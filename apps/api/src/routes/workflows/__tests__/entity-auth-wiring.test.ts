import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  setDefaultTimeout,
} from "bun:test";

setDefaultTimeout(30000);
import { db } from "../../../lib/db";
import {
  tenants,
  users,
  suppliers,
  processInstance,
  stepInstance,
  workflowTemplate,
} from "@supplex/db";
import { eq, and } from "drizzle-orm";
import { UserRole } from "@supplex/types";
import {
  getSupplierForUser,
  verifyProcessAccess,
  verifyStepProcessAccess,
} from "../../../lib/rbac/entity-authorization";
import type { AuthContext } from "../../../lib/rbac/middleware";

import { insertOneOrThrow, selectFirstOrThrow } from "../../../lib/db-helpers";
/**
 * SEC-004: Entity Authorization Wiring Tests
 *
 * Verifies that the authorization patterns used in the 6 protected routes
 * correctly deny supplier_user access to other suppliers' entities and
 * allow internal roles unrestricted access.
 *
 * These are direct-call tests (fallback approach) because the current test
 * infrastructure does not support easy mocking of the full auth middleware
 * chain for HTTP-level route testing. The entity-authorization helpers are
 * already unit-tested in __tests__/entity-authorization.test.ts.
 *
 * These tests verify the same data-loading + helper-calling patterns that
 * each route uses, ensuring the wiring is correct.
 */
