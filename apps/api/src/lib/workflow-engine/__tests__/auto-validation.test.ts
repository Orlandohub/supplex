import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { db } from "../../index";
import {
  tenants,
  users,
  workflowTemplate,
  workflowStepTemplate,
  processInstance,
  stepInstance,
  taskInstance,
} from "@supplex/db";
import { eq } from "drizzle-orm";
import { completeStep } from "../complete-step";
import { createValidationTasks } from "../create-validation-tasks";

/**
 * Integration Tests: Auto-Validation Task Creation
 * Story 2.2.15
 *
 * Tests the automatic creation of validation tasks when a step with requiresValidation completes
 */

describe("Auto-Validation Task Creation", () => {
  let tenant: { id: string };
  let user: { id: string };
  let template: { id: string };
  let _stepTemplate: { id: string; workflowStepTemplateId: string };
  let _process: { id: string };

  beforeAll(async () => {
    [tenant] = await db
      .insert(tenants)
      .values({
        name: "Auto-Validation Test Tenant",
        slug: `auto-validation-tenant-${Date.now()}`,
      })
      .returning();

    [user] = await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        tenantId: tenant.id,
        email: `auto-validation-user-${Date.now()}@test.com`,
        fullName: "Auto Validation User",
        role: "admin",
      })
      .returning();

    [template] = await db
      .insert(workflowTemplate)
      .values({
        tenantId: tenant.id,
        name: "Auto-Validation Test Template",
        status: "published",
        createdBy: user.id,
      })
      .returning();
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenant.id));
  });

  test("complete step with requiresValidation=true creates validation tasks", async () => {
    // Create step template with validation
    const [step1] = await db
      .insert(workflowStepTemplate)
      .values({
        workflowTemplateId: template.id,
        tenantId: tenant.id,
        stepOrder: 1,
        name: "Submit Form",
        stepType: "form",
        requiresValidation: true,
        validationConfig: {
          approverRoles: ["quality_manager", "procurement_manager"],
        },
      })
      .returning();

    const [_step2] = await db
      .insert(workflowStepTemplate)
      .values({
        workflowTemplateId: template.id,
        tenantId: tenant.id,
        stepOrder: 2,
        name: "Final Step",
        stepType: "approval",
      })
      .returning();

    // Create process instance
    const [proc] = await db
      .insert(processInstance)
      .values({
        tenantId: tenant.id,
        workflowTemplateId: template.id,
        supplierId: crypto.randomUUID(),
        status: "in_progress",
        createdBy: user.id,
      })
      .returning();

    // Create step instance
    const [stepInst] = await db
      .insert(stepInstance)
      .values({
        tenantId: tenant.id,
        processInstanceId: proc.id,
        workflowStepTemplateId: step1.id,
        stepOrder: 1,
        stepName: "Submit Form",
        stepType: "form",
        status: "active",
      })
      .returning();

    // Complete step (should trigger validation task creation)
    const result = await completeStep(db, {
      tenantId: tenant.id,
      stepInstanceId: stepInst.id,
      completedBy: user.id,
      outcome: "completed",
    });

    expect(result.success).toBe(true);
    expect(result.data?.stepCompleted).toBe(true);
    expect(result.data?.nextStepActivated).toBe(false); // Should NOT activate next step yet

    // Verify validation tasks were created
    const validationTasks = await db
      .select()
      .from(taskInstance)
      .where(eq(taskInstance.stepInstanceId, stepInst.id));

    expect(validationTasks.length).toBe(2); // One per approver role
    expect(validationTasks.every((t) => t.assigneeType === "role")).toBe(true);
    expect(validationTasks.every((t) => t.status === "open")).toBe(true);
    expect(
      validationTasks.some((t) => t.assigneeRole === "quality_manager")
    ).toBe(true);
    expect(
      validationTasks.some((t) => t.assigneeRole === "procurement_manager")
    ).toBe(true);
    expect(
      validationTasks.every((t) => t.taskType === "validation")
    ).toBe(true);

    // Verify step status is awaiting_validation
    const [updatedStep] = await db
      .select()
      .from(stepInstance)
      .where(eq(stepInstance.id, stepInst.id));

    expect(updatedStep.status).toBe("awaiting_validation");
  });

  test("validation tasks have correct assignee roles", async () => {
    const [step] = await db
      .insert(workflowStepTemplate)
      .values({
        workflowTemplateId: template.id,
        tenantId: tenant.id,
        stepOrder: 10,
        name: "Document Upload",
        stepType: "document",
        requiresValidation: true,
        validationConfig: {
          approverRoles: ["admin", "quality_manager"],
        },
      })
      .returning();

    const [proc] = await db
      .insert(processInstance)
      .values({
        tenantId: tenant.id,
        workflowTemplateId: template.id,
        supplierId: crypto.randomUUID(),
        status: "in_progress",
        createdBy: user.id,
      })
      .returning();

    const [stepInst] = await db
      .insert(stepInstance)
      .values({
        tenantId: tenant.id,
        processInstanceId: proc.id,
        workflowStepTemplateId: step.id,
        stepOrder: 10,
        stepName: "Document Upload",
        stepType: "document",
        status: "completed",
      })
      .returning();

    // Create validation tasks directly
    await createValidationTasks(db, {
      tenantId: tenant.id,
      stepInstanceId: stepInst.id,
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

  test("next step remains blocked until validation approved", async () => {
    const [step1] = await db
      .insert(workflowStepTemplate)
      .values({
        workflowTemplateId: template.id,
        tenantId: tenant.id,
        stepOrder: 20,
        name: "Submit Data",
        stepType: "form",
        requiresValidation: true,
        validationConfig: {
          approverRoles: ["quality_manager"],
        },
      })
      .returning();

    const [_step2] = await db
      .insert(workflowStepTemplate)
      .values({
        workflowTemplateId: template.id,
        tenantId: tenant.id,
        stepOrder: 21,
        name: "Review Data",
        stepType: "approval",
      })
      .returning();

    const [proc] = await db
      .insert(processInstance)
      .values({
        tenantId: tenant.id,
        workflowTemplateId: template.id,
        supplierId: crypto.randomUUID(),
        status: "in_progress",
        createdBy: user.id,
      })
      .returning();

    const [stepInst] = await db
      .insert(stepInstance)
      .values({
        tenantId: tenant.id,
        processInstanceId: proc.id,
        workflowStepTemplateId: step1.id,
        stepOrder: 20,
        stepName: "Submit Data",
        stepType: "form",
        status: "active",
      })
      .returning();

    // Complete step
    await completeStep(db, {
      tenantId: tenant.id,
      stepInstanceId: stepInst.id,
      completedBy: user.id,
      outcome: "completed",
    });

    // Verify next step instance was NOT created
    const nextStepInstances = await db
      .select()
      .from(stepInstance)
      .where(eq(stepInstance.processInstanceId, proc.id));

    expect(nextStepInstances.length).toBe(1); // Only original step
    expect(nextStepInstances[0].stepOrder).toBe(20);
  });

  test("complete step with requiresValidation=false activates next step immediately", async () => {
    const [step1] = await db
      .insert(workflowStepTemplate)
      .values({
        workflowTemplateId: template.id,
        tenantId: tenant.id,
        stepOrder: 30,
        name: "No Validation Step",
        stepType: "form",
        requiresValidation: false,
      })
      .returning();

    const [step2] = await db
      .insert(workflowStepTemplate)
      .values({
        workflowTemplateId: template.id,
        tenantId: tenant.id,
        stepOrder: 31,
        name: "Next Step",
        stepType: "approval",
      })
      .returning();

    const [proc] = await db
      .insert(processInstance)
      .values({
        tenantId: tenant.id,
        workflowTemplateId: template.id,
        supplierId: crypto.randomUUID(),
        status: "in_progress",
        createdBy: user.id,
      })
      .returning();

    const [stepInst] = await db
      .insert(stepInstance)
      .values({
        tenantId: tenant.id,
        processInstanceId: proc.id,
        workflowStepTemplateId: step1.id,
        stepOrder: 30,
        stepName: "No Validation Step",
        stepType: "form",
        status: "active",
      })
      .returning();

    // Complete step
    const result = await completeStep(db, {
      tenantId: tenant.id,
      stepInstanceId: stepInst.id,
      completedBy: user.id,
      outcome: "completed",
    });

    expect(result.success).toBe(true);
    expect(result.data?.nextStepActivated).toBe(true); // Should activate immediately

    // Verify no validation tasks were created
    const tasks = await db
      .select()
      .from(taskInstance)
      .where(eq(taskInstance.stepInstanceId, stepInst.id));

    expect(tasks.length).toBe(0);
  });
});
