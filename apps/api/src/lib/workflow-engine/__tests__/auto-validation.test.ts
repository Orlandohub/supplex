import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { db } from "../../db";
import {
  tenants,
  users,
  workflowTemplate,
  workflowStepTemplate,
  processInstance,
  stepInstance,
  taskInstance,
} from "@supplex/db";
import { eq, and } from "drizzle-orm";
import { completeStep } from "../complete-step";
import { createValidationTasks } from "../create-validation-tasks";
import { approveValidationTask } from "../approve-validation-task";

import { insertOneOrThrow, selectFirstOrThrow } from "../../db-helpers";
/**
 * Integration Tests: Auto-Validation Task Creation
 * Story 2.2.15
 * Updated: Story 2.2.19 - tx threading, idempotency, concurrent approval
 */

describe("Auto-Validation Task Creation", () => {
  let tenant: { id: string };
  let user: { id: string };
  let template: { id: string };

  beforeAll(async () => {
    tenant = await insertOneOrThrow(db, tenants, {
      name: "Auto-Validation Test Tenant",
      slug: `auto-validation-tenant-${Date.now()}`,
    });

    user = await insertOneOrThrow(db, users, {
      id: crypto.randomUUID(),
      tenantId: tenant.id,
      email: `auto-validation-user-${Date.now()}@test.com`,
      fullName: "Auto Validation User",
      role: "admin",
    });

    template = await insertOneOrThrow(db, workflowTemplate, {
      tenantId: tenant.id,
      name: "Auto-Validation Test Template",
      status: "published",
      createdBy: user.id,
    });
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenant.id));
  });

  test("complete step with requiresValidation=true creates validation tasks", async () => {
    const step1 = await insertOneOrThrow(db, workflowStepTemplate, {
      workflowTemplateId: template.id,
      tenantId: tenant.id,
      stepOrder: 1,
      name: "Submit Form",
      stepType: "form",
      requiresValidation: true,
      validationConfig: {
        approverRoles: ["quality_manager", "procurement_manager"],
      },
    });

    await db.insert(workflowStepTemplate).values({
      workflowTemplateId: template.id,
      tenantId: tenant.id,
      stepOrder: 2,
      name: "Final Step",
      stepType: "approval",
    });

    const proc = await insertOneOrThrow(db, processInstance, {
      tenantId: tenant.id,
      workflowTemplateId: template.id,
      processType: "workflow_execution",
      entityType: "supplier",
      entityId: crypto.randomUUID(),
      status: "in_progress",
      initiatedBy: user.id,
      initiatedDate: new Date(),
    });

    const stepInst = await insertOneOrThrow(db, stepInstance, {
      tenantId: tenant.id,
      processInstanceId: proc.id,
      workflowStepTemplateId: step1.id,
      stepOrder: 1,
      stepName: "Submit Form",
      stepType: "form",
      status: "active",
    });

    const result = await completeStep(db, {
      tenantId: tenant.id,
      stepInstanceId: stepInst.id,
      completedBy: user.id,
      outcome: "completed",
    });

    expect(result.success).toBe(true);
    expect(result.data?.stepCompleted).toBe(true);
    expect(result.data?.nextStepActivated).toBe(false);
    expect(result.data?.awaitingValidation).toBe(true);

    const validationTasks = await db
      .select()
      .from(taskInstance)
      .where(
        and(
          eq(taskInstance.stepInstanceId, stepInst.id),
          eq(taskInstance.taskType, "validation")
        )
      );

    expect(validationTasks.length).toBe(2);
    expect(validationTasks.every((t) => t.assigneeType === "role")).toBe(true);
    expect(validationTasks.every((t) => t.status === "pending")).toBe(true);
    expect(
      validationTasks.some((t) => t.assigneeRole === "quality_manager")
    ).toBe(true);
    expect(
      validationTasks.some((t) => t.assigneeRole === "procurement_manager")
    ).toBe(true);

    const updatedStep = await selectFirstOrThrow(
      db.select().from(stepInstance).where(eq(stepInstance.id, stepInst.id))
    );

    expect(updatedStep.status).toBe("awaiting_validation");
  });

  test("validation tasks have correct assignee roles", async () => {
    const step = await insertOneOrThrow(db, workflowStepTemplate, {
      workflowTemplateId: template.id,
      tenantId: tenant.id,
      stepOrder: 10,
      name: "Document Upload",
      stepType: "document",
      requiresValidation: true,
      validationConfig: {
        approverRoles: ["admin", "quality_manager"],
      },
    });

    const proc = await insertOneOrThrow(db, processInstance, {
      tenantId: tenant.id,
      workflowTemplateId: template.id,
      processType: "workflow_execution",
      entityType: "supplier",
      entityId: crypto.randomUUID(),
      status: "in_progress",
      initiatedBy: user.id,
      initiatedDate: new Date(),
    });

    const stepInst = await insertOneOrThrow(db, stepInstance, {
      tenantId: tenant.id,
      processInstanceId: proc.id,
      workflowStepTemplateId: step.id,
      stepOrder: 10,
      stepName: "Document Upload",
      stepType: "document",
      status: "completed",
    });

    await createValidationTasks(db, {
      tenantId: tenant.id,
      stepInstanceId: stepInst.id,
      processInstanceId: proc.id,
      stepTemplate: step,
    });

    const tasks = await db
      .select()
      .from(taskInstance)
      .where(eq(taskInstance.stepInstanceId, stepInst.id));

    const roles = tasks.map((t) => t.assigneeRole).sort();
    expect(roles).toEqual(["admin", "quality_manager"]);
    expect(tasks.every((t) => t.title?.startsWith("Validate:"))).toBe(true);
  });

  test("validation tasks receive correct dueAt when validationDueDays is configured", async () => {
    const step = await insertOneOrThrow(db, workflowStepTemplate, {
      workflowTemplateId: template.id,
      tenantId: tenant.id,
      stepOrder: 25,
      name: "Validation Due Days Test",
      stepType: "form",
      requiresValidation: true,
      validationConfig: {
        approverRoles: ["quality_manager"],
        validationDueDays: 5,
      },
    });

    const proc = await insertOneOrThrow(db, processInstance, {
      tenantId: tenant.id,
      workflowTemplateId: template.id,
      processType: "workflow_execution",
      entityType: "supplier",
      entityId: crypto.randomUUID(),
      status: "in_progress",
      initiatedBy: user.id,
      initiatedDate: new Date(),
    });

    const stepInst = await insertOneOrThrow(db, stepInstance, {
      tenantId: tenant.id,
      processInstanceId: proc.id,
      workflowStepTemplateId: step.id,
      stepOrder: 25,
      stepName: "Validation Due Days Test",
      stepType: "form",
      status: "completed",
    });

    const beforeCreate = Date.now();

    await createValidationTasks(db, {
      tenantId: tenant.id,
      stepInstanceId: stepInst.id,
      processInstanceId: proc.id,
      stepTemplate: step,
    });

    const afterCreate = Date.now();

    const tasks = await db
      .select()
      .from(taskInstance)
      .where(eq(taskInstance.stepInstanceId, stepInst.id));

    expect(tasks.length).toBe(1);
    expect(tasks[0]!.dueAt).toBeDefined();
    expect(tasks[0]!.dueAt).not.toBeNull();
    expect(tasks[0]!.completionTimeDays).toBe(5);

    const expectedMinDue = beforeCreate + 5 * 24 * 60 * 60 * 1000;
    const expectedMaxDue = afterCreate + 5 * 24 * 60 * 60 * 1000;
    const taskDueTime = tasks[0]!.dueAt!.getTime();

    expect(taskDueTime).toBeGreaterThanOrEqual(expectedMinDue);
    expect(taskDueTime).toBeLessThanOrEqual(expectedMaxDue);
  });

  test("complete step with requiresValidation=false activates next step immediately", async () => {
    const step1 = await insertOneOrThrow(db, workflowStepTemplate, {
      workflowTemplateId: template.id,
      tenantId: tenant.id,
      stepOrder: 30,
      name: "No Validation Step",
      stepType: "form",
      requiresValidation: false,
    });

    await db.insert(workflowStepTemplate).values({
      workflowTemplateId: template.id,
      tenantId: tenant.id,
      stepOrder: 31,
      name: "Next Step",
      stepType: "approval",
    });

    const proc = await insertOneOrThrow(db, processInstance, {
      tenantId: tenant.id,
      workflowTemplateId: template.id,
      processType: "workflow_execution",
      entityType: "supplier",
      entityId: crypto.randomUUID(),
      status: "in_progress",
      initiatedBy: user.id,
      initiatedDate: new Date(),
    });

    const stepInst = await insertOneOrThrow(db, stepInstance, {
      tenantId: tenant.id,
      processInstanceId: proc.id,
      workflowStepTemplateId: step1.id,
      stepOrder: 30,
      stepName: "No Validation Step",
      stepType: "form",
      status: "active",
    });

    const result = await completeStep(db, {
      tenantId: tenant.id,
      stepInstanceId: stepInst.id,
      completedBy: user.id,
      outcome: "completed",
    });

    expect(result.success).toBe(true);
    expect(result.data?.nextStepActivated).toBe(true);

    const tasks = await db
      .select()
      .from(taskInstance)
      .where(
        and(
          eq(taskInstance.stepInstanceId, stepInst.id),
          eq(taskInstance.taskType, "validation")
        )
      );

    expect(tasks.length).toBe(0);
  });

  test("role-aware idempotency: calling createValidationTasks twice skips existing roles", async () => {
    const step = await insertOneOrThrow(db, workflowStepTemplate, {
      workflowTemplateId: template.id,
      tenantId: tenant.id,
      stepOrder: 40,
      name: "Idempotency Validation Test",
      stepType: "form",
      requiresValidation: true,
      validationConfig: {
        approverRoles: ["quality_manager", "admin"],
      },
    });

    const proc = await insertOneOrThrow(db, processInstance, {
      tenantId: tenant.id,
      workflowTemplateId: template.id,
      processType: "workflow_execution",
      entityType: "supplier",
      entityId: crypto.randomUUID(),
      status: "in_progress",
      initiatedBy: user.id,
      initiatedDate: new Date(),
    });

    const stepInst = await insertOneOrThrow(db, stepInstance, {
      tenantId: tenant.id,
      processInstanceId: proc.id,
      workflowStepTemplateId: step.id,
      stepOrder: 40,
      stepName: "Idempotency Validation Test",
      stepType: "form",
      status: "completed",
    });

    // First call creates 2 validation tasks
    await createValidationTasks(db, {
      tenantId: tenant.id,
      stepInstanceId: stepInst.id,
      processInstanceId: proc.id,
      stepTemplate: step,
    });

    const tasksAfterFirst = await db
      .select()
      .from(taskInstance)
      .where(
        and(
          eq(taskInstance.stepInstanceId, stepInst.id),
          eq(taskInstance.taskType, "validation")
        )
      );
    expect(tasksAfterFirst.length).toBe(2);

    // Second call should not create duplicates
    await createValidationTasks(db, {
      tenantId: tenant.id,
      stepInstanceId: stepInst.id,
      processInstanceId: proc.id,
      stepTemplate: step,
    });

    const tasksAfterSecond = await db
      .select()
      .from(taskInstance)
      .where(
        and(
          eq(taskInstance.stepInstanceId, stepInst.id),
          eq(taskInstance.taskType, "validation")
        )
      );
    expect(tasksAfterSecond.length).toBe(2);
  });

  test("concurrent approval: only one triggers transition when all validations complete", async () => {
    const step1 = await insertOneOrThrow(db, workflowStepTemplate, {
      workflowTemplateId: template.id,
      tenantId: tenant.id,
      stepOrder: 50,
      name: "Concurrent Approval Step",
      stepType: "form",
      requiresValidation: true,
      validationConfig: {
        approverRoles: ["quality_manager", "admin"],
      },
      taskTitle: "Fill form",
      assigneeType: "role",
      assigneeRole: "procurement_manager",
    });

    const step2 = await insertOneOrThrow(db, workflowStepTemplate, {
      workflowTemplateId: template.id,
      tenantId: tenant.id,
      stepOrder: 51,
      name: "After Concurrent Test",
      stepType: "form",
      taskTitle: "Next task",
      assigneeType: "role",
      assigneeRole: "admin",
    });

    const proc = await insertOneOrThrow(db, processInstance, {
      tenantId: tenant.id,
      workflowTemplateId: template.id,
      processType: "workflow_execution",
      entityType: "supplier",
      entityId: crypto.randomUUID(),
      status: "in_progress",
      initiatedBy: user.id,
      initiatedDate: new Date(),
    });

    const stepInst1 = await insertOneOrThrow(db, stepInstance, {
      tenantId: tenant.id,
      processInstanceId: proc.id,
      workflowStepTemplateId: step1.id,
      stepOrder: 50,
      stepName: "Concurrent Approval Step",
      stepType: "form",
      status: "awaiting_validation",
    });

    await db.insert(stepInstance).values({
      tenantId: tenant.id,
      processInstanceId: proc.id,
      workflowStepTemplateId: step2.id,
      stepOrder: 51,
      stepName: "After Concurrent Test",
      stepType: "form",
      status: "blocked",
    });

    // Create 2 validation tasks manually (one per role)
    const task1 = await insertOneOrThrow(db, taskInstance, {
      tenantId: tenant.id,
      processInstanceId: proc.id,
      stepInstanceId: stepInst1.id,
      assigneeType: "role",
      assigneeRole: "quality_manager",
      title: "Validate: Concurrent",
      taskType: "validation",
      status: "pending",
      metadata: {},
    });

    const task2 = await insertOneOrThrow(db, taskInstance, {
      tenantId: tenant.id,
      processInstanceId: proc.id,
      stepInstanceId: stepInst1.id,
      assigneeType: "role",
      assigneeRole: "admin",
      title: "Validate: Concurrent",
      taskType: "validation",
      status: "pending",
      metadata: {},
    });

    // First approval — should not trigger transition yet (one pending remaining)
    const result1 = await approveValidationTask(db, {
      tenantId: tenant.id,
      taskInstanceId: task1.id,
      userId: user.id,
    });

    expect(result1.success).toBe(true);
    expect(result1.allValidationsComplete).toBe(false);
    expect(result1.remainingApprovals).toBe(1);
    expect(result1.nextStepActivated).toBe(false);

    // Second approval — should trigger transition (last pending task)
    const result2 = await approveValidationTask(db, {
      tenantId: tenant.id,
      taskInstanceId: task2.id,
      userId: user.id,
    });

    expect(result2.success).toBe(true);
    expect(result2.allValidationsComplete).toBe(true);
    expect(result2.nextStepActivated).toBe(true);

    // Verify step status transitioned to validated
    const finalStep = await selectFirstOrThrow(
      db.select().from(stepInstance).where(eq(stepInstance.id, stepInst1.id))
    );
    expect(finalStep.status).toBe("validated");
  });

  test("approveValidationTask CAS rejects already-processed task", async () => {
    const step = await insertOneOrThrow(db, workflowStepTemplate, {
      workflowTemplateId: template.id,
      tenantId: tenant.id,
      stepOrder: 60,
      name: "CAS Reject Test",
      stepType: "form",
      requiresValidation: true,
      validationConfig: {
        approverRoles: ["admin"],
      },
    });

    const proc = await insertOneOrThrow(db, processInstance, {
      tenantId: tenant.id,
      workflowTemplateId: template.id,
      processType: "workflow_execution",
      entityType: "supplier",
      entityId: crypto.randomUUID(),
      status: "in_progress",
      initiatedBy: user.id,
      initiatedDate: new Date(),
    });

    const stepInst = await insertOneOrThrow(db, stepInstance, {
      tenantId: tenant.id,
      processInstanceId: proc.id,
      workflowStepTemplateId: step.id,
      stepOrder: 60,
      stepName: "CAS Reject Test",
      stepType: "form",
      status: "awaiting_validation",
    });

    // Create a task that's already completed (simulating another request processed it first)
    const task = await insertOneOrThrow(db, taskInstance, {
      tenantId: tenant.id,
      processInstanceId: proc.id,
      stepInstanceId: stepInst.id,
      assigneeType: "role",
      assigneeRole: "admin",
      title: "Validate: CAS Test",
      taskType: "validation",
      status: "completed",
      completedBy: user.id,
      completedAt: new Date(),
      metadata: {},
    });

    // Attempt to approve already-completed task — CAS should reject
    const result = await approveValidationTask(db, {
      tenantId: tenant.id,
      taskInstanceId: task.id,
      userId: user.id,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Task already processed");
  });
});
