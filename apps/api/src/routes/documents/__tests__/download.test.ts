import { describe, it, expect, beforeAll, afterAll, mock } from "bun:test";
import { treaty } from "@elysiajs/eden";
import type app from "../../../index";
import { db, documents, suppliers, tenants, users } from "@supplex/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

type App = typeof app;
const client = treaty<App>("localhost:3001");

// Mock Supabase Storage for tests
mock.module("../../lib/supabase", () => ({
  supabaseAdmin: {
    storage: {
      from: () => ({
        createSignedUrl: async () => ({
          error: null,
          data: { signedUrl: "https://example.com/signed-url" },
        }),
      }),
    },
  },
}));

describe("GET /api/documents/:id/download", () => {
  let testTenantId: string;
  let testUserId: string;
  let testSupplierId: string;
  let testDocumentId: string;
  let testToken: string;

  beforeAll(async () => {
    // Create test tenant
    const tenant = (
      await db
        .insert(tenants)
        .values({
          name: "Test Tenant - Documents Download",
          slug: "test-tenant-docs-download",
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
        email: "test-docs-download@example.com",
        fullName: "Test Download User",
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

    // Create test document
    const document = (
      await db
        .insert(documents)
        .values({
          tenantId: testTenantId,
          supplierId: testSupplierId,
          filename: "download-test.pdf",
          documentType: "certificate",
          storagePath: `${testTenantId}/${testSupplierId}/download-test.pdf`,
          fileSize: 1024,
          mimeType: "application/pdf",
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

  it("should generate signed URL for document download", async () => {
    const response = await (client.api.documents as any)[
      testDocumentId
    ]!.download.get({
      headers: {
        Authorization: `Bearer ${testToken}`,
      },
    });

    expect(response.status).toBe(200);
    expect(response.data).toBeDefined();
    if (response.data && "url" in response.data) {
      expect(response.data.url).toContain("https://");
      expect(response.data.filename).toBe("download-test.pdf");
      expect(response.data.mimeType).toBe("application/pdf");
    }
  });

  it("should return 404 if document doesn't exist", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const response = await (client.api.documents as any)[fakeId]!.download.get({
      headers: {
        Authorization: `Bearer ${testToken}`,
      },
    });

    expect(response.status).toBe(404);
  });

  it("should require authentication", async () => {
    const response = await (client.api.documents as any)[
      testDocumentId
    ]!.download.get();

    expect(response.status).toBe(401);
  });

  it("should enforce tenant isolation", async () => {
    // Create different tenant with document
    const otherTenant = (
      await db
        .insert(tenants)
        .values({
          name: "Other Tenant",
          slug: "other-tenant-download",
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
          email: "other-user-download@example.com",
          fullName: "Other Tenant User",
          role: "admin",
          tenantId: otherTenant.id,
          isActive: true,
        })
        .returning()
    )[0]!;

    const otherToken = "mock-other-token";

    // Attempt to download document from different tenant
    const response = await (client.api.documents as any)[
      testDocumentId
    ]!.download.get({
      headers: {
        Authorization: `Bearer ${otherToken}`,
      },
    });

    expect(response.status).toBe(404); // Should not find document from other tenant

    // Cleanup
    await db.delete(users).where(eq(users.id, otherUser.id));
    await db.delete(tenants).where(eq(tenants.id, otherTenant.id));
  });

  it("should not allow download of deleted documents", async () => {
    // Create and delete document
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

    const response = await (client.api.documents as any)[
      deletedDoc.id
    ].download.get({
      headers: {
        Authorization: `Bearer ${testToken}`,
      },
    });

    expect(response.status).toBe(404);

    // Cleanup
    await db.delete(documents).where(eq(documents.id, deletedDoc.id));
  });
});
