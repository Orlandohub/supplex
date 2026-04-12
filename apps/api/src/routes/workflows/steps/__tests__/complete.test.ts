import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { db } from "../../../../lib/db";
import {
  tenants,
  users,
  processInstance,
  stepInstance,
  workflowTemplate,
  workflowStepTemplate,
  taskInstance,
  commentThread,
} from "@supplex/db";
import { eq, and } from "drizzle-orm";
import { completeStep } from "../../../../lib/workflow-engine/complete-step";

/**
 * Unit Tests: Step Completion
 * Story: 2.2.8 - Workflow Execution Engine
 * Updated: Story 2.2.19 - Atomic CAS transitions
 */

describe("Step Completion", () => {
  let tenantId: string;
  let userId: string;
  let templateId: string;

  beforeAll(async () => {
    const [tenant] = await db
      .insert(tenants)
      .values({
        name: "Test Tenant",
        slug: `test-tenant-complete-${Date.now()}`,
      })
      .returning();
    tenantId = tenant.id;

    [{ id: userId }] = await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        tenantId,
        email: `user-complete-${Date.now()}@test.com`,
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
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  test("completeStep succeeds for active step", async () => {
    const [process] = await db
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
      })
      .returning();

    const [stepTemplate] = await db
      .insert(workflowStepTemplate)
      .values({
        tenantId,
        workflowTemplateId: templateId,
        stepOrder: 1,
        name: "Fill Form",
        stepType: "form",
        taskTitle: "Fill form",
        assigneeType: "role",
        assigneeRole: "admin",
      })
      .returning();

    const [step] = await db
      .insert(stepInstance)
      .values({
        tenantId,
        processInstanceId: process.id,
        stepOrder: 1,
        stepName: "Fill Form",
        stepType: "form",
        status: "active",
      })
      .returning();

    const result = await completeStep(db, {
      tenantId,
      stepInstanceId: step.id,
      completedBy: userId,
      outcome: "completed",
    });

    expect(result.success).toBe(true);
    expect(result.data?.stepCompleted).toBe(true);

    // Verify step was marked completed
    const [updatedStep] = await db
      .select()
      .from(stepInstance)
      .where(eq(stepInstance.id, step.id));

    // Status is completed or awaiting_validation or validated depending on template config
    expect(["completed", "awaiting_validation", "validated"]).toContain(updatedStep.status);

    await db.delete(processInstance).where(eq(processInstance.id, process.id));
    await db.delete(workflowStepTemplate).where(eq(workflowStepTemplate.id, stepTemplate.id));
  });

  test("atomic CAS rejects step not in active state (blocked)", async () => {
    const [process] = await db
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
      })
      .returning();

    const [step] = await db
      .insert(stepInstance)
      .values({
        tenantId,
        processInstanceId: process.id,
        stepOrder: 2,
        stepName: "Blocked Step",
        stepType: "approval",
        status: "blocked",
      })
      .returning();

    const result = await completeStep(db, {
      tenantId,
      stepInstanceId: step.id,
      completedBy: userId,
      outcome: "completed",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("already processed or not in active state");

    // Verify step status unchanged
    const [unchangedStep] = await db
      .select()
      .from(stepInstance)
      .where(eq(stepInstance.id, step.id));
    expect(unchangedStep.status).toBe("blocked");

    await db.delete(processInstance).where(eq(processInstance.id, process.id));
  });

  test("atomic CAS rejects already-completed step (double submit)", async () => {
    const [process] = await db
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
      })
      .returning();

    const [step] = await db
      .insert(stepInstance)
      .values({
        tenantId,
        processInstanceId: process.id,
        stepOrder: 1,
        stepName: "Already Done",
        stepType: "form",
        status: "completed",
        completedBy: userId,
        completedDate: new Date(),
      })
      .returning();

    const result = await completeStep(db, {
      tenantId,
      stepInstanceId: step.id,
      completedBy: userId,
      outcome: "completed",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("already processed or not in active state");

    await db.delete(processInstance).where(eq(processInstance.id, process.id));
  });

  test("decline outcome creates comment and marks step declined", async () => {
    const [process] = await db
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
      })
      .returning();

    const [step] = await db
      .insert(stepInstance)
      .values({
        tenantId,
        processInstanceId: process.id,
        stepOrder: 1,
        stepName: "Decline Test",
        stepType: "form",
        status: "active",
      })
      .returning();

    const result = await completeStep(db, {
      tenantId,
      stepInstanceId: step.id,
      completedBy: userId,
      outcome: "declined",
      comments: "Needs revision",
    });

    expect(result.success).toBe(true);
    expect(result.data?.stepCompleted).toBe(true);

    const [declinedStep] = await db
      .select()
      .from(stepInstance)
      .where(eq(stepInstance.id, step.id));
    expect(declinedStep.status).toBe("declined");

    const comments = await db
      .select()
      .from(commentThread)
      .where(eq(commentThread.stepInstanceId, step.id));
    expect(comments.length).toBeGreaterThan(0);
    expect(comments[0].commentText).toBe("Needs revision");

    await db.delete(processInstance).where(eq(processInstance.id, process.id));
  });

  test("completeStep rejects non-existent step (CAS returns 0 rows)", async () => {
    const fakeStepId = crypto.randomUUID();

    const result = await completeStep(db, {
      tenantId,
      stepInstanceId: fakeStepId,
      completedBy: userId,
      outcome: "completed",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("already processed or not in active state");
  });
});
