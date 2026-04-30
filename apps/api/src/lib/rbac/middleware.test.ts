import { describe, expect, test, beforeEach, mock } from "bun:test";
import { Elysia } from "elysia";
import { db } from "../db";
import { UserRole } from "@supplex/types";
import { createMockDb, mockDbChain, type MockDb } from "../test-utils";

// ─────────────────────────────────────────────────────────────────────────────
// Module mocks (declared before importing the unit under test so Bun's
// hoisted `mock.module(...)` registrations are in place at import time).
//
// The `db` mock uses the shared {@link createMockDb} helper which produces
// a *complete* shape: every `db.X(...)` method returns an awaitable chain
// resolving to `[]` by default. This matters because Bun's `mock.module()`
// is process-wide and is not torn down between test files; a partial `db`
// mock here would crash unrelated test files (their `beforeAll` hooks
// would throw `db.delete is not a function`). The complete shape keeps
// any leakage non-fatal. Tests in this file override per-call via
// `mockDb.select.mockReturnValueOnce(mockDbChain([row]))`.
// ─────────────────────────────────────────────────────────────────────────────

class MockJWTVerificationError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "JWTVerificationError";
    this.code = code;
  }
}

interface MockJWTPayload {
  sub: string;
  email: string;
  role: string;
  aud: string;
  exp: number;
  iat: number;
  app_metadata: { role?: string; tenant_id?: string; provider?: string };
  user_metadata: {
    full_name?: string;
    role?: string;
    tenant_id?: string;
  };
}

const tokenPayloads: Record<string, MockJWTPayload> = {
  "valid-active-token": {
    sub: "user-active-123",
    email: "active@test.com",
    role: "authenticated",
    aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    app_metadata: { role: "admin", tenant_id: "tenant-123" },
    user_metadata: { full_name: "Active User" },
  },
  "valid-supplier-user-token": {
    sub: "user-supplier-789",
    email: "supplier@test.com",
    role: "authenticated",
    aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    app_metadata: { role: "supplier_user", tenant_id: "tenant-789" },
    user_metadata: { full_name: "Supplier Contact" },
  },
  "valid-deactivated-token": {
    sub: "user-deactivated-456",
    email: "deactivated@test.com",
    role: "authenticated",
    aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    app_metadata: { role: "admin", tenant_id: "tenant-456" },
    user_metadata: { full_name: "Deactivated User" },
  },
  "stale-user-metadata-only-token": {
    sub: "user-stale-999",
    email: "stale@test.com",
    role: "authenticated",
    aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    app_metadata: { provider: "email" },
    user_metadata: {
      role: "admin",
      tenant_id: "tenant-999",
      full_name: "Stale User",
    },
  },
  "missing-role-token": {
    sub: "user-norole-888",
    email: "norole@test.com",
    role: "authenticated",
    aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    app_metadata: { tenant_id: "tenant-888" },
    user_metadata: { full_name: "No Role User" },
  },
  "updated-role-token": {
    sub: "user-updated-777",
    email: "updated@test.com",
    role: "authenticated",
    aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    app_metadata: { role: "procurement_manager", tenant_id: "tenant-777" },
    user_metadata: { full_name: "Updated Role User" },
  },
};

mock.module("../jwt-verifier", () => ({
  JWTVerificationError: MockJWTVerificationError,
  verifyJWT: mock(async (token: string): Promise<MockJWTPayload> => {
    const payload = tokenPayloads[token];
    if (payload) return payload;
    if (token === "expired-token") {
      throw new MockJWTVerificationError(
        "JWT token has expired",
        "TOKEN_EXPIRED"
      );
    }
    throw new MockJWTVerificationError(
      "JWT token is invalid or malformed",
      "INVALID_TOKEN"
    );
  }),
}));

interface SupabaseUserMockEntry {
  data: { user: { id: string; email: string } | null };
  error: { message: string } | null;
}

