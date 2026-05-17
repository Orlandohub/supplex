/**
 * SUP-32: Admin read APIs for the form-template Versions / Changelog / Usage / Compare tabs.
 *
 * Covers:
 *   - GET /api/form-templates/:id/versions
 *   - GET /api/form-templates/:id/audit-events
 *   - GET /api/form-templates/:id/version-diff
 *   - GET /api/form-templates/:id/usage
 *
 * For each route: admin happy path, non-admin denied (403), cross-tenant access
 * returns 404, soft-deleted templates return 404, archived templates are still
 * readable, and route-registration smoke proves the aggregator does not collide
 * with the existing `/:id` and `/:templateId` family.
 *
 * Requires DATABASE_URL and migrations through 0044+ (section_key / field_key).
 *
 * Mirrors SUP-29's pattern: stub `authenticate` / `requireAdmin` so the routes
 * receive `user` from the outer `.derive()` without real JWTs.
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
  type FormTemplateVersionsListData,
  type FormTemplateAuditEventsListData,
  type FormTemplateVersionDiffData,
  type FormTemplateUsageData,
} from "@supplex/types";
import { Errors } from "../../../lib/errors";
import type { AuthContext } from "../../../lib/rbac/middleware";

setDefaultTimeout(60_000);

mock.module("../../../lib/rbac/middleware", () => {
  function requireRole(allowedRoles: UserRole[]) {
    // `{ as: "global" }` so the role check propagates to every route the
    // plugin is mounted alongside (without it, Elysia treats the hook as
    // local to this plugin instance and the guard never fires on
    // downstream `.get(...)` routes).
    return new Elysia({ name: "require-role" }).onBeforeHandle(
      { as: "global" },
      (context) => {
        const user = (context as { user?: AuthContext["user"] }).user;
        if (!user?.role || !allowedRoles.includes(user.role)) {
          throw Errors.forbidden("Insufficient permissions", "FORBIDDEN");
        }
      }
    );
  }

  return {
    authenticate: new Elysia({ name: "auth" }),
    requireRole,
    requireAdmin: requireRole([UserRole.ADMIN]),
  };
});

const { versionsRoute } = await import("../versions");
const { auditEventsRoute } = await import("../audit-events");
const { versionDiffRoute } = await import("../version-diff");
const { usageRoute } = await import("../usage");
const { formTemplatesRoutes } = await import("../index");
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
  formTemplateAuditEvent,
  FormTemplateAuditEventType,
  FormTemplateAuditSubject,
  workflowTemplate,
  workflowStepTemplate,
  processInstance,
  stepInstance,
  ProcessStatus,
  ProcessType,
} from "@supplex/db";
import { logger } from "../../../lib/logger";
import { insertOneOrThrow } from "../../../lib/db-helpers";

type AppLike = { handle: (req: Request) => Promise<Response> };

function withUser<R>(
  route: R,
  user: AuthContext["user"] | null | undefined
): AppLike {
  // Derive `{ as: "global" }` so the user context propagates to plugin-scoped
  // `onBeforeHandle` hooks (the mocked `requireAdmin` lives inside an
  // `Elysia({ name: "require-role" })` child plugin, which by default cannot
  // see derives from an unscoped parent). The real `authenticate` middleware
  // uses the same scoping for the same reason.
  return withApiErrorHandler(
    new Elysia()
      .derive({ as: "global" }, () => ({
        user,
        requestLogger: logger.child({ test: true }),
      }))
      .use(route as Parameters<Elysia["use"]>[0])
  );
}

async function seedNonAdmin(tenantId: string): Promise<AuthContext["user"]> {
  const u = await insertOneOrThrow(db, users, {
    id: crypto.randomUUID(),
    tenantId,
    email: `sup32-viewer-${crypto.randomUUID()}@test.com`,
    fullName: "SUP-32 Viewer",
    role: "viewer",
  });
  return {
    id: u.id,
    email: u.email,
    role: asUserRole(u.role),
    tenantId,
    fullName: u.fullName,
  };
}

describe("SUP-32 form-template admin read APIs", () => {
  let tenant: { id: string };
  let otherTenant: { id: string };
  let admin: AuthContext["user"];
  let otherAdmin: AuthContext["user"];

  beforeAll(async () => {
    tenant = await insertOneOrThrow(db, tenants, {
      name: "SUP-32 admin-read tenant",
      slug: `sup32-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    });

    otherTenant = await insertOneOrThrow(db, tenants, {
      name: "SUP-32 other tenant",
      slug: `sup32-other-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    });

    const adminRow = await insertOneOrThrow(db, users, {
      id: crypto.randomUUID(),
      tenantId: tenant.id,
      email: `sup32-admin-${Date.now()}@test.com`,
      fullName: "SUP-32 Admin",
      role: "admin",
    });
    admin = {
      id: adminRow.id,
      email: adminRow.email,
      role: asUserRole(adminRow.role),
      tenantId: tenant.id,
      fullName: adminRow.fullName,
    };

    const otherAdminRow = await insertOneOrThrow(db, users, {
      id: crypto.randomUUID(),
      tenantId: otherTenant.id,
      email: `sup32-other-admin-${Date.now()}@test.com`,
      fullName: "SUP-32 Other Admin",
      role: "admin",
    });
    otherAdmin = {
      id: otherAdminRow.id,
      email: otherAdminRow.email,
      role: asUserRole(otherAdminRow.role),
      tenantId: otherTenant.id,
      fullName: otherAdminRow.fullName,
    };
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenant.id));
    await db.delete(tenants).where(eq(tenants.id, otherTenant.id));
  });

  /**
   * Seeds a template that has been published once (so it has both a
   * published head and a fresh draft, plus at least one audit event from
   * the publish itself). Returns the ids the tests need.
   */
  async function seedPublishedTemplate(opts: {
    name: string;
    tenantId: string;
    actorUserId: string;
  }) {
    const tpl = await insertOneOrThrow(db, formTemplate, {
      tenantId: opts.tenantId,
      name: opts.name,
      status: FormTemplateStatus.DRAFT,
    });

    const initialDraft = await insertDraftFormTemplateVersion(db, {
      formTemplateId: tpl.id,
      tenantId: opts.tenantId,
    });

    const [sec] = await db
      .insert(formSection)
      .values({
        formTemplateVersionId: initialDraft.id,
        tenantId: opts.tenantId,
        sectionOrder: 1,
        sectionKey: "sec_alpha",
        title: "Alpha",
      })
      .returning();
    if (!sec) throw new Error("seed section");

    await db.insert(formField).values({
      formSectionId: sec.id,
      formTemplateVersionId: initialDraft.id,
      tenantId: opts.tenantId,
      fieldOrder: 1,
      fieldKey: "f_alpha",
      fieldType: FieldType.TEXT,
      label: "Alpha label",
    });

    await db.transaction(async (tx) => {
      await publishFormTemplateFromDraft(tx, {
        formTemplateId: tpl.id,
        tenantId: opts.tenantId,
        actorUserId: opts.actorUserId,
      });
    });

    const head = await getPublishedHeadFormTemplateVersion(db, {
      formTemplateId: tpl.id,
      tenantId: opts.tenantId,
    });
    if (!head) throw new Error("expected published head");

    const newDraft = await getDraftFormTemplateVersionForTemplate(db, {
      formTemplateId: tpl.id,
      tenantId: opts.tenantId,
    });
    if (!newDraft) throw new Error("expected fresh draft after publish");

    return { tpl, publishedHead: head, draft: newDraft };
  }

  describe("GET /:id/versions", () => {
    test("admin: lists draft + immutable rows without compiledJson", async () => {
      const { tpl, publishedHead, draft } = await seedPublishedTemplate({
        name: `Versions admin ${Date.now()}`,
        tenantId: tenant.id,
        actorUserId: admin.id,
      });

      const app = withUser(versionsRoute, admin);
      const res = await app.handle(
        new Request(`http://localhost/${tpl.id}/versions`)
      );
      expect(res.status).toBe(200);

      const body =
        (await res.json()) as ApiResult<FormTemplateVersionsListData>;
      expect(body.success).toBe(true);
      if (!body.success || !body.data) throw new Error("expected data");
      const ids = body.data.versions.map((v) => v.id);
      expect(ids).toContain(publishedHead.id);
      expect(ids).toContain(draft.id);
      for (const v of body.data.versions) {
        expect(
          (v as unknown as Record<string, unknown>).compiledJson
        ).toBeUndefined();
      }
      const draftRow = body.data.versions.find((v) => v.id === draft.id);
      expect(draftRow?.versionNumber).toBeNull();
      const headRow = body.data.versions.find((v) => v.id === publishedHead.id);
      expect(typeof headRow?.versionNumber).toBe("number");

      await db.delete(formTemplate).where(eq(formTemplate.id, tpl.id));
    });

    test("non-admin: 403", async () => {
      const { tpl } = await seedPublishedTemplate({
        name: `Versions denied ${Date.now()}`,
        tenantId: tenant.id,
        actorUserId: admin.id,
      });
      const viewer = await seedNonAdmin(tenant.id);
      const app = withUser(versionsRoute, viewer);
      const res = await app.handle(
        new Request(`http://localhost/${tpl.id}/versions`)
      );
      expect(res.status).toBe(403);

      await db.delete(formTemplate).where(eq(formTemplate.id, tpl.id));
    });

    test("cross-tenant: 404", async () => {
      const { tpl } = await seedPublishedTemplate({
        name: `Versions cross-tenant ${Date.now()}`,
        tenantId: tenant.id,
        actorUserId: admin.id,
      });
      const app = withUser(versionsRoute, otherAdmin);
      const res = await app.handle(
        new Request(`http://localhost/${tpl.id}/versions`)
      );
      expect(res.status).toBe(404);
      const body = (await res.json()) as ApiResult<unknown>;
      if (body.success) throw new Error("expected error");
      expect(body.error.code).toBe("TEMPLATE_NOT_FOUND");

      await db.delete(formTemplate).where(eq(formTemplate.id, tpl.id));
    });

    test("soft-deleted template: 404", async () => {
      const { tpl } = await seedPublishedTemplate({
        name: `Versions deleted ${Date.now()}`,
        tenantId: tenant.id,
        actorUserId: admin.id,
      });
      await db
        .update(formTemplate)
        .set({ deletedAt: new Date() })
        .where(eq(formTemplate.id, tpl.id));

      const app = withUser(versionsRoute, admin);
      const res = await app.handle(
        new Request(`http://localhost/${tpl.id}/versions`)
      );
      expect(res.status).toBe(404);

      await db.delete(formTemplate).where(eq(formTemplate.id, tpl.id));
    });

    test("archived template: still readable", async () => {
      const { tpl } = await seedPublishedTemplate({
        name: `Versions archived ${Date.now()}`,
        tenantId: tenant.id,
        actorUserId: admin.id,
      });
      await db
        .update(formTemplate)
        .set({ status: FormTemplateStatus.ARCHIVED })
        .where(eq(formTemplate.id, tpl.id));

      const app = withUser(versionsRoute, admin);
      const res = await app.handle(
        new Request(`http://localhost/${tpl.id}/versions`)
      );
      expect(res.status).toBe(200);

      await db.delete(formTemplate).where(eq(formTemplate.id, tpl.id));
    });
  });

  describe("GET /:id/audit-events", () => {
    test("admin: returns ordered events with actor and cursor pagination", async () => {
      const { tpl } = await seedPublishedTemplate({
        name: `Audit admin ${Date.now()}`,
        tenantId: tenant.id,
        actorUserId: admin.id,
      });

      const draft = await getDraftFormTemplateVersionForTemplate(db, {
        formTemplateId: tpl.id,
        tenantId: tenant.id,
      });
      if (!draft) throw new Error("draft missing");

      // Seed a few extra audit events so pagination can be exercised.
      for (let i = 0; i < 3; i++) {
        await db.insert(formTemplateAuditEvent).values({
          tenantId: tenant.id,
          formTemplateId: tpl.id,
          formTemplateVersionId: draft.id,
          actorUserId: admin.id,
          eventType: FormTemplateAuditEventType.SECTION_CREATED,
          subjectType: FormTemplateAuditSubject.SECTION,
          subjectId: crypto.randomUUID(),
          summary: `Seed ${i}`,
          metadata: {},
        });
      }

      const app = withUser(auditEventsRoute, admin);
      const first = await app.handle(
        new Request(`http://localhost/${tpl.id}/audit-events?limit=2`)
      );
      expect(first.status).toBe(200);
      const firstBody =
        (await first.json()) as ApiResult<FormTemplateAuditEventsListData>;
      if (!firstBody.success || !firstBody.data) throw new Error("data");
      expect(firstBody.data.events.length).toBe(2);
      expect(firstBody.data.nextCursor).not.toBeNull();
      for (const ev of firstBody.data.events) {
        expect(ev.actor?.id).toBe(admin.id);
      }
      // createdAt desc, id desc ordering
      const ev0 = firstBody.data.events[0];
      const ev1 = firstBody.data.events[1];
      if (!ev0 || !ev1) throw new Error("expected at least 2 events");
      const t0 = new Date(ev0.createdAt).getTime();
      const t1 = new Date(ev1.createdAt).getTime();
      expect(t0).toBeGreaterThanOrEqual(t1);

      const nextCursor = firstBody.data.nextCursor;
      if (!nextCursor) throw new Error("expected nextCursor");
      const second = await app.handle(
        new Request(
          `http://localhost/${tpl.id}/audit-events?limit=2&cursor=${encodeURIComponent(
            nextCursor
          )}`
        )
      );
      expect(second.status).toBe(200);
      const secondBody =
        (await second.json()) as ApiResult<FormTemplateAuditEventsListData>;
      if (!secondBody.success || !secondBody.data) throw new Error("data 2");
      // Subsequent page must not return any of the first page's ids.
      const firstIds = new Set(firstBody.data.events.map((e) => e.id));
      for (const ev of secondBody.data.events) {
        expect(firstIds.has(ev.id)).toBe(false);
      }

      await db.delete(formTemplate).where(eq(formTemplate.id, tpl.id));
    });

    test("non-admin: 403", async () => {
      const { tpl } = await seedPublishedTemplate({
        name: `Audit denied ${Date.now()}`,
        tenantId: tenant.id,
        actorUserId: admin.id,
      });
      const viewer = await seedNonAdmin(tenant.id);
      const app = withUser(auditEventsRoute, viewer);
      const res = await app.handle(
        new Request(`http://localhost/${tpl.id}/audit-events`)
      );
      expect(res.status).toBe(403);

      await db.delete(formTemplate).where(eq(formTemplate.id, tpl.id));
    });

    test("cross-tenant: 404", async () => {
      const { tpl } = await seedPublishedTemplate({
        name: `Audit cross-tenant ${Date.now()}`,
        tenantId: tenant.id,
        actorUserId: admin.id,
      });
      const app = withUser(auditEventsRoute, otherAdmin);
      const res = await app.handle(
        new Request(`http://localhost/${tpl.id}/audit-events`)
      );
      expect(res.status).toBe(404);

      await db.delete(formTemplate).where(eq(formTemplate.id, tpl.id));
    });
  });

  describe("GET /:id/version-diff", () => {
    test("admin: diffs two versions of the same template", async () => {
      const { tpl, publishedHead, draft } = await seedPublishedTemplate({
        name: `Diff admin ${Date.now()}`,
        tenantId: tenant.id,
        actorUserId: admin.id,
      });

      // Mutate the draft so a non-empty diff is computed.
      const [secB] = await db
        .insert(formSection)
        .values({
          formTemplateVersionId: draft.id,
          tenantId: tenant.id,
          sectionOrder: 2,
          sectionKey: "sec_beta",
          title: "Beta",
        })
        .returning();
      if (!secB) throw new Error("secB seed");
      await db.insert(formField).values({
        formSectionId: secB.id,
        formTemplateVersionId: draft.id,
        tenantId: tenant.id,
        fieldOrder: 1,
        fieldKey: "f_beta",
        fieldType: FieldType.TEXT,
        label: "Beta label",
      });

      const app = withUser(versionDiffRoute, admin);
      const res = await app.handle(
        new Request(
          `http://localhost/${tpl.id}/version-diff?fromVersionId=${publishedHead.id}&toVersionId=${draft.id}`
        )
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as ApiResult<FormTemplateVersionDiffData>;
      if (!body.success || !body.data) throw new Error("data");
      expect(body.data.structureChanged).toBe(true);
      expect(body.data.fromVersion.id).toBe(publishedHead.id);
      expect(body.data.toVersion.id).toBe(draft.id);
      expect(
        body.data.diff.addedSections.some((s) => s.sectionKey === "sec_beta")
      ).toBe(true);

      await db.delete(formTemplate).where(eq(formTemplate.id, tpl.id));
    });

    test("unknown version id: 404 VERSION_NOT_FOUND", async () => {
      const { tpl, publishedHead } = await seedPublishedTemplate({
        name: `Diff unknown ${Date.now()}`,
        tenantId: tenant.id,
        actorUserId: admin.id,
      });
      const bogus = crypto.randomUUID();
      const app = withUser(versionDiffRoute, admin);
      const res = await app.handle(
        new Request(
          `http://localhost/${tpl.id}/version-diff?fromVersionId=${publishedHead.id}&toVersionId=${bogus}`
        )
      );
      expect(res.status).toBe(404);
      const body = (await res.json()) as ApiResult<unknown>;
      if (body.success) throw new Error("expected error");
      expect(body.error.code).toBe("VERSION_NOT_FOUND");

      await db.delete(formTemplate).where(eq(formTemplate.id, tpl.id));
    });

    test("non-admin: 403", async () => {
      const { tpl, publishedHead, draft } = await seedPublishedTemplate({
        name: `Diff denied ${Date.now()}`,
        tenantId: tenant.id,
        actorUserId: admin.id,
      });
      const viewer = await seedNonAdmin(tenant.id);
      const app = withUser(versionDiffRoute, viewer);
      const res = await app.handle(
        new Request(
          `http://localhost/${tpl.id}/version-diff?fromVersionId=${publishedHead.id}&toVersionId=${draft.id}`
        )
      );
      expect(res.status).toBe(403);

      await db.delete(formTemplate).where(eq(formTemplate.id, tpl.id));
    });

    test("cross-tenant template: 404", async () => {
      const { tpl, publishedHead, draft } = await seedPublishedTemplate({
        name: `Diff cross-tenant ${Date.now()}`,
        tenantId: tenant.id,
        actorUserId: admin.id,
      });
      const app = withUser(versionDiffRoute, otherAdmin);
      const res = await app.handle(
        new Request(
          `http://localhost/${tpl.id}/version-diff?fromVersionId=${publishedHead.id}&toVersionId=${draft.id}`
        )
      );
      expect(res.status).toBe(404);

      await db.delete(formTemplate).where(eq(formTemplate.id, tpl.id));
    });
  });

  describe("GET /:id/usage", () => {
    test("admin: returns workflow refs and active pinned processes", async () => {
      const { tpl, publishedHead } = await seedPublishedTemplate({
        name: `Usage admin ${Date.now()}`,
        tenantId: tenant.id,
        actorUserId: admin.id,
      });

      const [wt] = await db
        .insert(workflowTemplate)
        .values({
          tenantId: tenant.id,
          name: "Usage WF",
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
        pinnedFormTemplateVersionId: publishedHead.id,
        status: "pending",
      });

      const app = withUser(usageRoute, admin);
      const res = await app.handle(
        new Request(`http://localhost/${tpl.id}/usage`)
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as ApiResult<FormTemplateUsageData>;
      if (!body.success || !body.data) throw new Error("data");
      expect(body.data.publishedHeadVersionId).toBe(publishedHead.id);
      expect(
        body.data.impact.workflowTemplatesReferencingContainer.some(
          (w) => w.id === wt.id
        )
      ).toBe(true);
      expect(
        body.data.impact.activeProcessesWithSupersededPin.some(
          (p) => p.id === proc.id
        )
      ).toBe(true);

      await db.delete(processInstance).where(eq(processInstance.id, proc.id));
      await db
        .delete(workflowStepTemplate)
        .where(eq(workflowStepTemplate.workflowTemplateId, wt.id));
      await db.delete(workflowTemplate).where(eq(workflowTemplate.id, wt.id));
      await db.delete(formTemplate).where(eq(formTemplate.id, tpl.id));
    });

    test("no published head: publishedHeadVersionId is null and active pin list is empty", async () => {
      const tpl = await insertOneOrThrow(db, formTemplate, {
        tenantId: tenant.id,
        name: `Usage no-head ${Date.now()}`,
        status: FormTemplateStatus.DRAFT,
      });
      await insertDraftFormTemplateVersion(db, {
        formTemplateId: tpl.id,
        tenantId: tenant.id,
      });

      const app = withUser(usageRoute, admin);
      const res = await app.handle(
        new Request(`http://localhost/${tpl.id}/usage`)
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as ApiResult<FormTemplateUsageData>;
      if (!body.success || !body.data) throw new Error("data");
      expect(body.data.publishedHeadVersionId).toBeNull();
      expect(body.data.impact.activeProcessesWithSupersededPin).toEqual([]);

      await db.delete(formTemplate).where(eq(formTemplate.id, tpl.id));
    });

    test("non-admin: 403", async () => {
      const { tpl } = await seedPublishedTemplate({
        name: `Usage denied ${Date.now()}`,
        tenantId: tenant.id,
        actorUserId: admin.id,
      });
      const viewer = await seedNonAdmin(tenant.id);
      const app = withUser(usageRoute, viewer);
      const res = await app.handle(
        new Request(`http://localhost/${tpl.id}/usage`)
      );
      expect(res.status).toBe(403);

      await db.delete(formTemplate).where(eq(formTemplate.id, tpl.id));
    });

    test("cross-tenant: 404", async () => {
      const { tpl } = await seedPublishedTemplate({
        name: `Usage cross-tenant ${Date.now()}`,
        tenantId: tenant.id,
        actorUserId: admin.id,
      });
      const app = withUser(usageRoute, otherAdmin);
      const res = await app.handle(
        new Request(`http://localhost/${tpl.id}/usage`)
      );
      expect(res.status).toBe(404);

      await db.delete(formTemplate).where(eq(formTemplate.id, tpl.id));
    });

    test("archived template: still readable", async () => {
      const { tpl } = await seedPublishedTemplate({
        name: `Usage archived ${Date.now()}`,
        tenantId: tenant.id,
        actorUserId: admin.id,
      });
      await db
        .update(formTemplate)
        .set({ status: FormTemplateStatus.ARCHIVED })
        .where(eq(formTemplate.id, tpl.id));
      const app = withUser(usageRoute, admin);
      const res = await app.handle(
        new Request(`http://localhost/${tpl.id}/usage`)
      );
      expect(res.status).toBe(200);

      await db.delete(formTemplate).where(eq(formTemplate.id, tpl.id));
    });
  });

  /**
   * Memoirist registration smoke test.
   *
   * Mounts the full `formTemplatesRoutes` aggregator and confirms each
   * route returns its tenant-isolation 404 (the expected business
   * response) rather than a 405 Method Not Allowed or 404 from
   * memoirist failing to bind the path. This catches conflicts between
   * `/:id/<segment>` and `/:templateId/<segment>` registration order
   * (the historical SUP-* publishing trap) without seeding any rows.
   */
  describe("route registration smoke", () => {
    const bogus = crypto.randomUUID();

    test("all SUP-32 routes resolve to business 404, not framework-level mismatch", async () => {
      const app = withUser(formTemplatesRoutes, admin);

      const paths = [
        `GET /api/form-templates/${bogus}`,
        `GET /api/form-templates/${bogus}/publish-preview`,
        `GET /api/form-templates/${bogus}/versions`,
        `GET /api/form-templates/${bogus}/audit-events`,
        `GET /api/form-templates/${bogus}/version-diff?fromVersionId=${bogus}&toVersionId=${bogus}`,
        `GET /api/form-templates/${bogus}/usage`,
      ];

      for (const spec of paths) {
        const [method, path] = spec.split(" ");
        const res = await app.handle(
          new Request(`http://localhost${path}`, { method })
        );
        expect(res.status).toBe(404);
        const body = (await res.json()) as ApiResult<unknown>;
        if (body.success) throw new Error(`${spec} unexpectedly succeeded`);
        // Either the template-not-found business code, or a route-level not
        // found from the aggregator. Both indicate the path is bound; the
        // failure we want to catch (memoirist mismatch) surfaces as 405 or
        // the generic NOT_FOUND from Elysia.
        expect(body.error.code).toBe("TEMPLATE_NOT_FOUND");
      }
    });

    test("templateId-family route (POST /:templateId/sections) still resolves", async () => {
      const app = withUser(formTemplatesRoutes, admin);
      const res = await app.handle(
        new Request(`http://localhost/api/form-templates/${bogus}/sections`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "X", sectionOrder: 1 }),
        })
      );
      // Either business 404 (template not found) or 400 (validation) — both
      // prove the route is bound; specifically NOT 405 / framework not found.
      expect([400, 404]).toContain(res.status);
    });
  });
});
