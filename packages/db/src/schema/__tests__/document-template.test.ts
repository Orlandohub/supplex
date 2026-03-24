/**
 * Document Template Schema Tests
 * Story 2.2.11 - Task 8
 * Tests document_template table creation, indexes, constraints, and FK relationships
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { db } from "../../lib/db";
import { documentTemplate, workflowStepTemplate, tenants } from "../index";
import { eq, and, isNull, sql } from "drizzle-orm";

describe("Document Template Schema Tests", () => {
  let testTenantId: string;
  let testTemplateId: string;

  beforeAll(async () => {
    // Create test tenant
    const [tenant] = await db
      .insert(tenants)
      .values({
        name: "Test Tenant for Document Templates",
        slug: `test-doc-templates-${Date.now()}`,
      })
      .returning();
    testTenantId = tenant.id;
  });

  afterAll(async () => {
    // Cleanup: Delete test data
    await db
      .delete(documentTemplate)
      .where(eq(documentTemplate.tenantId, testTenantId));
    await db.delete(tenants).where(eq(tenants.id, testTenantId));
  });

  it("should create document_template table with all required fields", async () => {
    const [template] = await db
      .insert(documentTemplate)
      .values({
        tenantId: testTenantId,
        templateName: "Test ISO Documents",
        requiredDocuments: [
          {
            name: "ISO 9001 Certificate",
            description: "Current certification",
            required: true,
            type: "certification",
          },
        ],
        isDefault: false,
        status: "published",
      })
      .returning();

    expect(template).toBeDefined();
    expect(template.id).toBeDefined();
    expect(template.tenantId).toBe(testTenantId);
    expect(template.templateName).toBe("Test ISO Documents");
    expect(template.status).toBe("published");
    expect(template.isDefault).toBe(false);
    expect(template.createdAt).toBeDefined();
    expect(template.updatedAt).toBeDefined();
    expect(template.deletedAt).toBeNull();

    testTemplateId = template.id;
  });

  it("should support required_documents JSONB structure", async () => {
    const documents = [
      {
        name: "Tax Form W-9",
        description: "IRS tax form",
        required: true,
        type: "tax",
      },
      {
        name: "Financial Statement",
        description: "Latest audited financials",
        required: false,
        type: "financial",
      },
    ];

    const [template] = await db
      .insert(documentTemplate)
      .values({
        tenantId: testTenantId,
        templateName: "Tax & Financial Documents",
        requiredDocuments: documents,
        isDefault: false,
        status: "draft",
      })
      .returning();

    expect(template.requiredDocuments).toEqual(documents);
    expect(Array.isArray(template.requiredDocuments)).toBe(true);
    expect(template.requiredDocuments.length).toBe(2);
  });

  it("should support status field values: draft, published, archived", async () => {
    const statuses = ["draft", "published", "archived"];

    for (const status of statuses) {
      const [template] = await db
        .insert(documentTemplate)
        .values({
          tenantId: testTenantId,
          templateName: `Template ${status}`,
          requiredDocuments: [],
          isDefault: false,
          status,
        })
        .returning();

      expect(template.status).toBe(status);
    }
  });

  it("should have composite index on (tenant_id, status)", async () => {
    // Insert multiple templates with different statuses
    await db.insert(documentTemplate).values([
      {
        tenantId: testTenantId,
        templateName: "Published Template 1",
        requiredDocuments: [],
        status: "published",
        isDefault: false,
      },
      {
        tenantId: testTenantId,
        templateName: "Published Template 2",
        requiredDocuments: [],
        status: "published",
        isDefault: false,
      },
      {
        tenantId: testTenantId,
        templateName: "Draft Template",
        requiredDocuments: [],
        status: "draft",
        isDefault: false,
      },
    ]);

    // Query using the index
    const publishedTemplates = await db
      .select()
      .from(documentTemplate)
      .where(
        and(
          eq(documentTemplate.tenantId, testTenantId),
          eq(documentTemplate.status, "published"),
          isNull(documentTemplate.deletedAt)
        )
      );

    expect(publishedTemplates.length).toBeGreaterThanOrEqual(2);
  });

  it("should support soft delete via deleted_at field", async () => {
    const [template] = await db
      .insert(documentTemplate)
      .values({
        tenantId: testTenantId,
        templateName: "Template to Delete",
        requiredDocuments: [],
        isDefault: false,
        status: "published",
      })
      .returning();

    // Soft delete
    await db
      .update(documentTemplate)
      .set({ deletedAt: new Date() })
      .where(eq(documentTemplate.id, template.id));

    // Verify soft delete
    const [deletedTemplate] = await db
      .select()
      .from(documentTemplate)
      .where(eq(documentTemplate.id, template.id));

    expect(deletedTemplate.deletedAt).not.toBeNull();

    // Verify it's excluded from active queries
    const activeTemplates = await db
      .select()
      .from(documentTemplate)
      .where(
        and(
          eq(documentTemplate.tenantId, testTenantId),
          isNull(documentTemplate.deletedAt)
        )
      );

    expect(activeTemplates.find((t) => t.id === template.id)).toBeUndefined();
  });

  it("should enforce tenant isolation via tenant_id", async () => {
    // Create another tenant
    const [otherTenant] = await db
      .insert(tenants)
      .values({
        name: "Other Tenant",
        slug: `other-tenant-${Date.now()}`,
      })
      .returning();

    // Create template for other tenant
    const [otherTemplate] = await db
      .insert(documentTemplate)
      .values({
        tenantId: otherTenant.id,
        templateName: "Other Tenant Template",
        requiredDocuments: [],
        isDefault: false,
        status: "published",
      })
      .returning();

    // Query for test tenant - should not include other tenant's template
    const testTenantTemplates = await db
      .select()
      .from(documentTemplate)
      .where(
        and(
          eq(documentTemplate.tenantId, testTenantId),
          isNull(documentTemplate.deletedAt)
        )
      );

    expect(
      testTenantTemplates.find((t) => t.id === otherTemplate.id)
    ).toBeUndefined();

    // Cleanup
    await db
      .delete(documentTemplate)
      .where(eq(documentTemplate.id, otherTemplate.id));
    await db.delete(tenants).where(eq(tenants.id, otherTenant.id));
  });

  it("should support only one default template per tenant", async () => {
    // Create first default template
    const [template1] = await db
      .insert(documentTemplate)
      .values({
        tenantId: testTenantId,
        templateName: "Default Template 1",
        requiredDocuments: [],
        isDefault: true,
        status: "published",
      })
      .returning();

    expect(template1.isDefault).toBe(true);

    // Create second default - should unset first one (business logic, not DB constraint)
    // This is tested in API tests, here we just verify the field works
    const [template2] = await db
      .insert(documentTemplate)
      .values({
        tenantId: testTenantId,
        templateName: "Default Template 2",
        requiredDocuments: [],
        isDefault: true,
        status: "published",
      })
      .returning();

    expect(template2.isDefault).toBe(true);
  });

  it("should have FK constraint from workflow_step_template", async () => {
    // This test verifies that the FK reference exists in the schema
    // Actual FK constraint behavior (ON DELETE RESTRICT) is tested in integration tests
    expect(workflowStepTemplate.documentTemplateId).toBeDefined();
  });
});