const supabaseUserResponses: Record<string, SupabaseUserMockEntry> = {
  "valid-active-token": {
    data: { user: { id: "user-active-123", email: "active@test.com" } },
    error: null,
  },
  "valid-supplier-user-token": {
    data: { user: { id: "user-supplier-789", email: "supplier@test.com" } },
    error: null,
  },
  "valid-deactivated-token": {
    data: {
      user: { id: "user-deactivated-456", email: "deactivated@test.com" },
    },
    error: null,
  },
  "stale-user-metadata-only-token": {
    data: { user: { id: "user-stale-999", email: "stale@test.com" } },
    error: null,
  },
  "missing-role-token": {
    data: { user: { id: "user-norole-888", email: "norole@test.com" } },
    error: null,
  },
  "updated-role-token": {
    data: { user: { id: "user-updated-777", email: "updated@test.com" } },
    error: null,
  },
};

mock.module("../supabase", () => ({
  supabaseAdmin: {
    auth: {
      getUser: mock(
        (token: string): SupabaseUserMockEntry =>
          supabaseUserResponses[token] ?? {
            data: { user: null },
            error: { message: "Invalid token" },
          }
      ),
    },
  },
}));

mock.module("../auth-cache", () => ({
  authCache: {
    get: mock(async () => null),
    set: mock(async () => {}),
    invalidate: mock(async () => {}),
  },
}));

// Database stub: complete shape via {@link createMockDb} so any leakage to
// other test files in the suite is non-fatal.
const mockDb: MockDb = createMockDb({
  queryTables: ["users", "tenants"],
});

mock.module("../db", () => ({
  db: mockDb,
}));

// SUP-21 (9a-4): Bun's `mock.module()` is process-wide (resolved by
// absolute path) so this mock leaks to every other test file that
// imports `apps/api/src/lib/logger.ts`. The previous shape only stubbed
// `default.child` and dropped the root-level `info`/`warn`/`error` plus
// the named exports (`logger`, `createChildLogger`), which crashed the
// global Elysia error handler in `apps/api/src/index.ts:54` (`logger.warn
// is undefined`) and every consumer of `import { logger } from`. Provide
// a fully-shaped stub that mirrors `pino`'s public surface AND
// `lib/logger.ts`'s named exports so any leaked importer stays alive.
const stubLogger = {
  trace: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  fatal: () => {},
  silent: () => {},
  bindings: () => ({}),
  child: () => stubLogger,
};

mock.module("../logger", () => ({
  default: stubLogger,
  logger: stubLogger,
  createChildLogger: () => stubLogger,
  getClientIp: (request: Request) => {
    const xff = request.headers.get("x-forwarded-for");
    if (xff) {
      const first = xff.split(",")[0];
      if (first) return first.trim();
    }
    return request.headers.get("x-real-ip");
  },
}));

// Import AFTER mocks are registered.
import { authenticate, requireRole } from "./middleware";
import { ApiError } from "../errors";

// ─── Typed response shapes for `app.handle(...).then(r => r.json())` ────────

interface HandleSuccessUser {
  id: string;
  email: string;
  role: string;
  tenantId: string;
  fullName?: string;
}

interface HandleSuccessResponse {
  success: true;
  user?: HandleSuccessUser;
  role?: string;
}

interface HandleErrorResponse {
  success: false;
  error: { code: string; message: string };
}

type HandleResponse = HandleSuccessResponse | HandleErrorResponse;

interface ApiErrorLike {
  statusCode: number;
  code?: string;
  message?: string;
}

function isApiErrorLike(value: unknown): value is ApiErrorLike {
  return (
    typeof value === "object" &&
    value !== null &&
    "statusCode" in value &&
    typeof (value as { statusCode: unknown }).statusCode === "number"
  );
}

/**
 * Shared test-app factory. Registers an error handler that mirrors the
 * production behavior (ApiError -> structured error envelope) so the
 * middleware tests can assert on `response.error.code` / `response.error.message`.
 */
function buildErrorHandlerApp() {
  return new Elysia().onError(({ error, set }) => {
    if (error instanceof ApiError) {
      set.status = error.statusCode;
      return {
        success: false,
        error: { code: error.code, message: error.message },
      };
    }
    if (isApiErrorLike(error)) {
      set.status = error.statusCode;
      return {
        success: false,
        error: {
          code: error.code ?? "INTERNAL_SERVER_ERROR",
          message: error.message ?? "Internal server error",
        },
      };
    }
    set.status = 500;
    return {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : String(error),
      },
    };
  });
}

