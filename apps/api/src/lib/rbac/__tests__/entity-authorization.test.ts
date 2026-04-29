import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { db } from "../../db";
import {
  tenants,
  users,
  suppliers,
  processInstance,
  stepInstance,
  taskInstance,
  workflowTemplate,
} from "@supplex/db";
import { eq } from "drizzle-orm";
import { UserRole } from "@supplex/types";
import {
  getSupplierForUser,
  verifyProcessAccess,
  verifyDocumentAccess,
  verifyTaskAssignment,
  verifyStepProcessAccess,
} from "../entity-authorization";
import type { AuthContext } from "../middleware";

import { insertOneOrThrow } from "../../db-helpers";
describe("Entity-Level Authorization Helpers", () => {
  let tenantId: string;
  let adminUserId: string;
  let supplierUserId: string;
  let supplierId: string;
  let otherSupplierId: string;
  let templateId: string;

  beforeAll(async () => {
    const tenant = await insertOneOrThrow(db, tenants, {
      name: "Auth Test Tenant",
      slug: `auth-test-${Date.now()}`,
    });
    tenantId = tenant.id;

    const admin = await insertOneOrThrow(db, users, {
      id: crypto.randomUUID(),
      tenantId,
      email: `admin-auth-${Date.now()}@test.com`,
      fullName: "Admin User",
      role: "admin",
    });
    adminUserId = admin.id;

    const su = await insertOneOrThrow(db, users, {
      id: crypto.randomUUID(),
      tenantId,
      email: `supplier-auth-${Date.now()}@test.com`,
      fullName: "Supplier User",
      role: "supplier_user",
    });
    supplierUserId = su.id;

    const supplier = await insertOneOrThrow(db, suppliers, {
      tenantId,
      name: "My Supplier",
      taxId: "111",
      category: "manufacturer",
      status: "approved",
      contactName: "A",
      contactEmail: "a@test.com",
      contactPhone: "123",
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
      supplierUserId,
    });
    supplierId = supplier.id;

    const other = await insertOneOrThrow(db, suppliers, {
      tenantId,
      name: "Other Supplier",
      taxId: "222",
      category: "distributor",
      status: "approved",
      contactName: "B",
      contactEmail: "b@test.com",
      contactPhone: "456",
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
    otherSupplierId = other.id;

    const template = await insertOneOrThrow(db, workflowTemplate, {
      tenantId,
      name: "Auth WF",
      status: "published",
      active: true,
      createdBy: adminUserId,
    });
    templateId = template.id;
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  // ----- getSupplierForUser -----
  describe("getSupplierForUser", () => {
    test("returns supplier for linked supplier_user", async () => {
      const result = await getSupplierForUser(supplierUserId, tenantId, db);
      expect(result).not.toBeNull();
      expect(result!.id).toBe(supplierId);
    });

    test("returns null for admin user (no supplier link)", async () => {
      const result = await getSupplierForUser(adminUserId, tenantId, db);
      expect(result).toBeNull();
    });

    test("returns null for non-existent user", async () => {
      const result = await getSupplierForUser(
        crypto.randomUUID(),
        tenantId,
        db
      );
      expect(result).toBeNull();
    });
  });

  // ----- verifyProcessAccess -----
  describe("verifyProcessAccess", () => {
    test("admin can access any process", async () => {
      const adminUser: AuthContext["user"] = {
        id: adminUserId,
        email: "a@t.com",
        role: UserRole.ADMIN,
        tenantId,
        fullName: "A",
      };
      const result = await verifyProcessAccess(
        adminUser,
        { entityType: "supplier", entityId: otherSupplierId },
        db
      );
      expect(result.allowed).toBe(true);
    });

    test("supplier_user can access own supplier process", async () => {
      const su: AuthContext["user"] = {
        id: supplierUserId,
        email: "s@t.com",
        role: UserRole.SUPPLIER_USER,
        tenantId,
        fullName: "S",
      };
      const result = await verifyProcessAccess(
        su,
        { entityType: "supplier", entityId: supplierId },
        db
      );
      expect(result.allowed).toBe(true);
    });

    test("supplier_user cannot access another supplier's process", async () => {
      const su: AuthContext["user"] = {
        id: supplierUserId,
        email: "s@t.com",
        role: UserRole.SUPPLIER_USER,
        tenantId,
        fullName: "S",
      };
      const result = await verifyProcessAccess(
        su,
        { entityType: "supplier", entityId: otherSupplierId },
        db
      );
      expect(result.allowed).toBe(false);
    });
  });

  // ----- verifyDocumentAccess -----
  describe("verifyDocumentAccess", () => {
    test("admin can access any document", async () => {
      const adminUser: AuthContext["user"] = {
        id: adminUserId,
        email: "a@t.com",
        role: UserRole.ADMIN,
        tenantId,
        fullName: "A",
      };
      const result = await verifyDocumentAccess(
        adminUser,
        { supplierId: otherSupplierId },
        db
      );
      expect(result.allowed).toBe(true);
    });

    test("supplier_user can access own document", async () => {
      const su: AuthContext["user"] = {
        id: supplierUserId,
        email: "s@t.com",
        role: UserRole.SUPPLIER_USER,
        tenantId,
        fullName: "S",
      };
      const result = await verifyDocumentAccess(su, { supplierId }, db);
      expect(result.allowed).toBe(true);
    });

    test("supplier_user cannot access other supplier's document", async () => {
      const su: AuthContext["user"] = {
        id: supplierUserId,
        email: "s@t.com",
        role: UserRole.SUPPLIER_USER,
        tenantId,
        fullName: "S",
      };
      const result = await verifyDocumentAccess(
        su,
        { supplierId: otherSupplierId },
        db
      );
      expect(result.allowed).toBe(false);
    });
  });

  // ----- verifyTaskAssignment -----
  describe("verifyTaskAssignment", () => {
    test("user with matching pending task is allowed", async () => {
      const process = await insertOneOrThrow(db, processInstance, {
        tenantId,
        processType: "workflow_execution",
        entityType: "supplier",
        entityId: supplierId,
        status: "in_progress",
        initiatedBy: adminUserId,
        initiatedDate: new Date(),
        workflowTemplateId: templateId,
      });

      const step = await insertOneOrThrow(db, stepInstance, {
        tenantId,
        processInstanceId: process.id,
        stepOrder: 1,
        stepName: "Submit",
        stepType: "form",
        status: "active",
      });

      const task = await insertOneOrThrow(db, taskInstance, {
        tenantId,
        processInstanceId: process.id,
        stepInstanceId: step.id,
        title: "Fill form",
        assigneeType: "user",
        assigneeUserId: supplierUserId,
        status: "pending",
        taskType: "action",
      });

      const su: AuthContext["user"] = {
        id: supplierUserId,
        email: "s@t.com",
        role: UserRole.SUPPLIER_USER,
        tenantId,
        fullName: "S",
      };
      const result = await verifyTaskAssignment(
        su,
        step.id,
        ["action", "resubmission"],
        db
      );
      expect(result.allowed).toBe(true);
      expect(result.taskId).toBe(task.id);

      await db
        .delete(processInstance)
        .where(eq(processInstance.id, process.id));
    });

    test("user without matching task is denied", async () => {
      const su: AuthContext["user"] = {
        id: supplierUserId,
        email: "s@t.com",
        role: UserRole.SUPPLIER_USER,
        tenantId,
        fullName: "S",
      };
      const fakeStepId = crypto.randomUUID();
      const result = await verifyTaskAssignment(su, fakeStepId, ["action"], db);
      expect(result.allowed).toBe(false);
    });

    test("role-based assignment works for validation tasks", async () => {
      const process = await insertOneOrThrow(db, processInstance, {
        tenantId,
        processType: "workflow_execution",
        entityType: "supplier",
        entityId: supplierId,
        status: "in_progress",
        initiatedBy: adminUserId,
        initiatedDate: new Date(),
        workflowTemplateId: templateId,
      });

      const step = await insertOneOrThrow(db, stepInstance, {
        tenantId,
        processInstanceId: process.id,
        stepOrder: 1,
        stepName: "Validate",
        stepType: "approval",
        status: "awaiting_validation",
      });

      await db.insert(taskInstance).values({
        tenantId,
        processInstanceId: process.id,
        stepInstanceId: step.id,
        title: "Review",
        assigneeType: "role",
        assigneeRole: "admin",
        status: "pending",
        taskType: "validation",
      });

      const adminUser: AuthContext["user"] = {
        id: adminUserId,
        email: "a@t.com",
        role: UserRole.ADMIN,
        tenantId,
        fullName: "A",
      };
      const result = await verifyTaskAssignment(
        adminUser,
        step.id,
        ["validation"],
        db
      );
      expect(result.allowed).toBe(true);

      await db
        .delete(processInstance)
        .where(eq(processInstance.id, process.id));
    });
  });

  // ----- verifyStepProcessAccess -----
  describe("verifyStepProcessAccess", () => {
    test("supplier_user can access step of own process", async () => {
      const process = await insertOneOrThrow(db, processInstance, {
        tenantId,
        processType: "workflow_execution",
        entityType: "supplier",
        entityId: supplierId,
        status: "in_progress",
        initiatedBy: adminUserId,
        initiatedDate: new Date(),
        workflowTemplateId: templateId,
      });

      const step = await insertOneOrThrow(db, stepInstance, {
        tenantId,
        processInstanceId: process.id,
        stepOrder: 1,
        stepName: "Step 1",
        stepType: "form",
        status: "active",
      });

      const su: AuthContext["user"] = {
        id: supplierUserId,
        email: "s@t.com",
        role: UserRole.SUPPLIER_USER,
        tenantId,
        fullName: "S",
      };
      const result = await verifyStepProcessAccess(su, step.id, db);
      expect(result.allowed).toBe(true);

      await db
        .delete(processInstance)
        .where(eq(processInstance.id, process.id));
    });

    test("supplier_user denied for step of other supplier's process", async () => {
      const process = await insertOneOrThrow(db, processInstance, {
        tenantId,
        processType: "workflow_execution",
        entityType: "supplier",
        entityId: otherSupplierId,
        status: "in_progress",
        initiatedBy: adminUserId,
        initiatedDate: new Date(),
        workflowTemplateId: templateId,
      });

      const step = await insertOneOrThrow(db, stepInstance, {
        tenantId,
        processInstanceId: process.id,
        stepOrder: 1,
        stepName: "Other Step",
        stepType: "form",
        status: "active",
      });

      const su: AuthContext["user"] = {
        id: supplierUserId,
        email: "s@t.com",
        role: UserRole.SUPPLIER_USER,
        tenantId,
        fullName: "S",
      };
      const result = await verifyStepProcessAccess(su, step.id, db);
      expect(result.allowed).toBe(false);

      await db
        .delete(processInstance)
        .where(eq(processInstance.id, process.id));
    });
  });
});
