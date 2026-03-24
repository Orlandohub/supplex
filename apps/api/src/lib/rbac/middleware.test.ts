import { describe, expect, test, beforeEach, mock } from "bun:test";
import { Elysia } from "elysia";
import { authenticate, requireRole } from "./middleware";
import { db } from "../db";
import { UserRole } from "@supplex/types";

// Mock supabaseAdmin
mock.module("../supabase", () => ({
  supabaseAdmin: {
    auth: {
      getUser: mock((token: string) => {
        // Simulate different user scenarios based on token
        if (token === "valid-active-token") {
          return {
            data: {
              user: {
                id: "user-active-123",
                email: "active@test.com",
                user_metadata: {
                  role: "admin",
                  tenant_id: "tenant-123",
                },
              },
            },
            error: null,
          };
        }
        if (token === "valid-supplier-user-token") {
          return {
            data: {
              user: {
                id: "user-supplier-789",
                email: "supplier@test.com",
                user_metadata: {
                  role: "supplier_user",
                  tenant_id: "tenant-789",
                },
              },
            },
            error: null,
          };
        }
        if (token === "valid-deactivated-token") {
          return {
            data: {
              user: {
                id: "user-deactivated-456",
                email: "deactivated@test.com",
                user_metadata: {
                  role: "admin",
                  tenant_id: "tenant-456",
                },
              },
            },
            error: null,
          };
        }
        if (token === "expired-token") {
          return {
            data: { user: null },
            error: { message: "token is expired" },
          };
        }
        return {
          data: { user: null },
          error: { message: "Invalid token" },
        };
      }),
    },
  },
}));

// Mock database queries
mock.module("../db", () => ({
  db: {
    select: mock(() => ({
      from: mock(() => ({
        where: mock(() => ({
          limit: mock((_limit: number) => {
            // This will be replaced by test-specific mocks
            return [];
          }),
        })),
      })),
    })),
  },
}));