async function handle(
  app: { handle: (req: Request) => Promise<Response> },
  request: Request
): Promise<HandleResponse> {
  const res = await app.handle(request);
  return (await res.json()) as HandleResponse;
}

interface DeactivatedUserRow {
  isActive: boolean;
  fullName: string;
  email: string;
  tenantId: string;
}

interface AdminContactRow {
  fullName: string;
  email: string;
}

beforeEach(() => {
  // Reset between tests so per-test `mockReturnValueOnce` doesn't leak.
  mockDb.select.mockReset();
  mockDb.select.mockImplementation(() => mockDbChain<unknown>([]));
});

// ─────────────────────────────────────────────────────────────────────────────
// Suites
// ─────────────────────────────────────────────────────────────────────────────

function buildAuthenticatedApp() {
  return buildErrorHandlerApp()
    .use(authenticate)
    .get("/test", ({ user }) => ({ success: true, user }));
}

describe("Authentication Middleware - Deactivated User Check", () => {
  let app: ReturnType<typeof buildAuthenticatedApp>;

  beforeEach(() => {
    app = buildAuthenticatedApp();
  });

  test("should reject deactivated user with 401 and USER_DEACTIVATED code", async () => {
    mockDb.select
      .mockReturnValueOnce(
        mockDbChain<DeactivatedUserRow>([
          {
            isActive: false,
            fullName: "Deactivated User",
            email: "deactivated@test.com",
            tenantId: "tenant-456",
          },
        ])
      )
      .mockReturnValueOnce(
        mockDbChain<AdminContactRow>([
          { fullName: "Admin User", email: "admin@test.com" },
        ])
      );

    const response = await handle(
      app,
      new Request("http://localhost/test", {
        headers: { Authorization: "Bearer valid-deactivated-token" },
      })
    );

    expect(response.success).toBe(false);
    if (response.success) return; // narrow for the assertions below
    expect(response.error.code).toBe("USER_DEACTIVATED");
    expect(response.error.message).toContain("Your user has been deactivated");
    expect(response.error.message).toContain("Admin User");
    expect(response.error.message).toContain("admin@test.com");
  });

  test("should allow active users (no regression)", async () => {
    mockDb.select.mockReturnValueOnce(
      mockDbChain<DeactivatedUserRow>([
        {
          isActive: true,
          fullName: "Active User",
          email: "active@test.com",
          tenantId: "tenant-123",
        },
      ])
    );

    const response = await handle(
      app,
      new Request("http://localhost/test", {
        headers: { Authorization: "Bearer valid-active-token" },
      })
    );

    expect(response.success).toBe(true);
    if (!response.success) return;
    expect(response.user).toBeDefined();
    expect(response.user?.id).toBe("user-active-123");
  });

  test("should include admin name and email when admin exists", async () => {
    mockDb.select
      .mockReturnValueOnce(
        mockDbChain<DeactivatedUserRow>([
          {
            isActive: false,
            fullName: "Deactivated User",
            email: "deactivated@test.com",
            tenantId: "tenant-456",
          },
        ])
      )
      .mockReturnValueOnce(
        mockDbChain<AdminContactRow>([
          { fullName: "John Admin", email: "john.admin@company.com" },
        ])
      );

    const response = await handle(
      app,
      new Request("http://localhost/test", {
        headers: { Authorization: "Bearer valid-deactivated-token" },
      })
    );

    expect(response.success).toBe(false);
    if (response.success) return;
    expect(response.error.message).toContain("John Admin");
    expect(response.error.message).toContain("john.admin@company.com");
  });

  test("should use fallback message when no admin exists", async () => {
    mockDb.select
      .mockReturnValueOnce(
        mockDbChain<DeactivatedUserRow>([
          {
            isActive: false,
            fullName: "Deactivated User",
            email: "deactivated@test.com",
            tenantId: "tenant-456",
          },
        ])
      )
      .mockReturnValueOnce(mockDbChain<AdminContactRow>([]));

    const response = await handle(
      app,
      new Request("http://localhost/test", {
        headers: { Authorization: "Bearer valid-deactivated-token" },
      })
    );

    expect(response.success).toBe(false);
    if (response.success) return;
    expect(response.error.message).toContain("your company's admin");
    expect(response.error.message).not.toContain("@");
  });

  test("should return TOKEN_EXPIRED error for expired tokens", async () => {
    const response = await handle(
      app,
      new Request("http://localhost/test", {
        headers: { Authorization: "Bearer expired-token" },
      })
    );

    expect(response.success).toBe(false);
    if (response.success) return;
    expect(response.error.code).toBe("TOKEN_EXPIRED");
  });

  test("should return MISSING_TOKEN error when no token provided", async () => {
    const response = await handle(app, new Request("http://localhost/test"));

    expect(response.success).toBe(false);
    if (response.success) return;
    expect(response.error.code).toBe("MISSING_TOKEN");
  });
});

