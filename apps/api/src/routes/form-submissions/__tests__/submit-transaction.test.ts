/**
 * Route-Level Integration Tests: Form Submit Transaction Safety
 * Story WFH-002
 *
 * Proves that submit.ts correctly:
 * - Wraps form update + completeStep in a single DB transaction
 * - Enforces verifyTaskAssignment before mutation
 * - Maps CAS failures to 409 Conflict
 * - Handles standalone (non-workflow) forms without transaction wrapping
 */

import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  setDefaultTimeout,
  mock,
} from "bun:test";
import { Elysia } from "elysia";

setDefaultTimeout(30_000);

// Mock authenticate BEFORE the route module is loaded.
// mock.module must be called before the dynamic import below.
mock.module("../../../lib/rbac/middleware", () => ({
  authenticate: new Elysia({ name: "auth" }),
}));

// Dynamic import so mock.module takes effect before submit.ts resolves its imports
const { submitRoute } = await import("../submit");
const { withApiErrorHandler } = await import("../../../lib/test-utils");

import { db } from "../../../lib/db";
import { eq } from "drizzle-orm";
import {
  tenants,
  users,
  formTemplate,
  formSection,
  formField,
  formSubmission,
  formAnswer,
  workflowTemplate,
  workflowStepTemplate,
  processInstance,
  stepInstance,
  taskInstance,
} from "@supplex/db";
import type { AuthContext } from "../../../lib/rbac/middleware";
import { logger } from "../../../lib/logger";

function createApp(user: AuthContext["user"]) {
  return withApiErrorHandler(
    new Elysia()
      .derive(() => ({ user, requestLogger: logger.child({ test: true }) }))
      .use(submitRoute)
  );
}

