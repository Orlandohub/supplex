/**
 * Create Validation Tasks Helper
 * Story: 2.2.15 - Auto-Validation Task Creation
 * 
 * Automatically creates validation tasks when a step with requiresValidation=true completes
 */

import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { taskInstance } from "@supplex/db";
import type { SelectWorkflowStepTemplate } from "@supplex/db";
import type { ValidationConfig } from "@supplex/types";

interface CreateValidationTasksParams {
  tenantId: string;
  stepInstanceId: string;
  processInstanceId: string;
  stepTemplate: SelectWorkflowStepTemplate;
}

export async function createValidationTasks(
  db: NodePgDatabase<any>,
  params: CreateValidationTasksParams
): Promise<void> {
  const { tenantId, stepInstanceId, processInstanceId, stepTemplate } = params;

  // Parse validation config
  const validationConfig = stepTemplate.validationConfig as ValidationConfig;

  if (!validationConfig?.approverRoles || validationConfig.approverRoles.length === 0) {
    console.warn(`[Validation] Step ${stepTemplate.name} has requiresValidation=true but no approverRoles configured`);
    return;
  }

  // Filter out supplier_user -- they cannot validate workflow steps
  const eligibleRoles = validationConfig.approverRoles.filter(
    (role) => role !== "supplier_user"
  );

  if (eligibleRoles.length === 0) {
    console.warn(`[Validation] Step ${stepTemplate.name} has no eligible validation roles after filtering`);
    return;
  }

  console.log(`[Validation] Creating validation tasks for step: ${stepTemplate.name}, approvers: ${eligibleRoles.join(", ")}`);

  for (const role of eligibleRoles) {
    await db.insert(taskInstance).values({
      tenantId,
      processInstanceId,
      stepInstanceId,
      assigneeType: "role",
      assigneeRole: role,
      assigneeUserId: null,
      title: `Validate: ${stepTemplate.name}`,
      description: `Review and approve or decline this step. ${stepTemplate.taskDescription || ""}`.trim(),
      taskType: "validation",
      status: "pending",
      dueAt: null,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log(`[Validation] Created validation task for role: ${role}`);
  }

  console.log(`[Validation] Successfully created ${eligibleRoles.length} validation task(s)`);
}
