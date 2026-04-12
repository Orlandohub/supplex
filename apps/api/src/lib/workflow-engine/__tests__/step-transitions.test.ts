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
import { eq, and } from "drizzle-orm";
import { transitionToNextStep } from "../transition-to-next-step";
import { returnToPreviousStep } from "../return-to-previous-step";
import { completeStep } from "../complete-step";

/**
 * Unit Tests: Step Transition Helpers
 * Story: 2.2.8 / 2.2.16 - Workflow Engine Step Transitions
 * Updated: Story 2.2.19 - tx parameter threading
 */

describe("Step Transition Helpers", () => {
  let tenantId: string;
  let userId: string;
  let processId: string;
  let templateId: string;
  let step1Id: string;
  let step2Id: string;
  let step3Id: string;
  let stepTemplate1Id: string;
  let stepTemplate2Id: string;
  let stepTemplate3Id: string;

  beforeAll(async () => {
    const [tenant] = await db
      .insert(tenants)
      .values({
        name: "Test Tenant",
        slug: `test-tenant-transitions-${Date.now()}`,
      })
      .returning();
    tenantId = tenant.id;

    [{ id: userId }] = await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        tenantId,
        email: `user-transitions-${Date.now()}@test.com`,
        fullName: "Test User",
        role: "admin",
      })
      .returning();

    const [template] = await db
      .insert(workflowTemplate)
      .values({
        tenantId,
        name: "Test Workflow",
        status: "published",
        active: true,
        createdBy: userId,
      })
      .returning();
    templateId = template.id;

    [{ id: stepTemplate1Id }] = await db
      .insert(workflowStepTemplate)
      .values({
        tenantId,
        workflowTemplateId: templateId,
        stepOrder: 1,
        name: "Step 1",
        stepType: "form",
        taskTitle: "Complete Step 1",
        assigneeType: "role",
        assigneeRole: "admin",
      })
      .returning();

    [{ id: stepTemplate2Id }] = await db
      .insert(workflowStepTemplate)
      .values({
        tenantId,
        workflowTemplateId: templateId,
        stepOrder: 2,
        name: "Step 2",
        stepType: "approval",
        taskTitle: "Approve Step 2",
        assigneeType: "role",
        assigneeRole: "admin",
        declineReturnsToStepOffset: 1,
      })
      .returning();

    [{ id: stepTemplate3Id }] = await db
      .insert(workflowStepTemplate)
      .values({
        tenantId,
        workflowTemplateId: templateId,
        stepOrder: 3,
        name: "Step 3",
        stepType: "form",
        taskTitle: "Complete Step 3",
        assigneeType: "role",
        assigneeRole: "admin",
      })
      .returning();

    [{ id: processId }] = await db
      .insert(processInstance)
      .values({
        tenantId,
        processType: "workflow_execution",
        entityType: "supplier",
        entityId: crypto.randomUUID(),
        status: "in_progress",
        initiatedBy: userId,
        initiatedDate: new Date(),
        workflowTemplateId: templateId,
        totalSteps: 3,
        completedSteps: 0,
        metadata: {},
      })
      .returning();

    [{ id: step1Id }] = await db
      .insert(stepInstance)
      .values({
        tenantId,
        processInstanceId: processId,
        stepOrder: 1,
        stepName: "Step 1",
        stepType: "form",
        status: "active",
      })
      .returning();

    [{ id: step2Id }] = await db
      .insert(stepInstance)
      .values({
        tenantId,
        processInstanceId: processId,
        stepOrder: 2,
        stepName: "Step 2",
        stepType: "approval",
        status: "blocked",
      })
      .returning();

    [{ id: step3Id }] = await db
      .insert(stepInstance)
      .values({
        tenantId,
        processInstanceId: processId,
        stepOrder: 3,
        stepName: "Step 3",
        stepType: "form",
        status: "blocked",
      })
      .returning();
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  test("transitionToNextStep - step 1 completes, step 2 activates with tasks, completedSteps increments", async () => {
    const result = await transitionToNextStep(db, step1Id, processId, tenantId);

    expect(result.currentStepCompleted).toBe(true);
    expect(result.nextStepActivated).toBe(true);
    expect(result.nextStepId).toBe(step2Id);
    expect(result.processCompleted).toBe(false);

    const [step2] = await db
      .select()
      .from(stepInstance)
      .where(eq(stepInstance.id, step2Id));
    expect(step2.status).toBe("active");

    // Verify completedSteps incremented by 1
    const [proc] = await db
      .select()
      .from(processInstance)
      .where(eq(processInstance.id, processId));
    expect(proc.completedSteps).toBe(1);
    expect(proc.totalSteps).toBe(3);

    const tasks = await db
      .select()
      .from(taskInstance)
      .where(eq(taskInstance.stepInstanceId, step2Id));
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks[0].status).toBe("pending");
  });

  test("transitionToNextStep - completes process when no next step, completedSteps equals totalSteps", async () => {
    await transitionToNextStep(db, step2Id, processId, tenantId);

    const result = await transitionToNextStep(db, step3Id, processId, tenantId);

    expect(result.currentStepCompleted).toBe(true);
    expect(result.nextStepActivated).toBe(false);
    expect(result.processCompleted).toBe(true);

    const [process] = await db
      .select()
      .from(processInstance)
      .where(eq(processInstance.id, processId));
    expect(process.status).toBe("completed");
    expect(process.completedDate).toBeDefined();

    // On process completion, completedSteps should equal totalSteps
    expect(process.completedSteps).toBe(process.totalSteps);
  });

  test("completeStep - resolves step template via process metadata", async () => {
    const [newProcess] = await db
      .insert(processInstance)
      .values({
        tenantId,
        processType: "workflow_execution",
        entityType: "supplier",
        entityId: crypto.randomUUID(),
        status: "in_progress",
        initiatedBy: userId,
        initiatedDate: new Date(),
        workflowTemplateId: templateId,
        metadata: {},
      })
      .returning();

    const [newStep1] = await db
      .insert(stepInstance)
      .values({
        tenantId,
        processInstanceId: newProcess.id,
        stepOrder: 1,
        stepName: "Step 1",
        stepType: "form",
        status: "active",
      })
      .returning();

    const [newStep2] = await db
      .insert(stepInstance)
      .values({
        tenantId,
        processInstanceId: newProcess.id,
        stepOrder: 2,
        stepName: "Step 2",
        stepType: "approval",
        status: "blocked",
      })
      .returning();

    const result = await completeStep(db, {
      tenantId,
      stepInstanceId: newStep1.id,
      completedBy: userId,
      outcome: "completed",
    });

    expect(result.success).toBe(true);
    expect(result.data?.stepCompleted).toBe(true);
    expect(result.data?.nextStepActivated).toBe(true);

    const [updatedStep2] = await db
      .select()
      .from(stepInstance)
      .where(eq(stepInstance.id, newStep2.id));
    expect(updatedStep2.status).toBe("active");

    const tasks = await db
      .select()
      .from(taskInstance)
      .where(eq(taskInstance.stepInstanceId, newStep2.id));
    expect(tasks.length).toBeGreaterThan(0);

    await db
      .delete(processInstance)
      .where(eq(processInstance.id, newProcess.id));
  });

  test("returnToPreviousStep - returns to previous step with tasks using workflowTemplateId", async () => {
    const [newProcess] = await db
      .insert(processInstance)
      .values({
        tenantId,
        processType: "workflow_execution",
        entityType: "supplier",
        entityId: crypto.randomUUID(),
        status: "in_progress",
        initiatedBy: userId,
        initiatedDate: new Date(),
        workflowTemplateId: templateId,
        metadata: {},
      })
      .returning();

    const [newStep1] = await db
      .insert(stepInstance)
      .values({
        tenantId,
        processInstanceId: newProcess.id,
        stepOrder: 1,
        stepName: "Step 1",
        stepType: "form",
        status: "completed",
      })
      .returning();

    const [newStep2] = await db
      .insert(stepInstance)
      .values({
        tenantId,
        processInstanceId: newProcess.id,
        stepOrder: 2,
        stepName: "Step 2",
        stepType: "approval",
        status: "active",
      })
      .returning();

    const result = await returnToPreviousStep(
      db,
      newStep2.id,
      1,
      newProcess.id,
      tenantId
    );

    expect(result.currentStepDeclined).toBe(true);
    expect(result.targetStepActivated).toBe(true);
    expect(result.targetStepId).toBe(newStep1.id);

    const [step2] = await db
      .select()
      .from(stepInstance)
      .where(eq(stepInstance.id, newStep2.id));
    expect(step2.status).toBe("declined");

    const [step1] = await db
      .select()
      .from(stepInstance)
      .where(eq(stepInstance.id, newStep1.id));
    expect(step1.status).toBe("active");

    const tasks = await db
      .select()
      .from(taskInstance)
      .where(eq(taskInstance.stepInstanceId, newStep1.id));
    expect(tasks.length).toBeGreaterThan(0);

    await db
      .delete(processInstance)
      .where(eq(processInstance.id, newProcess.id));
  });

  test("returnToPreviousStep - handles invalid offset (before first step)", async () => {
    const [newProcess] = await db
      .insert(processInstance)
      .values({
        tenantId,
        processType: "workflow_execution",
        entityType: "supplier",
        entityId: crypto.randomUUID(),
        status: "in_progress",
        initiatedBy: userId,
        initiatedDate: new Date(),
        workflowTemplateId: templateId,
        metadata: {},
      })
      .returning();

    const [newStep1] = await db
      .insert(stepInstance)
      .values({
        tenantId,
        processInstanceId: newProcess.id,
        stepOrder: 1,
        stepName: "Step 1",
        stepType: "form",
        status: "active",
      })
      .returning();

    const result = await returnToPreviousStep(db, newStep1.id, 2, newProcess.id, tenantId);

    expect(result.currentStepDeclined).toBe(false);
    expect(result.targetStepActivated).toBe(false);
    expect(result.error).toContain("Cannot return");

    await db
      .delete(processInstance)
      .where(eq(processInstance.id, newProcess.id));
  });

  test("tenant isolation - cannot transition steps from other tenant", async () => {
    const fakeTenantId = crypto.randomUUID();

    // Create a new process for this test since step1Id may have been used
    const [newProcess] = await db
      .insert(processInstance)
      .values({
        tenantId,
        processType: "workflow_execution",
        entityType: "supplier",
        entityId: crypto.randomUUID(),
        status: "in_progress",
        initiatedBy: userId,
        initiatedDate: new Date(),
        workflowTemplateId: templateId,
        metadata: {},
      })
      .returning();

    const [newStep] = await db
      .insert(stepInstance)
      .values({
        tenantId,
        processInstanceId: newProcess.id,
        stepOrder: 1,
        stepName: "Step 1",
        stepType: "form",
        status: "active",
      })
      .returning();

    let error: Error | null = null;
    try {
      await transitionToNextStep(db, newStep.id, newProcess.id, fakeTenantId);
    } catch (e) {
      error = e as Error;
    }

    expect(error).toBeDefined();
    expect(error?.message).toContain("not found");

    await db
      .delete(processInstance)
      .where(eq(processInstance.id, newProcess.id));
  });

  test("completeStep - atomic CAS rejects blocked step", async () => {
    const [newProcess] = await db
      .insert(processInstance)
      .values({
        tenantId,
        processType: "workflow_execution",
        entityType: "supplier",
        entityId: crypto.randomUUID(),
        status: "in_progress",
        initiatedBy: userId,
        initiatedDate: new Date(),
        workflowTemplateId: templateId,
        metadata: {},
      })
      .returning();

    const [blockedStep] = await db
      .insert(stepInstance)
      .values({
        tenantId,
        processInstanceId: newProcess.id,
        stepOrder: 2,
        stepName: "Blocked Step",
        stepType: "form",
        status: "blocked",
      })
      .returning();

    const result = await completeStep(db, {
      tenantId,
      stepInstanceId: blockedStep.id,
      completedBy: userId,
      outcome: "completed",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("already processed or not in active state");

    await db
      .delete(processInstance)
      .where(eq(processInstance.id, newProcess.id));
  });
});
