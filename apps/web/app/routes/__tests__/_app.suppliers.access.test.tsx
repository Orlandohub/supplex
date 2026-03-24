/**
 * Tests for Supplier Access Control
 * Tests role-based access restrictions for supplier routes
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader as suppliersIndexLoader } from "../_app.suppliers._index";
import { loader as supplierDetailLoader } from "../_app.suppliers.$id";
import { UserRole } from "@supplex/types";

// Mock dependencies
vi.mock("~/lib/auth/require-auth");
vi.mock("~/lib/api-client");
vi.mock("~/lib/suppliers.server");

describe("Supplier Access Control", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Suppliers List Page Access", () => {
    it("supplier_user accessing /suppliers should be redirected to their supplier page", async () => {
      // Mock requireAuth to return supplier_user
      const { requireAuth } = await import("~/lib/auth/require-auth");
      vi.mocked(requireAuth).mockResolvedValue({
        user: {
          id: "user-123",
          email: "supplier@test.com",
          aud: "authenticated",
          role: "authenticated",
        },
        userRecord: {
          id: "user-123",
          tenantId: "tenant-123",
          email: "supplier@test.com",
          fullName: "Supplier User",
          role: UserRole.SUPPLIER_USER,
          avatarUrl: null,
          isActive: true,
          status: "active",
          lastLoginAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        session: {
          access_token: "mock-token",
          refresh_token: "mock-refresh",
          expires_in: 3600,
          expires_at: Date.now() + 3600000,
          token_type: "bearer",
          user: {
            id: "user-123",
            email: "supplier@test.com",
            aud: "authenticated",
            role: "authenticated",
          },
        },
      });

      // Mock getSupplierForUser to return supplier info
      const { getSupplierForUser } = await import("~/lib/suppliers.server");
      vi.mocked(getSupplierForUser).mockResolvedValue({
        id: "supplier-456",
        name: "Test Supplier",
      });

      // Call loader
      const request = new Request("http://localhost:3000/suppliers");
      const args = {
        request,
        params: {},
        context: {},
      };

      try {
        await suppliersIndexLoader(args);
        expect.fail("Should have redirected");
      } catch (error) {
        // Check if it's a redirect response
        expect(error).toBeInstanceOf(Response);
        const response = error as Response;
        expect(response.status).toBe(302);
        expect(response.headers.get("Location")).toBe("/suppliers/supplier-456");
      }
    });

    it("admin can access /suppliers normally", async () => {
      // Mock requireAuth to return admin user
      const { requireAuth } = await import("~/lib/auth/require-auth");
      vi.mocked(requireAuth).mockResolvedValue({
        user: {
          id: "admin-123",
          email: "admin@test.com",
          aud: "authenticated",
          role: "authenticated",
        },
        userRecord: {
          id: "admin-123",
          tenantId: "tenant-123",
          email: "admin@test.com",
          fullName: "Admin User",
          role: UserRole.ADMIN,
          avatarUrl: null,
          isActive: true,
          status: "active",
          lastLoginAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        session: {
          access_token: "mock-token",
          refresh_token: "mock-refresh",
          expires_in: 3600,
          expires_at: Date.now() + 3600000,
          token_type: "bearer",
          user: {
            id: "admin-123",
            email: "admin@test.com",
            aud: "authenticated",
            role: "authenticated",
          },
        },
      });

      // Mock API client
      const { createEdenTreatyClient } = await import("~/lib/api-client");
      vi.mocked(createEdenTreatyClient).mockReturnValue({
        api: {
          suppliers: {
            get: vi.fn().mockResolvedValue({
              data: {
                success: true,
                data: {
                  suppliers: [],
                  total: 0,
                  page: 1,
                  limit: 20,
                },
              },
              error: null,
            }),
          },
        },
      } as any);

      // Call loader
      const request = new Request("http://localhost:3000/suppliers");
      const args = {
        request,
        params: {},
        context: {},
      };

      const response = await suppliersIndexLoader(args);
      expect(response).toBeDefined();
      // Should not redirect, should return data
    });
  });

  describe("Supplier Detail Page Access", () => {
    it("supplier_user can access their own supplier detail page", async () => {
      // Mock requireAuth to return supplier_user
      const { requireAuth } = await import("~/lib/auth/require-auth");
      vi.mocked(requireAuth).mockResolvedValue({
        user: {
          id: "user-123",
          email: "supplier@test.com",
          aud: "authenticated",
          role: "authenticated",
        },
        userRecord: {
          id: "user-123",
          tenantId: "tenant-123",
          email: "supplier@test.com",
          fullName: "Supplier User",
          role: UserRole.SUPPLIER_USER,
          avatarUrl: null,
          isActive: true,
          status: "active",
          lastLoginAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        session: {
          access_token: "mock-token",
          refresh_token: "mock-refresh",
          expires_in: 3600,
          expires_at: Date.now() + 3600000,
          token_type: "bearer",
          user: {
            id: "user-123",
            email: "supplier@test.com",
            aud: "authenticated",
            role: "authenticated",
          },
        },
      });

      // Mock getSupplierForUser to return their supplier
      const { getSupplierForUser } = await import("~/lib/suppliers.server");
      vi.mocked(getSupplierForUser).mockResolvedValue({
        id: "supplier-456",
        name: "Test Supplier",
      });

      // Mock API client
      const { createEdenTreatyClient } = await import("~/lib/api-client");
      vi.mocked(createEdenTreatyClient).mockReturnValue({
        api: {
          suppliers: {
            "supplier-456": {
              get: vi.fn().mockResolvedValue({
                data: {
                  success: true,
                  data: {
                    id: "supplier-456",
                    name: "Test Supplier",
                  },
                },
                error: null,
              }),
              documents: {
                get: vi.fn().mockResolvedValue({
                  data: { success: true, data: [] },
                  error: null,
                }),
              },
            },
          },
          workflows: {
            supplier: {
              "supplier-456": {
                get: vi.fn().mockResolvedValue({
                  data: { success: true, data: [] },
                  error: null,
                }),
              },
            },
          },
        },
      } as any);

      // Call loader with their own supplier ID
      const request = new Request("http://localhost:3000/suppliers/supplier-456");
      const args = {
        request,
        params: { id: "supplier-456" },
        context: {},
      };

      const response = await supplierDetailLoader(args);
      expect(response).toBeDefined();
      // Should successfully return data
    });

    it("supplier_user accessing another supplier detail page should return 403", async () => {
      // Mock requireAuth to return supplier_user
      const { requireAuth } = await import("~/lib/auth/require-auth");
      vi.mocked(requireAuth).mockResolvedValue({
        user: {
          id: "user-123",
          email: "supplier@test.com",
          aud: "authenticated",
          role: "authenticated",
        },
        userRecord: {
          id: "user-123",
          tenantId: "tenant-123",
          email: "supplier@test.com",
          fullName: "Supplier User",
          role: UserRole.SUPPLIER_USER,
          avatarUrl: null,
          isActive: true,
          status: "active",
          lastLoginAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        session: {
          access_token: "mock-token",
          refresh_token: "mock-refresh",
          expires_in: 3600,
          expires_at: Date.now() + 3600000,
          token_type: "bearer",
          user: {
            id: "user-123",
            email: "supplier@test.com",
            aud: "authenticated",
            role: "authenticated",
          },
        },
      });

      // Mock getSupplierForUser to return their supplier (different from requested)
      const { getSupplierForUser } = await import("~/lib/suppliers.server");
      vi.mocked(getSupplierForUser).mockResolvedValue({
        id: "supplier-456",
        name: "Test Supplier",
      });

      // Call loader with DIFFERENT supplier ID
      const request = new Request("http://localhost:3000/suppliers/supplier-999");
      const args = {
        request,
        params: { id: "supplier-999" },
        context: {},
      };

      try {
        await supplierDetailLoader(args);
        expect.fail("Should have thrown 403 error");
      } catch (error) {
        // Check if it's a 403 response
        expect(error).toBeInstanceOf(Response);
        const response = error as Response;
        expect(response.status).toBe(403);
        expect(response.statusText).toBe("Forbidden");
      }
    });

    it("admin can access any supplier detail page", async () => {
      // Mock requireAuth to return admin user
      const { requireAuth } = await import("~/lib/auth/require-auth");
      vi.mocked(requireAuth).mockResolvedValue({
        user: {
          id: "admin-123",
          email: "admin@test.com",
          aud: "authenticated",
          role: "authenticated",
        },
        userRecord: {
          id: "admin-123",
          tenantId: "tenant-123",
          email: "admin@test.com",
          fullName: "Admin User",
          role: UserRole.ADMIN,
          avatarUrl: null,
          isActive: true,
          status: "active",
          lastLoginAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        session: {
          access_token: "mock-token",
          refresh_token: "mock-refresh",
          expires_in: 3600,
          expires_at: Date.now() + 3600000,
          token_type: "bearer",
          user: {
            id: "admin-123",
            email: "admin@test.com",
            aud: "authenticated",
            role: "authenticated",
          },
        },
      });

      // Mock API client
      const { createEdenTreatyClient } = await import("~/lib/api-client");
      vi.mocked(createEdenTreatyClient).mockReturnValue({
        api: {
          suppliers: {
            "supplier-999": {
              get: vi.fn().mockResolvedValue({
                data: {
                  success: true,
                  data: {
                    id: "supplier-999",
                    name: "Any Supplier",
                  },
                },
                error: null,
              }),
              documents: {
                get: vi.fn().mockResolvedValue({
                  data: { success: true, data: [] },
                  error: null,
                }),
              },
            },
          },
          workflows: {
            supplier: {
              "supplier-999": {
                get: vi.fn().mockResolvedValue({
                  data: { success: true, data: [] },
                  error: null,
                }),
              },
            },
          },
        },
      } as any);

      // Call loader with any supplier ID
      const request = new Request("http://localhost:3000/suppliers/supplier-999");
      const args = {
        request,
        params: { id: "supplier-999" },
        context: {},
      };

      const response = await supplierDetailLoader(args);
      expect(response).toBeDefined();
      // Should successfully return data without restriction
    });
  });
});