describe("Authentication Middleware - supplier_user Role Support", () => {
  let app: ReturnType<typeof buildAuthenticatedApp>;

  beforeEach(() => {
    app = buildAuthenticatedApp();
  });

  test("should allow supplier_user role (authentication succeeds)", async () => {
    mockDb.select.mockReturnValueOnce(
      mockDbChain<DeactivatedUserRow>([
        {
          isActive: true,
          fullName: "Supplier Contact",
          email: "supplier@test.com",
          tenantId: "tenant-789",
        },
      ])
    );

    const response = await handle(
      app,
      new Request("http://localhost/test", {
        headers: { Authorization: "Bearer valid-supplier-user-token" },
      })
    );

    expect(response.success).toBe(true);
    if (!response.success) return;
    expect(response.user?.id).toBe("user-supplier-789");
    expect(response.user?.email).toBe("supplier@test.com");
  });

  test("should extract supplier_user role from JWT app_metadata", async () => {
    mockDb.select.mockReturnValueOnce(
      mockDbChain<DeactivatedUserRow>([
        {
          isActive: true,
          fullName: "Supplier Contact",
          email: "supplier@test.com",
          tenantId: "tenant-789",
        },
      ])
    );

    const response = await handle(
      app,
      new Request("http://localhost/test", {
        headers: { Authorization: "Bearer valid-supplier-user-token" },
      })
    );

    expect(response.success).toBe(true);
    if (!response.success) return;
    expect(response.user?.role).toBe("supplier_user");
  });
});

function buildSupplierUserAppFor(
  routePath: `/${string}`,
  middleware: ReturnType<typeof requireRole>
) {
  return buildErrorHandlerApp()
    .use(middleware)
    .get(routePath, ({ user }) => ({
      success: true,
      role: user.role,
    }));
}

