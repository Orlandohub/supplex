import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { db } from "../../db";
import {
  tenants,
  users,
  processInstance,
  stepInstance,
  workflowTemplate,
  workflowTemplateVersion,
  workflowStepTemplate,
  stepApprover,
  taskInstance,
} from "@supplex/db";
import { eq } from "drizzle-orm";
import { createTasksForStep } from "../create-tasks-for-step";

/**
 * Unit Tests: createTasksForStep Helper
 * Story: 2.2.8 - Workflow Execution Engine
 *
 * Tests task creation logic for single and multi-approver steps
 */

describe("createTasksForStep Helper", () => {
  let tenantId: string;
  let userId: string;
  let processId: string;
  let workflowTemplateId: string;
  let workflowVersionId: string;

  beforeAll(async () => {
    // Create test tenant
    const [tenant] = await db
      .insert(tenants)
      .values({
        name: "Test Tenant",
        slug: `test-tenant-tasks-${Date.now()}`,
      })
      .returning();
    tenantId = tenant.id;

    // Create test user
    [{ id: userId }] = await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        tenantId,
        email: `user-tasks-${Date.now()}@test.com`,
        fullName: "Test User",
        role: "admin",
      })
      .returning();

    // Create test process
    [{ id: processId }] = await db
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
      .returning();

    // Create workflow template
    [{ id: workflowTemplateId }] = await db
      .insert(workflowTemplate)
      .values({
        tenantId,
        name: "Test Workflow",
        status: "draft",
        createdBy: userId,
      })
      .returning();

    // Create workflow template version for testing
    [{ id: workflowVersionId }] = await db
      .insert(workflowTemplateVersion)
      .values({
        tenantId,
        workflowTemplateId,
        version: 1,
        status: "published",
        isPublished: true,
      })
      .returning();
  });

  afterAll(async () => {
    // Clean up
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  test("creates single task for single-approver step", async () => {
    // Create step instance
    const [step] = await db
      .insert(stepInstance)
      .values({
        tenantId,
        processInstanceId: processId,
        stepOrder: 1,
        stepName: "Submit Form",
        stepType: "form",
        status: "active",
      })
      .returning();

    // Create workflow step template (single approver)
    const [stepTemplate] = await db
      .insert(workflowStepTemplate)
      .values({
        tenantId,
        workflowTemplateVersionId: workflowVersionId,
        stepOrder: 1,
        name: "Submit Form",
        stepType: "form",
        taskTitle: "Fill out supplier form",
        taskDescription: "Please complete the supplier information form",
        dueDays: 7,
        assigneeType: "role",
        assigneeRole: "procurement_manager",
        multiApprover: false,
      })
      .returning();

    // Call helper function
    const tasks = await createTasksForStep(
      step.id,
      stepTemplate.id,
      processId,
      tenantId
    );

    // Assertions
    expect(tasks.length).toBe(1);
    expect(tasks[0].title).toBe("Fill out supplier form");
    expect(tasks[0].description).toBe(
      "Please complete the supplier information form"
    );
    expect(tasks[0].assigneeType).toBe("role");
    expect(tasks[0].assigneeRole).toBe("procurement_manager");
    expect(tasks[0].completionTimeDays).toBe(7);
    expect(tasks[0].status).toBe("open");
    expect(tasks[0].dueAt).toBeDefined();

    // Clean up
    await db.delete(taskInstance).where(eq(taskInstance.stepInstanceId, step.id));
    await db.delete(workflowStepTemplate).where(eq(workflowStepTemplate.id, stepTemplate.id));
    await db.delete(stepInstance).where(eq(stepInstance.id, step.id));
  });

  test("creates multiple tasks for multi-approver step", async () => {
    // Create step instance
    const [step] = await db
      .insert(stepInstance)
      .values({
        tenantId,
        processInstanceId: processId,
        stepOrder: 2,
        stepName: "Approve Form",
        stepType: "approval",
        status: "active",
      })
      .returning();

    // Create workflow step template (multi approver)
    const [stepTemplate] = await db
      .insert(workflowStepTemplate)
      .values({
        tenantId,
        workflowTemplateVersionId: workflowVersionId,
        stepOrder: 2,
        name: "Approve Form",
        stepType: "approval",
        taskTitle: "Review supplier form",
        taskDescription: "Review and approve the supplier information",
        dueDays: 3,
        assigneeType: "role", // This will be overridden by approvers
        multiApprover: true,
        approverCount: 2,
      })
      .returning();

    // Create approvers
    await db.insert(stepApprover).values([
      {
        tenantId,
        workflowStepTemplateId: stepTemplate.id,
        approverOrder: 1,
        approverType: "role",
        approverRole: "quality_manager",
      },
      {
        tenantId,
        workflowStepTemplateId: stepTemplate.id,
        approverOrder: 2,
        approverType: "role",
        approverRole: "procurement_manager",
      },
    ]);

    // Call helper function
    const tasks = await createTasksForStep(
      step.id,
      stepTemplate.id,
      processId,
      tenantId
    );

    // Assertions
    expect(tasks.length).toBe(2);

    // First approver task
    expect(tasks[0].title).toBe("Review supplier form");
    expect(tasks[0].assigneeType).toBe("role");
    expect(tasks[0].assigneeRole).toBe("quality_manager");
    expect(tasks[0].status).toBe("open");

    // Second approver task
    expect(tasks[1].title).toBe("Review supplier form");
    expect(tasks[1].assigneeType).toBe("role");
    expect(tasks[1].assigneeRole).toBe("procurement_manager");
    expect(tasks[1].status).toBe("open");

    // Clean up
    await db.delete(taskInstance).where(eq(taskInstance.stepInstanceId, step.id));
    await db.delete(stepApprover).where(eq(stepApprover.workflowStepTemplateId, stepTemplate.id));
    await db.delete(workflowStepTemplate).where(eq(workflowStepTemplate.id, stepTemplate.id));
    await db.delete(stepInstance).where(eq(stepInstance.id, step.id));
  });

  test("creates task with user assignee instead of role", async () => {
    // Create another user for specific assignment
    const [specificUser] = await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        tenantId,
        email: `specific-user-${Date.now()}@test.com`,
        fullName: "Specific User",
        role: "viewer",
      })
      .returning();

    // Create step instance
    const [step] = await db
      .insert(stepInstance)
      .values({
        tenantId,
        processInstanceId: processId,
        stepOrder: 3,
        stepName: "Upload Documents",
        stepType: "document",
        status: "active",
      })
      .returning();

    // Create workflow step template (user assignee)
    const [stepTemplate] = await db
      .insert(workflowStepTemplate)
      .values({
        tenantId,
        workflowTemplateVersionId: workflowVersionId,
        stepOrder: 3,
        name: "Upload Documents",
        stepType: "document",
        taskTitle: "Upload required documents",
        dueDays: 5,
        assigneeType: "user",
        assigneeUserId: specificUser.id,
        multiApprover: false,
      })
      .returning();

    // Call helper function
    const tasks = await createTasksForStep(
      step.id,
      stepTemplate.id,
      processId,
      tenantId
    );

    // Assertions
    expect(tasks.length).toBe(1);
    expect(tasks[0].assigneeType).toBe("user");
    expect(tasks[0].assigneeUserId).toBe(specificUser.id);
    expect(tasks[0].assigneeRole).toBeNull();

    // Clean up
    await db.delete(taskInstance).where(eq(taskInstance.stepInstanceId, step.id));
    await db.delete(workflowStepTemplate).where(eq(workflowStepTemplate.id, stepTemplate.id));
    await db.delete(stepInstance).where(eq(stepInstance.id, step.id));
    await db.delete(users).where(eq(users.id, specificUser.id));
  });

  test("calculates due date correctly based on dueDays", async () => {
    const beforeCreate = Date.now();

    // Create step instance
    const [step] = await db
      .insert(stepInstance)
      .values({
        tenantId,
        processInstanceId: processId,
        stepOrder: 4,
        stepName: "Test Due Date",
        stepType: "form",
        status: "active",
      })
      .returning();

    // Create workflow step template with 10 days due
    const [stepTemplate] = await db
      .insert(workflowStepTemplate)
      .values({
        tenantId,
        workflowTemplateVersionId: workflowVersionId,
        stepOrder: 4,
        name: "Test Due Date",
        stepType: "form",
        taskTitle: "Test task",
        dueDays: 10,
        assigneeType: "role",
        assigneeRole: "admin",
        multiApprover: false,
      })
      .returning();

    // Call helper function
    const tasks = await createTasksForStep(
      step.id,
      stepTemplate.id,
      processId,
      tenantId
    );

    // Assertions
    const afterCreate = Date.now();
    const expectedDueTime = beforeCreate + 10 * 24 * 60 * 60 * 1000;
    const taskDueTime = tasks[0].dueAt!.getTime();

    expect(tasks[0].dueAt).toBeDefined();
    expect(taskDueTime).toBeGreaterThanOrEqual(expectedDueTime);
    expect(taskDueTime).toBeLessThanOrEqual(
      afterCreate + 10 * 24 * 60 * 60 * 1000
    );

    // Clean up
    await db.delete(taskInstance).where(eq(taskInstance.stepInstanceId, step.id));
    await db.delete(workflowStepTemplate).where(eq(workflowStepTemplate.id, stepTemplate.id));
    await db.delete(stepInstance).where(eq(stepInstance.id, step.id));
  });

  test("handles step with no due date (dueDays is null)", async () => {
    // Create step instance
    const [step] = await db
      .insert(stepInstance)
      .values({
        tenantId,
        processInstanceId: processId,
        stepOrder: 5,
        stepName: "No Due Date",
        stepType: "form",
        status: "active",
      })
      .returning();

    // Create workflow step template without dueDays
    const [stepTemplate] = await db
      .insert(workflowStepTemplate)
      .values({
        tenantId,
        workflowTemplateVersionId: workflowVersionId,
        stepOrder: 5,
        name: "No Due Date",
        stepType: "form",
        taskTitle: "Task without deadline",
        assigneeType: "role",
        assigneeRole: "admin",
        multiApprover: false,
      })
      .returning();

    // Call helper function
    const tasks = await createTasksForStep(
      step.id,
      stepTemplate.id,
      processId,
      tenantId
    );

    // Assertions
    expect(tasks.length).toBe(1);
    expect(tasks[0].dueAt).toBeNull();
    expect(tasks[0].completionTimeDays).toBeNull();

    // Clean up
    await db.delete(taskInstance).where(eq(taskInstance.stepInstanceId, step.id));
    await db.delete(workflowStepTemplate).where(eq(workflowStepTemplate.id, stepTemplate.id));
    await db.delete(stepInstance).where(eq(stepInstance.id, step.id));
  });

  test("throws error if step template not found", async () => {
    const [step] = await db
      .insert(stepInstance)
      .values({
        tenantId,
        processInstanceId: processId,
        stepOrder: 99,
        stepName: "Error Test",
        stepType: "form",
        status: "active",
      })
      .returning();

    const fakeStepTemplateId = crypto.randomUUID();

    // Should throw error
    let error: Error | null = null;
    try {
      await createTasksForStep(
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

    // Clean up
    await db.delete(stepInstance).where(eq(stepInstance.id, step.id));
  });

  test("throws error if multi-approver step has no approvers", async () => {
    // Create step instance
    const [step] = await db
      .insert(stepInstance)
      .values({
        tenantId,
        processInstanceId: processId,
        stepOrder: 100,
        stepName: "Multi No Approvers",
        stepType: "approval",
        status: "active",
      })
      .returning();

    // Create multi-approver step template but don't create any approvers
    const [stepTemplate] = await db
      .insert(workflowStepTemplate)
      .values({
        tenantId,
        workflowTemplateVersionId: workflowVersionId,
        stepOrder: 100,
        name: "Multi No Approvers",
        stepType: "approval",
        taskTitle: "Approve",
        assigneeType: "role",
        multiApprover: true,
        approverCount: 2,
      })
      .returning();

    // Should throw error
    let error: Error | null = null;
    try {
      await createTasksForStep(
        step.id,
        stepTemplate.id,
        processId,
        tenantId
      );
    } catch (e) {
      error = e as Error;
    }

    expect(error).toBeDefined();
    expect(error?.message).toContain("No approvers found");

    // Clean up
    await db.delete(workflowStepTemplate).where(eq(workflowStepTemplate.id, stepTemplate.id));
    await db.delete(stepInstance).where(eq(stepInstance.id, step.id));
  });

  test("respects tenant isolation - cannot access other tenant's template", async () => {
    // Create another tenant
    const [otherTenant] = await db
      .insert(tenants)
      .values({
        name: "Other Tenant",
        slug: `other-tenant-${Date.now()}`,
      })
      .returning();

    // Create step in original tenant
    const [step] = await db
      .insert(stepInstance)
      .values({
        tenantId,
        processInstanceId: processId,
        stepOrder: 101,
        stepName: "Tenant Test",
        stepType: "form",
        status: "active",
      })
      .returning();

    // Create step template in OTHER tenant
    const [otherStepTemplate] = await db
      .insert(workflowStepTemplate)
      .values({
        tenantId: otherTenant.id,
        workflowTemplateVersionId: workflowVersionId,
        stepOrder: 101,
        name: "Other Tenant Template",
        stepType: "form",
        taskTitle: "Task from other tenant",
        assigneeType: "role",
        assigneeRole: "admin",
        multiApprover: false,
      })
      .returning();

    // Try to create tasks - should fail because tenant doesn't match
    let error: Error | null = null;
    try {
      await createTasksForStep(
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

    // Clean up
    await db.delete(stepInstance).where(eq(stepInstance.id, step.id));
    await db.delete(workflowStepTemplate).where(eq(workflowStepTemplate.id, otherStepTemplate.id));
    await db.delete(tenants).where(eq(tenants.id, otherTenant.id));
  });
});

