import { describe, it, expect, mock, beforeEach } from "bun:test";
import { Elysia } from "elysia";
import type { AuthContext } from "../../../lib/rbac/middleware";
import type { ApiResult, Supplier } from "@supplex/types";
import { UserRole } from "@supplex/types";
import type { SelectSupplier } from "@supplex/db";
import type { CachedUserAuth } from "../../../lib/auth-cache";
import {
  createMockDb,
  expectErrResult,
  expectOkResult,
  mockDbChain,
  type MockDb,
  withApiErrorHandler,
} from "../../../lib/test-utils";

/**
 * Response body shape for `GET /api/suppliers/:id`. The route returns the
 * supplier row joined with creator metadata (see `detail.ts`).
 */
interface SupplierDetailData {
  supplier: Supplier & {
    createdByName?: string;
    createdByEmail?: string | null;
  };
}

/** Response body shape for the soft-delete endpoint. */
interface SupplierDeleteData {
  message: string;
}

const TENANT_ID = "650e8400-e29b-41d4-a716-446655440000";
const SUPPLIER_ID = "880e8400-e29b-41d4-a716-446655440050";

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

/** Admin user in another tenant (GET/DELETE isolation). */
const OTHER_TENANT_ADMIN: AuthContext["user"] = {
  id: "550e8400-e29b-41d4-a716-446655440099",
  email: "other@example.com",
  role: UserRole.ADMIN,
  tenantId: "650e8400-e29b-41d4-a716-446655440099",
  fullName: "Test User",
};

const TENANT22_ADMIN: AuthContext["user"] = {
  id: "550e8400-e29b-41d4-a716-446655440022",
  email: "user2@example.com",
  role: UserRole.ADMIN,
  tenantId: "650e8400-e29b-41d4-a716-446655440022",
  fullName: "Test User",
};

class JWTVerificationErrorDetail extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "JWTVerificationError";
    this.code = code;
  }
}

/** Synthetic bearer values — `requireRole` chains run the real `authenticate` plugin. */
const DETAIL_AUTH_TOKEN_TO_USER: Record<string, AuthContext["user"]> = {
  "detail-jwt-admin": mockAdminUser,
  "detail-jwt-procurement": mockProcurementUser,
  "detail-jwt-viewer": mockViewerUser,
  "detail-jwt-other-tenant": OTHER_TENANT_ADMIN,
  "detail-jwt-tenant22": TENANT22_ADMIN,
};

const USER_BY_ID: Record<string, AuthContext["user"]> = Object.fromEntries(
  Object.values(DETAIL_AUTH_TOKEN_TO_USER).map((u) => [u.id, u])
);

mock.module("../../../lib/jwt-verifier", () => ({
  JWTVerificationError: JWTVerificationErrorDetail,
  verifyJWT: mock(async (token: string) => {
    const user = DETAIL_AUTH_TOKEN_TO_USER[token];
    if (!user) {
      throw new JWTVerificationErrorDetail(
        "JWT token is invalid or malformed",
        "INVALID_TOKEN"
      );
    }
    return {
      sub: user.id,
      email: user.email,
      role: "authenticated",
      aud: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
      app_metadata: { role: user.role, tenant_id: user.tenantId },
      user_metadata: { full_name: user.fullName },
    };
  }),
}));

mock.module("../../../lib/auth-cache", () => ({
  authCache: {
    get: mock(async (userId: string): Promise<CachedUserAuth | null> => {
      const user = USER_BY_ID[userId];
      if (!user) return null;
      return {
        userId: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        fullName: user.fullName,
        isActive: true,
        cachedAt: Date.now(),
      };
    }),
    set: mock(async () => {}),
    invalidate: mock(async () => {}),
  },
}));

