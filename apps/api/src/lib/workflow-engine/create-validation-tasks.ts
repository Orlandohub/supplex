/**
 * Create Validation Tasks Helper
 * Story: 2.2.15 - Auto-Validation Task Creation
 * Updated: Story 2.2.19 - Transaction threading, idempotency guards
 * 
 * Automatically creates validation tasks when a step with requiresValidation=true completes
 */

import type { DbOrTx } from "@supplex/db";
import { taskInstance } from "@supplex/db";
import type { SelectWorkflowStepTemplate } from "@supplex/db";
import type { ValidationConfig } from "@supplex/types";
import { eq, and, isNull } from "drizzle-orm";
import type { Logger } from "pino";
import defaultLogger from "../logger";

interface CreateValidationTasksParams {
  tenantId: string;
  stepInstanceId: string;
  processInstanceId: string;
  stepTemplate: SelectWorkflowStepTemplate;
  validationRound?: number;
}

export async function createValidationTasks(
  tx: DbOrTx,
  params: CreateValidationTasksParams,
  log?: Logger
): Promise<void> {
  const { tenantId, stepInstanceId, processInstanceId, stepTemplate, validationRound } = params;
  const valLog = (log || defaultLogger).child({ action: "createValidationTasks", tenantId, stepId: stepInstanceId });

  const validationConfig = stepTemplate.validationConfig as ValidationConfig;

  if (!validationConfig?.approverRoles || validationConfig.approverRoles.length === 0) {
    valLog.warn({ stepName: stepTemplate.name }, "requiresValidation=true but no approverRoles configured");
    return;
  }

  const eligibleRoles = validationConfig.approverRoles.filter(
    (role) => role !== "supplier_user"
  );

  if (eligibleRoles.length === 0) {
    valLog.warn({ stepName: stepTemplate.name }, "no eligible validation roles after filtering");
    return;
  }

  const validationDueDays = validationConfig.validationDueDays;
  const dueAt = validationDueDays
    ? new Date(Date.now() + validationDueDays * 24 * 60 * 60 * 1000)
    : null;

  valLog.info({ stepName: stepTemplate.name, approverRoles: eligibleRoles, dueAt }, "creating validation tasks");

  // Idempotency guard: check for any existing pending validation tasks for this step
  const existingTasks = await tx
    .select({ id: taskInstance.id, assigneeRole: taskInstance.assigneeRole })
    .from(taskInstance)
    .where(
      and(
        eq(taskInstance.stepInstanceId, stepInstanceId),
        eq(taskInstance.taskType, "validation"),
        eq(taskInstance.status, "pending"),
        isNull(taskInstance.deletedAt)
      )
    );

  const existingRoles = new Set(existingTasks.map((t) => t.assigneeRole));
  const rolesToInsert = eligibleRoles.filter((role) => !existingRoles.has(role));

  if (existingTasks.length > 0) {
    valLog.warn({ existingCount: existingTasks.length, existingRoles: [...existingRoles] }, "idempotency: some pending validation tasks already exist");
  }

  if (rolesToInsert.length === 0) {
    valLog.info("all validation tasks already exist, skipping batch insert");
    return;
  }

  const now = new Date();
  await tx.insert(taskInstance).values(
    rolesToInsert.map((role) => ({
      tenantId,
      processInstanceId,
      stepInstanceId,
      assigneeType: "role" as const,
      assigneeRole: role,
      assigneeUserId: null,
      title: `Validate: ${stepTemplate.name}`,
      description: `Review and approve or decline this step. ${stepTemplate.taskDescription || ""}`.trim(),
      taskType: "validation" as const,
      status: "pending" as const,
      validationRound: validationRound ?? null,
      completionTimeDays: validationDueDays || undefined,
      dueAt,
      metadata: {},
      createdAt: now,
      updatedAt: now,
    }))
  );

  valLog.info({ roleCount: rolesToInsert.length }, "batch validation task creation complete");
}
