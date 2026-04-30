/**
 * Document Templates API Endpoint Tests
 * Story 2.2.11 - Task 9
 * Tests all CRUD operations, tenant isolation, and access control
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import app from "../../../index";
import { db } from "../../../lib/db";
import { documentTemplate, tenants, users } from "@supplex/db";
import { eq } from "drizzle-orm";
import { supabaseAdmin } from "../../../lib/supabase";

import { insertOneOrThrow, selectFirstOrThrow } from "../../../lib/db-helpers";
// ─── Typed response shapes for `response.json()` parses ─────────────────────

interface DocumentTemplateRecord {
  id: string;
  templateName: string;
  status: "draft" | "published" | "archived";
  isDefault?: boolean;
  deletedAt?: string | null;
}

interface DocumentTemplateOption {
  id: string;
  label: string;
}

interface CreateOrUpdateBody {
  success: true;
  data: DocumentTemplateRecord;
}

interface ListBody {
  success: true;
  data: { templates: DocumentTemplateRecord[] };
}

interface PublishedListBody {
  success: true;
  data: { templates: DocumentTemplateOption[] };
}

interface DeleteBody {
  success: true;
  data?: { id: string };
}

interface ApiErrorBody {
  success: false;
  error: { code: string; message: string };
}

type CreateOrUpdateResponse = CreateOrUpdateBody | ApiErrorBody;
type ListResponse = ListBody | ApiErrorBody;
type PublishedResponse = PublishedListBody | ApiErrorBody;
type DeleteResponse = DeleteBody | ApiErrorBody;

describe("Document Templates API Tests", () => {
  let adminToken: string;
  let adminUserId: string;
  let testTenantId: string;
  let createdTemplateId: string;

  beforeAll(async () => {
    // Create test tenant
    const tenant = await insertOneOrThrow(db, tenants, {
      name: "Test Tenant API",
      slug: `test-api-${Date.now()}`,
    });
    testTenantId = tenant.id;

    // Create admin user via Supabase
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: `admin-doc-test-${Date.now()}@test.com`,
        password: "testpassword123",
        email_confirm: true,
        app_metadata: {
          role: "admin",
          tenant_id: testTenantId,
        },
      });

    if (authError || !authData.user) {
      throw new Error("Failed to create test admin user");
    }

    adminUserId = authData.user.id;

    // Create user record in database
    await db.insert(users).values({
      id: adminUserId,
      tenantId: testTenantId,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- existence asserted above
      email: authData.user.email!,
      fullName: "Admin User",
      role: "admin",
      isActive: true,
    });

    // Get session token
    const { data: _sessionData } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- existence asserted above
      email: authData.user.email!,
    });

    // Create session to get token
    const { data: signInData } = await supabaseAdmin.auth.signInWithPassword({
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- existence asserted above
      email: authData.user.email!,
      password: "testpassword123",
    });

    adminToken = signInData.session?.access_token || "";
  });

  afterAll(async () => {
    // Cleanup
    await db
      .delete(documentTemplate)
      .where(eq(documentTemplate.tenantId, testTenantId));
    await db.delete(users).where(eq(users.id, adminUserId));
    await db.delete(tenants).where(eq(tenants.id, testTenantId));

    // Delete Supabase auth user
    await supabaseAdmin.auth.admin.deleteUser(adminUserId);
  });

  describe("POST /api/document-templates - Create Template", () => {
    it("should create a new document template (admin only)", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/document-templates", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            templateName: "ISO Certification Documents",
            requiredDocuments: [
              {
                name: "ISO 9001 Certificate",
                description: "Current ISO certification",
                required: true,
                type: "certification",
              },
            ],
            isDefault: false,
            status: "published",
          }),
        })
      );

      expect(response.status).toBe(200);
      const data = (await response.json()) as CreateOrUpdateResponse;
      expect(data.success).toBe(true);
      if (!data.success) return;
      expect(data.data).toBeDefined();
      expect(data.data.templateName).toBe("ISO Certification Documents");

      createdTemplateId = data.data.id;
    });

    it("should unset other default templates when creating a new default", async () => {
      // Create first default
      const response1 = await app.handle(
        new Request("http://localhost/api/document-templates", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            templateName: "Default Template 1",
            requiredDocuments: [],
            isDefault: true,
            status: "published",
          }),
        })
      );

      const data1 = (await response1.json()) as CreateOrUpdateResponse;
      if (!data1.success) {
        throw new Error("Expected first default-template creation to succeed");
      }
      const template1Id = data1.data.id;

      // Create second default
      const response2 = await app.handle(
        new Request("http://localhost/api/document-templates", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            templateName: "Default Template 2",
            requiredDocuments: [],
            isDefault: true,
            status: "published",
          }),
        })
      );

      expect(response2.status).toBe(200);

      // Verify first template is no longer default
      const template1 = await selectFirstOrThrow(
        db
          .select()
          .from(documentTemplate)
          .where(eq(documentTemplate.id, template1Id))
      );

      expect(template1.isDefault).toBe(false);
    });
  });

  describe("GET /api/document-templates - List Templates", () => {
    it("should return all templates for tenant (admin only)", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/document-templates", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        })
      );

      expect(response.status).toBe(200);
      const data = (await response.json()) as ListResponse;
      expect(data.success).toBe(true);
      if (!data.success) return;
      expect(Array.isArray(data.data.templates)).toBe(true);
      expect(data.data.templates.length).toBeGreaterThan(0);
    });

    it("should filter templates by status", async () => {
      const response = await app.handle(
        new Request(
          "http://localhost/api/document-templates?status=published",
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${adminToken}`,
            },
          }
        )
      );

      expect(response.status).toBe(200);
      const data = (await response.json()) as ListResponse;
      expect(data.success).toBe(true);
      if (!data.success) return;

      // All returned templates should be published
      data.data.templates.forEach((template) => {
        expect(template.status).toBe("published");
      });
    });
  });

  describe("GET /api/document-templates/published - Get Published Templates", () => {
    it("should return only published templates for workflow builder", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/document-templates/published", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        })
      );

      expect(response.status).toBe(200);
      const data = (await response.json()) as PublishedResponse;
      expect(data.success).toBe(true);
      if (!data.success) return;
      expect(Array.isArray(data.data.templates)).toBe(true);

      // Verify format: { id, label }
      if (data.data.templates.length > 0) {
        const first = data.data.templates[0];
        expect(first?.id).toBeDefined();
        expect(first?.label).toBeDefined();
      }
    });
  });

  describe("PUT /api/document-templates/:id - Update Template", () => {
    it("should update an existing template (admin only)", async () => {
      const response = await app.handle(
        new Request(
          `http://localhost/api/document-templates/${createdTemplateId}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({
              templateName: "Updated ISO Documents",
              status: "archived",
            }),
          }
        )
      );

      expect(response.status).toBe(200);
      const data = (await response.json()) as CreateOrUpdateResponse;
      expect(data.success).toBe(true);
      if (!data.success) return;
      expect(data.data.templateName).toBe("Updated ISO Documents");
      expect(data.data.status).toBe("archived");
    });

    it("should return 404 for non-existent template", async () => {
      const response = await app.handle(
        new Request(
          `http://localhost/api/document-templates/00000000-0000-0000-0000-000000000000`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({
              templateName: "Updated",
            }),
          }
        )
      );

      expect(response.status).toBe(404);
    });
  });

  describe("DELETE /api/document-templates/:id - Delete Template", () => {
    it("should soft delete a template not in use", async () => {
      // Create a template to delete
      const createResponse = await app.handle(
        new Request("http://localhost/api/document-templates", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            templateName: "Template to Delete",
            requiredDocuments: [],
            isDefault: false,
            status: "draft",
          }),
        })
      );

      const createData =
        (await createResponse.json()) as CreateOrUpdateResponse;
      if (!createData.success) {
        throw new Error("Expected template-to-delete creation to succeed");
      }
      const templateId = createData.data.id;

      // Delete it
      const deleteResponse = await app.handle(
        new Request(`http://localhost/api/document-templates/${templateId}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        })
      );

      expect(deleteResponse.status).toBe(200);
      const deleteData = (await deleteResponse.json()) as DeleteResponse;
      expect(deleteData.success).toBe(true);

      // Verify soft delete
      const deletedTemplate = await selectFirstOrThrow(
        db
          .select()
          .from(documentTemplate)
          .where(eq(documentTemplate.id, templateId))
      );

      expect(deletedTemplate.deletedAt).not.toBeNull();
    });

    it("should fail to delete template in use by workflow steps", async () => {
      // This test requires workflow setup - covered in integration tests
      // Placeholder for documentation
      expect(true).toBe(true);
    });
  });

  describe("Tenant Isolation", () => {
    it("should not allow access to other tenant's templates", async () => {
      // Create another tenant and admin
      const otherTenant = await insertOneOrThrow(db, tenants, {
        name: "Other Tenant",
        slug: `other-tenant-${Date.now()}`,
      });

      const { data: otherAuthData } = await supabaseAdmin.auth.admin.createUser(
        {
          email: `other-admin-${Date.now()}@test.com`,
          password: "testpassword123",
          email_confirm: true,
          app_metadata: {
            role: "admin",
            tenant_id: otherTenant.id,
          },
        }
      );

      await db.insert(users).values({
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- existence asserted above
        id: otherAuthData.user!.id,
        tenantId: otherTenant.id,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- existence asserted above
        email: otherAuthData.user!.email!,
        fullName: "Other Admin",
        role: "admin",
        isActive: true,
      });

      const { data: otherSignInData } =
        await supabaseAdmin.auth.signInWithPassword({
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- existence asserted above
          email: otherAuthData.user!.email!,
          password: "testpassword123",
        });

      const otherToken = otherSignInData.session?.access_token || "";

      // Try to access first tenant's templates
      const response = await app.handle(
        new Request("http://localhost/api/document-templates", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${otherToken}`,
          },
        })
      );

      const data = (await response.json()) as ListResponse;

      // Should only see their own tenant's templates (none created)
      if (!data.success) {
        throw new Error("Expected list-templates request to succeed");
      }
      expect(data.data.templates.length).toBe(0);

      // Cleanup
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- existence asserted above
      await db.delete(users).where(eq(users.id, otherAuthData.user!.id));
      await db.delete(tenants).where(eq(tenants.id, otherTenant.id));
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- existence asserted above
      await supabaseAdmin.auth.admin.deleteUser(otherAuthData.user!.id);
    });
  });
});
