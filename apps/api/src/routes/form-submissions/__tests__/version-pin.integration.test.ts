/**
 * SUP-30: submissions pinned to form_template_version — GET/submit/create-draft
 *
 * Regression: structure and validation must use submission.form_template_version_id
 * (and step pins for new workflow drafts), not all rows under form_template_id.
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

setDefaultTimeout(60_000);

mock.module("../../../lib/rbac/middleware", () => ({
  authenticate: new Elysia({ name: "auth" }),
}));

const { getSubmissionRoute } = await import("../get");
const { createDraftRoute } = await import("../create-draft");
const { submitRoute } = await import("../submit");
const { withApiErrorHandler } = await import("../../../lib/test-utils");

import { db } from "../../../lib/db";
import { and, eq, isNull } from "drizzle-orm";
import {
  tenants,
  users,
  formTemplate,
  formTemplateVersion,
  FormTemplateStatus,
  FormTemplateVersionStatus,
  formSection,
  formField,
  formSubmission,
  formAnswer,
  processInstance,
  stepInstance,
  insertDraftFormTemplateVersion,
  publishFormTemplateFromDraft,
  getPublishedHeadFormTemplateVersion,
  getDraftFormTemplateVersionForTemplate,
  workflowTemplate,
  workflowStepTemplate,
} from "@supplex/db";
import type { AuthContext } from "../../../lib/rbac/middleware";
import { logger } from "../../../lib/logger";
import { asUserRole } from "../../../lib/test-utils";
import { insertOneOrThrow } from "../../../lib/db-helpers";

function createGetApp(user: AuthContext["user"]) {
  return withApiErrorHandler(
    new Elysia()
      .derive(() => ({ user, requestLogger: logger.child({ test: true }) }))
      .use(getSubmissionRoute)
  );
}

function createDraftApp(user: AuthContext["user"]) {
  return withApiErrorHandler(
    new Elysia()
      .derive(() => ({ user, requestLogger: logger.child({ test: true }) }))
      .use(createDraftRoute)
  );
}

function createSubmitApp(user: AuthContext["user"]) {
  return withApiErrorHandler(
    new Elysia()
      .derive(() => ({
        user,
        requestLogger: logger.child({ test: true }),
        correlationId: "test",
      }))
      .use(submitRoute)
  );
}

describe("Form submissions — version pin (SUP-30)", () => {
  let tenant: { id: string };
  let testUser: AuthContext["user"];

  beforeAll(async () => {
    tenant = await insertOneOrThrow(db, tenants, {
      name: "SUP-30 pin tenant",
      slug: `sup30-${Date.now()}`,
    });

    const u = await insertOneOrThrow(db, users, {
      id: crypto.randomUUID(),
      tenantId: tenant.id,
      email: `sup30-${Date.now()}@test.com`,
      fullName: "SUP-30 User",
      role: "admin",
    });

    testUser = {
      id: u.id,
      email: u.email,
      role: asUserRole(u.role),
      tenantId: tenant.id,
      fullName: u.fullName,
    };
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenant.id));
  });

  test("GET shows v1 section title after v2 publish changes draft title", async () => {
    const tpl = await insertOneOrThrow(db, formTemplate, {
      tenantId: tenant.id,
      name: `Pin GET ${Date.now()}`,
      status: FormTemplateStatus.DRAFT,
    });

    const draft0 = await insertDraftFormTemplateVersion(db, {
      formTemplateId: tpl.id,
      tenantId: tenant.id,
    });

    const section0 = await insertOneOrThrow(db, formSection, {
      formTemplateVersionId: draft0.id,
      tenantId: tenant.id,
      sectionOrder: 1,
      sectionKey: "original_section",
      title: "Original Section",
    });

    await insertOneOrThrow(db, formField, {
      formSectionId: section0.id,
      formTemplateVersionId: draft0.id,
      tenantId: tenant.id,
      fieldOrder: 1,
      fieldKey: "a",
      fieldType: "text",
      label: "A",
      required: false,
    });

    await db.transaction(async (tx) => {
      await publishFormTemplateFromDraft(tx, {
        formTemplateId: tpl.id,
        tenantId: tenant.id,
        actorUserId: testUser.id,
      });
    });

    const v1 = await db.query.formTemplateVersion.findFirst({
      where: and(
        eq(formTemplateVersion.formTemplateId, tpl.id),
        eq(formTemplateVersion.versionNumber, 1),
        isNull(formTemplateVersion.deletedAt)
      ),
    });
    expect(v1).toBeDefined();
    if (!v1) throw new Error("expected v1");

    const draft1 = await getDraftFormTemplateVersionForTemplate(db, {
      formTemplateId: tpl.id,
      tenantId: tenant.id,
    });
    expect(draft1).not.toBeNull();
    if (!draft1) throw new Error("expected draft");

    const [draftSection] = await db
      .select()
      .from(formSection)
      .where(
        and(
          eq(formSection.formTemplateVersionId, draft1.id),
          isNull(formSection.deletedAt)
        )
      );

    expect(draftSection).toBeDefined();
    if (!draftSection) throw new Error("expected draftSection");
    await db
      .update(formSection)
      .set({ title: "Renamed On Draft" })
      .where(eq(formSection.id, draftSection.id));

    await db.transaction(async (tx) => {
      await publishFormTemplateFromDraft(tx, {
        formTemplateId: tpl.id,
        tenantId: tenant.id,
        actorUserId: testUser.id,
      });
    });

    const submission = await insertOneOrThrow(db, formSubmission, {
      tenantId: tenant.id,
      formTemplateId: tpl.id,
      formTemplateVersionId: v1.id,
      submittedBy: testUser.id,
      status: "submitted",
      submittedAt: new Date(),
    });

    const app = createGetApp(testUser);
    const res = await app.handle(
      new Request(`http://localhost/${submission.id}`, { method: "GET" })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: true;
      data: {
        formStructure: {
          sections: Array<{ title: string; fields: unknown[] }>;
        };
      };
    };
    expect(body.success).toBe(true);
    expect(body.data.formStructure.sections).toHaveLength(1);
    expect(body.data.formStructure.sections[0]?.title).toBe("Original Section");
  });

  test("GET v1 submission still shows field soft-deleted before v2 publish", async () => {
    const tpl = await insertOneOrThrow(db, formTemplate, {
      tenantId: tenant.id,
      name: `Pin field rem ${Date.now()}`,
      status: FormTemplateStatus.DRAFT,
    });

    const draft0 = await insertDraftFormTemplateVersion(db, {
      formTemplateId: tpl.id,
      tenantId: tenant.id,
    });

    const section0 = await insertOneOrThrow(db, formSection, {
      formTemplateVersionId: draft0.id,
      tenantId: tenant.id,
      sectionOrder: 1,
      sectionKey: "s",
      title: "S",
    });

    await insertOneOrThrow(db, formField, {
      formSectionId: section0.id,
      formTemplateVersionId: draft0.id,
      tenantId: tenant.id,
      fieldOrder: 1,
      fieldKey: "keep",
      fieldType: "text",
      label: "Keep",
      required: false,
    });

    await insertOneOrThrow(db, formField, {
      formSectionId: section0.id,
      formTemplateVersionId: draft0.id,
      tenantId: tenant.id,
      fieldOrder: 2,
      fieldKey: "removeme",
      fieldType: "text",
      label: "RemoveMe",
      required: false,
    });

    await db.transaction(async (tx) => {
      await publishFormTemplateFromDraft(tx, {
        formTemplateId: tpl.id,
        tenantId: tenant.id,
        actorUserId: testUser.id,
      });
    });

    const v1 = await db.query.formTemplateVersion.findFirst({
      where: and(
        eq(formTemplateVersion.formTemplateId, tpl.id),
        eq(formTemplateVersion.versionNumber, 1),
        isNull(formTemplateVersion.deletedAt)
      ),
    });
    expect(v1).toBeDefined();
    if (!v1) throw new Error("expected v1");

    const v1Fields = await db
      .select()
      .from(formField)
      .where(
        and(
          eq(formField.formTemplateVersionId, v1.id),
          isNull(formField.deletedAt)
        )
      );

    const fKeepV1 = v1Fields.find((f) => f.label === "Keep");
    const fRemoveV1 = v1Fields.find((f) => f.label === "RemoveMe");
    expect(fKeepV1).toBeDefined();
    expect(fRemoveV1).toBeDefined();
    if (!fKeepV1) throw new Error("expected fKeepV1");

    const draft1 = await getDraftFormTemplateVersionForTemplate(db, {
      formTemplateId: tpl.id,
      tenantId: tenant.id,
    });
    expect(draft1).not.toBeNull();
    if (!draft1) throw new Error("expected draft1");

    const [draftRemoveField] = await db
      .select()
      .from(formField)
      .where(
        and(
          eq(formField.formTemplateVersionId, draft1.id),
          eq(formField.label, "RemoveMe"),
          isNull(formField.deletedAt)
        )
      );

    expect(draftRemoveField).toBeDefined();
    if (!draftRemoveField) throw new Error("expected draftRemoveField");

    await db
      .update(formField)
      .set({ deletedAt: new Date() })
      .where(eq(formField.id, draftRemoveField.id));

    await db.transaction(async (tx) => {
      await publishFormTemplateFromDraft(tx, {
        formTemplateId: tpl.id,
        tenantId: tenant.id,
        actorUserId: testUser.id,
      });
    });

    const submission = await insertOneOrThrow(db, formSubmission, {
      tenantId: tenant.id,
      formTemplateId: tpl.id,
      formTemplateVersionId: v1.id,
      submittedBy: testUser.id,
      status: "submitted",
      submittedAt: new Date(),
    });

    await db.insert(formAnswer).values({
      formSubmissionId: submission.id,
      formFieldId: fKeepV1.id,
      tenantId: tenant.id,
      answerValue: "x",
    });

    const app = createGetApp(testUser);
    const res = await app.handle(
      new Request(`http://localhost/${submission.id}`, { method: "GET" })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: true;
      data: {
        formStructure: { sections: Array<{ fields: { label: string }[] }> };
      };
    };
    const labels = body.data.formStructure.sections.flatMap((s) =>
      s.fields.map((f) => f.label)
    );
    expect(labels).toContain("Keep");
    expect(labels).toContain("RemoveMe");
  });

  test("submit validates required fields only on pinned v1 when v2 adds required field", async () => {
    const tpl = await insertOneOrThrow(db, formTemplate, {
      tenantId: tenant.id,
      name: `Pin submit ${Date.now()}`,
      status: FormTemplateStatus.DRAFT,
    });

    const draft0 = await insertDraftFormTemplateVersion(db, {
      formTemplateId: tpl.id,
      tenantId: tenant.id,
    });

    const section0 = await insertOneOrThrow(db, formSection, {
      formTemplateVersionId: draft0.id,
      tenantId: tenant.id,
      sectionOrder: 1,
      sectionKey: "s",
      title: "S",
    });

    await insertOneOrThrow(db, formField, {
      formSectionId: section0.id,
      formTemplateVersionId: draft0.id,
      tenantId: tenant.id,
      fieldOrder: 1,
      fieldKey: "onlyv1required",
      fieldType: "text",
      label: "OnlyV1Required",
      required: true,
    });

    await insertOneOrThrow(db, formField, {
      formSectionId: section0.id,
      formTemplateVersionId: draft0.id,
      tenantId: tenant.id,
      fieldOrder: 2,
      fieldKey: "opt",
      fieldType: "text",
      label: "Opt",
      required: false,
    });

    await db.transaction(async (tx) => {
      await publishFormTemplateFromDraft(tx, {
        formTemplateId: tpl.id,
        tenantId: tenant.id,
        actorUserId: testUser.id,
      });
    });

    const v1 = await db.query.formTemplateVersion.findFirst({
      where: and(
        eq(formTemplateVersion.formTemplateId, tpl.id),
        eq(formTemplateVersion.versionNumber, 1),
        isNull(formTemplateVersion.deletedAt)
      ),
    });

    expect(v1).toBeDefined();
    const draft1 = await getDraftFormTemplateVersionForTemplate(db, {
      formTemplateId: tpl.id,
      tenantId: tenant.id,
    });
    expect(draft1).not.toBeNull();
    if (!draft1) throw new Error("expected draft1");
    if (!v1) throw new Error("expected v1");

    const [draftSecForV2] = await db
      .select()
      .from(formSection)
      .where(eq(formSection.formTemplateVersionId, draft1.id));

    expect(draftSecForV2).toBeDefined();
    if (!draftSecForV2) throw new Error("expected draftSecForV2");

    await insertOneOrThrow(db, formField, {
      formSectionId: draftSecForV2.id,
      formTemplateVersionId: draft1.id,
      tenantId: tenant.id,
      fieldOrder: 99,
      fieldKey: "v2onlyrequired",
      fieldType: "text",
      label: "V2OnlyRequired",
      required: true,
    });

    await db.transaction(async (tx) => {
      await publishFormTemplateFromDraft(tx, {
        formTemplateId: tpl.id,
        tenantId: tenant.id,
        actorUserId: testUser.id,
      });
    });

    const [v1RequiredField] = await db
      .select()
      .from(formField)
      .where(
        and(
          eq(formField.formTemplateVersionId, v1.id),
          eq(formField.label, "OnlyV1Required"),
          isNull(formField.deletedAt)
        )
      );

    expect(v1RequiredField).toBeDefined();
    if (!v1RequiredField) throw new Error("expected v1RequiredField");

    const submission = await insertOneOrThrow(db, formSubmission, {
      tenantId: tenant.id,
      formTemplateId: tpl.id,
      formTemplateVersionId: v1.id,
      submittedBy: testUser.id,
      status: "draft",
      submittedAt: null,
    });

    await db.insert(formAnswer).values({
      formSubmissionId: submission.id,
      formFieldId: v1RequiredField.id,
      tenantId: tenant.id,
      answerValue: "filled",
    });

    const app = createSubmitApp(testUser);
    const res = await app.handle(
      new Request(`http://localhost/${submission.id}/submit`, {
        method: "POST",
      })
    );
    expect(res.status).toBe(200);
  });

  test("create-draft update after republish validates answers against original submission version", async () => {
    const tpl = await insertOneOrThrow(db, formTemplate, {
      tenantId: tenant.id,
      name: `Pin draft upd ${Date.now()}`,
      status: FormTemplateStatus.DRAFT,
    });

    const draft0 = await insertDraftFormTemplateVersion(db, {
      formTemplateId: tpl.id,
      tenantId: tenant.id,
    });

    const section0 = await insertOneOrThrow(db, formSection, {
      formTemplateVersionId: draft0.id,
      tenantId: tenant.id,
      sectionOrder: 1,
      sectionKey: "s",
      title: "S",
    });

    await insertOneOrThrow(db, formField, {
      formSectionId: section0.id,
      formTemplateVersionId: draft0.id,
      tenantId: tenant.id,
      fieldOrder: 1,
      fieldKey: "f1",
      fieldType: "text",
      label: "F1",
      required: false,
    });

    await db.transaction(async (tx) => {
      await publishFormTemplateFromDraft(tx, {
        formTemplateId: tpl.id,
        tenantId: tenant.id,
        actorUserId: testUser.id,
      });
    });

    const v1 = await getPublishedHeadFormTemplateVersion(db, {
      formTemplateId: tpl.id,
      tenantId: tenant.id,
    });
    expect(v1).not.toBeNull();
    if (!v1) throw new Error("expected v1");

    const [v1F1] = await db
      .select({ id: formField.id })
      .from(formField)
      .where(
        and(
          eq(formField.formTemplateVersionId, v1.id),
          eq(formField.label, "F1"),
          isNull(formField.deletedAt)
        )
      );

    expect(v1F1).toBeDefined();
    if (!v1F1) throw new Error("expected v1F1");

    await insertOneOrThrow(db, formSubmission, {
      tenantId: tenant.id,
      formTemplateId: tpl.id,
      formTemplateVersionId: v1.id,
      submittedBy: testUser.id,
      status: "draft",
      processInstanceId: null,
      stepInstanceId: null,
    });

    const draft1 = await getDraftFormTemplateVersionForTemplate(db, {
      formTemplateId: tpl.id,
      tenantId: tenant.id,
    });
    if (!draft1) throw new Error("expected draft1");
    const [draftSec] = await db
      .select()
      .from(formSection)
      .where(eq(formSection.formTemplateVersionId, draft1.id));
    if (!draftSec) throw new Error("expected draftSec");
    await insertOneOrThrow(db, formField, {
      formSectionId: draftSec.id,
      formTemplateVersionId: draft1.id,
      tenantId: tenant.id,
      fieldOrder: 2,
      fieldKey: "onlyonv2draft",
      fieldType: "text",
      label: "OnlyOnV2Draft",
      required: false,
    });

    await db.transaction(async (tx) => {
      await publishFormTemplateFromDraft(tx, {
        formTemplateId: tpl.id,
        tenantId: tenant.id,
        actorUserId: testUser.id,
      });
    });

    const app = createDraftApp(testUser);
    const res = await app.handle(
      new Request("http://localhost/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formTemplateId: tpl.id,
          processInstanceId: null,
          stepInstanceId: null,
          answers: [
            {
              formFieldId: v1F1.id,
              answerValue: "ok",
            },
          ],
        }),
      })
    );

    expect(res.status).toBe(200);
  });

  test("create-draft rejects FORM_TEMPLATE_PIN_MISMATCH when template id does not match step pin", async () => {
    const tplA = await insertOneOrThrow(db, formTemplate, {
      tenantId: tenant.id,
      name: `Tpl A ${Date.now()}`,
      status: "published",
    });

    const verA = await insertOneOrThrow(db, formTemplateVersion, {
      formTemplateId: tplA.id,
      tenantId: tenant.id,
      versionNumber: 1,
      status: FormTemplateVersionStatus.PUBLISHED,
    });

    const tplB = await insertOneOrThrow(db, formTemplate, {
      tenantId: tenant.id,
      name: `Tpl B ${Date.now()}`,
      status: "published",
    });

    await insertOneOrThrow(db, formTemplateVersion, {
      formTemplateId: tplB.id,
      tenantId: tenant.id,
      versionNumber: 1,
      status: FormTemplateVersionStatus.PUBLISHED,
    });

    const wf = await insertOneOrThrow(db, workflowTemplate, {
      tenantId: tenant.id,
      name: `WF mismatch ${Date.now()}`,
      status: "published",
      createdBy: testUser.id,
    });

    const stepTpl = await insertOneOrThrow(db, workflowStepTemplate, {
      workflowTemplateId: wf.id,
      tenantId: tenant.id,
      stepOrder: 1,
      name: "Form",
      stepType: "form",
      requiresValidation: false,
      taskTitle: "Fill",
      assigneeType: "role",
      assigneeRole: "admin",
    });

    const proc = await insertOneOrThrow(db, processInstance, {
      tenantId: tenant.id,
      workflowTemplateId: wf.id,
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
      workflowStepTemplateId: stepTpl.id,
      stepOrder: 1,
      stepName: "Form",
      stepType: "form",
      status: "active",
      pinnedFormTemplateVersionId: verA.id,
    });

    const app = createDraftApp(testUser);
    const res = await app.handle(
      new Request("http://localhost/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formTemplateId: tplB.id,
          processInstanceId: proc.id,
          stepInstanceId: step.id,
          answers: [],
        }),
      })
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as {
      success: false;
      error: { code: string };
    };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("FORM_TEMPLATE_PIN_MISMATCH");
  });

  test("create-draft rejects STEP_PIN_VERSION_MISMATCH when existing draft version differs from step pin", async () => {
    const tpl = await insertOneOrThrow(db, formTemplate, {
      tenantId: tenant.id,
      name: `Pin mism ver ${Date.now()}`,
      status: "published",
    });

    const ver1 = await insertOneOrThrow(db, formTemplateVersion, {
      formTemplateId: tpl.id,
      tenantId: tenant.id,
      versionNumber: 1,
      status: FormTemplateVersionStatus.SUPERSEDED,
    });

    const ver2 = await insertOneOrThrow(db, formTemplateVersion, {
      formTemplateId: tpl.id,
      tenantId: tenant.id,
      versionNumber: 2,
      status: FormTemplateVersionStatus.PUBLISHED,
    });

    const wf = await insertOneOrThrow(db, workflowTemplate, {
      tenantId: tenant.id,
      name: `WF pin ver ${Date.now()}`,
      status: "published",
      createdBy: testUser.id,
    });

    const stepTpl = await insertOneOrThrow(db, workflowStepTemplate, {
      workflowTemplateId: wf.id,
      tenantId: tenant.id,
      stepOrder: 1,
      name: "Form",
      stepType: "form",
      requiresValidation: false,
      taskTitle: "Fill",
      assigneeType: "role",
      assigneeRole: "admin",
    });

    const proc = await insertOneOrThrow(db, processInstance, {
      tenantId: tenant.id,
      workflowTemplateId: wf.id,
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
      workflowStepTemplateId: stepTpl.id,
      stepOrder: 1,
      stepName: "Form",
      stepType: "form",
      status: "active",
      pinnedFormTemplateVersionId: ver2.id,
    });

    const sectionV1 = await insertOneOrThrow(db, formSection, {
      formTemplateVersionId: ver1.id,
      tenantId: tenant.id,
      sectionOrder: 1,
      sectionKey: "s",
      title: "S",
    });

    const fieldV1 = await insertOneOrThrow(db, formField, {
      formSectionId: sectionV1.id,
      formTemplateVersionId: ver1.id,
      tenantId: tenant.id,
      fieldOrder: 1,
      fieldKey: "legacy",
      fieldType: "text",
      label: "Legacy",
      required: false,
    });

    await insertOneOrThrow(db, formSubmission, {
      tenantId: tenant.id,
      formTemplateId: tpl.id,
      formTemplateVersionId: ver1.id,
      processInstanceId: proc.id,
      stepInstanceId: step.id,
      submittedBy: testUser.id,
      status: "draft",
    });

    const app = createDraftApp(testUser);
    const res = await app.handle(
      new Request("http://localhost/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formTemplateId: tpl.id,
          processInstanceId: proc.id,
          stepInstanceId: step.id,
          answers: [{ formFieldId: fieldV1.id, answerValue: "x" }],
        }),
      })
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as {
      success: false;
      error: { code: string };
    };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("STEP_PIN_VERSION_MISMATCH");
  });
});
