/**
 * Route-Level Integration Tests: GET /api/form-submissions/:submissionId
 *
 * Covers the read path's access-control logic, including the canValidate
 * flag used by the frontend to drive the validator UI:
 *   - submitter without a validation task -> canValidate=false, isReadOnly=false
 *   - submitter who also has a pending validation task (e.g. PM acting on
 *     behalf of a supplier without a user) -> canValidate=true, isReadOnly=true
 *   - non-submitter validator assigned by user id -> canValidate=true, isReadOnly=true
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

mock.module("../../../lib/rbac/middleware", () => ({
  authenticate: new Elysia({ name: "auth" }),
}));

const { getSubmissionRoute } = await import("../get");
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
  workflowTemplate,
  workflowStepTemplate,
  processInstance,
  stepInstance,
  taskInstance,
} from "@supplex/db";
import type { AuthContext } from "../../../lib/rbac/middleware";
import { logger } from "../../../lib/logger";
import { asUserRole } from "../../../lib/test-utils";

interface SubmissionGetSuccess {
  success: true;
  data: {
    canValidate: boolean;
    isReadOnly: boolean;
    [key: string]: unknown;
  };
}

interface SubmissionGetError {
  success: false;
  error: { code: string; message: string };
}

type SubmissionGetBody = SubmissionGetSuccess | SubmissionGetError;

function createApp(user: AuthContext["user"]) {
  return withApiErrorHandler(
    new Elysia()
      .derive(() => ({ user, requestLogger: logger.child({ test: true }) }))
      .use(getSubmissionRoute)
  );
}

describe("Form Submissions — GET :submissionId (access control & canValidate)", () => {
  let tenant: { id: string };
  let submitterUser: AuthContext["user"];
  let validatorUser: AuthContext["user"];
  let fmTemplate: { id: string };
  let section: { id: string };
  let _field: { id: string };
  let wfTemplate: { id: string };
  let stepTemplate: { id: string };

  beforeAll(async () => {
    tenant = (
      await db
        .insert(tenants)
        .values({
          name: "Get Submission Test Tenant",
          slug: `getsub-${Date.now()}`,
        })
        .returning()
    )[0]!;

    const u1 = (
      await db
        .insert(users)
        .values({
          id: crypto.randomUUID(),
          tenantId: tenant.id,
          email: `getsub-pm-${Date.now()}@test.com`,
          fullName: "Procurement Manager",
          role: "procurement_manager",
        })
        .returning()
    )[0]!;

    submitterUser = {
      id: u1.id,
      email: u1.email,
      role: asUserRole(u1.role),
      tenantId: tenant.id,
      fullName: u1.fullName,
    };

    const u2 = (
      await db
        .insert(users)
        .values({
          id: crypto.randomUUID(),
          tenantId: tenant.id,
          email: `getsub-qm-${Date.now()}@test.com`,
          fullName: "Quality Manager",
          role: "quality_manager",
        })
        .returning()
    )[0]!;

    validatorUser = {
      id: u2.id,
      email: u2.email,
      role: asUserRole(u2.role),
      tenantId: tenant.id,
      fullName: u2.fullName,
    };

    fmTemplate = (
      await db
        .insert(formTemplate)
        .values({
          tenantId: tenant.id,
          name: "Get Submission Form",
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

    _field = (
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
          name: "Get Submission Workflow",
          status: "published",
          createdBy: submitterUser.id,
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
          requiresValidation: true,
          taskTitle: "Fill form",
          assigneeType: "role",
          assigneeRole: "procurement_manager",
        })
        .returning()
    )[0]!;
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenant.id));
  });

  async function seedSubmission(params: {
    submittedBy: string;
    status?: "draft" | "submitted";
    withStep?: boolean;
  }) {
    let stepId: string | null = null;
    let procId: string | null = null;

    if (params.withStep !== false) {
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
            initiatedBy: submitterUser.id,
            initiatedDate: new Date(),
          })
          .returning()
      )[0]!;
      procId = proc.id;

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
            status: "awaiting_validation",
          })
          .returning()
      )[0]!;
      stepId = step.id;
    }

    const submission = (
      await db
        .insert(formSubmission)
        .values({
          tenantId: tenant.id,
          formTemplateId: fmTemplate.id,
          processInstanceId: procId,
          stepInstanceId: stepId,
          submittedBy: params.submittedBy,
          status: params.status ?? "submitted",
          submittedAt: params.status === "draft" ? null : new Date(),
        })
        .returning()
    )[0]!;

    return { submission, stepId, procId };
  }

  test("submitter without validation task -> canValidate=false, isReadOnly=false", async () => {
    const { submission } = await seedSubmission({
      submittedBy: submitterUser.id,
      status: "submitted",
    });

    const app = createApp(submitterUser);
    const response = await app.handle(
      new Request(`http://localhost/${submission.id}`, { method: "GET" })
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as SubmissionGetBody;
    expect(body.success).toBe(true);
    if (!body.success) return;
    expect(body.data.canValidate).toBe(false);
    expect(body.data.isReadOnly).toBe(false);
  });

  test("submitter who is also validator (role-based) -> canValidate=true, isReadOnly=true", async () => {
    const { submission, stepId, procId } = await seedSubmission({
      submittedBy: submitterUser.id,
      status: "submitted",
    });

    // Role-based validation task for the same step, matching submitter's role.
    await db.insert(taskInstance).values({
      tenantId: tenant.id,
      processInstanceId: procId!,
      stepInstanceId: stepId!,
      assigneeType: "role",
      assigneeRole: submitterUser.role,
      assigneeUserId: null,
      title: "Validate: Submit Form",
      taskType: "validation",
      status: "pending",
      metadata: {},
    });

    const app = createApp(submitterUser);
    const response = await app.handle(
      new Request(`http://localhost/${submission.id}`, { method: "GET" })
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as SubmissionGetBody;
    expect(body.success).toBe(true);
    if (!body.success) return;
    expect(body.data.canValidate).toBe(true);
    expect(body.data.isReadOnly).toBe(true);
  });

  test("draft with a pending action task on the same step -> canValidate=false", async () => {
    // Regression: after a next-step activation, the newly-created draft
    // form submission on that step has a pending action task assigned to
    // the submitter. That must NOT turn on the validator UI.
    const { submission, stepId, procId } = await seedSubmission({
      submittedBy: submitterUser.id,
      status: "draft",
    });

    await db.insert(taskInstance).values({
      tenantId: tenant.id,
      processInstanceId: procId!,
      stepInstanceId: stepId!,
      assigneeType: "user",
      assigneeUserId: submitterUser.id,
      title: "Fill form",
      taskType: "action",
      status: "pending",
      metadata: {},
    });

    const app = createApp(submitterUser);
    const response = await app.handle(
      new Request(`http://localhost/${submission.id}`, { method: "GET" })
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as SubmissionGetBody;
    expect(body.success).toBe(true);
    if (!body.success) return;
    expect(body.data.canValidate).toBe(false);
    expect(body.data.isReadOnly).toBe(false);
  });

  test("non-submitter validator assigned by user id -> canValidate=true, isReadOnly=true", async () => {
    const { submission, stepId, procId } = await seedSubmission({
      submittedBy: submitterUser.id,
      status: "submitted",
    });

    await db.insert(taskInstance).values({
      tenantId: tenant.id,
      processInstanceId: procId!,
      stepInstanceId: stepId!,
      assigneeType: "user",
      assigneeUserId: validatorUser.id,
      title: "Validate: Submit Form",
      taskType: "validation",
      status: "pending",
      metadata: {},
    });

    const app = createApp(validatorUser);
    const response = await app.handle(
      new Request(`http://localhost/${submission.id}`, { method: "GET" })
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as SubmissionGetBody;
    expect(body.success).toBe(true);
    if (!body.success) return;
    expect(body.data.canValidate).toBe(true);
    expect(body.data.isReadOnly).toBe(true);
  });
});
