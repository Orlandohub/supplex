import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { treaty } from "@elysiajs/eden";
import type app from "../../../index";
import { db, documents, suppliers, tenants, users } from "@supplex/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

type App = typeof app;
const client = treaty<App>("localhost:3001");

describe("GET /api/suppliers/:supplierId/documents", () => {
  let testTenantId: string;
  let testUserId: string;
  let testSupplierId: string;
  let testToken: string;
  let testDocumentId: string;

  beforeAll(async () => {
    // Create test tenant
    const tenant = (
      await db
        .insert(tenants)
        .values({
          name: "Test Tenant - Documents List",
          slug: "test-tenant-docs-list",
          settings: {},
        })
        .returning()
    )[0]!;
    testTenantId = tenant.id;

    // Create test user
    testUserId = randomUUID();
    await db
      .insert(users)
      .values({
        id: testUserId,
        email: "test-docs-list@example.com",
        fullName: "Test User",
        role: "admin",
        tenantId: testTenantId,
        isActive: true,
      })
      .returning();

    // Mock JWT token (in real tests, you'd use Supabase auth)
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

    // Create test document
    const document = (
      await db
        .insert(documents)
        .values({
          tenantId: testTenantId,
          supplierId: testSupplierId,
          filename: "test-document.pdf",
          documentType: "certificate",
          storagePath: `${testTenantId}/${testSupplierId}/test.pdf`,
          fileSize: 1024,
          mimeType: "application/pdf",
          description: "Test document",
          expiryDate: new Date("2025-12-31"),
          uploadedBy: testUserId,
        })
        .returning()
    )[0]!;
    testDocumentId = document.id;
  });

  afterAll(async () => {
    // Cleanup
    await db.delete(documents).where(eq(documents.tenantId, testTenantId));
    await db.delete(suppliers).where(eq(suppliers.tenantId, testTenantId));
    await db.delete(users).where(eq(users.tenantId, testTenantId));
    await db.delete(tenants).where(eq(tenants.id, testTenantId));
  });

  it("should return documents for a supplier", async () => {
    const response = await (client.api.suppliers as any)[
      testSupplierId
    ]!.documents.get({
      headers: {
        Authorization: `Bearer ${testToken}`,
      },
    });

    expect(response.status).toBe(200);
    expect(response.data).toBeDefined();
    if (response.data && "documents" in response.data) {
      expect(Array.isArray(response.data.documents)).toBe(true);
      expect(response.data.documents.length).toBeGreaterThan(0);
      expect(response.data.documents[0]!.id).toBe(testDocumentId);
    }
  });

  it("should return empty array when no documents exist", async () => {
    // Create supplier without documents
    const emptySupplier = (
      await db
        .insert(suppliers)
        .values({
          tenantId: testTenantId,
          name: "Empty Supplier",
          taxId: "87654321",
          category: "distributor",
          status: "approved",
          contactName: "Jane Doe",
          contactEmail: "jane@example.com",
          contactPhone: "+1234567890",
          address: {
            street: "456 Empty St",
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

    const response = await (client.api.suppliers as any)[
      emptySupplier.id
    ].documents.get({
      headers: {
        Authorization: `Bearer ${testToken}`,
      },
    });

    expect(response.status).toBe(200);
    expect(response.data).toBeDefined();
    if (response.data && "documents" in response.data) {
      expect(Array.isArray(response.data.documents)).toBe(true);
      expect(response.data.documents.length).toBe(0);
    }

    // Cleanup
    await db.delete(suppliers).where(eq(suppliers.id, emptySupplier.id));
  });

  it("should return 404 if supplier doesn't exist", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const response = await (client.api.suppliers as any)[fakeId]!.documents.get(
      {
        headers: {
          Authorization: `Bearer ${testToken}`,
        },
      }
    );

    expect(response.status).toBe(404);
  });

  it("should return 401 without authentication", async () => {
    const response = await (client.api.suppliers as any)[
      testSupplierId
    ]!.documents.get();

    expect(response.status).toBe(401);
  });

  it("should not return deleted documents", async () => {
    // Create and delete a document
    const deletedDoc = (
      await db
        .insert(documents)
        .values({
          tenantId: testTenantId,
          supplierId: testSupplierId,
          filename: "deleted-doc.pdf",
          documentType: "contract",
          storagePath: `${testTenantId}/${testSupplierId}/deleted.pdf`,
          fileSize: 2048,
          mimeType: "application/pdf",
          uploadedBy: testUserId,
          deletedAt: new Date(),
        })
        .returning()
    )[0]!;

    const response = await (client.api.suppliers as any)[
      testSupplierId
    ]!.documents.get({
      headers: {
        Authorization: `Bearer ${testToken}`,
      },
    });

    expect(response.status).toBe(200);
    if (response.data && "documents" in response.data) {
      const deletedDocExists = response.data.documents.some(
        (doc: any) => doc.id === deletedDoc.id
      );
      expect(deletedDocExists).toBe(false);
    }

    // Cleanup
    await db.delete(documents).where(eq(documents.id, deletedDoc.id));
  });
});
