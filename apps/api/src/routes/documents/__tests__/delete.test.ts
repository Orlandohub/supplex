import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { treaty } from "@elysiajs/eden";
import type app from "../../../index";
import { db, documents, suppliers, tenants, users } from "@supplex/db";
import { eq, isNull } from "drizzle-orm";
import { randomUUID } from "crypto";

type App = typeof app;
const client = treaty<App>("localhost:3001");

describe("DELETE /api/documents/:id", () => {
  let testTenantId: string;
  let testUserId: string;
  let testSupplierId: string;
  let testToken: string;

  beforeAll(async () => {
    // Create test tenant
    const tenant = (
      await db
        .insert(tenants)
        .values({
          name: "Test Tenant - Documents Delete",
          slug: "test-tenant-docs-delete",
          settings: {},
        })
        .returning()
    )[0]!;
    testTenantId = tenant.id;

    // Create test user (Admin)
    testUserId = randomUUID();
    await db
      .insert(users)
      .values({
        id: testUserId,
        email: "test-docs-delete@example.com",
        fullName: "Test Delete User",
        role: "admin",
        tenantId: testTenantId,
        isActive: true,
      })
      .returning();

    testToken = "mock-jwt-token";

    // Create test supplier
    const supplier = (
      await db
        .insert(suppliers)
        .values({
          tenantId: testTenantId,
          name: "Test Supplier",
          taxId: "12345678",
          category: "manufacturer",
          status: "approved",
          contactName: "John Doe",
          contactEmail: "john@example.com",
          contactPhone: "+1234567890",
          address: {
            street: "123 Main St",
            city: "Test City",
            state: "TS",
            postalCode: "12345",
            country: "US",
          },
          certifications: [],
          metadata: {},
          createdBy: testUserId,
        })
        .returning()
    )[0]!;
    testSupplierId = supplier.id;
  });

  afterAll(async () => {
    // Cleanup
    await db.delete(documents).where(eq(documents.tenantId, testTenantId));
    await db.delete(suppliers).where(eq(suppliers.tenantId, testTenantId));
    await db.delete(users).where(eq(users.tenantId, testTenantId));
    await db.delete(tenants).where(eq(tenants.id, testTenantId));
  });

  it("should soft delete document", async () => {
    // Create document to delete
    const document = (
      await db
        .insert(documents)
        .values({
          tenantId: testTenantId,
          supplierId: testSupplierId,
          filename: "to-delete.pdf",
          documentType: "certificate",
          storagePath: `${testTenantId}/${testSupplierId}/to-delete.pdf`,
          fileSize: 1024,
          mimeType: "application/pdf",
          uploadedBy: testUserId,
        })
        .returning()
    )[0]!;

    const response = await (client.api.documents as any)[document.id].delete({
      headers: {
        Authorization: `Bearer ${testToken}`,
      },
    });

    expect(response.status).toBe(200);
    expect(response.data).toBeDefined();
    if (response.data && "success" in response.data) {
      expect(response.data.success).toBe(true);
    }

    // Verify document is soft deleted (has deletedAt timestamp)
    const deletedDoc = (
      await db
        .select()
        .from(documents)
        .where(eq(documents.id, document.id))
        .limit(1)
    )[0]!;

    expect(deletedDoc).toBeDefined();
    expect(deletedDoc.deletedAt).not.toBeNull();

    // Verify document is excluded from list queries
    const activeDocuments = await db
      .select()
      .from(documents)
      .where(
        eq(documents.supplierId, testSupplierId) && isNull(documents.deletedAt)
      );

    const deletedDocInList = activeDocuments.some(
      (doc) => doc.id === document.id
    );
    expect(deletedDocInList).toBe(false);
  });

  it("should return 404 if document doesn't exist", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const response = await (client.api.documents as any)[fakeId]!.delete({
      headers: {
        Authorization: `Bearer ${testToken}`,
      },
    });

    expect(response.status).toBe(404);
  });

  it("should require authentication", async () => {
    const document = (
      await db
        .insert(documents)
        .values({
          tenantId: testTenantId,
          supplierId: testSupplierId,
          filename: "auth-test.pdf",
          documentType: "certificate",
          storagePath: `${testTenantId}/${testSupplierId}/auth-test.pdf`,
          fileSize: 1024,
          mimeType: "application/pdf",
          uploadedBy: testUserId,
        })
        .returning()
    )[0]!;

    const response = await (client.api.documents as any)[document.id].delete();

    expect(response.status).toBe(401);

    // Cleanup
    await db.delete(documents).where(eq(documents.id, document.id));
  });

  it("should enforce RBAC (Admin/Procurement Manager only)", async () => {
    // Create viewer user
    const viewerId = randomUUID();
    const viewer = (
      await db
        .insert(users)
        .values({
          id: viewerId,
          email: "viewer-delete@example.com",
          fullName: "Test Viewer",
          role: "viewer",
          tenantId: testTenantId,
          isActive: true,
        })
        .returning()
    )[0]!;

    const viewerToken = "mock-viewer-token";

    const document = (
      await db
        .insert(documents)
        .values({
          tenantId: testTenantId,
          supplierId: testSupplierId,
          filename: "rbac-test.pdf",
          documentType: "certificate",
          storagePath: `${testTenantId}/${testSupplierId}/rbac-test.pdf`,
          fileSize: 1024,
          mimeType: "application/pdf",
          uploadedBy: testUserId,
        })
        .returning()
    )[0]!;

    const response = await (client.api.documents as any)[document.id].delete({
      headers: {
        Authorization: `Bearer ${viewerToken}`,
      },
    });

    expect(response.status).toBe(403);

    // Cleanup
    await db.delete(documents).where(eq(documents.id, document.id));
    await db.delete(users).where(eq(users.id, viewer.id));
  });

  it("should enforce tenant isolation", async () => {
    // Create different tenant with document
    const otherTenant = (
      await db
        .insert(tenants)
        .values({
          name: "Other Tenant",
          slug: "other-tenant-delete",
          settings: {},
        })
        .returning()
    )[0]!;

    const otherUserId = randomUUID();
    const otherUser = (
      await db
        .insert(users)
        .values({
          id: otherUserId,
          email: "other-user-delete@example.com",
          fullName: "Other Tenant User",
          role: "admin",
          tenantId: otherTenant.id,
          isActive: true,
        })
        .returning()
    )[0]!;

    const otherSupplier = (
      await db
        .insert(suppliers)
        .values({
          tenantId: otherTenant.id,
          name: "Other Supplier",
          taxId: "87654321",
          category: "distributor",
          status: "approved",
          contactName: "Jane Doe",
          contactEmail: "jane@example.com",
          contactPhone: "+1234567890",
          address: {
            street: "456 Other St",
            city: "Other City",
            state: "OT",
            postalCode: "54321",
            country: "US",
          },
          certifications: [],
          metadata: {},
          createdBy: otherUser.id,
        })
        .returning()
    )[0]!;

    const otherDocument = (
      await db
        .insert(documents)
        .values({
          tenantId: otherTenant.id,
          supplierId: otherSupplier.id,
          filename: "other-doc.pdf",
          documentType: "certificate",
          storagePath: `${otherTenant.id}/${otherSupplier.id}/other-doc.pdf`,
          fileSize: 1024,
          mimeType: "application/pdf",
          uploadedBy: otherUser.id,
        })
        .returning()
    )[0]!;

    // Attempt to delete document from different tenant
    const response = await (client.api.documents as any)[
      otherDocument.id
    ].delete({
      headers: {
        Authorization: `Bearer ${testToken}`,
      },
    });

    expect(response.status).toBe(404); // Should not find document from other tenant

    // Cleanup
    await db.delete(documents).where(eq(documents.id, otherDocument.id));
    await db.delete(suppliers).where(eq(suppliers.id, otherSupplier.id));
    await db.delete(users).where(eq(users.id, otherUser.id));
    await db.delete(tenants).where(eq(tenants.id, otherTenant.id));
  });

  it("should return 404 when trying to delete already deleted document", async () => {
    // Create and delete document
    const document = (
      await db
        .insert(documents)
        .values({
          tenantId: testTenantId,
          supplierId: testSupplierId,
          filename: "already-deleted.pdf",
          documentType: "contract",
          storagePath: `${testTenantId}/${testSupplierId}/already-deleted.pdf`,
          fileSize: 2048,
          mimeType: "application/pdf",
          uploadedBy: testUserId,
          deletedAt: new Date(),
        })
        .returning()
    )[0]!;

    const response = await (client.api.documents as any)[document.id].delete({
      headers: {
        Authorization: `Bearer ${testToken}`,
      },
    });

    expect(response.status).toBe(404);

    // Cleanup
    await db.delete(documents).where(eq(documents.id, document.id));
  });
});
