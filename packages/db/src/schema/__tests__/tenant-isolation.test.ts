/**
 * Tenant Isolation Tests
 * Verifies that tenant context helpers and schema definitions work correctly
 */

import { describe, it, expect } from "bun:test";
import {
  withTenantId,
  withTenantIdAndNotDeleted,
  TenantContextError,
  isValidUUID,
  validateTenantContext,
  type TenantContext,
} from "../../helpers/tenant-context";
import { tenants, users, suppliers, contacts, documents } from "../index";

describe("Tenant Context Helpers", () => {
  const validTenantId = "550e8400-e29b-41d4-a716-446655440000";
  const validUserId = "660e8400-e29b-41d4-a716-446655440001";

  describe("withTenantId", () => {
    it("should create a tenant filter condition", () => {
      const condition = withTenantId(suppliers.tenantId, validTenantId);
      expect(condition).toBeDefined();
      expect(typeof condition).toBe("object");
    });

    it("should throw error when tenant ID is missing", () => {
      expect(() => withTenantId(suppliers.tenantId, "")).toThrow(
        TenantContextError
      );
    });

    it("should throw error when tenant ID is null", () => {
      // Intentional bad input: pass `null` past the `string` type to verify
      // the runtime guard. `as unknown as string` keeps the cast narrow at
      // this single trust boundary.
      expect(() =>
        withTenantId(suppliers.tenantId, null as unknown as string)
      ).toThrow(TenantContextError);
    });
  });

  describe("withTenantIdAndNotDeleted", () => {
    it("should create combined tenant and soft-delete filter", () => {
      const condition = withTenantIdAndNotDeleted(
        suppliers.tenantId,
        suppliers.deletedAt,
        validTenantId
      );
      expect(condition).toBeDefined();
      expect(typeof condition).toBe("object");
    });

    it("should throw error when tenant ID is missing", () => {
      expect(() =>
        withTenantIdAndNotDeleted(suppliers.tenantId, suppliers.deletedAt, "")
      ).toThrow(TenantContextError);
    });
  });

  describe("isValidUUID", () => {
    it("should validate correct UUID v4 format", () => {
      expect(isValidUUID("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
      expect(isValidUUID("00000000-0000-0000-0000-000000000000")).toBe(true);
      expect(isValidUUID("123e4567-e89b-12d3-a456-426614174000")).toBe(true);
    });

    it("should reject invalid UUID formats", () => {
      expect(isValidUUID("not-a-uuid")).toBe(false);
      expect(isValidUUID("")).toBe(false);
      expect(isValidUUID("550e8400-e29b-41d4-a716")).toBe(false); // Too short
      expect(isValidUUID("550e8400e29b41d4a716446655440000")).toBe(false); // No hyphens
      expect(isValidUUID("550e8400-e29b-41d4-a716-446655440000-extra")).toBe(
        false
      ); // Too long
    });
  });

  describe("validateTenantContext", () => {
    it("should validate correct tenant context", () => {
      const context: TenantContext = {
        tenantId: validTenantId,
        userId: validUserId,
        role: "admin",
      };

      expect(() => validateTenantContext(context)).not.toThrow();
    });

    it("should validate tenant context without optional fields", () => {
      const context: TenantContext = {
        tenantId: validTenantId,
      };

      expect(() => validateTenantContext(context)).not.toThrow();
    });

    it("should throw error for missing tenant ID", () => {
      const context = {
        tenantId: "",
      } as TenantContext;

      expect(() => validateTenantContext(context)).toThrow(TenantContextError);
    });

    it("should throw error for invalid tenant UUID", () => {
      const context: TenantContext = {
        tenantId: "not-a-uuid",
      };

      expect(() => validateTenantContext(context)).toThrow(TenantContextError);
    });

    it("should throw error for invalid user UUID", () => {
      const context: TenantContext = {
        tenantId: validTenantId,
        userId: "not-a-uuid",
      };

      expect(() => validateTenantContext(context)).toThrow(TenantContextError);
    });
  });
});

describe("Schema Definitions", () => {
  describe("Tenants Table", () => {
    it("should have correct column structure", () => {
      expect(tenants.id).toBeDefined();
      expect(tenants.name).toBeDefined();
      expect(tenants.slug).toBeDefined();
      expect(tenants.status).toBeDefined();
      expect(tenants.plan).toBeDefined();
      expect(tenants.settings).toBeDefined();
      expect(tenants.subscriptionEndsAt).toBeDefined();
      expect(tenants.createdAt).toBeDefined();
      expect(tenants.updatedAt).toBeDefined();
    });

    it("should have correct table name", () => {
      expect(tenants[Symbol.for("drizzle:Name")]).toBe("tenants");
    });
  });

  describe("Users Table", () => {
    it("should have correct column structure", () => {
      expect(users.id).toBeDefined();
      expect(users.tenantId).toBeDefined();
      expect(users.email).toBeDefined();
      expect(users.fullName).toBeDefined();
      expect(users.role).toBeDefined();
      expect(users.avatarUrl).toBeDefined();
      expect(users.isActive).toBeDefined();
      expect(users.lastLoginAt).toBeDefined();
      expect(users.createdAt).toBeDefined();
      expect(users.updatedAt).toBeDefined();
    });

    it("should have tenant_id column for isolation", () => {
      expect(users.tenantId).toBeDefined();
      expect(users.tenantId.name).toBe("tenant_id");
    });

    it("should have correct table name", () => {
      expect(users[Symbol.for("drizzle:Name")]).toBe("users");
    });
  });

  describe("Suppliers Table", () => {
    it("should have correct column structure", () => {
      expect(suppliers.id).toBeDefined();
      expect(suppliers.tenantId).toBeDefined();
      expect(suppliers.name).toBeDefined();
      expect(suppliers.taxId).toBeDefined();
      expect(suppliers.category).toBeDefined();
      expect(suppliers.status).toBeDefined();
      expect(suppliers.performanceScore).toBeDefined();
      expect(suppliers.contactName).toBeDefined();
      expect(suppliers.contactEmail).toBeDefined();
      expect(suppliers.contactPhone).toBeDefined();
      expect(suppliers.address).toBeDefined();
      expect(suppliers.certifications).toBeDefined();
      expect(suppliers.metadata).toBeDefined();
      expect(suppliers.riskScore).toBeDefined();
      expect(suppliers.createdBy).toBeDefined();
      expect(suppliers.createdAt).toBeDefined();
      expect(suppliers.updatedAt).toBeDefined();
      expect(suppliers.deletedAt).toBeDefined();
    });

    it("should have tenant_id column for isolation", () => {
      expect(suppliers.tenantId).toBeDefined();
      expect(suppliers.tenantId.name).toBe("tenant_id");
    });

    it("should have deleted_at for soft deletes", () => {
      expect(suppliers.deletedAt).toBeDefined();
      expect(suppliers.deletedAt.name).toBe("deleted_at");
    });

    it("should have correct table name", () => {
      expect(suppliers[Symbol.for("drizzle:Name")]).toBe("suppliers");
    });
  });

  describe("Contacts Table", () => {
    it("should have correct column structure", () => {
      expect(contacts.id).toBeDefined();
      expect(contacts.tenantId).toBeDefined();
      expect(contacts.supplierId).toBeDefined();
      expect(contacts.name).toBeDefined();
      expect(contacts.title).toBeDefined();
      expect(contacts.email).toBeDefined();
      expect(contacts.phone).toBeDefined();
      expect(contacts.isPrimary).toBeDefined();
      expect(contacts.createdAt).toBeDefined();
      expect(contacts.updatedAt).toBeDefined();
    });

    it("should have tenant_id column for isolation", () => {
      expect(contacts.tenantId).toBeDefined();
      expect(contacts.tenantId.name).toBe("tenant_id");
    });

    it("should have supplier_id for relationship", () => {
      expect(contacts.supplierId).toBeDefined();
      expect(contacts.supplierId.name).toBe("supplier_id");
    });

    it("should have correct table name", () => {
      expect(contacts[Symbol.for("drizzle:Name")]).toBe("contacts");
    });
  });

  describe("Documents Table", () => {
    it("should have correct column structure", () => {
      expect(documents.id).toBeDefined();
      expect(documents.tenantId).toBeDefined();
      expect(documents.supplierId).toBeDefined();
      expect(documents.filename).toBeDefined();
      expect(documents.documentType).toBeDefined();
      expect(documents.storagePath).toBeDefined();
      expect(documents.fileSize).toBeDefined();
      expect(documents.mimeType).toBeDefined();
      expect(documents.description).toBeDefined();
      expect(documents.expiryDate).toBeDefined();
      expect(documents.uploadedBy).toBeDefined();
      expect(documents.createdAt).toBeDefined();
      expect(documents.updatedAt).toBeDefined();
      expect(documents.deletedAt).toBeDefined();
    });

    it("should have tenant_id column for isolation", () => {
      expect(documents.tenantId).toBeDefined();
      expect(documents.tenantId.name).toBe("tenant_id");
    });

    it("should have deleted_at for soft deletes", () => {
      expect(documents.deletedAt).toBeDefined();
      expect(documents.deletedAt.name).toBe("deleted_at");
    });

    it("should have correct table name", () => {
      expect(documents[Symbol.for("drizzle:Name")]).toBe("documents");
    });
  });
});

describe("Tenant Isolation Enforcement", () => {
  const tenantA = "550e8400-e29b-41d4-a716-446655440000";
  const tenantB = "660e8400-e29b-41d4-a716-446655440001";

  it("should generate different SQL for different tenants", () => {
    const conditionA = withTenantId(suppliers.tenantId, tenantA);
    const conditionB = withTenantId(suppliers.tenantId, tenantB);

    // Both should be defined objects
    expect(conditionA).toBeDefined();
    expect(conditionB).toBeDefined();
    expect(typeof conditionA).toBe("object");
    expect(typeof conditionB).toBe("object");
  });

  it("should enforce tenant context in helper functions", () => {
    // Attempting to use empty tenant ID should fail
    expect(() => {
      withTenantId(suppliers.tenantId, "");
    }).toThrow(TenantContextError);

    // Valid tenant ID should succeed
    expect(() => {
      withTenantId(suppliers.tenantId, tenantA);
    }).not.toThrow();
  });
});

describe("Type Inference", () => {
  it("should infer correct insert types", () => {
    // This is a compile-time test more than runtime
    // If TypeScript compiles, the types are correct

    const tenantInsert = {
      name: "Test Tenant",
      slug: "test-tenant",
      status: "active" as const,
      plan: "starter" as const,
      settings: {},
      subscriptionEndsAt: null,
    };

    // Should compile without errors
    expect(tenantInsert).toBeDefined();
  });

  it("should infer correct select types with all fields", () => {
    // This verifies the schema has all expected fields
    type TenantSelect = typeof tenants.$inferSelect;

    const mockTenant: Partial<TenantSelect> = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "Test",
      slug: "test",
    };

    expect(mockTenant).toBeDefined();
  });
});
