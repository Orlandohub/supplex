/**
 * Tests for Get Supplier By User ID Endpoint
 * Tests: /api/suppliers/by-user/:userId
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { treaty } from "@elysiajs/eden";
import { db } from "../../lib/db";
import { suppliers, users, tenants } from "@supplex/db";
import { eq } from "drizzle-orm";
import type { App } from "../../index";
import app from "../../index";
import { UserRole } from "@supplex/types";

import { insertOneOrThrow } from "../../lib/db-helpers";
// Create treaty client
const client = treaty<App>(app);

interface SupplierByUserError {
  success: false;
  error: { code: string; message: string };
}

/**
 * Treaty puts non-2xx response bodies in `response.error.value`. Centralised
 * so each test can assert on `error.code` / `error.message` without mixing
 * `response.data?.error` (success-only path) with `response.error.value`.
 */
function errorBody(
  error: { value: unknown } | null
): SupplierByUserError | null {
  if (!error) return null;
  return error.value as SupplierByUserError;
}

// Test data
let testTenantId: string;
let testUserId: string;
let testSupplierId: string;
let testSupplierUserId: string;
let testUnassociatedUserId: string;
let authToken: string;
let otherTenantId: string;
let otherTenantSupplierId: string;
let otherTenantUserId: string;

describe("GET /api/suppliers/by-user/:userId", () => {
  beforeAll(async () => {
    // Create test tenant
    const tenant = await insertOneOrThrow(db, tenants, {
      name: "Test Tenant - By User Endpoint",
      slug: "test-tenant-by-user",
    });
    testTenantId = tenant.id;

    // Create another tenant for tenant isolation test
    const otherTenant = await insertOneOrThrow(db, tenants, {
      name: "Other Tenant - By User",
      slug: "other-tenant-by-user",
    });
    otherTenantId = otherTenant.id;

    // Create test admin user
    const adminUser = await insertOneOrThrow(db, users, {
      id: crypto.randomUUID(),
      tenantId: testTenantId,
      email: "admin@test-by-user.com",
      fullName: "Test Admin",
      role: UserRole.ADMIN,
      isActive: true,
      status: "active",
    });
    testUserId = adminUser.id;

    // Create supplier_user
    const supplierUser = await insertOneOrThrow(db, users, {
      id: crypto.randomUUID(),
      tenantId: testTenantId,
      email: "supplier@test-by-user.com",
      fullName: "Test Supplier User",
      role: UserRole.SUPPLIER_USER,
      isActive: true,
      status: "active",
    });
    testSupplierUserId = supplierUser.id;

    // Create unassociated user
    const unassociatedUser = await insertOneOrThrow(db, users, {
      id: crypto.randomUUID(),
      tenantId: testTenantId,
      email: "unassociated@test-by-user.com",
      fullName: "Unassociated User",
      role: UserRole.VIEWER,
      isActive: true,
      status: "active",
    });
    testUnassociatedUserId = unassociatedUser.id;

    // Create supplier associated with supplier_user
    const supplier = await insertOneOrThrow(db, suppliers, {
      tenantId: testTenantId,
      name: "Test Supplier with User",
      taxId: "TEST-TAX-BY-USER",
      category: "manufacturer",
      status: "approved",
      contactName: "Test Contact",
      contactEmail: "contact@test-supplier.com",
      contactPhone: "+1234567890",
      address: {
        street: "123 Test St",
        city: "Test City",
        state: "TS",
        postalCode: "12345",
        country: "Test Country",
      },
      certifications: [],
      metadata: {},
      supplierUserId: testSupplierUserId, // Link to supplier user
      createdBy: testUserId,
    });
    testSupplierId = supplier.id;

    // Create supplier in other tenant
    const otherTenantUser = await insertOneOrThrow(db, users, {
      id: crypto.randomUUID(),
      tenantId: otherTenantId,
      email: "user@other-tenant.com",
      fullName: "Other Tenant User",
      role: UserRole.SUPPLIER_USER,
      isActive: true,
      status: "active",
    });
    otherTenantUserId = otherTenantUser.id;

    const otherSupplier = await insertOneOrThrow(db, suppliers, {
      tenantId: otherTenantId,
      name: "Other Tenant Supplier",
      taxId: "OTHER-TAX",
      category: "distributor",
      status: "approved",
      contactName: "Other Contact",
      contactEmail: "contact@other.com",
      contactPhone: "+9876543210",
      address: {
        street: "456 Other St",
        city: "Other City",
        state: "OS",
        postalCode: "54321",
        country: "Other Country",
      },
      certifications: [],
      metadata: {},
      supplierUserId: otherTenantUserId,
      createdBy: otherTenantUserId,
    });
    otherTenantSupplierId = otherSupplier.id;

    // Mock auth token (in real tests, you'd get this from Supabase)
    authToken = "mock-jwt-token";
  });

  afterAll(async () => {
    // Clean up test data
    await db.delete(suppliers).where(eq(suppliers.id, testSupplierId));
    await db.delete(suppliers).where(eq(suppliers.id, otherTenantSupplierId));
    await db.delete(users).where(eq(users.id, testUserId));
    await db.delete(users).where(eq(users.id, testSupplierUserId));
    await db.delete(users).where(eq(users.id, testUnassociatedUserId));
    await db.delete(users).where(eq(users.id, otherTenantUserId));
    await db.delete(tenants).where(eq(tenants.id, testTenantId));
    await db.delete(tenants).where(eq(tenants.id, otherTenantId));
  });

  it("should return supplier for valid supplier_user", async () => {
    const response = await client.api.suppliers["by-user"]({
      userId: testSupplierUserId,
    }).get({
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    expect(response.status).toBe(200);
    expect(response.data).toBeDefined();

    if (response.data && "success" in response.data) {
      expect(response.data.success).toBe(true);
      expect(response.data.data).toBeDefined();
      expect(response.data.data?.id).toBe(testSupplierId);
      expect(response.data.data?.name).toBe("Test Supplier with User");
      expect(response.data.data?.supplierUserId).toBe(testSupplierUserId);
    }
  });

  it("should return 404 for user with no associated supplier", async () => {
    const response = await client.api.suppliers["by-user"]({
      userId: testUnassociatedUserId,
    }).get({
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    expect(response.status).toBe(404);
    const body = errorBody(response.error);
    expect(body?.success).toBe(false);
    expect(body?.error.code).toBe("SUPPLIER_NOT_FOUND");
    expect(body?.error.message).toBe("No supplier associated with this user");
  });

  it("should enforce tenant isolation", async () => {
    // Try to access other tenant's supplier user from current tenant
    const response = await client.api.suppliers["by-user"]({
      userId: otherTenantUserId,
    }).get({
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    // Should return 404 because tenant isolation prevents cross-tenant access
    expect(response.status).toBe(404);
    const body = errorBody(response.error);
    expect(body?.error.code).toBe("SUPPLIER_NOT_FOUND");
  });

  it("should return 401 without authentication", async () => {
    const response = await client.api.suppliers["by-user"]({
      userId: testSupplierUserId,
    }).get();

    expect(response.status).toBe(401);
    const body = errorBody(response.error);
    expect(body?.error.code).toBe("UNAUTHORIZED");
  });

  it("should return 404 for non-existent user", async () => {
    const fakeUserId = "00000000-0000-0000-0000-000000000000";

    const response = await client.api.suppliers["by-user"]({
      userId: fakeUserId,
    }).get({
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    expect(response.status).toBe(404);
    const body = errorBody(response.error);
    expect(body?.error.code).toBe("SUPPLIER_NOT_FOUND");
  });
});
