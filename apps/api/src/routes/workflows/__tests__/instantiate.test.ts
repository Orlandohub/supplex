import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { db } from "../../../lib/db";
import {
  tenants,
  users,
  workflowTemplate,
  workflowStepTemplate,
  processInstance,
  stepInstance,
  taskInstance,
} from "@supplex/db";
import { eq, asc } from "drizzle-orm";
import { instantiateWorkflow } from "../../../lib/workflow-engine/instantiate-workflow";

import { insertOneOrThrow } from "../../../lib/db-helpers";
/**
 * Integration Tests: Workflow Instantiation
 * Story: 2.2.8 - Workflow Execution Engine
 * Updated: Story 2.2.19 - Transaction wrapping, batch inserts, library delegation
 */

describe("Workflow Instantiation", () => {
  let tenantId: string;
  let userId: string;
  let workflowTemplateId: string;

  beforeAll(async () => {
    const tenant = await insertOneOrThrow(db, tenants, {
      name: "Test Tenant",
      slug: `test-tenant-instantiate-${Date.now()}`,
    });
    tenantId = tenant.id;

    const user = await insertOneOrThrow(db, users, {
      id: crypto.randomUUID(),
      tenantId,
      email: `user-instantiate-${Date.now()}@test.com`,
      fullName: "Test User",
      role: "admin",
    });
    userId = user.id;

    const template = await insertOneOrThrow(db, workflowTemplate, {
      tenantId,
      name: "Test Workflow",
      status: "published",
      active: true,
      createdBy: userId,
    });
    workflowTemplateId = template.id;

    await db.insert(workflowStepTemplate).values([
      {
        tenantId,
        workflowTemplateId,
        stepOrder: 1,
        name: "Step 1: Submit Form",
        stepType: "form",
        taskTitle: "Fill out form",
        taskDescription: "Please complete the form",
        dueDays: 7,
        assigneeType: "role",
        assigneeRole: "admin",
      },
      {
        tenantId,
        workflowTemplateId,
        stepOrder: 2,
        name: "Step 2: Approve",
        stepType: "approval",
        taskTitle: "Review and approve",
        dueDays: 3,
        assigneeType: "role",
        assigneeRole: "admin",
      },
    ]);
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  test("successfully creates workflow instance via instantiateWorkflow", async () => {
    const entityId = crypto.randomUUID();

    const result = await instantiateWorkflow(db, {
      tenantId,
      workflowTemplateId,
      entityType: "supplier",
      entityId,
      initiatedBy: userId,
      metadata: { processType: "supplier_qualification" },
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data!.processInstance).toBeDefined();
    expect(result.data!.steps).toBeDefined();

    const process = result.data!.processInstance;
    expect(process.tenantId).toBe(tenantId);
    expect(process.status).toBe("in_progress");
    expect(process.initiatedBy).toBe(userId);

    // Denormalized totalSteps set from stepTemplates.length
    expect(process.totalSteps).toBe(2);
    expect(process.completedSteps).toBe(0);

    // All steps created in a single batch
    const steps = result.data!.steps;
    expect(steps.length).toBe(2);

    const firstStep = steps.find((s) => s.stepOrder === 1);
    expect(firstStep).toBeDefined();
    expect(firstStep?.status).toBe("active");

    const secondStep = steps.find((s) => s.stepOrder === 2);
    expect(secondStep).toBeDefined();
    expect(secondStep?.status).toBe("blocked");

    // Tasks created for first step
    const tasks = await db
      .select()
      .from(taskInstance)
      .where(eq(taskInstance.stepInstanceId, firstStep!.id));
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks[0]!.status).toBe("pending");

    // Cleanup
    await db.delete(processInstance).where(eq(processInstance.id, process.id));
  });

  test("rejects instantiation of unpublished workflow template", async () => {
    const draftTemplate = await insertOneOrThrow(db, workflowTemplate, {
      tenantId,
      name: "Draft Workflow",
      status: "draft",
      createdBy: userId,
    });

    const result = await instantiateWorkflow(db, {
      tenantId,
      workflowTemplateId: draftTemplate.id,
      entityType: "supplier",
      entityId: crypto.randomUUID(),
      initiatedBy: userId,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("not published");

    await db
      .delete(workflowTemplate)
      .where(eq(workflowTemplate.id, draftTemplate.id));
  });

  test("enforces tenant isolation", async () => {
    const otherTenant = await insertOneOrThrow(db, tenants, {
      name: "Other Tenant",
      slug: `other-tenant-inst-${Date.now()}`,
    });

    const result = await instantiateWorkflow(db, {
      tenantId: otherTenant.id,
      workflowTemplateId,
      entityType: "supplier",
      entityId: crypto.randomUUID(),
      initiatedBy: userId,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("not found");

    await db.delete(tenants).where(eq(tenants.id, otherTenant.id));
  });

  test("handles workflow template with no steps (transaction rollback)", async () => {
    const emptyWorkflow = await insertOneOrThrow(db, workflowTemplate, {
      tenantId,
      name: "Empty Workflow",
      status: "published",
      active: true,
      createdBy: userId,
    });

    const result = await instantiateWorkflow(db, {
      tenantId,
      workflowTemplateId: emptyWorkflow.id,
      entityType: "supplier",
      entityId: crypto.randomUUID(),
      initiatedBy: userId,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("no steps");

    // Transaction should have rolled back — no orphaned process instances
    const orphans = await db
      .select()
      .from(processInstance)
      .where(eq(processInstance.workflowTemplateId, emptyWorkflow.id));
    expect(orphans.length).toBe(0);

    await db
      .delete(workflowTemplate)
      .where(eq(workflowTemplate.id, emptyWorkflow.id));
  });

  test("batch insert creates all steps in correct order", async () => {
    const entityId = crypto.randomUUID();

    const result = await instantiateWorkflow(db, {
      tenantId,
      workflowTemplateId,
      entityType: "supplier",
      entityId,
      initiatedBy: userId,
    });

    expect(result.success).toBe(true);

    const steps = await db
      .select()
      .from(stepInstance)
      .where(
        eq(stepInstance.processInstanceId, result.data!.processInstance.id)
      )
      .orderBy(asc(stepInstance.stepOrder));

    expect(steps.length).toBe(2);
    expect(steps[0]!.stepOrder).toBe(1);
    expect(steps[0]!.status).toBe("active");
    expect(steps[1]!.stepOrder).toBe(2);
    expect(steps[1]!.status).toBe("blocked");

    await db
      .delete(processInstance)
      .where(eq(processInstance.id, result.data!.processInstance.id));
  });
});
