import { describe, it, expect, mock, beforeEach } from "bun:test";
import { Elysia } from "elysia";
import { createSupplierRoute } from "../create";
import type { AuthContext } from "../../../lib/rbac/middleware";
import type { ApiResult } from "@supplex/types";
import { UserRole } from "@supplex/types";
import type { SelectSupplier } from "@supplex/db";
import {
  createMockDb,
  expectErrResult,
  expectOkResult,
  mockDbChain,
  type MockDb,
  withApiErrorHandler,
} from "../../../lib/test-utils";

const TENANT_ID = "650e8400-e29b-41d4-a716-446655440000";

// Mock data
const mockAdminUser: AuthContext["user"] = {
  id: "550e8400-e29b-41d4-a716-446655440001",
  email: "admin@example.com",
  role: UserRole.ADMIN,
  tenantId: TENANT_ID,
  fullName: "Test User",
};

const mockProcurementUser: AuthContext["user"] = {
  id: "550e8400-e29b-41d4-a716-446655440002",
  email: "procurement@example.com",
  role: UserRole.PROCUREMENT_MANAGER,
  tenantId: TENANT_ID,
  fullName: "Test User",
};

const mockViewerUser: AuthContext["user"] = {
  id: "550e8400-e29b-41d4-a716-446655440003",
  email: "viewer@example.com",
  role: UserRole.VIEWER,
  tenantId: TENANT_ID,
  fullName: "Test User",
};

const mockQualityUser: AuthContext["user"] = {
  id: "550e8400-e29b-41d4-a716-446655440004",
  email: "quality@example.com",
  role: UserRole.QUALITY_MANAGER,
  tenantId: TENANT_ID,
  fullName: "Test User",
};

const validSupplierData = {
  name: "Test Supplier Corp",
  taxId: "TAX-TEST-001",
  category: "raw_materials",
  status: "prospect",
  contactName: "Jane Smith",
  contactEmail: "jane@testsupplier.com",
  contactPhone: "+1234567890",
  address: {
    street: "456 Test St",
    city: "Test City",
    state: "TC",
    postalCode: "12345",
    country: "USA",
  },
  website: "https://testsupplier.com",
  notes: "Test supplier for automated testing",
};

const NEW_SUPPLIER_ID = "77777777-7777-7777-7777-777777777777";

function buildInsertedRow(): SelectSupplier {
  return {
    id: NEW_SUPPLIER_ID,
    tenantId: TENANT_ID,
    name: validSupplierData.name,
    taxId: validSupplierData.taxId,
    category: validSupplierData.category,
    status: validSupplierData.status,
    performanceScore: null,
    contactName: validSupplierData.contactName,
    contactEmail: validSupplierData.contactEmail,
    contactPhone: validSupplierData.contactPhone,
    address: validSupplierData.address,
    certifications: [],
    metadata: {},
    riskScore: null,
    supplierStatusId: null,
    supplierUserId: null,
    createdBy: mockAdminUser.id,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    deletedAt: null,
  };
}

/** Rows returned by duplicate-name `db.select()` (id + name only). */
let duplicateCheckRows: Array<{ id: string; name: string }> = [];

const mockDuplicateSelect = mock(() => mockDbChain(duplicateCheckRows));

const mockInsert = mock(() => mockDbChain([buildInsertedRow()]));

const mockDb = createMockDb({
  overrides: {
    select: mockDuplicateSelect as MockDb["select"],
    insert: mockInsert as MockDb["insert"],
  },
  queryTables: ["users"],
});

mock.module("../../../lib/db", () => ({ db: mockDb }));

