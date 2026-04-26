import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { db } from "../../db";
import {
  tenants,
  users,
  processInstance,
  stepInstance,
  workflowTemplate,
  workflowStepTemplate,
  taskInstance,
} from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import { createTasksForStep } from "../create-tasks-for-step";

/**
 * Unit Tests: createTasksForStep Helper
 * Story: 2.2.8 - Workflow Execution Engine
 * Updated: Story 2.2.18 - Removed multi-approver tests
 * Updated: Story 2.2.19 - tx parameter threading, idempotency guards
 */

describe("createTasksForStep Helper", () => {
  let tenantId: string;
  let userId: string;
  let processId: string;
  let workflowTemplateId: string;

  beforeAll(async () => {
    const tenant = (
      await db
        .insert(tenants)
        .values({
          name: "Test Tenant",
          slug: `test-tenant-tasks-${Date.now()}`,
        })
        .returning()
    )[0]!;
    tenantId = tenant.id;

    ({ id: userId } = (
      await db
        .insert(users)
        .values({
          id: crypto.randomUUID(),
          tenantId,
          email: `user-tasks-${Date.now()}@test.com`,
          fullName: "Test User",
          role: "admin",
        })
        .returning()
    )[0]!);

    ({ id: processId } = (
      await db
        .insert(processInstance)
        .values({
          tenantId,
          processType: "supplier_qualification",
          entityType: "supplier",
          entityId: crypto.randomUUID(),
          status: "in_progress",
          initiatedBy: userId,
          initiatedDate: new Date(),
        })
        .returning()
    )[0]!);

    ({ id: workflowTemplateId } = (
      await db
        .insert(workflowTemplate)
        .values({
          tenantId,
          name: "Test Workflow",
          status: "draft",
          createdBy: userId,
        })
        .returning()
    )[0]!);
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  test("creates single task for step with role assignee", async () => {
    const step = (
      await db
        .insert(stepInstance)
        .values({
          tenantId,
          processInstanceId: processId,
          stepOrder: 1,
          stepName: "Submit Form",
          stepType: "form",
          status: "active",
        })
        .returning()
    )[0]!;

    const stepTemplate = (
      await db
        .insert(workflowStepTemplate)
        .values({
          tenantId,
          workflowTemplateId,
          stepOrder: 1,
          name: "Submit Form",
          stepType: "form",
          taskTitle: "Fill out supplier form",
          taskDescription: "Please complete the supplier information form",
          dueDays: 7,
          assigneeType: "role",
          assigneeRole: "procurement_manager",
        })
        .returning()
    )[0]!;

    const tasks = await createTasksForStep(
      db,
      step.id,
      stepTemplate.id,
      processId,
      tenantId
    );

    expect(tasks.length).toBe(1);
    expect(tasks[0]!.title).toBe("Fill out supplier form");
    expect(tasks[0]!.description).toBe(
      "Please complete the supplier information form"
    );
    expect(tasks[0]!.assigneeType).toBe("role");
    expect(tasks[0]!.assigneeRole).toBe("procurement_manager");
    expect(tasks[0]!.completionTimeDays).toBe(7);
    expect(tasks[0]!.dueAt).toBeDefined();

    await db
      .delete(taskInstance)
      .where(eq(taskInstance.stepInstanceId, step.id));
    await db
      .delete(workflowStepTemplate)
      .where(eq(workflowStepTemplate.id, stepTemplate.id));
    await db.delete(stepInstance).where(eq(stepInstance.id, step.id));
  });

  test("creates task with user assignee instead of role", async () => {
    const specificUser = (
      await db
        .insert(users)
        .values({
          id: crypto.randomUUID(),
          tenantId,
          email: `specific-user-${Date.now()}@test.com`,
          fullName: "Specific User",
          role: "viewer",
        })
        .returning()
    )[0]!;

    const step = (
      await db
        .insert(stepInstance)
        .values({
          tenantId,
          processInstanceId: processId,
          stepOrder: 3,
          stepName: "Upload Documents",
          stepType: "document",
          status: "active",
        })
        .returning()
    )[0]!;

    const stepTemplate = (
      await db
        .insert(workflowStepTemplate)
        .values({
          tenantId,
          workflowTemplateId,
          stepOrder: 3,
          name: "Upload Documents",
          stepType: "document",
          taskTitle: "Upload required documents",
          dueDays: 5,
          assigneeType: "user",
          assigneeUserId: specificUser.id,
        })
        .returning()
    )[0]!;

    const tasks = await createTasksForStep(
      db,
      step.id,
      stepTemplate.id,
      processId,
      tenantId
    );

    expect(tasks.length).toBe(1);
    expect(tasks[0]!.assigneeType).toBe("user");
    expect(tasks[0]!.assigneeUserId).toBe(specificUser.id);
    expect(tasks[0]!.assigneeRole).toBeNull();

    await db
      .delete(taskInstance)
      .where(eq(taskInstance.stepInstanceId, step.id));
    await db
      .delete(workflowStepTemplate)
      .where(eq(workflowStepTemplate.id, stepTemplate.id));
    await db.delete(stepInstance).where(eq(stepInstance.id, step.id));
    await db.delete(users).where(eq(users.id, specificUser.id));
  });

  test("calculates due date correctly based on dueDays", async () => {
    const beforeCreate = Date.now();

    const step = (
      await db
        .insert(stepInstance)
        .values({
          tenantId,
          processInstanceId: processId,
          stepOrder: 4,
          stepName: "Test Due Date",
          stepType: "form",
          status: "active",
        })
        .returning()
    )[0]!;

    const stepTemplate = (
      await db
        .insert(workflowStepTemplate)
        .values({
          tenantId,
          workflowTemplateId,
          stepOrder: 4,
          name: "Test Due Date",
          stepType: "form",
          taskTitle: "Test task",
          dueDays: 10,
          assigneeType: "role",
          assigneeRole: "admin",
        })
        .returning()
    )[0]!;

    const tasks = await createTasksForStep(
      db,
      step.id,
      stepTemplate.id,
      processId,
      tenantId
    );

    const afterCreate = Date.now();
    const expectedDueTime = beforeCreate + 10 * 24 * 60 * 60 * 1000;
    const taskDueTime = tasks[0]!.dueAt!.getTime();

    expect(tasks[0]!.dueAt).toBeDefined();
    expect(taskDueTime).toBeGreaterThanOrEqual(expectedDueTime);
    expect(taskDueTime).toBeLessThanOrEqual(
      afterCreate + 10 * 24 * 60 * 60 * 1000
    );

    await db
      .delete(taskInstance)
      .where(eq(taskInstance.stepInstanceId, step.id));
    await db
      .delete(workflowStepTemplate)
      .where(eq(workflowStepTemplate.id, stepTemplate.id));
    await db.delete(stepInstance).where(eq(stepInstance.id, step.id));
  });

  test("handles step with no due date (dueDays is null)", async () => {
    const step = (
      await db
        .insert(stepInstance)
        .values({
          tenantId,
          processInstanceId: processId,
          stepOrder: 5,
          stepName: "No Due Date",
          stepType: "form",
          status: "active",
        })
        .returning()
    )[0]!;

    const stepTemplate = (
      await db
        .insert(workflowStepTemplate)
        .values({
          tenantId,
          workflowTemplateId,
          stepOrder: 5,
          name: "No Due Date",
          stepType: "form",
          taskTitle: "Task without deadline",
          assigneeType: "role",
          assigneeRole: "admin",
        })
        .returning()
    )[0]!;

    const tasks = await createTasksForStep(
      db,
      step.id,
      stepTemplate.id,
      processId,
      tenantId
    );

    expect(tasks.length).toBe(1);
    expect(tasks[0]!.dueAt).toBeNull();
    expect(tasks[0]!.completionTimeDays).toBeNull();

    await db
      .delete(taskInstance)
      .where(eq(taskInstance.stepInstanceId, step.id));
    await db
      .delete(workflowStepTemplate)
      .where(eq(workflowStepTemplate.id, stepTemplate.id));
    await db.delete(stepInstance).where(eq(stepInstance.id, step.id));
  });

  test("throws error if step template not found", async () => {
    const step = (
      await db
        .insert(stepInstance)
        .values({
          tenantId,
          processInstanceId: processId,
          stepOrder: 99,
          stepName: "Error Test",
          stepType: "form",
          status: "active",
        })
        .returning()
    )[0]!;

    const fakeStepTemplateId = crypto.randomUUID();

    let error: Error | null = null;
    try {
      await createTasksForStep(
        db,
        step.id,
        fakeStepTemplateId,
        processId,
        tenantId
      );
    } catch (e) {
      error = e as Error;
    }

    expect(error).toBeDefined();
    expect(error?.message).toContain("Workflow step template not found");

    await db.delete(stepInstance).where(eq(stepInstance.id, step.id));
  });

  test("respects tenant isolation - cannot access other tenant's template", async () => {
    const otherTenant = (
      await db
        .insert(tenants)
        .values({
          name: "Other Tenant",
          slug: `other-tenant-${Date.now()}`,
        })
        .returning()
    )[0]!;

    const step = (
      await db
        .insert(stepInstance)
        .values({
          tenantId,
          processInstanceId: processId,
          stepOrder: 101,
          stepName: "Tenant Test",
          stepType: "form",
          status: "active",
        })
        .returning()
    )[0]!;

    const otherStepTemplate = (
      await db
        .insert(workflowStepTemplate)
        .values({
          tenantId: otherTenant.id,
          workflowTemplateId,
          stepOrder: 101,
          name: "Other Tenant Template",
          stepType: "form",
          taskTitle: "Task from other tenant",
          assigneeType: "role",
          assigneeRole: "admin",
        })
        .returning()
    )[0]!;

    let error: Error | null = null;
    try {
      await createTasksForStep(
        db,
        step.id,
        otherStepTemplate.id,
        processId,
        tenantId
      );
    } catch (e) {
      error = e as Error;
    }

    expect(error).toBeDefined();
    expect(error?.message).toContain("Workflow step template not found");

    await db.delete(stepInstance).where(eq(stepInstance.id, step.id));
    await db
      .delete(workflowStepTemplate)
      .where(eq(workflowStepTemplate.id, otherStepTemplate.id));
    await db.delete(tenants).where(eq(tenants.id, otherTenant.id));
  });

  test("idempotency: returns existing pending task instead of inserting duplicate", async () => {
    const step = (
      await db
        .insert(stepInstance)
        .values({
          tenantId,
          processInstanceId: processId,
          stepOrder: 200,
          stepName: "Idempotency Test",
          stepType: "form",
          status: "active",
        })
        .returning()
    )[0]!;

    const stepTemplate = (
      await db
        .insert(workflowStepTemplate)
        .values({
          tenantId,
          workflowTemplateId,
          stepOrder: 200,
          name: "Idempotency Test",
          stepType: "form",
          taskTitle: "Idempotent task",
          assigneeType: "role",
          assigneeRole: "admin",
        })
        .returning()
    )[0]!;

    // First call creates a task
    const tasks1 = await createTasksForStep(
      db,
      step.id,
      stepTemplate.id,
      processId,
      tenantId
    );
    expect(tasks1.length).toBe(1);

    // Second call should return existing task, not insert a duplicate
    const tasks2 = await createTasksForStep(
      db,
      step.id,
      stepTemplate.id,
      processId,
      tenantId
    );
    expect(tasks2.length).toBe(1);
    expect(tasks2[0]!.id).toBe(tasks1[0]!.id);

    // Verify only one task exists in DB
    const allTasks = await db
      .select()
      .from(taskInstance)
      .where(
        and(
          eq(taskInstance.stepInstanceId, step.id),
          eq(taskInstance.status, "pending"),
          isNull(taskInstance.deletedAt)
        )
      );
    expect(allTasks.length).toBe(1);

    await db
      .delete(taskInstance)
      .where(eq(taskInstance.stepInstanceId, step.id));
    await db
      .delete(workflowStepTemplate)
      .where(eq(workflowStepTemplate.id, stepTemplate.id));
    await db.delete(stepInstance).where(eq(stepInstance.id, step.id));
  });
});
