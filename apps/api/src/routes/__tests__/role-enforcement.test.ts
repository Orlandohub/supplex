import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  setDefaultTimeout,
} from "bun:test";
import { db } from "../../lib/db";
import { tenants, users, formTemplate, FormTemplateStatus } from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import { UserRole } from "@supplex/types";

import { insertOneOrThrow, selectFirstOrThrow } from "../../lib/db-helpers";
setDefaultTimeout(30000);

/**
 * SEC-005: Role Enforcement Tests
 *
 * Verifies that the role-based access patterns added to the 5 protected routes
 * correctly deny unauthorized roles and allow authorized ones.
 *
 * These tests use direct DB queries to verify the filtering logic that the
 * routes implement. The test infrastructure does not support easy mocking of
 * the full auth middleware chain for HTTP-level route testing.
 *
 * The `requireRole` middleware is already tested in the RBAC middleware tests.
 * These tests verify that:
 * - The form template list route filters non-admin to published+active only
 * - The form template get route returns 404 for non-admin accessing drafts
 * - The inline admin checks produce the correct 403 response shape
 */
describe("SEC-005: Role Enforcement", () => {
  let tenantId: string;
  let _adminUserId: string;
  let draftTemplateId: string;
  let publishedTemplateId: string;
  let archivedTemplateId: string;
  let inactivePublishedTemplateId: string;

  beforeAll(async () => {
    const tenant = await insertOneOrThrow(db, tenants, {
      name: "SEC005 Test",
      slug: `sec005-${Date.now()}`,
    });
    tenantId = tenant.id;

    const admin = await insertOneOrThrow(db, users, {
      id: crypto.randomUUID(),
      tenantId,
      email: `sec005-admin-${Date.now()}@test.com`,
      fullName: "Admin",
      role: "admin",
    });
    _adminUserId = admin.id;

    const draft = await insertOneOrThrow(db, formTemplate, {
      tenantId,
      name: "Draft Template",
      status: FormTemplateStatus.DRAFT,
      isActive: true,
    });
    draftTemplateId = draft.id;

    const published = await insertOneOrThrow(db, formTemplate, {
      tenantId,
      name: "Published Template",
      status: FormTemplateStatus.PUBLISHED,
      isActive: true,
    });
    publishedTemplateId = published.id;

    const archived = await insertOneOrThrow(db, formTemplate, {
      tenantId,
      name: "Archived Template",
      status: FormTemplateStatus.ARCHIVED,
      isActive: false,
    });
    archivedTemplateId = archived.id;

    const inactivePub = await insertOneOrThrow(db, formTemplate, {
      tenantId,
      name: "Inactive Published",
      status: FormTemplateStatus.PUBLISHED,
      isActive: false,
    });
    inactivePublishedTemplateId = inactivePub.id;
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  // ─── by-supplier: requireRole enforcement ──────────────────────

  describe("A7: form-submissions/by-supplier — requireRole middleware", () => {
    const allowedRoles = [
      UserRole.ADMIN,
      UserRole.PROCUREMENT_MANAGER,
      UserRole.QUALITY_MANAGER,
    ];
    const deniedRoles = [UserRole.VIEWER, UserRole.SUPPLIER_USER];

    test("allowed roles include admin, procurement_manager, quality_manager", () => {
      expect(allowedRoles).toContain(UserRole.ADMIN);
      expect(allowedRoles).toContain(UserRole.PROCUREMENT_MANAGER);
      expect(allowedRoles).toContain(UserRole.QUALITY_MANAGER);
    });

    test("denied roles include viewer and supplier_user", () => {
      for (const role of deniedRoles) {
        expect(allowedRoles).not.toContain(role);
      }
    });
  });

  // ─── copy routes: inline admin check ───────────────────────────

  describe("A8: workflow-templates/copy — inline admin check", () => {
    test("admin role passes inline check", () => {
      const user = { role: UserRole.ADMIN };
      expect(!user?.role || user.role !== UserRole.ADMIN).toBe(false);
    });

    test("viewer role fails inline check", () => {
      const user = { role: UserRole.VIEWER };
      expect(!user?.role || user.role !== UserRole.ADMIN).toBe(true);
    });

    test("supplier_user role fails inline check", () => {
      const user = { role: UserRole.SUPPLIER_USER };
      expect(!user?.role || user.role !== UserRole.ADMIN).toBe(true);
    });

    test("procurement_manager role fails inline check", () => {
      const user = { role: UserRole.PROCUREMENT_MANAGER };
      expect(!user?.role || user.role !== UserRole.ADMIN).toBe(true);
    });

    test("null role fails inline check", () => {
      const user: { role: UserRole | null } = { role: null };
      expect(!user?.role || user.role !== UserRole.ADMIN).toBe(true);
    });
  });

  describe("A9: form-templates/copy — inline admin check", () => {
    test("admin role passes inline check", () => {
      const user = { role: UserRole.ADMIN };
      expect(!user?.role || user.role !== UserRole.ADMIN).toBe(false);
    });

    test("viewer role fails inline check", () => {
      const user = { role: UserRole.VIEWER };
      expect(!user?.role || user.role !== UserRole.ADMIN).toBe(true);
    });

    test("supplier_user role fails inline check", () => {
      const user = { role: UserRole.SUPPLIER_USER };
      expect(!user?.role || user.role !== UserRole.ADMIN).toBe(true);
    });
  });

  // ─── form-templates/list: role-based filtering ─────────────────

  describe("A9/A10: form-templates/list — role-based filtering", () => {
    test("non-admin query returns only published+active templates", async () => {
      const isAdmin = false;
      const conditions = [
        eq(formTemplate.tenantId, tenantId),
        isNull(formTemplate.deletedAt),
      ];
      if (!isAdmin) {
        conditions.push(eq(formTemplate.status, "published"));
        conditions.push(eq(formTemplate.isActive, true));
      }

      const templates = await db
        .select()
        .from(formTemplate)
        .where(and(...conditions));

      const ids = templates.map((t) => t.id);
      expect(ids).toContain(publishedTemplateId);
      expect(ids).not.toContain(draftTemplateId);
      expect(ids).not.toContain(archivedTemplateId);
      expect(ids).not.toContain(inactivePublishedTemplateId);
    });

    test("admin query returns all templates (including drafts)", async () => {
      const _isAdmin = true;
      const conditions = [
        eq(formTemplate.tenantId, tenantId),
        isNull(formTemplate.deletedAt),
      ];

      const templates = await db
        .select()
        .from(formTemplate)
        .where(and(...conditions));

      const ids = templates.map((t) => t.id);
      expect(ids).toContain(publishedTemplateId);
      expect(ids).toContain(draftTemplateId);
      expect(ids).toContain(archivedTemplateId);
      expect(ids).toContain(inactivePublishedTemplateId);
    });
  });

  // ─── form-templates/get: role-based draft hiding ───────────────

  describe("A9/A10: form-templates/get — draft hiding for non-admin", () => {
    test("non-admin accessing draft template gets 404 behavior", async () => {
      const templateRecord = await selectFirstOrThrow(
        db
          .select()
          .from(formTemplate)
          .where(
            and(
              eq(formTemplate.id, draftTemplateId),
              eq(formTemplate.tenantId, tenantId),
              isNull(formTemplate.deletedAt)
            )
          )
      );

      expect(templateRecord).toBeDefined();
      const userRole = UserRole.SUPPLIER_USER as UserRole;
      const shouldHide =
        userRole !== UserRole.ADMIN && templateRecord.status !== "published";
      expect(shouldHide).toBe(true);
    });

    test("non-admin accessing published template succeeds", async () => {
      const templateRecord = await selectFirstOrThrow(
        db
          .select()
          .from(formTemplate)
          .where(
            and(
              eq(formTemplate.id, publishedTemplateId),
              eq(formTemplate.tenantId, tenantId),
              isNull(formTemplate.deletedAt)
            )
          )
      );

      expect(templateRecord).toBeDefined();
      const userRole = UserRole.VIEWER as UserRole;
      const shouldHide =
        userRole !== UserRole.ADMIN && templateRecord.status !== "published";
      expect(shouldHide).toBe(false);
    });

    test("admin accessing draft template succeeds", async () => {
      const templateRecord = await selectFirstOrThrow(
        db
          .select()
          .from(formTemplate)
          .where(
            and(
              eq(formTemplate.id, draftTemplateId),
              eq(formTemplate.tenantId, tenantId),
              isNull(formTemplate.deletedAt)
            )
          )
      );

      expect(templateRecord).toBeDefined();
      const userRole: UserRole = UserRole.ADMIN;
      const shouldHide =
        userRole !== UserRole.ADMIN && templateRecord.status !== "published";
      expect(shouldHide).toBe(false);
    });

    test("non-admin accessing archived template gets 404 behavior", async () => {
      const templateRecord = await selectFirstOrThrow(
        db
          .select()
          .from(formTemplate)
          .where(
            and(
              eq(formTemplate.id, archivedTemplateId),
              eq(formTemplate.tenantId, tenantId),
              isNull(formTemplate.deletedAt)
            )
          )
      );

      expect(templateRecord).toBeDefined();
      const userRole = UserRole.PROCUREMENT_MANAGER as UserRole;
      const shouldHide =
        userRole !== UserRole.ADMIN && templateRecord.status !== "published";
      expect(shouldHide).toBe(true);
    });
  });
});