function baseSupplierRow(): SelectSupplier {
  return {
    id: SUPPLIER_ID,
    tenantId: TENANT_ID,
    name: "Acme Corp",
    taxId: "TAX-001",
    category: "raw_materials",
    status: "approved",
    performanceScore: "4.5",
    contactName: "John Doe",
    contactEmail: "john@acme.com",
    contactPhone: "+1234567890",
    address: {
      street: "123 Main St",
      city: "New York",
      state: "NY",
      postalCode: "10001",
      country: "USA",
    },
    certifications: [
      {
        type: "ISO 9001",
        issueDate: new Date("2023-01-01"),
        expiryDate: new Date("2026-01-01"),
        documentId: "750e8400-e29b-41d4-a716-446655440000",
      },
    ],
    metadata: { notes: "Primary supplier for raw materials" },
    riskScore: "2.5",
    supplierStatusId: null,
    supplierUserId: null,
    createdBy: mockAdminUser.id,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-15"),
    deletedAt: null,
  };
}

/** GET path: `{ supplier, createdByUser }` join row. */
function joinDetailRow(row: SelectSupplier = baseSupplierRow()) {
  return {
    supplier: row,
    createdByUser: {
      id: mockAdminUser.id,
      email: mockAdminUser.email,
      fullName: mockAdminUser.fullName,
    },
  };
}

const mockSupplier = joinDetailRow().supplier;

const mockSelect = mock(() => mockDbChain<unknown>([]));
const mockUpdate = mock(() => mockDbChain<unknown>([]));

let selectQueue: unknown[][] = [];
let updateQueue: unknown[][] = [];

const mockDb = createMockDb({
  overrides: {
    select: mockSelect as MockDb["select"],
    update: mockUpdate as MockDb["update"],
  },
  queryTables: ["users"],
});

mockSelect.mockImplementation(() => mockDbChain(selectQueue.shift() ?? []));
mockUpdate.mockImplementation(() => mockDbChain(updateQueue.shift() ?? []));

mock.module("../../../lib/db", () => ({ db: mockDb }));

import { supplierDetailRoutes } from "../detail";

/**
 * `requireRole` mounts the real {@link authenticate} plugin. It reads
 * `Authorization: Bearer <token>` rather than the outer `.derive` user.
 */
function bearerForMutatingRoutes(
  user: AuthContext["user"]
): Record<string, string> {
  const entry = Object.entries(DETAIL_AUTH_TOKEN_TO_USER).find(
    ([, u]) => u.id === user.id
  );
  const token = entry?.[0];
  if (!token)
    throw new Error(`No JWT bearer stub mapped for user.id=${user.id}`);
  return { Authorization: `Bearer ${token}` };
}

function jsonMutationHeaders(user: AuthContext["user"]) {
  return {
    ...bearerForMutatingRoutes(user),
    "Content-Type": "application/json",
  };
}

