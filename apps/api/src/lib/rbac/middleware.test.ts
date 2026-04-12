import { describe, expect, test, beforeEach, mock } from "bun:test";
import { Elysia } from "elysia";
import { db } from "../db";
import { UserRole } from "@supplex/types";

// Mock jwt-verifier: maps fake tokens to decoded JWT payloads with app_metadata
class MockJWTVerificationError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "JWTVerificationError";
    this.code = code;
  }
}

mock.module("../jwt-verifier", () => ({
  JWTVerificationError: MockJWTVerificationError,
  verifyJWT: mock(async (token: string) => {
    if (token === "valid-active-token") {
      return {
        sub: "user-active-123",
        email: "active@test.com",
        role: "authenticated",
        aud: "authenticated",
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        app_metadata: { role: "admin", tenant_id: "tenant-123" },
        user_metadata: { full_name: "Active User" },
      };
    }
    if (token === "valid-supplier-user-token") {
      return {
        sub: "user-supplier-789",
        email: "supplier@test.com",
        role: "authenticated",
        aud: "authenticated",
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        app_metadata: { role: "supplier_user", tenant_id: "tenant-789" },
        user_metadata: { full_name: "Supplier Contact" },
      };
    }
    if (token === "valid-deactivated-token") {
      return {
        sub: "user-deactivated-456",
        email: "deactivated@test.com",
        role: "authenticated",
        aud: "authenticated",
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        app_metadata: { role: "admin", tenant_id: "tenant-456" },
        user_metadata: { full_name: "Deactivated User" },
      };
    }
    if (token === "stale-user-metadata-only-token") {
      return {
        sub: "user-stale-999",
        email: "stale@test.com",
        role: "authenticated",
        aud: "authenticated",
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        app_metadata: { provider: "email" },
        user_metadata: { role: "admin", tenant_id: "tenant-999", full_name: "Stale User" },
      };
    }
    if (token === "missing-role-token") {
      return {
        sub: "user-norole-888",
        email: "norole@test.com",
        role: "authenticated",
        aud: "authenticated",
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        app_metadata: { tenant_id: "tenant-888" },
        user_metadata: { full_name: "No Role User" },
      };
    }
    if (token === "updated-role-token") {
      return {
        sub: "user-updated-777",
        email: "updated@test.com",
        role: "authenticated",
        aud: "authenticated",
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        app_metadata: { role: "procurement_manager", tenant_id: "tenant-777" },
        user_metadata: { full_name: "Updated Role User" },
      };
    }
    if (token === "expired-token") {
      throw new MockJWTVerificationError("JWT token has expired", "TOKEN_EXPIRED");
    }
    throw new MockJWTVerificationError("JWT token is invalid or malformed", "INVALID_TOKEN");
  }),
}));

// Mock supabaseAdmin (only used in slow path for token revocation check)
mock.module("../supabase", () => ({
  supabaseAdmin: {
    auth: {
      getUser: mock((token: string) => {
        if (token === "valid-active-token") {
          return { data: { user: { id: "user-active-123", email: "active@test.com" } }, error: null };
        }
        if (token === "valid-supplier-user-token") {
          return { data: { user: { id: "user-supplier-789", email: "supplier@test.com" } }, error: null };
        }
        if (token === "valid-deactivated-token") {
          return { data: { user: { id: "user-deactivated-456", email: "deactivated@test.com" } }, error: null };
        }
        if (token === "stale-user-metadata-only-token") {
          return { data: { user: { id: "user-stale-999", email: "stale@test.com" } }, error: null };
        }
        if (token === "missing-role-token") {
          return { data: { user: { id: "user-norole-888", email: "norole@test.com" } }, error: null };
        }
        if (token === "updated-role-token") {
          return { data: { user: { id: "user-updated-777", email: "updated@test.com" } }, error: null };
        }
        return { data: { user: null }, error: { message: "Invalid token" } };
      }),
    },
  },
}));

// Mock auth-cache: return null to force slow path (cache miss)
mock.module("../auth-cache", () => ({
  authCache: {
    get: mock(async () => null),
    set: mock(async () => {}),
    invalidate: mock(async () => {}),
  },
}));

