/**
 * Task Creation Helper for Workflow Engine
 * Story: 2.2.8 - Workflow Execution Engine
 * Updated: Story 2.2.10 - Supplier User Auto-Assignment
 * Updated: Story 2.2.19 - Transaction threading, idempotency guards
 *
 * Creates task instances when a workflow step becomes active
 */

import type { DbOrTx } from "@supplex/db";
import {
  taskInstance,
  workflowStepTemplate,
  processInstance,
  users,
  suppliers,
} from "@supplex/db";
import { eq, and, isNull, sql, aliasedTable } from "drizzle-orm";
import type { Logger } from "pino";
import defaultLogger from "../logger";

async function resolveSupplierUser(
  tx: DbOrTx,
  processInstanceId: string,
  tenantId: string,
  taskLog: Logger
): Promise<string | null> {
  const supplierUser = aliasedTable(users, "supplier_user");

  const [result] = await tx
    .select({
      entityType: processInstance.entityType,
      entityId: processInstance.entityId,
      initiatedBy: processInstance.initiatedBy,
      supplierUserId: supplierUser.id,
      pmId: sql<string | null>`(
        SELECT id FROM users
        WHERE tenant_id = ${tenantId}
          AND role = 'procurement_manager'
          AND is_active = true
        LIMIT 1
      )`,
    })
    .from(processInstance)
    .leftJoin(
      suppliers,
      and(
        eq(suppliers.id, processInstance.entityId),
        eq(suppliers.tenantId, tenantId),
        isNull(suppliers.deletedAt)
      )
    )
    .leftJoin(
      supplierUser,
      and(
        eq(supplierUser.id, suppliers.supplierUserId),
        eq(supplierUser.role, "supplier_user"),
        eq(supplierUser.isActive, true)
      )
    )
    .where(
      and(
        eq(processInstance.id, processInstanceId),
        eq(processInstance.tenantId, tenantId)
      )
    );

  if (!result) {
    taskLog.error({ processInstanceId }, "process instance not found");
    return null;
  }

  if (result.entityType === "supplier" && result.supplierUserId) {
    taskLog.info(
      { assignee: result.supplierUserId },
      "assigned to supplier user"
    );
    return result.supplierUserId;
  }

  if (result.pmId) {
    taskLog.info(
      { assignee: result.pmId },
      "assigned to procurement manager (fallback)"
    );
    return result.pmId;
  }

  taskLog.warn(
    { tenantId },
    "no procurement manager found, using process initiator as last resort"
  );
  return result.initiatedBy;
}

export async function createTasksForStep(
  tx: DbOrTx,
  stepInstanceId: string,
  workflowStepTemplateId: string,
  processInstanceId: string,
  tenantId: string,
  options?: { isResubmission?: boolean },
  log?: Logger
): Promise<(typeof taskInstance.$inferSelect)[]> {
  const taskLog = (log || defaultLogger).child({
    action: "createTasksForStep",
    tenantId,
    stepId: stepInstanceId,
  });
  const [stepTemplate] = await tx
    .select()
    .from(workflowStepTemplate)
    .where(
      and(
        eq(workflowStepTemplate.id, workflowStepTemplateId),
        eq(workflowStepTemplate.tenantId, tenantId)
      )
    );

  if (!stepTemplate) {
    throw new Error(
      `Workflow step template not found: ${workflowStepTemplateId}`
    );
  }

  // Idempotency guard: check for existing pending tasks before inserting
  const taskType = options?.isResubmission ? "resubmission" : "action";
  const existingTasks = await tx
    .select()
    .from(taskInstance)
    .where(
      and(
        eq(taskInstance.stepInstanceId, stepInstanceId),
        eq(taskInstance.taskType, taskType),
        eq(taskInstance.status, "pending"),
        isNull(taskInstance.deletedAt)
      )
    );

  if (existingTasks.length > 0) {
    taskLog.warn(
      { existingCount: existingTasks.length, taskType },
      "idempotency: existing pending tasks found, skipping insert"
    );
    return existingTasks;
  }

  const dueAt = stepTemplate.dueDays
    ? new Date(Date.now() + stepTemplate.dueDays * 24 * 60 * 60 * 1000)
    : null;

  let assigneeUserId = stepTemplate.assigneeUserId || undefined;
  let assigneeType = stepTemplate.assigneeType;
  let assigneeRole = stepTemplate.assigneeRole || undefined;

  if (stepTemplate.assigneeRole === "supplier_user") {
    const resolvedUserId = await resolveSupplierUser(
      tx,
      processInstanceId,
      tenantId,
      taskLog
    );
    if (resolvedUserId) {
      assigneeUserId = resolvedUserId;
      assigneeType = "user";
      assigneeRole = undefined;
    }
  }

  const [task] = await tx
    .insert(taskInstance)
    .values({
      tenantId,
      processInstanceId,
      stepInstanceId,
      title: stepTemplate.taskTitle,
      description: stepTemplate.taskDescription || undefined,
      assigneeType,
      assigneeRole,
      assigneeUserId,
      completionTimeDays: stepTemplate.dueDays || undefined,
      dueAt: dueAt,
      taskType,
      status: "pending" as const,
    } as any)
    .onConflictDoNothing()
    .returning();

  if (!task) {
    taskLog.warn("onConflictDoNothing: task already exists for step");
    const existing = await tx
      .select()
      .from(taskInstance)
      .where(
        and(
          eq(taskInstance.stepInstanceId, stepInstanceId),
          eq(taskInstance.taskType, taskType),
          eq(taskInstance.status, "pending"),
          isNull(taskInstance.deletedAt)
        )
      );
    return existing;
  }

  return [task];
}
