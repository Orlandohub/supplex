/**
 * SUP-29: GET /api/form-templates/:id/publish-preview — structure diff + publish impact.
 *
 * Requires DATABASE_URL and migrations through 0044+ (section_key / field_key).
 *
 * Stubs `authenticate` / `requireAdmin` like other form-template integration specs so the
 * handler receives `user` from the outer `.derive()` without JWT setup.
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
import { eq } from "drizzle-orm";
import {
  UserRole,
  type ApiResult,
  type FormTemplatePublishPreviewData,
} from "@supplex/types";
import { Errors } from "../../../lib/errors";
import type { AuthContext } from "../../../lib/rbac/middleware";

setDefaultTimeout(60_000);

mock.module("../../../lib/rbac/middleware", () => {
  function requireRole(allowedRoles: UserRole[]) {
    return new Elysia({ name: "require-role" }).onBeforeHandle((context) => {
      const user = (context as { user?: AuthContext["user"] }).user;
      if (!user?.role || !allowedRoles.includes(user.role)) {
        throw Errors.forbidden("Insufficient permissions", "FORBIDDEN");
      }
    });
  }

  return {
    authenticate: new Elysia({ name: "auth" }),
    requireRole,
    requireAdmin: requireRole([UserRole.ADMIN]),
  };
});

const { publishPreviewRoute } = await import("../publish-preview");
const { withApiErrorHandler, asUserRole } = await import(
  "../../../lib/test-utils"
);

import { db } from "../../../lib/db";
import {
  tenants,
  users,
  formTemplate,
  formSection,
  formField,
  FormTemplateStatus,
  FieldType,
  insertDraftFormTemplateVersion,
  publishFormTemplateFromDraft,
  getDraftFormTemplateVersionForTemplate,
  getPublishedHeadFormTemplateVersion,
  workflowTemplate,
  workflowStepTemplate,
  processInstance,
  stepInstance,
  ProcessStatus,
  ProcessType,
} from "@supplex/db";
import { logger } from "../../../lib/logger";
import { insertOneOrThrow } from "../../../lib/db-helpers";

function previewApp(user: AuthContext["user"]) {
  return withApiErrorHandler(
    new Elysia()
      .derive(() => ({
        user,
        requestLogger: logger.child({ test: true }),
      }))
      .use(publishPreviewRoute)
  );
}

describe("SUP-29 GET /api/form-templates/:id/publish-preview", () => {
  let tenant: { id: string };
  let admin: AuthContext["user"];

  beforeAll(async () => {
    tenant = await insertOneOrThrow(db, tenants, {
      name: "SUP-29 publish-preview tenant",
      slug: `sup29-preview-${Date.now()}`,
    });

    const u = await insertOneOrThrow(db, users, {
      id: crypto.randomUUID(),
      tenantId: tenant.id,
      email: `sup29-preview-${Date.now()}@test.com`,
      fullName: "SUP-29 Admin",
      role: "admin",
    });

    admin = {
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

  test("first publish: full structure is added vs empty baseline; workflow references appear", async () => {
    const [tpl] = await db
      .insert(formTemplate)
      .values({
        tenantId: tenant.id,
        name: `Preview form ${Date.now()}`,
        status: FormTemplateStatus.DRAFT,
      })
      .returning();
    if (!tpl) throw new Error("tpl");

    const draft0 = await insertDraftFormTemplateVersion(db, {
      formTemplateId: tpl.id,
      tenantId: tenant.id,
    });

    await db.insert(formSection).values({
      formTemplateId: tpl.id,
      formTemplateVersionId: draft0.id,
      tenantId: tenant.id,
      sectionOrder: 1,
      sectionKey: "sec_preview_a",
      title: "Section A",
    });

    const [sec] = await db
      .select()
      .from(formSection)
      .where(eq(formSection.formTemplateVersionId, draft0.id))
      .limit(1);
    if (!sec) throw new Error("section");

    await db.insert(formField).values({
      formSectionId: sec.id,
      formTemplateVersionId: draft0.id,
      tenantId: tenant.id,
      fieldOrder: 1,
      fieldKey: "field_a",
      fieldType: FieldType.TEXT,
      label: "Alpha",
    });

    const [wt] = await db
      .insert(workflowTemplate)
      .values({
        tenantId: tenant.id,
        name: "WF ref preview",
        createdBy: admin.id,
        status: "published",
      })
      .returning();
    if (!wt) throw new Error("wt");

    await db.insert(workflowStepTemplate).values({
      workflowTemplateId: wt.id,
      tenantId: tenant.id,
      stepOrder: 1,
      name: "Form step",
      stepType: "form",
      formTemplateId: tpl.id,
      formActionMode: "fill_out",
    });

    const app = previewApp(admin);
    const res = await app.handle(
      new Request(`http://localhost/${tpl.id}/publish-preview`, {
        method: "GET",
      })
    );
    expect(res.status).toBe(200);
    const ok = (await res.json()) as ApiResult<FormTemplatePublishPreviewData>;
    expect(ok.success).toBe(true);
    if (!ok.success) return;
    if (ok.data === undefined) throw new Error("expected publish preview data");
    const preview = ok.data;

    expect(preview.structureChanged).toBe(true);
    expect(preview.diff.addedSections.length).toBe(1);
    expect(preview.diff.addedSections[0]?.sectionKey).toBe("sec_preview_a");
    expect(preview.publishImpact.workflowTemplatesReferencingContainer).toEqual(
      [{ id: wt.id, name: "WF ref preview" }]
    );
    expect(preview.publishImpact.activeProcessesWithSupersededPin).toEqual([]);

    await db
      .delete(workflowStepTemplate)
      .where(eq(workflowStepTemplate.workflowTemplateId, wt.id));
    await db.delete(workflowTemplate).where(eq(workflowTemplate.id, wt.id));
    await db.delete(formTemplate).where(eq(formTemplate.id, tpl.id));
  });

  test("republish: new section in draft + process pinned to superseded head", async () => {
    const [tpl] = await db
      .insert(formTemplate)
      .values({
        tenantId: tenant.id,
        name: `Republish preview ${Date.now()}`,
        status: FormTemplateStatus.DRAFT,
      })
      .returning();
    if (!tpl) throw new Error("tpl");

    const initialDraft = await insertDraftFormTemplateVersion(db, {
      formTemplateId: tpl.id,
      tenantId: tenant.id,
    });

    const [secA] = await db
      .insert(formSection)
      .values({
        formTemplateId: tpl.id,
        formTemplateVersionId: initialDraft.id,
        tenantId: tenant.id,
        sectionOrder: 1,
        sectionKey: "sec_rep_a",
        title: "A",
      })
      .returning();
    if (!secA) throw new Error("secA");

    await db.insert(formField).values({
      formSectionId: secA.id,
      formTemplateVersionId: initialDraft.id,
      tenantId: tenant.id,
      fieldOrder: 1,
      fieldKey: "f1",
      fieldType: FieldType.TEXT,
      label: "L",
    });

    await db.transaction(async (tx) => {
      await publishFormTemplateFromDraft(tx, {
        formTemplateId: tpl.id,
        tenantId: tenant.id,
        actorUserId: admin.id,
      });
    });

    const head = await getPublishedHeadFormTemplateVersion(db, {
      formTemplateId: tpl.id,
      tenantId: tenant.id,
    });
    if (!head) throw new Error("head");

    const [proc] = await db
      .insert(processInstance)
      .values({
        tenantId: tenant.id,
        processType: ProcessType.SUPPLIER_QUALIFICATION,
        entityType: "supplier",
        entityId: crypto.randomUUID(),
        status: ProcessStatus.IN_PROGRESS,
        workflowTemplateId: null,
        initiatedBy: admin.id,
      })
      .returning();
    if (!proc) throw new Error("proc");

    await db.insert(stepInstance).values({
      tenantId: tenant.id,
      processInstanceId: proc.id,
      stepOrder: 1,
      stepName: "Form step",
      stepType: "form",
      pinnedFormTemplateVersionId: head.id,
      status: "pending",
    });

    const draftAfter = await getDraftFormTemplateVersionForTemplate(db, {
      formTemplateId: tpl.id,
      tenantId: tenant.id,
    });
    if (!draftAfter) throw new Error("draft after publish");

    await db.insert(formSection).values({
      formTemplateId: tpl.id,
      formTemplateVersionId: draftAfter.id,
      tenantId: tenant.id,
      sectionOrder: 2,
      sectionKey: "sec_rep_b",
      title: "B",
    });

    const draftSections = await db
      .select()
      .from(formSection)
      .where(eq(formSection.formTemplateVersionId, draftAfter.id));
    const secBRow = draftSections.find((s) => s.sectionKey === "sec_rep_b");
    if (!secBRow) throw new Error("sec_rep_b section missing");

    await db.insert(formField).values({
      formSectionId: secBRow.id,
      formTemplateVersionId: draftAfter.id,
      tenantId: tenant.id,
      fieldOrder: 1,
      fieldKey: "fB",
      fieldType: FieldType.TEXT,
      label: "LB",
    });

    const app = previewApp(admin);
    const res = await app.handle(
      new Request(`http://localhost/${tpl.id}/publish-preview`, {
        method: "GET",
      })
    );
    expect(res.status).toBe(200);
    const ok = (await res.json()) as ApiResult<FormTemplatePublishPreviewData>;
    expect(ok.success).toBe(true);
    if (!ok.success) return;
    if (ok.data === undefined) throw new Error("expected publish preview data");
    const preview = ok.data;

    expect(
      preview.diff.addedSections.some(
        (s: { sectionKey: string }) => s.sectionKey === "sec_rep_b"
      )
    ).toBe(true);
    expect(
      preview.publishImpact.activeProcessesWithSupersededPin.some(
        (p: { id: string }) => p.id === proc.id
      )
    ).toBe(true);

    await db.delete(processInstance).where(eq(processInstance.id, proc.id));
    await db.delete(formTemplate).where(eq(formTemplate.id, tpl.id));
  });

  test("missing template returns 404", async () => {
    const app = previewApp(admin);
    const res = await app.handle(
      new Request(`http://localhost/${crypto.randomUUID()}/publish-preview`, {
        method: "GET",
      })
    );
    expect(res.status).toBe(404);
    const err = (await res.json()) as ApiResult<unknown>;
    expect(err.success).toBe(false);
    if (err.success) return;
    expect(err.error.code).toBe("TEMPLATE_NOT_FOUND");
  });
});
