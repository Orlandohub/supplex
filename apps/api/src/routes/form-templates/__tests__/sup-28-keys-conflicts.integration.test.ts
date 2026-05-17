/**
 * SUP-28: form template section routes — duplicate keys (409) and immutable
 * published snapshot mutations (409), plus create audit events.
 *
 * Requires DB migration 0044 (section_key / field_key) and DATABASE_URL.
 *
 * `requireAdmin` normally chains the real `authenticate` plugin; for route tests
 * we stub the middleware module so admin checks use the `user` from the outer
 * `.derive()` (same pattern as form-submissions integration specs).
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
import { and, eq } from "drizzle-orm";
import { UserRole } from "@supplex/types";
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

const { createSectionRoute } = await import("../sections/create");
const { updateSectionRoute } = await import("../sections/update");
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
  getPublishedHeadFormTemplateVersion,
  formTemplateAuditEvent,
  FormTemplateAuditEventType,
} from "@supplex/db";
import { logger } from "../../../lib/logger";
import { insertOneOrThrow } from "../../../lib/db-helpers";

function sectionApp(user: AuthContext["user"]) {
  return withApiErrorHandler(
    new Elysia()
      .derive(() => ({
        user,
        requestLogger: logger.child({ test: true }),
      }))
      .use(createSectionRoute)
  );
}

function updateSectionApp(user: AuthContext["user"]) {
  return withApiErrorHandler(
    new Elysia()
      .derive(() => ({
        user,
        requestLogger: logger.child({ test: true }),
      }))
      .use(updateSectionRoute)
  );
}

describe("SUP-28 form template sections — keys & conflicts", () => {
  let tenant: { id: string };
  let admin: AuthContext["user"];

  beforeAll(async () => {
    tenant = await insertOneOrThrow(db, tenants, {
      name: "SUP-28 section routes tenant",
      slug: `sup28-${Date.now()}`,
    });

    const u = await insertOneOrThrow(db, users, {
      id: crypto.randomUUID(),
      tenantId: tenant.id,
      email: `sup28-${Date.now()}@test.com`,
      fullName: "SUP-28 Admin",
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

  test("POST second section with duplicate sectionKey → 409 DUPLICATE_FORM_KEY", async () => {
    const tpl = await insertOneOrThrow(db, formTemplate, {
      tenantId: tenant.id,
      name: `Dup key ${Date.now()}`,
      status: FormTemplateStatus.DRAFT,
    });

    await insertDraftFormTemplateVersion(db, {
      formTemplateId: tpl.id,
      tenantId: tenant.id,
    });

    const app = sectionApp(admin);
    const url = (path: string) => `http://localhost/${tpl.id}${path}`;

    const first = await app.handle(
      new Request(url("/sections"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Alpha",
          sectionOrder: 1,
        }),
      })
    );
    expect(first.status).toBe(201);

    const second = await app.handle(
      new Request(url("/sections"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Beta",
          sectionOrder: 2,
          sectionKey: "alpha",
        }),
      })
    );
    expect(second.status).toBe(409);
    const body = (await second.json()) as {
      success: boolean;
      error?: { code?: string };
    };
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe("DUPLICATE_FORM_KEY");
  });

  test("PATCH section on published snapshot → 409 IMMUTABLE_FORM_VERSION", async () => {
    const tpl = await insertOneOrThrow(db, formTemplate, {
      tenantId: tenant.id,
      name: `Immutable PATCH ${Date.now()}`,
      status: FormTemplateStatus.DRAFT,
    });

    const draft = await insertDraftFormTemplateVersion(db, {
      formTemplateId: tpl.id,
      tenantId: tenant.id,
    });

    const [sec] = await db
      .insert(formSection)
      .values({
        formTemplateVersionId: draft.id,
        tenantId: tenant.id,
        sectionOrder: 1,
        sectionKey: "immut_test",
        title: "S",
      })
      .returning();
    if (!sec) throw new Error("section seed failed");

    await db.insert(formField).values({
      formSectionId: sec.id,
      formTemplateVersionId: draft.id,
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

    const pub = await getPublishedHeadFormTemplateVersion(db, {
      formTemplateId: tpl.id,
      tenantId: tenant.id,
    });
    if (!pub) throw new Error("expected published version");

    const [pubSection] = await db
      .select()
      .from(formSection)
      .where(
        and(
          eq(formSection.formTemplateVersionId, pub.id),
          eq(formSection.tenantId, tenant.id)
        )
      )
      .limit(1);
    if (!pubSection) throw new Error("expected published section row");

    const app = updateSectionApp(admin);
    const res = await app.handle(
      new Request(`http://localhost/sections/${pubSection.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Changed" }),
      })
    );

    expect(res.status).toBe(409);
    const payload = (await res.json()) as {
      success: boolean;
      error?: { code?: string };
    };
    expect(payload.success).toBe(false);
    expect(payload.error?.code).toBe("IMMUTABLE_FORM_VERSION");
  });

  test("POST section emits section_created audit row", async () => {
    const tpl = await insertOneOrThrow(db, formTemplate, {
      tenantId: tenant.id,
      name: `Audit create ${Date.now()}`,
      status: FormTemplateStatus.DRAFT,
    });

    const draft = await insertDraftFormTemplateVersion(db, {
      formTemplateId: tpl.id,
      tenantId: tenant.id,
    });

    const app = sectionApp(admin);
    const createRes = await app.handle(
      new Request(`http://localhost/${tpl.id}/sections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "New section",
          sectionOrder: 1,
        }),
      })
    );
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as {
      data: { section: { id: string } };
    };

    const [ev] = await db
      .select()
      .from(formTemplateAuditEvent)
      .where(
        and(
          eq(formTemplateAuditEvent.formTemplateId, tpl.id),
          eq(formTemplateAuditEvent.tenantId, tenant.id),
          eq(formTemplateAuditEvent.subjectId, created.data.section.id)
        )
      )
      .limit(1);

    expect(ev).toBeDefined();
    if (!ev) throw new Error("expected section_created audit event");
    expect(ev.eventType).toBe(FormTemplateAuditEventType.SECTION_CREATED);
    expect(ev.formTemplateVersionId).toBe(draft.id);
    expect(ev.actorUserId).toBe(admin.id);
    expect(ev.before).toBeNull();
  });
});