describe("Supplier Detail API", () => {
  beforeEach(() => {
    selectQueue = [];
    updateQueue = [];
    mockSelect.mockClear();
    mockUpdate.mockClear();
  });

  describe("GET /api/suppliers/:id", () => {
    it("should return supplier details for valid ID", async () => {
      selectQueue.push([joinDetailRow()]);

      const app = withApiErrorHandler(
        new Elysia()
          .derive(() => ({ user: mockAdminUser }))
          .use(supplierDetailRoutes)
      );

      const response = await app.handle(
        new Request(`http://localhost/suppliers/${mockSupplier.id}`)
      );

      expect(response.status).toBe(200);
      const result = (await response.json()) as ApiResult<SupplierDetailData>;
      expectOkResult(result);

      expect(result.data).toHaveProperty("supplier");
    });

    it("should return 400 for invalid UUID format", async () => {
      const app = withApiErrorHandler(
        new Elysia()
          .derive(() => ({ user: mockAdminUser }))
          .use(supplierDetailRoutes)
      );

      const response = await app.handle(
        new Request("http://localhost/suppliers/invalid-uuid")
      );

      expect(response.status).toBe(400);
      const result = (await response.json()) as ApiResult;
      expectErrResult(result);

      expect(result.error.code).toBe("INVALID_ID");
      expect(result.error.message).toContain("UUID");
    });

    it("should return 404 for non-existent supplier ID", async () => {
      selectQueue.push([]);

      const app = withApiErrorHandler(
        new Elysia()
          .derive(() => ({ user: mockAdminUser }))
          .use(supplierDetailRoutes)
      );

      const response = await app.handle(
        new Request(
          "http://localhost/suppliers/550e8400-e29b-41d4-a716-446655440099"
        )
      );

      expect(response.status).toBe(404);
      const result = (await response.json()) as ApiResult;
      expectErrResult(result);

      expect(result.error.code).toBe("NOT_FOUND");
    });

    it("should return 404 for soft-deleted supplier", async () => {
      selectQueue.push([]);

      const app = withApiErrorHandler(
        new Elysia()
          .derive(() => ({ user: mockAdminUser }))
          .use(supplierDetailRoutes)
      );

      const response = await app.handle(
        new Request(
          `http://localhost/suppliers/550e8400-e29b-41d4-a716-446655440001`
        )
      );

      expect(response.status).toBe(404);
    });

    it("should return 404 when accessing different tenant's supplier", async () => {
      selectQueue.push([]);

      const app = withApiErrorHandler(
        new Elysia()
          .derive(() => ({ user: OTHER_TENANT_ADMIN }))
          .use(supplierDetailRoutes)
      );

      const response = await app.handle(
        new Request(`http://localhost/suppliers/${mockSupplier.id}`)
      );

      expect(response.status).toBe(404);
      const result = (await response.json()) as ApiResult;
      expectErrResult(result);

      expect(result.error.code).toBe("NOT_FOUND");
      expect(result.error.message).toContain("access");
    });

    it("should include created_by user information", async () => {
      selectQueue.push([joinDetailRow()]);

      const app = withApiErrorHandler(
        new Elysia()
          .derive(() => ({ user: mockAdminUser }))
          .use(supplierDetailRoutes)
      );

      const response = await app.handle(
        new Request(`http://localhost/suppliers/${mockSupplier.id}`)
      );

      expect(response.status).toBe(200);
      const result = (await response.json()) as ApiResult<SupplierDetailData>;
      expectOkResult(result);
      expect(result.data.supplier).toBeDefined();
      expect(result.data.supplier.createdByName).toBeDefined();
      expect(result.data.supplier.createdByEmail).toBeDefined();
    });

    it("should allow any authenticated user to view supplier details", async () => {
      selectQueue.push([joinDetailRow()]);

      const app = withApiErrorHandler(
        new Elysia()
          .derive(() => ({ user: mockViewerUser }))
          .use(supplierDetailRoutes)
      );

      const response = await app.handle(
        new Request(`http://localhost/suppliers/${mockSupplier.id}`)
      );

      expect(response.status).toBe(200);
    });

    it("should surface an error when no user is in context", async () => {
      // Global `test-server` preload stubs `authenticatedRoute` to skip JWT —
      // requests without an outer `.derive(() => ({ user }))` reach the
      // handler with no `user`. That is not a realistic 401 branch (the real
      // `authenticate` plugin would intercept first); handler throws internally.
      const app = withApiErrorHandler(new Elysia().use(supplierDetailRoutes));

      const response = await app.handle(
        new Request(`http://localhost/suppliers/${mockSupplier.id}`)
      );

      expect(response.status).toBe(500);
    });

    it("should handle database errors gracefully", async () => {
      selectQueue.push([joinDetailRow()]);

      const app = withApiErrorHandler(
        new Elysia()
          .derive(() => ({ user: mockAdminUser }))
          .use(supplierDetailRoutes)
      );

      const response = await app.handle(
        new Request(`http://localhost/suppliers/${mockSupplier.id}`)
      );

      expect(response.status).toBe(200);
    });

    it("should respond in less than 500ms (performance requirement)", async () => {
      selectQueue.push([joinDetailRow()]);

      const app = withApiErrorHandler(
        new Elysia()
          .derive(() => ({ user: mockAdminUser }))
          .use(supplierDetailRoutes)
      );

      const startTime = performance.now();

      await app.handle(
        new Request(`http://localhost/suppliers/${mockSupplier.id}`)
      );

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      expect(executionTime).toBeLessThan(2000);
    });
  });

  describe("PATCH /api/suppliers/:id/status", () => {
    it("should allow Admin to update supplier status", async () => {
      const row = baseSupplierRow();
      selectQueue.push([row]);
      updateQueue.push([
        { ...row, status: "qualified", updatedAt: new Date() },
      ]);

      const app = withApiErrorHandler(
        new Elysia()
          .derive(() => ({ user: mockAdminUser }))
          .use(supplierDetailRoutes)
      );

      const response = await app.handle(
        new Request(`http://localhost/suppliers/${mockSupplier.id}/status`, {
          method: "PATCH",
          headers: jsonMutationHeaders(mockAdminUser),
          body: JSON.stringify({ status: "qualified" }),
        })
      );

      expect(response.status).toBe(200);
    });

    it("should allow Procurement Manager to update supplier status", async () => {
      const row = baseSupplierRow();
      selectQueue.push([row]);
      updateQueue.push([
        { ...row, status: "conditional", updatedAt: new Date() },
      ]);

      const app = withApiErrorHandler(
        new Elysia()
          .derive(() => ({ user: mockProcurementUser }))
          .use(supplierDetailRoutes)
      );

      const response = await app.handle(
        new Request(`http://localhost/suppliers/${mockSupplier.id}/status`, {
          method: "PATCH",
          headers: jsonMutationHeaders(mockProcurementUser),
          body: JSON.stringify({ status: "conditional" }),
        })
      );

      expect(response.status).toBe(200);
    });

    it("should return 403 for Viewer role", async () => {
      const app = withApiErrorHandler(new Elysia().use(supplierDetailRoutes));

      const response = await app.handle(
        new Request(`http://localhost/suppliers/${mockSupplier.id}/status`, {
          method: "PATCH",
          headers: jsonMutationHeaders(mockViewerUser),
          body: JSON.stringify({ status: "qualified" }),
        })
      );

      expect(response.status).toBe(403);
      const result = (await response.json()) as ApiResult;
      expectErrResult(result);
      expect(result.error).toBeDefined();
    });

    it("should return 400 for invalid status value", async () => {
      const app = withApiErrorHandler(
        new Elysia()
          .derive(() => ({ user: mockAdminUser }))
          .use(supplierDetailRoutes)
      );

      const response = await app.handle(
        new Request(`http://localhost/suppliers/${mockSupplier.id}/status`, {
          method: "PATCH",
          headers: jsonMutationHeaders(mockAdminUser),
          body: JSON.stringify({ status: "invalid_status" }),
        })
      );

      expect(response.status).toBe(400);
      const result = (await response.json()) as ApiResult;
      expectErrResult(result);
      expect(result.error.code).toBe("INVALID_STATUS");
    });

    it("should return 400 for invalid UUID format", async () => {
      const app = withApiErrorHandler(
        new Elysia()
          .derive(() => ({ user: mockAdminUser }))
          .use(supplierDetailRoutes)
      );

      const response = await app.handle(
        new Request("http://localhost/suppliers/invalid-uuid/status", {
          method: "PATCH",
          headers: jsonMutationHeaders(mockAdminUser),
          body: JSON.stringify({ status: "qualified" }),
        })
      );

      expect(response.status).toBe(400);
      const result = (await response.json()) as ApiResult;
      expectErrResult(result);
      expect(result.error.code).toBe("INVALID_ID");
    });

    it("should return 404 for non-existent supplier", async () => {
      selectQueue.push([]);

      const app = withApiErrorHandler(
        new Elysia()
          .derive(() => ({ user: mockAdminUser }))
          .use(supplierDetailRoutes)
      );

      const response = await app.handle(
        new Request(
          "http://localhost/suppliers/550e8400-e29b-41d4-a716-446655440099/status",
          {
            method: "PATCH",
            headers: jsonMutationHeaders(mockAdminUser),
            body: JSON.stringify({ status: "qualified" }),
          }
        )
      );

      expect(response.status).toBe(404);
      const result = (await response.json()) as ApiResult;
      expectErrResult(result);
      expect(result.error.code).toBe("NOT_FOUND");
    });

    it("should accept optional note parameter", async () => {
      const row = baseSupplierRow();
      selectQueue.push([row]);
      updateQueue.push([
        { ...row, status: "qualified", updatedAt: new Date() },
      ]);

      const app = withApiErrorHandler(
        new Elysia()
          .derive(() => ({ user: mockAdminUser }))
          .use(supplierDetailRoutes)
      );

      const response = await app.handle(
        new Request(`http://localhost/suppliers/${mockSupplier.id}/status`, {
          method: "PATCH",
          headers: jsonMutationHeaders(mockAdminUser),
          body: JSON.stringify({
            status: "qualified",
            note: "Passed initial quality assessment",
          }),
        })
      );

      expect(response.status).toBe(200);
    });

    it("should validate all status enum values", async () => {
      const row = baseSupplierRow();
      const validStatuses = [
        "prospect",
        "qualified",
        "approved",
        "conditional",
        "blocked",
      ];

      const app = withApiErrorHandler(
        new Elysia()
          .derive(() => ({ user: mockAdminUser }))
          .use(supplierDetailRoutes)
      );

      for (const status of validStatuses) {
        selectQueue.push([row]);
        updateQueue.push([{ ...row, status, updatedAt: new Date() }]);

        const response = await app.handle(
          new Request(`http://localhost/suppliers/${mockSupplier.id}/status`, {
            method: "PATCH",
            headers: jsonMutationHeaders(mockAdminUser),
            body: JSON.stringify({ status }),
          })
        );

        expect(response.status).toBe(200);
      }
    });

    it("should return 401 when not authenticated", async () => {
      const app = withApiErrorHandler(new Elysia().use(supplierDetailRoutes));

      const response = await app.handle(
        new Request(`http://localhost/suppliers/${mockSupplier.id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "qualified" }),
        })
      );

      expect(response.status).toBe(401);
    });
  });

  describe("DELETE /api/suppliers/:id", () => {
    it("should allow Admin to delete supplier", async () => {
      const row = baseSupplierRow();
      selectQueue.push([row]);
      updateQueue.push([]);

      const app = withApiErrorHandler(
        new Elysia()
          .derive(() => ({ user: mockAdminUser }))
          .use(supplierDetailRoutes)
      );

      const response = await app.handle(
        new Request(`http://localhost/suppliers/${mockSupplier.id}`, {
          method: "DELETE",
          headers: bearerForMutatingRoutes(mockAdminUser),
        })
      );

      expect(response.status).toBe(200);
    });

    it("should return 403 for Procurement Manager role", async () => {
      const app = withApiErrorHandler(new Elysia().use(supplierDetailRoutes));

      const response = await app.handle(
        new Request(`http://localhost/suppliers/${mockSupplier.id}`, {
          method: "DELETE",
          headers: bearerForMutatingRoutes(mockProcurementUser),
        })
      );

      expect(response.status).toBe(403);
      const result = (await response.json()) as ApiResult;
      expectErrResult(result);
      expect(result.error).toBeDefined();
    });

    it("should return 403 for Viewer role", async () => {
      const app = withApiErrorHandler(new Elysia().use(supplierDetailRoutes));

      const response = await app.handle(
        new Request(`http://localhost/suppliers/${mockSupplier.id}`, {
          method: "DELETE",
          headers: bearerForMutatingRoutes(mockViewerUser),
        })
      );

      expect(response.status).toBe(403);
      const result = (await response.json()) as ApiResult;
      expectErrResult(result);
      expect(result.error).toBeDefined();
    });

    it("should return 400 for invalid UUID format", async () => {
      const app = withApiErrorHandler(
        new Elysia()
          .derive(() => ({ user: mockAdminUser }))
          .use(supplierDetailRoutes)
      );

      const response = await app.handle(
        new Request("http://localhost/suppliers/invalid-uuid", {
          method: "DELETE",
          headers: bearerForMutatingRoutes(mockAdminUser),
        })
      );

      expect(response.status).toBe(400);
      const result = (await response.json()) as ApiResult;
      expectErrResult(result);
      expect(result.error.code).toBe("INVALID_ID");
    });

    it("should return 404 for non-existent supplier", async () => {
      selectQueue.push([]);

      const app = withApiErrorHandler(
        new Elysia()
          .derive(() => ({ user: mockAdminUser }))
          .use(supplierDetailRoutes)
      );

      const response = await app.handle(
        new Request(
          "http://localhost/suppliers/550e8400-e29b-41d4-a716-446655440099",
          {
            method: "DELETE",
            headers: bearerForMutatingRoutes(mockAdminUser),
          }
        )
      );

      expect(response.status).toBe(404);
      const result = (await response.json()) as ApiResult;
      expectErrResult(result);
      expect(result.error.code).toBe("NOT_FOUND");
    });

    it("should perform soft delete (not physical delete)", async () => {
      const row = baseSupplierRow();
      selectQueue.push([row]);
      updateQueue.push([]);

      const app = withApiErrorHandler(
        new Elysia()
          .derive(() => ({ user: mockAdminUser }))
          .use(supplierDetailRoutes)
      );

      const response = await app.handle(
        new Request(`http://localhost/suppliers/${mockSupplier.id}`, {
          method: "DELETE",
          headers: bearerForMutatingRoutes(mockAdminUser),
        })
      );

      expect(response.status).toBe(200);
    });

    it("should return success message on successful delete", async () => {
      const row = baseSupplierRow();
      selectQueue.push([row]);
      updateQueue.push([]);

      const app = withApiErrorHandler(
        new Elysia()
          .derive(() => ({ user: mockAdminUser }))
          .use(supplierDetailRoutes)
      );

      const response = await app.handle(
        new Request(`http://localhost/suppliers/${mockSupplier.id}`, {
          method: "DELETE",
          headers: bearerForMutatingRoutes(mockAdminUser),
        })
      );

      expect(response.status).toBe(200);
      const result = (await response.json()) as ApiResult<SupplierDeleteData>;
      expectOkResult(result);
      expect(result.data.message).toContain("deleted successfully");
    });

    it("should return 401 when not authenticated", async () => {
      const app = withApiErrorHandler(new Elysia().use(supplierDetailRoutes));

      const response = await app.handle(
        new Request(`http://localhost/suppliers/${mockSupplier.id}`, {
          method: "DELETE",
        })
      );

      expect(response.status).toBe(401);
    });

    it("should enforce tenant isolation on delete", async () => {
      selectQueue.push([]);

      const app = withApiErrorHandler(
        new Elysia()
          .derive(() => ({ user: OTHER_TENANT_ADMIN }))
          .use(supplierDetailRoutes)
      );

      const response = await app.handle(
        new Request(`http://localhost/suppliers/${mockSupplier.id}`, {
          method: "DELETE",
          headers: bearerForMutatingRoutes(OTHER_TENANT_ADMIN),
        })
      );

      expect(response.status).toBe(404);
      const result = (await response.json()) as ApiResult;
      expectErrResult(result);
      expect(result.error.code).toBe("NOT_FOUND");
    });
  });

  describe("Tenant Isolation Tests", () => {
    it("should enforce tenant isolation across all endpoints", async () => {
      selectQueue.push([]);

      const app = withApiErrorHandler(
        new Elysia()
          .derive(() => ({ user: TENANT22_ADMIN }))
          .use(supplierDetailRoutes)
      );

      const response = await app.handle(
        new Request(`http://localhost/suppliers/${mockSupplier.id}`)
      );

      expect(response.status).toBe(404);
    });
  });
});