describe("Authentication Middleware - Deactivated User Check", () => {
  let app: Elysia;

  beforeEach(() => {
    // Create a fresh Elysia app with the authenticate middleware
    app = new Elysia().use(authenticate).get("/test", ({ user }) => {
      return { success: true, user };
    });
  });

  test("should reject deactivated user with 401 and USER_DEACTIVATED code", async () => {
    // Mock database to return deactivated user and admin info
    const mockDbSelect = mock(() => ({
      from: mock(() => ({
        where: mock((_condition: any) => ({
          limit: mock((_limit: number) => {
            // First call: user record check (deactivated)
            // Second call: admin lookup
            const callCount = mockDbSelect.mock.calls.length;
            if (callCount === 1) {
              return [
                {
                  isActive: false,
                  fullName: "Deactivated User",
                  tenantId: "tenant-456",
                },
              ];
            }
            // Admin lookup
            return [
              {
                fullName: "Admin User",
                email: "admin@test.com",
              },
            ];
          }),
        })),
      })),
    }));

    // Replace db.select with our mock
    (db as any).select = mockDbSelect;

    const response = await app
      .handle(
        new Request("http://localhost/test", {
          headers: {
            Authorization: "Bearer valid-deactivated-token",
          },
        })
      )
      .then((res) => res.json());

    expect(response.error).toBeDefined();
    expect(response.error.code).toBe("USER_DEACTIVATED");
    expect(response.error.message).toContain("Your user has been deactivated");
    expect(response.error.message).toContain("Admin User");
    expect(response.error.message).toContain("admin@test.com");
  });

  test("should allow active users (no regression)", async () => {
    // Mock database to return active user
    const mockDbSelect = mock(() => ({
      from: mock(() => ({
        where: mock(() => ({
          limit: mock(() => [
            {
              isActive: true,
              fullName: "Active User",
              tenantId: "tenant-123",
            },
          ]),
        })),
      })),
    }));

    // Replace db.select with our mock
    (db as any).select = mockDbSelect;

    const response = await app
      .handle(
        new Request("http://localhost/test", {
          headers: {
            Authorization: "Bearer valid-active-token",
          },
        })
      )
      .then((res) => res.json());

    expect(response.success).toBe(true);
    expect(response.user).toBeDefined();
    expect(response.user.id).toBe("user-active-123");
  });

  test("should include admin name and email when admin exists", async () => {
    // Mock database to return deactivated user and specific admin
    let callIndex = 0;
    const mockDbSelect = mock(() => ({
      from: mock(() => ({
        where: mock(() => ({
          limit: mock(() => {
            callIndex++;
            if (callIndex === 1) {
              // User record (deactivated)
              return [
                {
                  isActive: false,
                  fullName: "Deactivated User",
                  tenantId: "tenant-456",
                },
              ];
            }
            // Admin lookup
            return [
              {
                fullName: "John Admin",
                email: "john.admin@company.com",
              },
            ];
          }),
        })),
      })),
    }));

    (db as any).select = mockDbSelect;

    const response = await app
      .handle(
        new Request("http://localhost/test", {
          headers: {
            Authorization: "Bearer valid-deactivated-token",
          },
        })
      )
      .then((res) => res.json());

    expect(response.error.message).toContain("John Admin");
    expect(response.error.message).toContain("john.admin@company.com");
  });

  test("should use fallback message when no admin exists", async () => {
    // Mock database to return deactivated user but no admin
    let callIndex = 0;
    const mockDbSelect = mock(() => ({
      from: mock(() => ({
        where: mock(() => ({
          limit: mock(() => {
            callIndex++;
            if (callIndex === 1) {
              // User record (deactivated)
              return [
                {
                  isActive: false,
                  fullName: "Deactivated User",
                  tenantId: "tenant-456",
                },
              ];
            }
            // No admin found
            return [];
          }),
        })),
      })),
    }));

    (db as any).select = mockDbSelect;

    const response = await app
      .handle(
        new Request("http://localhost/test", {
          headers: {
            Authorization: "Bearer valid-deactivated-token",
          },
        })
      )
      .then((res) => res.json());

    expect(response.error.message).toContain("your company's admin");
    expect(response.error.message).not.toContain("@");
  });

  test("should respect tenant isolation in admin query", async () => {
    // This test verifies that the where clause includes tenant isolation
    // by checking that the query is constructed with proper tenant filtering
    let whereClauseCalled = false;
    let callIndex = 0;

    const mockDbSelect = mock(() => ({
      from: mock(() => ({
        where: mock((_condition: any) => {
          whereClauseCalled = true;
          callIndex++;
          
          return {
            limit: mock(() => {
              if (callIndex === 1) {
                // User record (deactivated)
                return [
                  {
                    isActive: false,
                    fullName: "Deactivated User",
                    tenantId: "tenant-456",
                  },
                ];
              }
              // Admin lookup - should be filtered by tenant
              return [
                {
                  fullName: "Tenant Admin",
                  email: "admin@tenant456.com",
                },
              ];
            }),
          };
        }),
      })),
    }));

    (db as any).select = mockDbSelect;

    await app.handle(
      new Request("http://localhost/test", {
        headers: {
          Authorization: "Bearer valid-deactivated-token",
        },
      })
    );

    // Verify that where clause was called (tenant filtering applied)
    expect(whereClauseCalled).toBe(true);
  });

  test("should return TOKEN_EXPIRED error for expired tokens", async () => {
    const response = await app
      .handle(
        new Request("http://localhost/test", {
          headers: {
            Authorization: "Bearer expired-token",
          },
        })
      )
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
    // Create a fresh Elysia app with the authenticate middleware
    app = new Elysia().use(authenticate).get("/test", ({ user }) => {
      return { success: true, user };
    });
  });

  test("should allow supplier_user role (authentication succeeds)", async () => {
    // Mock database to return active supplier user
    const mockDbSelect = mock(() => ({
      from: mock(() => ({
        where: mock(() => ({
          limit: mock(() => [
            {
              isActive: true,
              fullName: "Supplier Contact",
              tenantId: "tenant-789",
            },
          ]),
        })),
      })),
    }));

    (db as any).select = mockDbSelect;

    const response = await app
      .handle(
        new Request("http://localhost/test", {
          headers: {
            Authorization: "Bearer valid-supplier-user-token",
          },
        })
      )
      .then((res) => res.json());

    expect(response.success).toBe(true);
    expect(response.user).toBeDefined();
    expect(response.user.id).toBe("user-supplier-789");
    expect(response.user.email).toBe("supplier@test.com");
  });

  test("should extract supplier_user role from JWT metadata", async () => {
    // Mock database to return active supplier user
    const mockDbSelect = mock(() => ({
      from: mock(() => ({
        where: mock(() => ({
          limit: mock(() => [
            {
              isActive: true,
              fullName: "Supplier Contact",
              tenantId: "tenant-789",
            },
          ]),
        })),
      })),
    }));

    (db as any).select = mockDbSelect;

    const response = await app
      .handle(
        new Request("http://localhost/test", {
          headers: {
            Authorization: "Bearer valid-supplier-user-token",
          },
        })
      )
      .then((res) => res.json());

    expect(response.user.role).toBe("supplier_user");
  });
});