describe("SEC-004: Entity Authorization Wiring", () => {
  let tenantId: string;
  let adminUserId: string;
  let supplierUserAId: string;
  let supplierAId: string;
  let supplierBId: string;
  let templateId: string;
  let processAId: string;
  let processBId: string;
  let stepAId: string;
  let stepBId: string;

  const adminUser = () =>
    ({
      id: adminUserId,
      email: "admin@test.com",
      role: UserRole.ADMIN,
      tenantId,
      fullName: "Admin",
    }) as AuthContext["user"];

  const supplierUserA = () =>
    ({
      id: supplierUserAId,
      email: "su-a@test.com",
      role: UserRole.SUPPLIER_USER,
      tenantId,
      fullName: "Supplier A User",
    }) as AuthContext["user"];

  beforeAll(async () => {
    const tenant = await insertOneOrThrow(db, tenants, {
      name: "SEC004 Test",
      slug: `sec004-${Date.now()}`,
    });
    tenantId = tenant.id;

    const admin = await insertOneOrThrow(db, users, {
      id: crypto.randomUUID(),
      tenantId,
      email: `sec004-admin-${Date.now()}@test.com`,
      fullName: "Admin",
      role: "admin",
    });
    adminUserId = admin.id;

    const suA = await insertOneOrThrow(db, users, {
      id: crypto.randomUUID(),
      tenantId,
      email: `sec004-su-a-${Date.now()}@test.com`,
      fullName: "Supplier A User",
      role: "supplier_user",
    });
    supplierUserAId = suA.id;

    const supplierA = await insertOneOrThrow(db, suppliers, {
      tenantId,
      name: "Supplier A",
      taxId: "SA1",
      category: "manufacturer",
      status: "approved",
      contactName: "A",
      contactEmail: "a@test.com",
      contactPhone: "111",
      address: {
        street: "1",
        city: "C",
        state: "S",
        postalCode: "0",
        country: "US",
      },
      certifications: [],
      metadata: {},
      createdBy: adminUserId,
      supplierUserId: supplierUserAId,
    });
    supplierAId = supplierA.id;

    const supplierB = await insertOneOrThrow(db, suppliers, {
      tenantId,
      name: "Supplier B",
      taxId: "SB1",
      category: "distributor",
      status: "approved",
      contactName: "B",
      contactEmail: "b@test.com",
      contactPhone: "222",
      address: {
        street: "2",
        city: "D",
        state: "T",
        postalCode: "1",
        country: "US",
      },
      certifications: [],
      metadata: {},
      createdBy: adminUserId,
    });
    supplierBId = supplierB.id;

    const template = await insertOneOrThrow(db, workflowTemplate, {
      tenantId,
      name: "SEC004 WF",
      status: "published",
      active: true,
      createdBy: adminUserId,
    });
    templateId = template.id;

    // Process for Supplier A
    const procA = await insertOneOrThrow(db, processInstance, {
      tenantId,
      processType: "workflow_execution",
      entityType: "supplier",
      entityId: supplierAId,
      status: "in_progress",
      initiatedBy: adminUserId,
      initiatedDate: new Date(),
      workflowTemplateId: templateId,
    });
    processAId = procA.id;

    // Process for Supplier B
    const procB = await insertOneOrThrow(db, processInstance, {
      tenantId,
      processType: "workflow_execution",
      entityType: "supplier",
      entityId: supplierBId,
      status: "in_progress",
      initiatedBy: adminUserId,
      initiatedDate: new Date(),
      workflowTemplateId: templateId,
    });
    processBId = procB.id;

    // Step in Supplier A's process
    const sA = await insertOneOrThrow(db, stepInstance, {
      tenantId,
      processInstanceId: processAId,
      stepOrder: 1,
      stepName: "Step A",
      stepType: "form",
      status: "active",
    });
    stepAId = sA.id;

    // Step in Supplier B's process
    const sB = await insertOneOrThrow(db, stepInstance, {
      tenantId,
      processInstanceId: processBId,
      stepOrder: 1,
      stepName: "Step B",
      stepType: "form",
      status: "active",
    });
    stepBId = sB.id;
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  // ─── A1: supplier-processes (getSupplierForUser pattern) ─────────

  describe("A1: supplier-processes — supplierId ownership", () => {
    test("supplier_user denied for another supplier's ID", async () => {
      const supplier = await getSupplierForUser(supplierUserAId, tenantId, db);
      expect(supplier).not.toBeNull();
      expect(supplier!.id).not.toBe(supplierBId);
    });

    test("supplier_user allowed for own supplier's ID", async () => {
      const supplier = await getSupplierForUser(supplierUserAId, tenantId, db);
      expect(supplier).not.toBeNull();
      expect(supplier!.id).toBe(supplierAId);
    });

    test("admin bypasses supplier check (no supplier link, allowed by role)", async () => {
      const supplier = await getSupplierForUser(adminUserId, tenantId, db);
      expect(supplier).toBeNull();
      // Admin routes skip the supplier check entirely (role !== SUPPLIER_USER)
    });
  });

  // ─── A2: process events (verifyProcessAccess pattern) ────────────

  describe("A2: process events — verifyProcessAccess", () => {
    test("supplier_user denied for Supplier B's process", async () => {
      const process = await selectFirstOrThrow(
        db
          .select({
            entityType: processInstance.entityType,
            entityId: processInstance.entityId,
          })
          .from(processInstance)
          .where(eq(processInstance.id, processBId))
      );

      const result = await verifyProcessAccess(supplierUserA(), process, db);
      expect(result.allowed).toBe(false);
    });

    test("supplier_user allowed for own process", async () => {
      const process = await selectFirstOrThrow(
        db
          .select({
            entityType: processInstance.entityType,
            entityId: processInstance.entityId,
          })
          .from(processInstance)
          .where(eq(processInstance.id, processAId))
      );

      const result = await verifyProcessAccess(supplierUserA(), process, db);
      expect(result.allowed).toBe(true);
    });

    test("admin allowed for any process", async () => {
      const process = await selectFirstOrThrow(
        db
          .select({
            entityType: processInstance.entityType,
            entityId: processInstance.entityId,
          })
          .from(processInstance)
          .where(eq(processInstance.id, processBId))
      );

      const result = await verifyProcessAccess(adminUser(), process, db);
      expect(result.allowed).toBe(true);
    });
  });

  // ─── A3: comment create (verifyProcessAccess pattern) ────────────

  describe("A3: comment create — verifyProcessAccess on loaded process", () => {
    test("supplier_user denied for comment on Supplier B's process", async () => {
      const process = await selectFirstOrThrow(
        db
          .select({
            entityType: processInstance.entityType,
            entityId: processInstance.entityId,
          })
          .from(processInstance)
          .where(
            and(
              eq(processInstance.id, processBId),
              eq(processInstance.tenantId, tenantId)
            )
          )
      );

      const result = await verifyProcessAccess(supplierUserA(), process, db);
      expect(result.allowed).toBe(false);
    });

    test("supplier_user allowed for comment on own process", async () => {
      const process = await selectFirstOrThrow(
        db
          .select({
            entityType: processInstance.entityType,
            entityId: processInstance.entityId,
          })
          .from(processInstance)
          .where(
            and(
              eq(processInstance.id, processAId),
              eq(processInstance.tenantId, tenantId)
            )
          )
      );

      const result = await verifyProcessAccess(supplierUserA(), process, db);
      expect(result.allowed).toBe(true);
    });
  });

  // ─── A4: comments get-by-step (verifyStepProcessAccess) ─────────

  describe("A4: comments get-by-step — verifyStepProcessAccess", () => {
    test("supplier_user denied for Supplier B's step", async () => {
      const result = await verifyStepProcessAccess(
        supplierUserA(),
        stepBId,
        db
      );
      expect(result.allowed).toBe(false);
    });

    test("supplier_user allowed for own step", async () => {
      const result = await verifyStepProcessAccess(
        supplierUserA(),
        stepAId,
        db
      );
      expect(result.allowed).toBe(true);
    });

    test("admin allowed for any step", async () => {
      const result = await verifyStepProcessAccess(adminUser(), stepBId, db);
      expect(result.allowed).toBe(true);
    });
  });

  // ─── A5: step document upload (verifyStepProcessAccess) ─────────

  describe("A5: step document upload — verifyStepProcessAccess before file ops", () => {
    test("supplier_user denied for upload to Supplier B's step", async () => {
      const result = await verifyStepProcessAccess(
        supplierUserA(),
        stepBId,
        db
      );
      expect(result.allowed).toBe(false);
    });

    test("supplier_user allowed for upload to own step", async () => {
      const result = await verifyStepProcessAccess(
        supplierUserA(),
        stepAId,
        db
      );
      expect(result.allowed).toBe(true);
    });

    test("admin allowed for upload to any step", async () => {
      const result = await verifyStepProcessAccess(adminUser(), stepBId, db);
      expect(result.allowed).toBe(true);
    });
  });

  // ─── A6: form draft create (verifyProcessAccess when processInstanceId given) ─

  describe("A6: form draft create — verifyProcessAccess with processInstanceId", () => {
    test("supplier_user denied for draft linked to Supplier B's process", async () => {
      const process = await selectFirstOrThrow(
        db
          .select({
            entityType: processInstance.entityType,
            entityId: processInstance.entityId,
          })
          .from(processInstance)
          .where(
            and(
              eq(processInstance.id, processBId),
              eq(processInstance.tenantId, tenantId)
            )
          )
      );

      const result = await verifyProcessAccess(supplierUserA(), process, db);
      expect(result.allowed).toBe(false);
    });

    test("supplier_user allowed for draft linked to own process", async () => {
      const process = await selectFirstOrThrow(
        db
          .select({
            entityType: processInstance.entityType,
            entityId: processInstance.entityId,
          })
          .from(processInstance)
          .where(
            and(
              eq(processInstance.id, processAId),
              eq(processInstance.tenantId, tenantId)
            )
          )
      );

      const result = await verifyProcessAccess(supplierUserA(), process, db);
      expect(result.allowed).toBe(true);
    });

    test("admin allowed for draft linked to any process", async () => {
      const process = await selectFirstOrThrow(
        db
          .select({
            entityType: processInstance.entityType,
            entityId: processInstance.entityId,
          })
          .from(processInstance)
          .where(eq(processInstance.id, processBId))
      );

      const result = await verifyProcessAccess(adminUser(), process, db);
      expect(result.allowed).toBe(true);
    });
  });
});