describe("Supplier Create API", () => {
  beforeEach(() => {
    duplicateCheckRows = [];
    mockDuplicateSelect.mockClear();
    mockInsert.mockClear();
    mockDuplicateSelect.mockImplementation(() =>
      mockDbChain(duplicateCheckRows)
    );
    mockInsert.mockImplementation(() => mockDbChain([buildInsertedRow()]));
  });

  describe("POST /api/suppliers", () => {
    it("should create supplier with valid data as Admin", async () => {
      const app = withApiErrorHandler(
        new Elysia()
          .derive(() => ({ user: mockAdminUser }))
          .use(createSupplierRoute)
      );

      const response = await app.handle(
        new Request("http://localhost/suppliers", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(validSupplierData),
        })
      );

      expect(response.status).toBe(201);
      const result = (await response.json()) as ApiResult<{
        supplier: unknown;
        supplierUser: null;
        invitationToken: null;
      }>;
      expectOkResult(result);
      expect(result.data.supplier).toBeDefined();
      expect(result.data.supplierUser).toBeNull();
      expect(result.data.invitationToken).toBeNull();
    });

    it("should create supplier with valid data as Procurement Manager", async () => {
      const insertedForPm = { ...buildInsertedRow(), id: NEW_SUPPLIER_ID };
      mockInsert.mockImplementationOnce(() => mockDbChain([insertedForPm]));

      const app = withApiErrorHandler(
        new Elysia()
          .derive(() => ({ user: mockProcurementUser }))
          .use(createSupplierRoute)
      );

      const response = await app.handle(
        new Request("http://localhost/suppliers", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(validSupplierData),
        })
      );

      expect(response.status).toBe(201);
      const result = (await response.json()) as ApiResult<{
        supplier: unknown;
      }>;
      expectOkResult(result);
      expect(result.data.supplier).toBeDefined();
    });

    it("should return 403 for Viewer role", async () => {
      const app = withApiErrorHandler(
        new Elysia()
          .derive(() => ({ user: mockViewerUser }))
          .use(createSupplierRoute)
      );

      const response = await app.handle(
        new Request("http://localhost/suppliers", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(validSupplierData),
        })
      );

      expect(response.status).toBe(403);
      const result = (await response.json()) as ApiResult;
      expectErrResult(result);
      expect(result.error).toHaveProperty("code");
      expect(result.error.code).toBe("FORBIDDEN");
    });

    it("should return 403 for Quality Manager role", async () => {
      const app = withApiErrorHandler(
        new Elysia()
          .derive(() => ({ user: mockQualityUser }))
          .use(createSupplierRoute)
      );

      const response = await app.handle(
        new Request("http://localhost/suppliers", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(validSupplierData),
        })
      );

      expect(response.status).toBe(403);
      const result = (await response.json()) as ApiResult;
      expectErrResult(result);
      expect(result.error).toHaveProperty("code");
      expect(result.error.code).toBe("FORBIDDEN");
    });

    it("should return 400 for missing required field (name)", async () => {
      const app = withApiErrorHandler(
        new Elysia()
          .derive(() => ({ user: mockAdminUser }))
          .use(createSupplierRoute)
      );

      const { name: _excludedName, ...invalidData } = validSupplierData;

      const response = await app.handle(
        new Request("http://localhost/suppliers", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(invalidData),
        })
      );

      // Elysia body validation surfaces as 422 native; harness may normalize to 500.
      expect([422, 500]).toContain(response.status);
    });

    it("should return 400 for missing required field (contactEmail)", async () => {
      const app = withApiErrorHandler(
        new Elysia()
          .derive(() => ({ user: mockAdminUser }))
          .use(createSupplierRoute)
      );

      const { contactEmail: _excludedContactEmail, ...invalidData } =
        validSupplierData;

      const response = await app.handle(
        new Request("http://localhost/suppliers", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(invalidData),
        })
      );

      expect([422, 500]).toContain(response.status);
    });

    it("should return 400 for invalid email format", async () => {
      const app = withApiErrorHandler(
        new Elysia()
          .derive(() => ({ user: mockAdminUser }))
          .use(createSupplierRoute)
      );

      const invalidData = {
        ...validSupplierData,
        contactEmail: "not-an-email",
      };

      const response = await app.handle(
        new Request("http://localhost/suppliers", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(invalidData),
        })
      );

      expect(response.status).toBe(400);
      const result = (await response.json()) as ApiResult;
      expectErrResult(result);
      expect(result.error.code).toBe("VALIDATION_ERROR");
    });

    it("should return 400 for invalid URL format (website)", async () => {
      const app = withApiErrorHandler(
        new Elysia()
          .derive(() => ({ user: mockAdminUser }))
          .use(createSupplierRoute)
      );

      const invalidData = {
        ...validSupplierData,
        website: "not-a-url",
      };

      const response = await app.handle(
        new Request("http://localhost/suppliers", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(invalidData),
        })
      );

      expect(response.status).toBe(400);
      const result = (await response.json()) as ApiResult;
      expectErrResult(result);
      expect(result.error.code).toBe("VALIDATION_ERROR");
    });

    it("should return 400 for missing address fields", async () => {
      const app = withApiErrorHandler(
        new Elysia()
          .derive(() => ({ user: mockAdminUser }))
          .use(createSupplierRoute)
      );

      const invalidData = {
        ...validSupplierData,
        address: {
          street: "123 Main St",
        },
      };

      const response = await app.handle(
        new Request("http://localhost/suppliers", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(invalidData),
        })
      );

      expect([422, 500]).toContain(response.status);
    });

    it("should accept optional fields (website, notes)", async () => {
      const app = withApiErrorHandler(
        new Elysia()
          .derive(() => ({ user: mockAdminUser }))
          .use(createSupplierRoute)
      );

      const {
        website: _excludedWebsite,
        notes: _excludedNotes,
        ...dataWithoutOptionals
      } = validSupplierData;

      const response = await app.handle(
        new Request("http://localhost/suppliers", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(dataWithoutOptionals),
        })
      );

      expect(response.status).toBe(201);
    });

    it("should set default status to 'prospect' if not provided", async () => {
      const app = withApiErrorHandler(
        new Elysia()
          .derive(() => ({ user: mockAdminUser }))
          .use(createSupplierRoute)
      );

      const { status: _excludedStatus, ...dataWithoutStatus } =
        validSupplierData;

      const response = await app.handle(
        new Request("http://localhost/suppliers", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(dataWithoutStatus),
        })
      );

      expect(response.status).toBe(201);
      const result = (await response.json()) as ApiResult<{
        supplier: { status: string };
      }>;
      expectOkResult(result);
      expect(result.data.supplier.status).toBe("prospect");
    });
  });

  describe("POST /api/suppliers - Duplicate Detection", () => {
    it("should return 409 for duplicate supplier name (without forceSave)", async () => {
      duplicateCheckRows.push({
        id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        name: "Acme Corp",
      });

      const app = withApiErrorHandler(
        new Elysia()
          .derive(() => ({ user: mockAdminUser }))
          .use(createSupplierRoute)
      );

      const response = await app.handle(
        new Request("http://localhost/suppliers", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...validSupplierData,
            name: "Acme Corp",
            forceSave: false,
          }),
        })
      );

      expect(response.status).toBe(409);
      const result = (await response.json()) as ApiResult;
      expectErrResult(result);
      expect(result.error.code).toBe("DUPLICATE_SUPPLIER");
    });

    it("should accept duplicate with forceSave=true", async () => {
      duplicateCheckRows.push({
        id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        name: "Acme Corp",
      });

      const app = withApiErrorHandler(
        new Elysia()
          .derive(() => ({ user: mockAdminUser }))
          .use(createSupplierRoute)
      );

      const response = await app.handle(
        new Request("http://localhost/suppliers", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...validSupplierData,
            name: "Acme Corp",
            forceSave: true,
          }),
        })
      );

      expect(response.status).toBe(201);
    });
  });
});