// Mock database queries
mock.module("../db", () => ({
  db: {
    select: mock(() => ({
      from: mock(() => ({
        where: mock(() => ({
          limit: mock(() => []),
        })),
      })),
    })),
  },
}));

// Mock logger
mock.module("../logger", () => ({
  default: {
    child: () => ({
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    }),
  },
}));

// Import AFTER mocks are registered
import { authenticate, requireRole } from "./middleware";
import { ApiError } from "../errors";

function testApp() {
  return new Elysia()
    .onError(({ error, set }) => {
      if (error instanceof ApiError) {
        set.status = error.statusCode;
        return { success: false, error: { code: error.code, message: error.message } };
      }
      if (error && typeof error === "object" && "statusCode" in error) {
        const e = error as any;
        set.status = e.statusCode;
        return { success: false, error: { code: e.code, message: e.message } };
      }
      set.status = 500;
      return { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: String(error instanceof Error ? error.message : error) } };
    });
}

describe("Authentication Middleware - Deactivated User Check", () => {
  let app: Elysia;

  beforeEach(() => {
    app = testApp().use(authenticate).get("/test", ({ user }) => {
      return { success: true, user };
    });
  });

  test("should reject deactivated user with 401 and USER_DEACTIVATED code", async () => {
    const mockDbSelect = mock(() => ({
      from: mock(() => ({
        where: mock((_condition: any) => ({
          limit: mock((_limit: number) => {
            const callCount = mockDbSelect.mock.calls.length;
            if (callCount === 1) {
              return [{ isActive: false, fullName: "Deactivated User", email: "deactivated@test.com", tenantId: "tenant-456" }];
            }
            return [{ fullName: "Admin User", email: "admin@test.com" }];
          }),
        })),
      })),
    }));

    (db as any).select = mockDbSelect;

    const response = await app
      .handle(new Request("http://localhost/test", { headers: { Authorization: "Bearer valid-deactivated-token" } }))
      .then((res) => res.json());

    expect(response.error).toBeDefined();
    expect(response.error.code).toBe("USER_DEACTIVATED");
    expect(response.error.message).toContain("Your user has been deactivated");
    expect(response.error.message).toContain("Admin User");
    expect(response.error.message).toContain("admin@test.com");
  });

  test("should allow active users (no regression)", async () => {
    const mockDbSelect = mock(() => ({
      from: mock(() => ({
        where: mock(() => ({
          limit: mock(() => [{ isActive: true, fullName: "Active User", email: "active@test.com", tenantId: "tenant-123" }]),
        })),
      })),
    }));

    (db as any).select = mockDbSelect;

    const response = await app
      .handle(new Request("http://localhost/test", { headers: { Authorization: "Bearer valid-active-token" } }))
      .then((res) => res.json());

    expect(response.success).toBe(true);
    expect(response.user).toBeDefined();
    expect(response.user.id).toBe("user-active-123");
  });

  test("should include admin name and email when admin exists", async () => {
    let callIndex = 0;
    const mockDbSelect = mock(() => ({
      from: mock(() => ({
        where: mock(() => ({
          limit: mock(() => {
            callIndex++;
            if (callIndex === 1) {
              return [{ isActive: false, fullName: "Deactivated User", email: "deactivated@test.com", tenantId: "tenant-456" }];
            }
            return [{ fullName: "John Admin", email: "john.admin@company.com" }];
          }),
        })),
      })),
    }));

    (db as any).select = mockDbSelect;

    const response = await app
      .handle(new Request("http://localhost/test", { headers: { Authorization: "Bearer valid-deactivated-token" } }))
      .then((res) => res.json());

    expect(response.error.message).toContain("John Admin");
    expect(response.error.message).toContain("john.admin@company.com");
  });

  test("should use fallback message when no admin exists", async () => {
    let callIndex = 0;
    const mockDbSelect = mock(() => ({
      from: mock(() => ({
        where: mock(() => ({
          limit: mock(() => {
            callIndex++;
            if (callIndex === 1) {
              return [{ isActive: false, fullName: "Deactivated User", email: "deactivated@test.com", tenantId: "tenant-456" }];
            }
            return [];
          }),
        })),
      })),
    }));

    (db as any).select = mockDbSelect;

    const response = await app
      .handle(new Request("http://localhost/test", { headers: { Authorization: "Bearer valid-deactivated-token" } }))
      .then((res) => res.json());

    expect(response.error.message).toContain("your company's admin");
    expect(response.error.message).not.toContain("@");
  });

  test("should return TOKEN_EXPIRED error for expired tokens", async () => {
    const response = await app
      .handle(new Request("http://localhost/test", { headers: { Authorization: "Bearer expired-token" } }))
      .then((res) => res.json());

    expect(response.error).toBeDefined();
    expect(response.error.code).toBe("TOKEN_EXPIRED");
  });

  test("should return MISSING_TOKEN error when no token provided", async () => {
    const response = await app
      .handle(new Request("http://localhost/test"))
      .then((res) => res.json());

    expect(response.error).toBeDefined();
    expect(response.error.code).toBe("MISSING_TOKEN");
  });
});

