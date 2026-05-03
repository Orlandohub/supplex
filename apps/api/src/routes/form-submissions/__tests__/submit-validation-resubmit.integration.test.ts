/**
 * Integration: validation round-trip + invariant behavior (WFH txn)
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

setDefaultTimeout(120_000);

mock.module("../../../lib/rbac/middleware", () => ({
  authenticate: new Elysia({ name: "auth" }),
}));

const { submitRoute } = await import("../submit");
const { completeStepRoute } = await import("../../workflows/steps/complete");
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
import { asUserRole } from "../../../lib/test-utils";
import { insertOneOrThrow, selectFirstOrThrow } from "../../../lib/db-helpers";

function createCombinedApp(user: AuthContext["user"]) {
  return withApiErrorHandler(
    new Elysia()
      .derive(() => ({ user, requestLogger: logger.child({ test: true }) }))
      .use(submitRoute)
      .use(new Elysia({ prefix: "/api/workflows" }).use(completeStepRoute))
  );
}

describe("Form submit + validation decline + resubmit", () => {
  let tenant: { id: string };
  let testUser: AuthContext["user"];
  let fmTemplate: { id: string };
  let fieldId: string;
  let wfVal: { id: string };
  let stepTplVal: { id: string };

  beforeAll(async () => {
    tenant = await insertOneOrThrow(db, tenants, {
      name: "Val-Resubmit Tenant",
      slug: `val-resubmit-${Date.now()}`,
    });

    const u = await insertOneOrThrow(db, users, {
      id: crypto.randomUUID(),
      tenantId: tenant.id,
      email: `val-resubmit-admin-${Date.now()}@test.com`,
      fullName: "Val Resubmit Admin",
      role: "admin",
    });

    testUser = {
      id: u.id,
      email: u.email,
      role: asUserRole(u.role),
      tenantId: tenant.id,
      fullName: u.fullName,
    };

    const fm = await insertOneOrThrow(db, formTemplate, {
      tenantId: tenant.id,
      name: "Val Form",
      status: "published",
    });

    const section = await insertOneOrThrow(db, formSection, {
      formTemplateId: fm.id,
      tenantId: tenant.id,
      sectionOrder: 1,
      title: "S1",
    });

    const fld = await insertOneOrThrow(db, formField, {
      formSectionId: section.id,
      tenantId: tenant.id,
      fieldOrder: 1,
      fieldType: "text",
      label: "Name",
      required: true,
    });
    fieldId = fld.id;
    fmTemplate = fm;

    wfVal = await insertOneOrThrow(db, workflowTemplate, {
      tenantId: tenant.id,
      name: "Val Workflow",
      status: "published",
      createdBy: u.id,
    });

    stepTplVal = await insertOneOrThrow(db, workflowStepTemplate, {
      workflowTemplateId: wfVal.id,
      tenantId: tenant.id,
      stepOrder: 1,
      name: "Needs validation",
      stepType: "form",
      requiresValidation: true,
      validationConfig: { approverRoles: ["admin"] },
      taskTitle: "Fill",
      assigneeType: "role",
      assigneeRole: "admin",
    });
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenant.id));
  });

  test("requiresValidation submit then decline then same submission resubmit → 200", async () => {
    const proc = await insertOneOrThrow(db, processInstance, {
      tenantId: tenant.id,
      workflowTemplateId: wfVal.id,
      processType: "workflow_execution",
      entityType: "supplier",
      entityId: crypto.randomUUID(),
      status: "in_progress",
      initiatedBy: testUser.id,
      initiatedDate: new Date(),
    });

    const step = await insertOneOrThrow(db, stepInstance, {
      tenantId: tenant.id,
      processInstanceId: proc.id,
      workflowStepTemplateId: stepTplVal.id,
      stepOrder: 1,
      stepName: "Needs validation",
      stepType: "form",
      status: "active",
    });

    await db.insert(taskInstance).values({
      tenantId: tenant.id,
      processInstanceId: proc.id,
      stepInstanceId: step.id,
      assigneeType: "user",
      assigneeUserId: testUser.id,
      title: "Fill",
      taskType: "action",
      status: "pending",
      metadata: {},
    });

    const submission = await insertOneOrThrow(db, formSubmission, {
      tenantId: tenant.id,
      formTemplateId: fmTemplate.id,
      processInstanceId: proc.id,
      stepInstanceId: step.id,
      submittedBy: testUser.id,
      status: "draft",
    });

    await db.insert(formAnswer).values({
      formSubmissionId: submission.id,
      formFieldId: fieldId,
      tenantId: tenant.id,
      answerValue: "First",
    });

    const app = createCombinedApp(testUser);

    const r1 = await app.handle(
      new Request(`http://localhost/${submission.id}/submit`, {
        method: "POST",
      })
    );
    expect(r1.status).toBe(200);
    const afterFirst = await selectFirstOrThrow(
      db
        .select()
        .from(formSubmission)
        .where(eq(formSubmission.id, submission.id))
    );
    expect(afterFirst.status).toBe("submitted");

    const stepAfterFirst = await selectFirstOrThrow(
      db.select().from(stepInstance).where(eq(stepInstance.id, step.id))
    );
    expect(stepAfterFirst.status).toBe("awaiting_validation");

    const decline = await app.handle(
      new Request(`http://localhost/api/workflows/steps/${step.id}/complete`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "decline",
          comment: "revise fields",
        }),
      })
    );
    expect(decline.status).toBe(200);
    const afterDecline = await selectFirstOrThrow(
      db
        .select()
        .from(formSubmission)
        .where(eq(formSubmission.id, submission.id))
    );
    expect(afterDecline.status).toBe("draft");

    const stepAfterDecline = await selectFirstOrThrow(
      db.select().from(stepInstance).where(eq(stepInstance.id, step.id))
    );
    expect(stepAfterDecline.status).toBe("active");

    const r2 = await app.handle(
      new Request(`http://localhost/${submission.id}/submit`, {
        method: "POST",
      })
    );
    expect(r2.status).toBe(200);
  }, 180_000);
});
