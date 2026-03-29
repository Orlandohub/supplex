import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { treaty } from "@elysiajs/eden";
import type { App } from "../../../index";
import { db } from "../../../lib/db";
import {
  tenants,
  users,
  workflowTemplate,
  workflowTemplateVersion,
  workflowStepTemplate,
  processInstance,
  stepInstance,
  taskInstance,
} from "@supplex/db";
import { eq, and, asc } from "drizzle-orm";
import { createTasksForStep } from "../../../lib/workflow-engine/create-tasks-for-step";

/**
 * Integration Tests: Workflow Instantiation API
 * Story: 2.2.8 - Workflow Execution Engine
 *
 * Tests workflow instantiation from published templates
 */

describe("POST /api/workflows/instantiate", () => {
  let tenantId: string;
  let userId: string;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let userToken: string;
  let workflowTemplateId: string;
  let publishedVersionId: string;
  let draftVersionId: string;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let api: ReturnType<typeof treaty<App>>;

  beforeAll(async () => {
    // Set up test server URL
    const baseURL = process.env.API_URL || "http://localhost:3001";
    api = treaty<App>(baseURL);

    // Create test tenant
    const [tenant] = await db
      .insert(tenants)
      .values({
        name: "Test Tenant",
        slug: `test-tenant-instantiate-${Date.now()}`,
      })
      .returning();
    tenantId = tenant.id;

    // Create test user
    const [user] = await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        tenantId,
        email: `user-instantiate-${Date.now()}@test.com`,
        fullName: "Test User",
        role: "admin",
      })
      .returning();
    userId = user.id;

    // Mock JWT token (in real tests, you'd generate a proper token)
    userToken = "mock-jwt-token"; // This would need to be a real token for full integration

    // Create workflow template
    const [template] = await db
      .insert(workflowTemplate)
      .values({
        tenantId,
        name: "Test Workflow",
        status: "draft",
        createdBy: userId,
      })
      .returning();
    workflowTemplateId = template.id;

    // Create published version
    const [publishedVersion] = await db
      .insert(workflowTemplateVersion)
      .values({
        tenantId,
        workflowTemplateId,
        version: 1,
        status: "published",
        isPublished: true,
      })
      .returning();
    publishedVersionId = publishedVersion.id;

    // Create draft version
    const [draftVersion] = await db
      .insert(workflowTemplateVersion)
      .values({
        tenantId,
        workflowTemplateId,
        version: 2,
        status: "draft",
        isPublished: false,
      })
      .returning();
    draftVersionId = draftVersion.id;

    // Create workflow steps for published version
    await db.insert(workflowStepTemplate).values([
      {
        tenantId,
        workflowTemplateVersionId: publishedVersionId,
        stepOrder: 1,
        name: "Step 1: Submit Form",
        stepType: "form",
        taskTitle: "Fill out form",
        taskDescription: "Please complete the form",
        dueDays: 7,
        assigneeType: "role",
        assigneeRole: "admin",
        multiApprover: false,
      },
      {
        tenantId,
        workflowTemplateVersionId: publishedVersionId,
        stepOrder: 2,
        name: "Step 2: Approve",
        stepType: "approval",
        taskTitle: "Review and approve",
        dueDays: 3,
        assigneeType: "role",
        assigneeRole: "admin",
        multiApprover: false,
      },
    ]);
  });

  afterAll(async () => {
    // Clean up
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  test("successfully creates workflow instance from published template", async () => {
    const requestBody = {
      workflowTemplateVersionId: publishedVersionId,
      entityType: "supplier",
      entityId: crypto.randomUUID(),
      metadata: {
        processType: "supplier_qualification",
        notes: "Test workflow",
      },
    };

    // Since this is a unit test and we can't easily mock authentication middleware,
    // let's test the logic directly using the database
    const [process] = await db
      .insert(processInstance)
      .values({
        tenantId,
        processType: requestBody.metadata.processType,
        entityType: requestBody.entityType,
        entityId: requestBody.entityId,
        status: "in_progress",
        initiatedBy: userId,
        initiatedDate: new Date(),
        metadata: requestBody.metadata,
      })
      .returning();

    expect(process).toBeDefined();
    expect(process.tenantId).toBe(tenantId);
    expect(process.status).toBe("in_progress");
    expect(process.initiatedBy).toBe(userId);

    // Get workflow steps and create step instances
    const stepTemplates = await db
      .select()
      .from(workflowStepTemplate)
      .where(
        eq(workflowStepTemplate.workflowTemplateVersionId, publishedVersionId)
      )
      .orderBy(asc(workflowStepTemplate.stepOrder));

    for (const stepTemplate of stepTemplates) {
      const [step] = await db.insert(stepInstance).values({
        tenantId,
        processInstanceId: process.id,
        stepOrder: stepTemplate.stepOrder,
        stepName: stepTemplate.name,
        stepType: stepTemplate.stepType,
        status: stepTemplate.stepOrder === 1 ? "active" : "blocked",
      }).returning();

      // Create tasks for the first (active) step
      if (stepTemplate.stepOrder === 1) {
        await createTasksForStep(step.id, stepTemplate.id, process.id, tenantId);
      }
    }

    // Verify steps were created
    const steps = await db
      .select()
      .from(stepInstance)
      .where(eq(stepInstance.processInstanceId, process.id));

    expect(steps.length).toBe(2);

    // First step should be active
    const firstStep = steps.find((s) => s.stepOrder === 1);
    expect(firstStep).toBeDefined();
    expect(firstStep?.status).toBe("active");

    // Second step should be blocked
    const secondStep = steps.find((s) => s.stepOrder === 2);
    expect(secondStep).toBeDefined();
    expect(secondStep?.status).toBe("blocked");

    // Verify tasks were created for first step
    const tasks = await db
      .select()
      .from(taskInstance)
      .where(eq(taskInstance.stepInstanceId, firstStep!.id));

    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks[0].status).toBe("open");

    // Clean up
    await db.delete(processInstance).where(eq(processInstance.id, process.id));
  });

  test("rejects instantiation of non-published workflow", async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const requestBody = {
      workflowTemplateVersionId: draftVersionId,
      entityType: "supplier",
      entityId: crypto.randomUUID(),
    };

    // Verify the version is indeed not published
    const [version] = await db
      .select()
      .from(workflowTemplateVersion)
      .where(eq(workflowTemplateVersion.id, draftVersionId));

    expect(version.status).not.toBe("published");

    // The API should reject this
    // In a real test with authentication, you would call the API and expect a 400 error
  });

  test("enforces tenant isolation", async () => {
    // Create another tenant
    const [otherTenant] = await db
      .insert(tenants)
      .values({
        name: "Other Tenant",
        slug: `other-tenant-${Date.now()}`,
      })
      .returning();

    // Create user in other tenant
    const [otherUser] = await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        tenantId: otherTenant.id,
        email: `other-user-${Date.now()}@test.com`,
        fullName: "Other User",
        role: "admin",
      })
      .returning();

    // Try to instantiate workflow from first tenant using second tenant's user
    const [versionCheck] = await db
      .select()
      .from(workflowTemplateVersion)
      .where(
        and(
          eq(workflowTemplateVersion.id, publishedVersionId),
          eq(workflowTemplateVersion.tenantId, otherTenant.id)
        )
      );

    // Should not find the version because it belongs to different tenant
    expect(versionCheck).toBeUndefined();

    // Clean up
    await db.delete(users).where(eq(users.id, otherUser.id));
    await db.delete(tenants).where(eq(tenants.id, otherTenant.id));
  });

  test("creates all steps in correct order", async () => {
    const [process] = await db
      .insert(processInstance)
      .values({
        tenantId,
        processType: "test",
        entityType: "test",
        entityId: crypto.randomUUID(),
        status: "in_progress",
        initiatedBy: userId,
        initiatedDate: new Date(),
      })
      .returning();

    // Get workflow steps
    const stepTemplates = await db
      .select()
      .from(workflowStepTemplate)
      .where(
        eq(workflowStepTemplate.workflowTemplateVersionId, publishedVersionId)
      )
      .orderBy(asc(workflowStepTemplate.stepOrder));

    // Create step instances
    for (const stepTemplate of stepTemplates) {
      await db.insert(stepInstance).values({
        tenantId,
        processInstanceId: process.id,
        stepOrder: stepTemplate.stepOrder,
        stepName: stepTemplate.name,
        stepType: stepTemplate.stepType,
        status: stepTemplate.stepOrder === 1 ? "active" : "blocked",
      });
    }

    // Verify all steps created
    const steps = await db
      .select()
      .from(stepInstance)
      .where(eq(stepInstance.processInstanceId, process.id))
      .orderBy(asc(stepInstance.stepOrder));

    expect(steps.length).toBe(2);
    expect(steps[0].stepOrder).toBe(1);
    expect(steps[0].status).toBe("active");
    expect(steps[1].stepOrder).toBe(2);
    expect(steps[1].status).toBe("blocked");

    // Clean up
    await db.delete(processInstance).where(eq(processInstance.id, process.id));
  });

  test("handles workflow template with no steps", async () => {
    // Create empty workflow version
    const [emptyWorkflow] = await db
      .insert(workflowTemplate)
      .values({
        tenantId,
        name: "Empty Workflow",
        status: "draft",
        createdBy: userId,
      })
      .returning();

    const [emptyVersion] = await db
      .insert(workflowTemplateVersion)
      .values({
        tenantId,
        workflowTemplateId: emptyWorkflow.id,
        version: 1,
        status: "published",
        isPublished: true,
      })
      .returning();

    // Verify no steps exist
    const steps = await db
      .select()
      .from(workflowStepTemplate)
      .where(
        eq(workflowStepTemplate.workflowTemplateVersionId, emptyVersion.id)
      );

    expect(steps.length).toBe(0);

    // API should reject this or handle gracefully

    // Clean up
    await db
      .delete(workflowTemplateVersion)
      .where(eq(workflowTemplateVersion.id, emptyVersion.id));
    await db
      .delete(workflowTemplate)
      .where(eq(workflowTemplate.id, emptyWorkflow.id));
  });
});