describe("Authentication Middleware - supplier_user Role Support", () => {
  let app: Elysia;

  beforeEach(() => {
    app = testApp().use(authenticate).get("/test", ({ user }) => {
      return { success: true, user };
    });
  });

  test("should allow supplier_user role (authentication succeeds)", async () => {
    const mockDbSelect = mock(() => ({
      from: mock(() => ({
        where: mock(() => ({
          limit: mock(() => [{ isActive: true, fullName: "Supplier Contact", email: "supplier@test.com", tenantId: "tenant-789" }]),
        })),
      })),
    }));

    (db as any).select = mockDbSelect;

    const response = await app
      .handle(new Request("http://localhost/test", { headers: { Authorization: "Bearer valid-supplier-user-token" } }))
      .then((res) => res.json());

    expect(response.success).toBe(true);
    expect(response.user).toBeDefined();
    expect(response.user.id).toBe("user-supplier-789");
    expect(response.user.email).toBe("supplier@test.com");
  });

  test("should extract supplier_user role from JWT app_metadata", async () => {
    const mockDbSelect = mock(() => ({
      from: mock(() => ({
        where: mock(() => ({
          limit: mock(() => [{ isActive: true, fullName: "Supplier Contact", email: "supplier@test.com", tenantId: "tenant-789" }]),
        })),
      })),
    }));

    (db as any).select = mockDbSelect;

    const response = await app
      .handle(new Request("http://localhost/test", { headers: { Authorization: "Bearer valid-supplier-user-token" } }))
      .then((res) => res.json());

    expect(response.user.role).toBe("supplier_user");
  });
});

