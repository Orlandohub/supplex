import { describe, it, expect } from "vitest";
import {
  HealthCheckSchema,
  schemas,
  TenantSchema,
  TenantStatus,
  TenantPlan,
  UserSchema,
  UserRole,
  SupplierSchema,
  SupplierCategory,
  SupplierStatus,
  ContactSchema,
  DocumentSchema,
  DocumentType,
} from "./index";
import type { HealthCheck, ApiResult } from "./index";

describe("Shared Types Package", () => {
  describe("HealthCheckSchema", () => {
    it("should validate a valid health check response", () => {
      const validHealthCheck = {
        status: "ok" as const,
        timestamp: new Date().toISOString(),
        version: "1.0.0",
      };

      const result = HealthCheckSchema.safeParse(validHealthCheck);
      expect(result.success).toBe(true);
    });

    it("should reject invalid status", () => {
      const invalidHealthCheck = {
        status: "invalid",
        timestamp: new Date().toISOString(),
      };

      const result = HealthCheckSchema.safeParse(invalidHealthCheck);
      expect(result.success).toBe(false);
    });

    it("should accept health check without version", () => {
      const healthCheck = {
        status: "ok" as const,
        timestamp: new Date().toISOString(),
      };

      const result = HealthCheckSchema.safeParse(healthCheck);
      expect(result.success).toBe(true);
    });
  });

  describe("TenantSchema", () => {
    it("should validate a valid tenant", () => {
      const validTenant = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        name: "Acme Manufacturing",
        slug: "acme-manufacturing",
        status: TenantStatus.ACTIVE,
        plan: TenantPlan.STARTER,
        settings: {
          evaluationFrequency: "monthly" as const,
          notificationEmail: "admin@acme.com",
        },
        subscriptionEndsAt: new Date("2026-01-01"),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = TenantSchema.safeParse(validTenant);
      expect(result.success).toBe(true);
    });

    it("should reject invalid slug format", () => {
      const invalidTenant = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        name: "Acme Manufacturing",
        slug: "Acme Manufacturing!", // Invalid: uppercase and special chars
        status: TenantStatus.ACTIVE,
        plan: TenantPlan.STARTER,
        settings: {},
        subscriptionEndsAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = TenantSchema.safeParse(invalidTenant);
      expect(result.success).toBe(false);
    });
  });

  describe("UserSchema", () => {
    it("should validate a valid user", () => {
      const validUser = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        tenantId: "660e8400-e29b-41d4-a716-446655440000",
        email: "john@example.com",
        fullName: "John Doe",
        role: UserRole.ADMIN,
        avatarUrl: "https://example.com/avatar.jpg",
        isActive: true,
        lastLoginAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = UserSchema.safeParse(validUser);
      expect(result.success).toBe(true);
    });

    it("should reject invalid email", () => {
      const invalidUser = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        tenantId: "660e8400-e29b-41d4-a716-446655440000",
        email: "not-an-email",
        fullName: "John Doe",
        role: UserRole.ADMIN,
        avatarUrl: null,
        isActive: true,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = UserSchema.safeParse(invalidUser);
      expect(result.success).toBe(false);
    });
  });

  describe("SupplierSchema", () => {
    it("should validate a valid supplier", () => {
      const validSupplier = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        tenantId: "660e8400-e29b-41d4-a716-446655440000",
        name: "Steel Corp",
        taxId: "12-3456789",
        category: SupplierCategory.RAW_MATERIALS,
        status: SupplierStatus.APPROVED,
        performanceScore: 4.5,
        contactName: "Jane Smith",
        contactEmail: "jane@steelcorp.com",
        contactPhone: "+1234567890",
        address: {
          street: "123 Main St",
          city: "Frankfurt",
          state: "Hessen",
          postalCode: "60311",
          country: "Germany",
        },
        certifications: [
          {
            type: "ISO 9001",
            issueDate: new Date("2023-01-01"),
            expiryDate: new Date("2026-01-01"),
          },
        ],
        metadata: {},
        riskScore: 2.5,
        createdBy: "770e8400-e29b-41d4-a716-446655440000",
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      const result = SupplierSchema.safeParse(validSupplier);
      expect(result.success).toBe(true);
    });

    it("should reject performance score out of range", () => {
      const invalidSupplier = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        tenantId: "660e8400-e29b-41d4-a716-446655440000",
        name: "Steel Corp",
        taxId: "12-3456789",
        category: SupplierCategory.RAW_MATERIALS,
        status: SupplierStatus.APPROVED,
        performanceScore: 6.0, // Invalid: max is 5
        contactName: "Jane Smith",
        contactEmail: "jane@steelcorp.com",
        contactPhone: "+1234567890",
        address: {
          street: "123 Main St",
          city: "Frankfurt",
          state: "Hessen",
          postalCode: "60311",
          country: "Germany",
        },
        certifications: [],
        metadata: {},
        riskScore: null,
        createdBy: "770e8400-e29b-41d4-a716-446655440000",
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      const result = SupplierSchema.safeParse(invalidSupplier);
      expect(result.success).toBe(false);
    });
  });

  describe("ContactSchema", () => {
    it("should validate a valid contact", () => {
      const validContact = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        tenantId: "660e8400-e29b-41d4-a716-446655440000",
        supplierId: "770e8400-e29b-41d4-a716-446655440000",
        name: "Bob Johnson",
        title: "Sales Manager",
        email: "bob@supplier.com",
        phone: "+1234567890",
        isPrimary: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = ContactSchema.safeParse(validContact);
      expect(result.success).toBe(true);
    });
  });

  describe("DocumentSchema", () => {
    it("should validate a valid document", () => {
      const validDocument = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        tenantId: "660e8400-e29b-41d4-a716-446655440000",
        supplierId: "770e8400-e29b-41d4-a716-446655440000",
        filename: "ISO9001-Certificate.pdf",
        documentType: DocumentType.CERTIFICATE,
        storagePath:
          "tenants/660e8400/suppliers/770e8400/ISO9001-Certificate.pdf",
        fileSize: 1024000,
        mimeType: "application/pdf",
        description: "ISO 9001 Certification",
        expiryDate: new Date("2026-01-01"),
        uploadedBy: "880e8400-e29b-41d4-a716-446655440000",
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      const result = DocumentSchema.safeParse(validDocument);
      expect(result.success).toBe(true);
    });
  });

  describe("ApiResult type", () => {
    it("should allow success response with data", () => {
      const response: ApiResult<string> = {
        success: true,
        data: "test data",
      };

      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data).toBe("test data");
      }
    });

    it("should allow success response without data (void operations)", () => {
      const response: ApiResult = { success: true };

      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data).toBeUndefined();
      }
    });

    it("should allow error response with code and message", () => {
      const response: ApiResult = {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Something went wrong",
        },
      };

      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error.code).toBe("INTERNAL_SERVER_ERROR");
        expect(response.error.message).toBe("Something went wrong");
      }
    });

    it("should narrow data access via success discriminant", () => {
      const response: ApiResult<{ id: string }> = {
        success: true,
        data: { id: "abc-123" },
      };

      if (response.success && response.data) {
        const id: string = response.data.id;
        expect(id).toBe("abc-123");
      } else {
        throw new Error("expected success branch");
      }
    });
  });

  describe("schemas export", () => {
    it("should export all schemas", () => {
      expect(schemas).toHaveProperty("HealthCheckSchema");
    });
  });

  describe("TypeScript type inference", () => {
    it("should infer HealthCheck type from schema", () => {
      const healthCheck: HealthCheck = {
        status: "ok",
        timestamp: "2025-10-13T00:00:00.000Z",
      };

      expect(healthCheck.status).toBe("ok");
    });
  });
});