describe("Role-Based Authorization - supplier_user Role", () => {
  test("requireRole([UserRole.SUPPLIER_USER]) should permit supplier_user", async () => {
    mockDb.select.mockReturnValueOnce(
      mockDbChain<DeactivatedUserRow>([
        {
          isActive: true,
          fullName: "Supplier Contact",
          email: "supplier@test.com",
          tenantId: "tenant-789",
        },
      ])
    );

    const app = buildSupplierUserAppFor(
      "/supplier-route",
      requireRole([UserRole.SUPPLIER_USER])
    );

    const response = await handle(
      app,
      new Request("http://localhost/supplier-route", {
        headers: { Authorization: "Bearer valid-supplier-user-token" },
      })
    );

    expect(response.success).toBe(true);
    if (!response.success) return;
    expect(response.role).toBe("supplier_user");
  });

  test("requireRole([UserRole.ADMIN]) should deny supplier_user with 403 error", async () => {
    const adminOnlyRoles = [UserRole.ADMIN];
    expect(adminOnlyRoles.includes(UserRole.SUPPLIER_USER)).toBe(false);

    const { PERMISSION_MATRIX, PermissionAction } = await import(
      "@supplex/types"
    );
    const supplierUserPermissions = PERMISSION_MATRIX[UserRole.SUPPLIER_USER];

    expect(supplierUserPermissions).not.toContain(
      PermissionAction.MANAGE_USERS
    );
    expect(supplierUserPermissions).not.toContain(
      PermissionAction.MANAGE_TENANT_SETTINGS
    );
    expect(supplierUserPermissions).not.toContain(
      PermissionAction.CHANGE_USER_ROLES
    );

    expect(supplierUserPermissions).toContain(
      PermissionAction.VIEW_OWN_SUPPLIER
    );
    expect(supplierUserPermissions).toContain(
      PermissionAction.EDIT_OWN_SUPPLIER
    );
    expect(supplierUserPermissions).toContain(PermissionAction.VIEW_OWN_TASKS);
  });

  test("requireRole() should support supplier_user alongside other roles", async () => {
    mockDb.select.mockReturnValueOnce(
      mockDbChain<DeactivatedUserRow>([
        {
          isActive: true,
          fullName: "Supplier Contact",
          email: "supplier@test.com",
          tenantId: "tenant-789",
        },
      ])
    );

    const app = buildSupplierUserAppFor(
      "/shared-route",
      requireRole([UserRole.PROCUREMENT_MANAGER, UserRole.SUPPLIER_USER])
    );

    const response = await handle(
      app,
      new Request("http://localhost/shared-route", {
        headers: { Authorization: "Bearer valid-supplier-user-token" },
      })
    );

    expect(response.success).toBe(true);
    if (!response.success) return;
    expect(response.role).toBe("supplier_user");
  });
});

// ─── SEC-001: Tests for app_metadata Claims Model ───────────────────────────

describe("Authentication Middleware - app_metadata Claims (SEC-001)", () => {
  let app: ReturnType<typeof buildAuthenticatedApp>;

  beforeEach(() => {
    app = buildAuthenticatedApp();
  });

  test("8.3: middleware correctly reads role and tenant_id from app_metadata", async () => {
    mockDb.select.mockReturnValueOnce(
      mockDbChain<DeactivatedUserRow>([
        {
          isActive: true,
          fullName: "Active User",
          email: "active@test.com",
          tenantId: "tenant-123",
        },
      ])
    );

    const response = await handle(
      app,
      new Request("http://localhost/test", {
        headers: { Authorization: "Bearer valid-active-token" },
      })
    );

    expect(response.success).toBe(true);
    if (!response.success) return;
    expect(response.user?.role).toBe("admin");
    expect(response.user?.tenantId).toBe("tenant-123");
  });

  test("8.4: middleware returns 401 INVALID_ROLE when JWT has claims only in user_metadata (stale pre-migration token)", async () => {
    const response = await handle(
      app,
      new Request("http://localhost/test", {
        headers: { Authorization: "Bearer stale-user-metadata-only-token" },
      })
    );

    expect(response.success).toBe(false);
    if (response.success) return;
    expect(response.error.code).toBe("INVALID_ROLE");
    expect(response.error.message).toContain("Missing role");
  });

  test("8.4b: middleware returns 401 INVALID_ROLE when role is absent from app_metadata", async () => {
    const response = await handle(
      app,
      new Request("http://localhost/test", {
        headers: { Authorization: "Bearer missing-role-token" },
      })
    );

    expect(response.success).toBe(false);
    if (response.success) return;
    expect(response.error.code).toBe("INVALID_ROLE");
  });

  test("8.5: after role update to app_metadata, next cache-miss authentication picks up new role", async () => {
    mockDb.select.mockReturnValueOnce(
      mockDbChain<DeactivatedUserRow>([
        {
          isActive: true,
          fullName: "Updated Role User",
          email: "updated@test.com",
          tenantId: "tenant-777",
        },
      ])
    );

    const response = await handle(
      app,
      new Request("http://localhost/test", {
        headers: { Authorization: "Bearer updated-role-token" },
      })
    );

    expect(response.success).toBe(true);
    if (!response.success) return;
    expect(response.user?.role).toBe("procurement_manager");
    expect(response.user?.tenantId).toBe("tenant-777");
  });
});

// Reference `db` so the linter is happy that the import is used (it is — via
// the module-mock factory's resolution path; see `mock.module("../db", ...)`).
void db;