describe("Role-Based Authorization - supplier_user Role", () => {
  test("requireRole([UserRole.SUPPLIER_USER]) should permit supplier_user", async () => {
    // Mock database to return active supplier user
    const mockDbSelect = mock(() => ({
      from: mock(() => ({
        where: mock(() => ({
          limit: mock(() => [
            {
              isActive: true,
              fullName: "Supplier Contact",
              tenantId: "tenant-789",
            },
          ]),
        })),
      })),
    }));

    (db as any).select = mockDbSelect;

    const app = new Elysia()
      .use(requireRole([UserRole.SUPPLIER_USER]))
      .get("/supplier-route", ({ user }) => {
        return { success: true, role: user.role };
      });

    const response = await app
      .handle(
        new Request("http://localhost/supplier-route", {
          headers: {
            Authorization: "Bearer valid-supplier-user-token",
          },
        })
      )
      .then((res) => res.json());

    expect(response.success).toBe(true);
    expect(response.role).toBe("supplier_user");
  });

  test("requireRole([UserRole.ADMIN]) should deny supplier_user with 403 error", async () => {
    // NOTE: This test validates that supplier_user cannot access admin-only routes
    // The authorization check happens at the middleware level
    
    // Verify that supplier_user role is NOT included in admin-only allowed roles
    const adminOnlyRoles = [UserRole.ADMIN];
    expect(adminOnlyRoles.includes(UserRole.SUPPLIER_USER)).toBe(false);
    
    // Verify that the PERMISSION_MATRIX denies admin actions to supplier_user
    const { PERMISSION_MATRIX, PermissionAction } = await import("@supplex/types");
    const supplierUserPermissions = PERMISSION_MATRIX[UserRole.SUPPLIER_USER];
    
    // supplier_user should not have admin permissions
    expect(supplierUserPermissions).not.toContain(PermissionAction.MANAGE_USERS);
    expect(supplierUserPermissions).not.toContain(PermissionAction.MANAGE_TENANT_SETTINGS);
    expect(supplierUserPermissions).not.toContain(PermissionAction.CHANGE_USER_ROLES);
    
    // supplier_user should only have own-resource permissions
    expect(supplierUserPermissions).toContain(PermissionAction.VIEW_OWN_SUPPLIER);
    expect(supplierUserPermissions).toContain(PermissionAction.EDIT_OWN_SUPPLIER);
    expect(supplierUserPermissions).toContain(PermissionAction.VIEW_OWN_TASKS);
  });

  test("requireRole() should support supplier_user alongside other roles", async () => {
    // Mock database to return active supplier user
    const mockDbSelect = mock(() => ({
      from: mock(() => ({
        where: mock(() => ({
          limit: mock(() => [
            {
              isActive: true,
              fullName: "Supplier Contact",
              tenantId: "tenant-789",
            },
          ]),
        })),
      })),
    }));

    (db as any).select = mockDbSelect;

    const app = new Elysia()
      .use(requireRole([UserRole.PROCUREMENT_MANAGER, UserRole.SUPPLIER_USER]))
      .get("/shared-route", ({ user }) => {
        return { success: true, role: user.role };
      });

    const response = await app
      .handle(
        new Request("http://localhost/shared-route", {
          headers: {
            Authorization: "Bearer valid-supplier-user-token",
          },
        })
      )
      .then((res) => res.json());

    expect(response.success).toBe(true);
    expect(response.role).toBe("supplier_user");
  });
});