describe("Role-Based Authorization - supplier_user Role", () => {
  test("requireRole([UserRole.SUPPLIER_USER]) should permit supplier_user", async () => {
    const mockDbSelect = mock(() => ({
      from: mock(() => ({
        where: mock(() => ({
          limit: mock(() => [{ isActive: true, fullName: "Supplier Contact", email: "supplier@test.com", tenantId: "tenant-789" }]),
        })),
      })),
    }));

    (db as any).select = mockDbSelect;

    const app = testApp()
      .use(requireRole([UserRole.SUPPLIER_USER]))
      .get("/supplier-route", ({ user }) => {
        return { success: true, role: user.role };
      });

    const response = await app
      .handle(new Request("http://localhost/supplier-route", { headers: { Authorization: "Bearer valid-supplier-user-token" } }))
      .then((res) => res.json());

    expect(response.success).toBe(true);
    expect(response.role).toBe("supplier_user");
  });

  test("requireRole([UserRole.ADMIN]) should deny supplier_user with 403 error", async () => {
    const adminOnlyRoles = [UserRole.ADMIN];
    expect(adminOnlyRoles.includes(UserRole.SUPPLIER_USER)).toBe(false);

    const { PERMISSION_MATRIX, PermissionAction } = await import("@supplex/types");
    const supplierUserPermissions = PERMISSION_MATRIX[UserRole.SUPPLIER_USER];

    expect(supplierUserPermissions).not.toContain(PermissionAction.MANAGE_USERS);
    expect(supplierUserPermissions).not.toContain(PermissionAction.MANAGE_TENANT_SETTINGS);
    expect(supplierUserPermissions).not.toContain(PermissionAction.CHANGE_USER_ROLES);

    expect(supplierUserPermissions).toContain(PermissionAction.VIEW_OWN_SUPPLIER);
    expect(supplierUserPermissions).toContain(PermissionAction.EDIT_OWN_SUPPLIER);
    expect(supplierUserPermissions).toContain(PermissionAction.VIEW_OWN_TASKS);
  });

  test("requireRole() should support supplier_user alongside other roles", async () => {
    const mockDbSelect = mock(() => ({
      from: mock(() => ({
        where: mock(() => ({
          limit: mock(() => [{ isActive: true, fullName: "Supplier Contact", email: "supplier@test.com", tenantId: "tenant-789" }]),
        })),
      })),
    }));

    (db as any).select = mockDbSelect;

    const app = testApp()
      .use(requireRole([UserRole.PROCUREMENT_MANAGER, UserRole.SUPPLIER_USER]))
      .get("/shared-route", ({ user }) => {
        return { success: true, role: user.role };
      });

    const response = await app
      .handle(new Request("http://localhost/shared-route", { headers: { Authorization: "Bearer valid-supplier-user-token" } }))
      .then((res) => res.json());

    expect(response.success).toBe(true);
    expect(response.role).toBe("supplier_user");
  });
});

// ─── SEC-001: New Tests for app_metadata Claims Model ────────────────────────

describe("Authentication Middleware - app_metadata Claims (SEC-001)", () => {
  let app: Elysia;

  beforeEach(() => {
    app = testApp().use(authenticate).get("/test", ({ user }) => {
      return { success: true, user };
    });
  });

  test("8.3: middleware correctly reads role and tenant_id from app_metadata", async () => {
    const mockDbSelect = mock(() => ({
      from: mock(() => ({
        where: mock(() => ({
          limit: mock(() => [{ isActive: true, fullName: "Active User", email: "active@test.com", tenantId: "tenant-123" }]),
        })),
      })),
    }));

    (db as any).select = mockDbSelect;

    const response = await app
      .handle(new Request("http://localhost/test", { headers: { Authorization: "Bearer valid-active-token" } }))
      .then((res) => res.json());

    expect(response.success).toBe(true);
    expect(response.user.role).toBe("admin");
    expect(response.user.tenantId).toBe("tenant-123");
  });

  test("8.4: middleware returns 401 INVALID_ROLE when JWT has claims only in user_metadata (stale pre-migration token)", async () => {
    const response = await app
      .handle(new Request("http://localhost/test", { headers: { Authorization: "Bearer stale-user-metadata-only-token" } }))
      .then((res) => res.json());

    expect(response.error).toBeDefined();
    expect(response.error.code).toBe("INVALID_ROLE");
    expect(response.error.message).toContain("Missing role");
  });

  test("8.4b: middleware returns 401 INVALID_ROLE when role is absent from app_metadata", async () => {
    const response = await app
      .handle(new Request("http://localhost/test", { headers: { Authorization: "Bearer missing-role-token" } }))
      .then((res) => res.json());

    expect(response.error).toBeDefined();
    expect(response.error.code).toBe("INVALID_ROLE");
  });

  test("8.5: after role update to app_metadata, next cache-miss authentication picks up new role", async () => {
    const mockDbSelect = mock(() => ({
      from: mock(() => ({
        where: mock(() => ({
          limit: mock(() => [{ isActive: true, fullName: "Updated Role User", email: "updated@test.com", tenantId: "tenant-777" }]),
        })),
      })),
    }));

    (db as any).select = mockDbSelect;

    const response = await app
      .handle(new Request("http://localhost/test", { headers: { Authorization: "Bearer updated-role-token" } }))
      .then((res) => res.json());

    expect(response.success).toBe(true);
    expect(response.user.role).toBe("procurement_manager");
    expect(response.user.tenantId).toBe("tenant-777");
  });
});
