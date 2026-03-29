/**
 * Task Creation Helper for Workflow Engine
 * Story: 2.2.8 - Workflow Execution Engine
 * Updated: Story 2.2.10 - Supplier User Auto-Assignment
 * 
 * Creates task instances when a workflow step becomes active
 */

import { db } from "../db";
import { taskInstance, workflowStepTemplate, stepApprover, processInstance, users, suppliers } from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";

/**
 * Resolve supplier user for auto-assignment
 * 
 * Resolution hierarchy:
 * 1. Find supplier user for the supplier (supplier_id = entity_id, role = 'supplier_user')
 * 2. If not found, fall back to procurement manager of the tenant
 * 3. If no procurement manager, fall back to process initiator (last resort)
 * 
 * @param processInstanceId - UUID of the process instance
 * @param tenantId - Tenant ID for isolation
 * @returns Resolved user ID or null
 */
async function resolveSupplierUser(
  processInstanceId: string,
  tenantId: string
): Promise<string | null> {
  // Get process instance to find entity_type and entity_id
  const [process] = await db
    .select()
    .from(processInstance)
    .where(
      and(
        eq(processInstance.id, processInstanceId),
        eq(processInstance.tenantId, tenantId)
      )
    );

  if (!process) {
    console.error(`Process instance not found: ${processInstanceId}`);
    return null;
  }

  // Verify entity_type is 'supplier'
  if (process.entityType !== "supplier") {
    console.log(
      `Non-supplier workflow (entity_type: ${process.entityType}). Falling back to procurement manager.`
    );
    // Fallback to procurement manager
    const [procurementManager] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.tenantId, tenantId),
          eq(users.role, "procurement_manager"),
          eq(users.isActive, true)
        )
      )
      .limit(1);

    if (procurementManager) {
      console.log(
        `Assigned to procurement manager (non-supplier workflow): ${procurementManager.email}`
      );
      return procurementManager.id;
    }

    // Last resort: Use process initiator
    console.log(
      `No procurement manager found, using process initiator: ${process.initiatedBy}`
    );
    return process.initiatedBy;
  }

  // Query the supplier record to get the supplier_user_id
  const [supplier] = await db
    .select()
    .from(suppliers)
    .where(
      and(
        eq(suppliers.id, process.entityId),
        eq(suppliers.tenantId, tenantId),
        isNull(suppliers.deletedAt)
      )
    )
    .limit(1);

  if (!supplier) {
    console.error(
      `Supplier not found: ${process.entityId}. Falling back to procurement manager.`
    );
    // Fallback to procurement manager
    const [procurementManager] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.tenantId, tenantId),
          eq(users.role, "procurement_manager"),
          eq(users.isActive, true)
        )
      )
      .limit(1);

    if (procurementManager) {
      console.log(
        `Assigned to procurement manager (supplier not found): ${procurementManager.email}`
      );
      return procurementManager.id;
    }

    return process.initiatedBy;
  }

  // Check if supplier has an associated supplier user
  if (supplier.supplierUserId) {
    // Verify the supplier user exists and is active
    const [supplierUser] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.id, supplier.supplierUserId),
          eq(users.tenantId, tenantId),
          eq(users.role, "supplier_user"),
          eq(users.isActive, true)
        )
      )
      .limit(1);

    if (supplierUser) {
      console.log(
        `Assigned to supplier user: ${supplierUser.email} for supplier: ${supplier.name}`
      );
      return supplierUser.id;
    } else {
      console.warn(
        `Supplier user ID ${supplier.supplierUserId} is set but user not found or inactive. Falling back to procurement manager.`
      );
    }
  } else {
    console.log(
      `No supplier user associated with supplier ${supplier.name} (${supplier.id}). Falling back to procurement manager.`
    );
  }

  // Fallback to procurement manager
  const [procurementManager] = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.tenantId, tenantId),
        eq(users.role, "procurement_manager"),
        eq(users.isActive, true)
      )
    )
    .limit(1);

  if (procurementManager) {
    console.log(
      `Assigning to procurement manager (fallback): ${procurementManager.email}`
    );
    return procurementManager.id;
  }

  // Last resort: Use process initiator
  console.error(
    `No procurement manager found for tenant ${tenantId}. Using process initiator as last resort.`
  );
  return process.initiatedBy;
}

/**
 * Create task instances for a workflow step
 * 
 * Based on multi_approver configuration:
 * - If false: Creates single task with assignee from step template
 * - If true: Creates one task per approver from step_approver table
 * 
 * @param stepInstanceId - UUID of the step instance
 * @param workflowStepTemplateId - UUID of the workflow step template
 * @param processInstanceId - UUID of the process instance (for task relationship)
 * @param tenantId - Tenant ID for isolation
 * @returns Array of created task instances
 */
export async function createTasksForStep(
  stepInstanceId: string,
  workflowStepTemplateId: string,
  processInstanceId: string,
  tenantId: string,
  options?: { isResubmission?: boolean }
): Promise<typeof taskInstance.$inferSelect[]> {
  // Get the workflow step template configuration
  const [stepTemplate] = await db
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

  const tasks: typeof taskInstance.$inferSelect[] = [];

  // Check if multi-approver is enabled
  if (stepTemplate.multiApprover) {
    // Multi-approver: Create one task per approver
    const approvers = await db
      .select()
      .from(stepApprover)
      .where(
        and(
          eq(stepApprover.workflowStepTemplateId, workflowStepTemplateId),
          eq(stepApprover.tenantId, tenantId)
        )
      )
      .orderBy(stepApprover.approverOrder);

    if (approvers.length === 0) {
      throw new Error(
        `No approvers found for multi-approver step: ${workflowStepTemplateId}`
      );
    }

    // Create one task for each approver
    for (const approver of approvers) {
      const dueAt = stepTemplate.dueDays
        ? new Date(Date.now() + stepTemplate.dueDays * 24 * 60 * 60 * 1000)
        : null;

      // Handle supplier_user role auto-assignment
      let assigneeUserId = approver.approverUserId || undefined;
      let assigneeType = approver.approverType;
      let assigneeRole = approver.approverRole || undefined;

      if (approver.approverRole === "supplier_user") {
        const resolvedUserId = await resolveSupplierUser(processInstanceId, tenantId);
        if (resolvedUserId) {
          assigneeUserId = resolvedUserId;
          assigneeType = "user";
          assigneeRole = undefined;
        }
      }

      const [task] = await db
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
          taskType: options?.isResubmission ? "resubmission" : "action",
          status: "pending",
        })
        .returning();

      tasks.push(task);
    }
  } else {
    // Single approver: Create one task with assignee from step template
    const dueAt = stepTemplate.dueDays
      ? new Date(Date.now() + stepTemplate.dueDays * 24 * 60 * 60 * 1000)
      : null;

    // Handle supplier_user role auto-assignment
    let assigneeUserId = stepTemplate.assigneeUserId || undefined;
    let assigneeType = stepTemplate.assigneeType;
    let assigneeRole = stepTemplate.assigneeRole || undefined;

    if (stepTemplate.assigneeRole === "supplier_user") {
      const resolvedUserId = await resolveSupplierUser(processInstanceId, tenantId);
      if (resolvedUserId) {
        assigneeUserId = resolvedUserId;
        assigneeType = "user";
        assigneeRole = undefined;
      }
    }

    const [task] = await db
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
        taskType: options?.isResubmission ? "resubmission" : "action",
        status: "pending",
      })
      .returning();

    tasks.push(task);
  }

  return tasks;
}

