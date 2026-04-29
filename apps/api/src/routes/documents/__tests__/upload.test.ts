import { describe, it, expect, beforeAll, afterAll, mock } from "bun:test";
import { treaty } from "@elysiajs/eden";
import type app from "../../../index";
import { db, documents, suppliers, tenants, users } from "@supplex/db";
import { insertOneOrThrow } from "../../../lib/db-helpers";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

type App = typeof app;
const client = treaty<App>("localhost:3001");

// Mock Supabase Storage for tests
mock.module("../../lib/supabase", () => ({
  supabaseAdmin: {
    storage: {
      from: () => ({
        upload: async () => ({ error: null, data: { path: "test-path" } }),
        remove: async () => ({ error: null }),
      }),
    },
  },
}));

describe("POST /api/suppliers/:supplierId/documents", () => {
  let testTenantId: string;
  let testUserId: string;
  let testSupplierId: string;
  let testToken: string;

  beforeAll(async () => {
    // Create test tenant
    const tenant = await insertOneOrThrow(db, tenants, {
      name: "Test Tenant - Documents Upload",
      slug: "test-tenant-docs-upload",
      settings: {},
    });
    testTenantId = tenant.id;

    // Create test user (Admin)
    testUserId = randomUUID();
    await db
      .insert(users)
      .values({
        id: testUserId,
        email: "test-docs-upload@example.com",
        fullName: "Test Admin User",
        role: "admin",
        tenantId: testTenantId,
        isActive: true,
      })
      .returning();

    // Mock JWT token
    testToken = "mock-jwt-token";

    // Create test supplier
    const supplier = await insertOneOrThrow(db, suppliers, {
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
    });
    testSupplierId = supplier.id;
  });

  afterAll(async () => {
    // Cleanup
    await db.delete(documents).where(eq(documents.tenantId, testTenantId));
    await db.delete(suppliers).where(eq(suppliers.tenantId, testTenantId));
    await db.delete(users).where(eq(users.tenantId, testTenantId));
    await db.delete(tenants).where(eq(tenants.id, testTenantId));
  });

  it("should upload document with valid file and metadata", async () => {
    const file = new File(["test content"], "test-doc.pdf", {
      type: "application/pdf",
    });

    const response = await client.api
      .suppliers({ id: testSupplierId })
      .documents.post(
        {
          file,
          documentType: "certificate",
          description: "Test certificate",
          expiryDate: "2025-12-31",
        },
        {
          headers: {
            Authorization: `Bearer ${testToken}`,
          },
        }
      );

    expect(response.status).toBe(200);
    expect(response.data).toBeDefined();
    if (response.data && "document" in response.data) {
      expect(response.data.document.filename).toBe("test-doc.pdf");
      expect(response.data.document.documentType).toBe("certificate");
      expect(response.data.document.description).toBe("Test certificate");
    }
  });

  it("should reject invalid file type", async () => {
    const file = new File(["malicious content"], "virus.exe", {
      type: "application/x-msdownload",
    });

    const response = await client.api
      .suppliers({ id: testSupplierId })
      .documents.post(
        {
          file,
          documentType: "other",
        },
        {
          headers: {
            Authorization: `Bearer ${testToken}`,
          },
        }
      );

    expect(response.status).toBe(400);
  });

  it("should reject file exceeding size limit", async () => {
    // Create 11MB file (exceeds 10MB limit)
    const largeContent = new Uint8Array(11 * 1024 * 1024);
    const file = new File([largeContent], "large-file.pdf", {
      type: "application/pdf",
    });

    const response = await client.api
      .suppliers({ id: testSupplierId })
      .documents.post(
        {
          file,
          documentType: "contract",
        },
        {
          headers: {
            Authorization: `Bearer ${testToken}`,
          },
        }
      );

    expect(response.status).toBe(413);
  });

  it("should require authentication", async () => {
    const file = new File(["test"], "test.pdf", { type: "application/pdf" });

    const response = await client.api
      .suppliers({ id: testSupplierId })
      .documents.post({
        file,
        documentType: "certificate",
      });

    expect(response.status).toBe(401);
  });

  it("should enforce RBAC (Admin/Procurement Manager only)", async () => {
    // Create viewer user
    const viewerId = randomUUID();
    const viewer = await insertOneOrThrow(db, users, {
      id: viewerId,
      email: "viewer@example.com",
      fullName: "Test Viewer",
      role: "viewer",
      tenantId: testTenantId,
      isActive: true,
    });

    const viewerToken = "mock-viewer-token";

    const file = new File(["test"], "test.pdf", { type: "application/pdf" });

    const response = await client.api
      .suppliers({ id: testSupplierId })
      .documents.post(
        {
          file,
          documentType: "certificate",
        },
        {
          headers: {
            Authorization: `Bearer ${viewerToken}`,
          },
        }
      );

    expect(response.status).toBe(403);

    // Cleanup
    await db.delete(users).where(eq(users.id, viewer.id));
  });

  it("should return 404 if supplier doesn't exist", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const file = new File(["test"], "test.pdf", { type: "application/pdf" });

    const response = await client.api.suppliers({ id: fakeId }).documents.post(
      {
        file,
        documentType: "certificate",
      },
      {
        headers: {
          Authorization: `Bearer ${testToken}`,
        },
      }
    );

    expect(response.status).toBe(404);
  });

  it("should sanitize filename", async () => {
    const file = new File(["test"], "../../../etc/passwd", {
      type: "application/pdf",
    });

    const response = await client.api
      .suppliers({ id: testSupplierId })
      .documents.post(
        {
          file,
          documentType: "other",
        },
        {
          headers: {
            Authorization: `Bearer ${testToken}`,
          },
        }
      );

    expect(response.status).toBe(200);
    if (response.data && "document" in response.data) {
      // Filename should be sanitized (no path traversal chars)
      expect(response.data.document.storagePath).not.toContain("../");
      expect(response.data.document.storagePath).not.toContain("..");
    }
  });

  it("should auto-set tenant_id and uploaded_by", async () => {
    const file = new File(["test"], "auto-fields.pdf", {
      type: "application/pdf",
    });

    const response = await client.api
      .suppliers({ id: testSupplierId })
      .documents.post(
        {
          file,
          documentType: "certificate",
        },
        {
          headers: {
            Authorization: `Bearer ${testToken}`,
          },
        }
      );

    expect(response.status).toBe(200);
    if (response.data && "document" in response.data) {
      expect(response.data.document.tenantId).toBe(testTenantId);
      expect(response.data.document.uploadedBy).toBe(testUserId);
    }
  });
});