describe("Form Submit — Transaction Safety (WFH-002)", () => {
  let tenant: { id: string };
  let testUser: AuthContext["user"];
  let secondUser: AuthContext["user"];
  let fmTemplate: { id: string };
  let section: { id: string };
  let field: { id: string };
  let wfTemplate: { id: string };
  let stepTemplate: { id: string };

  beforeAll(async () => {
    tenant = (
      await db
        .insert(tenants)
        .values({ name: "WFH-002 Test Tenant", slug: `wfh002-${Date.now()}` })
        .returning()
    )[0]!;

    const user1 = (
      await db
        .insert(users)
        .values({
          id: crypto.randomUUID(),
          tenantId: tenant.id,
          email: `wfh002-user1-${Date.now()}@test.com`,
          fullName: "WFH-002 User 1",
          role: "admin",
        })
        .returning()
    )[0]!;

    testUser = {
      id: user1.id,
      email: user1.email,
      role: user1.role as any,
      tenantId: tenant.id,
      fullName: user1.fullName,
    };

    const user2 = (
      await db
        .insert(users)
        .values({
          id: crypto.randomUUID(),
          tenantId: tenant.id,
          email: `wfh002-user2-${Date.now()}@test.com`,
          fullName: "WFH-002 User 2",
          role: "admin",
        })
        .returning()
    )[0]!;

    secondUser = {
      id: user2.id,
      email: user2.email,
      role: user2.role as any,
      tenantId: tenant.id,
      fullName: user2.fullName,
    };

    fmTemplate = (
      await db
        .insert(formTemplate)
        .values({
          tenantId: tenant.id,
          name: "WFH-002 Form",
          status: "published",
        })
        .returning()
    )[0]!;

    section = (
      await db
        .insert(formSection)
        .values({
          formTemplateId: fmTemplate.id,
          tenantId: tenant.id,
          sectionOrder: 1,
          title: "Section 1",
        })
        .returning()
    )[0]!;

    field = (
      await db
        .insert(formField)
        .values({
          formSectionId: section.id,
          tenantId: tenant.id,
          fieldOrder: 1,
          fieldType: "text",
          label: "Company Name",
          required: true,
        })
        .returning()
    )[0]!;

    wfTemplate = (
      await db
        .insert(workflowTemplate)
        .values({
          tenantId: tenant.id,
          name: "WFH-002 Workflow",
          status: "published",
          createdBy: user1.id,
        })
        .returning()
    )[0]!;

    stepTemplate = (
      await db
        .insert(workflowStepTemplate)
        .values({
          workflowTemplateId: wfTemplate.id,
          tenantId: tenant.id,
          stepOrder: 1,
          name: "Submit Form",
          stepType: "form",
          requiresValidation: false,
          taskTitle: "Fill form",
          assigneeType: "role",
          assigneeRole: "admin",
        })
        .returning()
    )[0]!;
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenant.id));
  });

  async function seedWorkflowSubmission() {
    const proc = (
      await db
        .insert(processInstance)
        .values({
          tenantId: tenant.id,
          workflowTemplateId: wfTemplate.id,
          processType: "workflow_execution",
          entityType: "supplier",
          entityId: crypto.randomUUID(),
          status: "in_progress",
          initiatedBy: testUser.id,
          initiatedDate: new Date(),
        })
        .returning()
    )[0]!;

    const step = (
      await db
        .insert(stepInstance)
        .values({
          tenantId: tenant.id,
          processInstanceId: proc.id,
          workflowStepTemplateId: stepTemplate.id,
          stepOrder: 1,
          stepName: "Submit Form",
          stepType: "form",
          status: "active",
        })
        .returning()
    )[0]!;

    await db.insert(taskInstance).values({
      tenantId: tenant.id,
      processInstanceId: proc.id,
      stepInstanceId: step.id,
      assigneeType: "user",
      assigneeUserId: testUser.id,
      title: "Fill form",
      taskType: "action",
      status: "pending",
      metadata: {},
    });

    const submission = (
      await db
        .insert(formSubmission)
        .values({
          tenantId: tenant.id,
          formTemplateId: fmTemplate.id,
          processInstanceId: proc.id,
          stepInstanceId: step.id,
          submittedBy: testUser.id,
          status: "draft",
        })
        .returning()
    )[0]!;

    await db.insert(formAnswer).values({
      formSubmissionId: submission.id,
      formFieldId: field.id,
      tenantId: tenant.id,
      answerValue: "ACME Corp",
    });

    return { proc, step, submission };
  }

  // ---------------------------------------------------------------
  // 5.2: workflow-linked form submit → 200, form submitted, step completed
  // ---------------------------------------------------------------
  test("workflow-linked submit → 200, form submitted + step completed atomically", async () => {
    const { submission, step } = await seedWorkflowSubmission();
    const app = createApp(testUser);

    const response = await app.handle(
      new Request(`http://localhost/${submission.id}/submit`, {
        method: "POST",
      })
    );

    expect(response.status).toBe(200);

    const body: any = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.stepCompleted).toBe(true);

    const dbSubmission = (
      await db
        .select()
        .from(formSubmission)
        .where(eq(formSubmission.id, submission.id))
    )[0]!;
    expect(dbSubmission.status).toBe("submitted");
    expect(dbSubmission.submittedAt).not.toBeNull();

    const dbStep = (
      await db.select().from(stepInstance).where(eq(stepInstance.id, step.id))
    )[0]!;
    expect(["completed", "awaiting_validation"]).toContain(dbStep.status);
  });

  // ---------------------------------------------------------------
  // 5.3: CAS failure → rollback → form stays draft → 409
  // ---------------------------------------------------------------
  test("CAS failure → 409, form stays draft (transaction rolled back)", async () => {
    const { submission, step } = await seedWorkflowSubmission();

    // Simulate concurrent completion
    await db
      .update(stepInstance)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(stepInstance.id, step.id));

    const app = createApp(testUser);

    const response = await app.handle(
      new Request(`http://localhost/${submission.id}/submit`, {
        method: "POST",
      })
    );

    if (response.status !== 409) {
      const debugText = await response
        .clone()
        .text()
        .catch(() => "no body");
      console.error("CAS test debug:", response.status, debugText);
    }
    expect(response.status).toBe(409);

    const dbSubmission = (
      await db
        .select()
        .from(formSubmission)
        .where(eq(formSubmission.id, submission.id))
    )[0]!;
    expect(dbSubmission.status).toBe("draft");
    expect(dbSubmission.submittedAt).toBeNull();
  });

  // ---------------------------------------------------------------
  // 5.4: verifyTaskAssignment fails → 403 → form stays draft
  // ---------------------------------------------------------------
  test("no task assignment → 403, form stays draft", async () => {
    // Submission owned by secondUser, task assigned to testUser (not secondUser)
    const proc = (
      await db
        .insert(processInstance)
        .values({
          tenantId: tenant.id,
          workflowTemplateId: wfTemplate.id,
          processType: "workflow_execution",
          entityType: "supplier",
          entityId: crypto.randomUUID(),
          status: "in_progress",
          initiatedBy: secondUser.id,
          initiatedDate: new Date(),
        })
        .returning()
    )[0]!;

    const step = (
      await db
        .insert(stepInstance)
        .values({
          tenantId: tenant.id,
          processInstanceId: proc.id,
          workflowStepTemplateId: stepTemplate.id,
          stepOrder: 1,
          stepName: "Submit Form",
          stepType: "form",
          status: "active",
        })
        .returning()
    )[0]!;

    await db.insert(taskInstance).values({
      tenantId: tenant.id,
      processInstanceId: proc.id,
      stepInstanceId: step.id,
      assigneeType: "user",
      assigneeUserId: testUser.id,
      title: "Fill form",
      taskType: "action",
      status: "pending",
      metadata: {},
    });

    const submission = (
      await db
        .insert(formSubmission)
        .values({
          tenantId: tenant.id,
          formTemplateId: fmTemplate.id,
          processInstanceId: proc.id,
          stepInstanceId: step.id,
          submittedBy: secondUser.id,
          status: "draft",
        })
        .returning()
    )[0]!;

    await db.insert(formAnswer).values({
      formSubmissionId: submission.id,
      formFieldId: field.id,
      tenantId: tenant.id,
      answerValue: "Other Corp",
    });

    const app = createApp(secondUser);

    const response = await app.handle(
      new Request(`http://localhost/${submission.id}/submit`, {
        method: "POST",
      })
    );

    if (response.status !== 403) {
      const debugText = await response
        .clone()
        .text()
        .catch(() => "no body");
      console.error("403 test debug:", response.status, debugText);
    }
    expect(response.status).toBe(403);

    const dbSubmission = (
      await db
        .select()
        .from(formSubmission)
        .where(eq(formSubmission.id, submission.id))
    )[0]!;
    expect(dbSubmission.status).toBe("draft");
    expect(dbSubmission.submittedAt).toBeNull();
  });

  // ---------------------------------------------------------------
  // 5.5: standalone form (no stepInstanceId) → 200 + form submitted
  // ---------------------------------------------------------------
  test("standalone form (no stepInstanceId) → 200, form submitted", async () => {
    const standaloneSubmission = (
      await db
        .insert(formSubmission)
        .values({
          tenantId: tenant.id,
          formTemplateId: fmTemplate.id,
          processInstanceId: null,
          stepInstanceId: null,
          submittedBy: testUser.id,
          status: "draft",
        })
        .returning()
    )[0]!;

    await db.insert(formAnswer).values({
      formSubmissionId: standaloneSubmission.id,
      formFieldId: field.id,
      tenantId: tenant.id,
      answerValue: "Standalone Corp",
    });

    const app = createApp(testUser);

    const response = await app.handle(
      new Request(`http://localhost/${standaloneSubmission.id}/submit`, {
        method: "POST",
      })
    );

    expect(response.status).toBe(200);

    const body: any = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.stepCompleted).toBe(false);

    const dbSubmission = (
      await db
        .select()
        .from(formSubmission)
        .where(eq(formSubmission.id, standaloneSubmission.id))
    )[0]!;
    expect(dbSubmission.status).toBe("submitted");
    expect(dbSubmission.submittedAt).not.toBeNull();
  });
});
