import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader, action } from "../suppliers.$id";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";

// Mock dependencies
vi.mock("~/lib/auth/require-auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("~/lib/api-client", () => ({
  createEdenTreatyClient: vi.fn(),
}));

import { requireAuth } from "~/lib/auth/require-auth";
import { createEdenTreatyClient } from "~/lib/api-client";

describe("suppliers.$id route", () => {
  const mockSession = {
    access_token: "mock-token-123",
    user: {
      id: "user-123",
      email: "test@example.com",
    },
  };

  const mockSupplier = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    tenantId: "tenant-123",
    name: "Acme Corp",
    taxId: "TAX-001",
    category: "raw_materials",
    status: "approved",
    performanceScore: 4.5,
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
    certifications: [],
    metadata: {},
    riskScore: 2.5,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-15"),
    deletedAt: null,
    createdByName: "Admin User",
    createdByEmail: "admin@example.com",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loader", () => {
    it("fetches supplier successfully", async () => {
      vi.mocked(requireAuth).mockResolvedValue({
        session: mockSession,
        user: mockSession.user,
      } as any);

      const mockClient = {
        api: {
          suppliers: {
            [mockSupplier.id]: {
              get: vi.fn().mockResolvedValue({
                data: {
                  success: true,
                  data: {
                    supplier: mockSupplier,
                  },
                },
                error: null,
              }),
            },
          },
        },
      };

      vi.mocked(createEdenTreatyClient).mockReturnValue(mockClient as any);

      const request = new Request(
        `http://localhost/suppliers/${mockSupplier.id}`
      );
      const args: LoaderFunctionArgs = {
        request,
        params: { id: mockSupplier.id },
        context: {},
      };

      const response = await loader(args);
      const data = await response.json();

      expect(data.supplier).toBeDefined();
      expect(data.supplier.id).toBe(mockSupplier.id);
      expect(data.supplier.name).toBe("Acme Corp");
    });

    it("throws 404 when supplier not found", async () => {
      vi.mocked(requireAuth).mockResolvedValue({
        session: mockSession,
        user: mockSession.user,
      } as any);

      const mockClient = {
        api: {
          suppliers: {
            ["non-existent-id"]: {
              get: vi.fn().mockResolvedValue({
                data: null,
                error: { status: 404 },
                status: 404,
              }),
            },
          },
        },
      };

      vi.mocked(createEdenTreatyClient).mockReturnValue(mockClient as any);

      const request = new Request("http://localhost/suppliers/non-existent-id");
      const args: LoaderFunctionArgs = {
        request,
        params: { id: "non-existent-id" },
        context: {},
      };

      await expect(loader(args)).rejects.toThrow();
    });

    it("throws 400 when supplier ID is missing", async () => {
      vi.mocked(requireAuth).mockResolvedValue({
        session: mockSession,
        user: mockSession.user,
      } as any);

      const request = new Request("http://localhost/suppliers/");
      const args: LoaderFunctionArgs = {
        request,
        params: {},
        context: {},
      };

      await expect(loader(args)).rejects.toThrow();
    });

    it("throws 401 when not authenticated", async () => {
      vi.mocked(requireAuth).mockResolvedValue({
        session: null,
        user: null,
      } as any);

      const request = new Request(
        `http://localhost/suppliers/${mockSupplier.id}`
      );
      const args: LoaderFunctionArgs = {
        request,
        params: { id: mockSupplier.id },
        context: {},
      };

      await expect(loader(args)).rejects.toThrow();
    });

    it("enforces tenant isolation", async () => {
      vi.mocked(requireAuth).mockResolvedValue({
        session: mockSession,
        user: mockSession.user,
      } as any);

      const mockClient = {
        api: {
          suppliers: {
            [mockSupplier.id]: {
              get: vi.fn().mockResolvedValue({
                data: null,
                error: { status: 404, message: "Not found" },
                status: 404,
              }),
            },
          },
        },
      };

      vi.mocked(createEdenTreatyClient).mockReturnValue(mockClient as any);

      const request = new Request(
        `http://localhost/suppliers/${mockSupplier.id}`
      );
      const args: LoaderFunctionArgs = {
        request,
        params: { id: mockSupplier.id },
        context: {},
      };

      await expect(loader(args)).rejects.toThrow();
    });
  });

  describe("action", () => {
    it("updates supplier status successfully", async () => {
      vi.mocked(requireAuth).mockResolvedValue({
        session: mockSession,
        user: mockSession.user,
      } as any);

      const mockClient = {
        api: {
          suppliers: {
            [mockSupplier.id]: {
              status: {
                patch: vi.fn().mockResolvedValue({
                  data: {
                    success: true,
                    data: {
                      supplier: { ...mockSupplier, status: "qualified" },
                    },
                  },
                  error: null,
                }),
              },
            },
          },
        },
      };

      vi.mocked(createEdenTreatyClient).mockReturnValue(mockClient as any);

      const formData = new FormData();
      formData.append("intent", "update-status");
      formData.append("status", "qualified");

      const request = new Request(
        `http://localhost/suppliers/${mockSupplier.id}`,
        {
          method: "POST",
          body: formData,
        }
      );

      const args: ActionFunctionArgs = {
        request,
        params: { id: mockSupplier.id },
        context: {},
      };

      const response = await action(args);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.message).toContain("updated successfully");
    });

    it("deletes supplier and redirects to list", async () => {
      vi.mocked(requireAuth).mockResolvedValue({
        session: mockSession,
        user: mockSession.user,
      } as any);

      const mockClient = {
        api: {
          suppliers: {
            [mockSupplier.id]: {
              delete: vi.fn().mockResolvedValue({
                data: {
                  success: true,
                  data: {
                    message: "Supplier deleted successfully",
                  },
                },
                error: null,
              }),
            },
          },
        },
      };

      vi.mocked(createEdenTreatyClient).mockReturnValue(mockClient as any);

      const formData = new FormData();
      formData.append("intent", "delete");

      const request = new Request(
        `http://localhost/suppliers/${mockSupplier.id}`,
        {
          method: "POST",
          body: formData,
        }
      );

      const args: ActionFunctionArgs = {
        request,
        params: { id: mockSupplier.id },
        context: {},
      };

      const response = await action(args);

      // Should redirect to suppliers list
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toContain("/suppliers");
    });

    it("returns error for invalid intent", async () => {
      vi.mocked(requireAuth).mockResolvedValue({
        session: mockSession,
        user: mockSession.user,
      } as any);

      const formData = new FormData();
      formData.append("intent", "invalid-action");

      const request = new Request(
        `http://localhost/suppliers/${mockSupplier.id}`,
        {
          method: "POST",
          body: formData,
        }
      );

      const args: ActionFunctionArgs = {
        request,
        params: { id: mockSupplier.id },
        context: {},
      };

      const response = await action(args);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it("returns error when API call fails", async () => {
      vi.mocked(requireAuth).mockResolvedValue({
        session: mockSession,
        user: mockSession.user,
      } as any);

      const mockClient = {
        api: {
          suppliers: {
            [mockSupplier.id]: {
              status: {
                patch: vi.fn().mockResolvedValue({
                  data: null,
                  error: { value: "Failed to update status", status: 500 },
                  status: 500,
                }),
              },
            },
          },
        },
      };

      vi.mocked(createEdenTreatyClient).mockReturnValue(mockClient as any);

      const formData = new FormData();
      formData.append("intent", "update-status");
      formData.append("status", "qualified");

      const request = new Request(
        `http://localhost/suppliers/${mockSupplier.id}`,
        {
          method: "POST",
          body: formData,
        }
      );

      const args: ActionFunctionArgs = {
        request,
        params: { id: mockSupplier.id },
        context: {},
      };

      const response = await action(args);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
    });

    it("requires authentication for actions", async () => {
      vi.mocked(requireAuth).mockResolvedValue({
        session: null,
        user: null,
      } as any);

      const formData = new FormData();
      formData.append("intent", "update-status");
      formData.append("status", "qualified");

      const request = new Request(
        `http://localhost/suppliers/${mockSupplier.id}`,
        {
          method: "POST",
          body: formData,
        }
      );

      const args: ActionFunctionArgs = {
        request,
        params: { id: mockSupplier.id },
        context: {},
      };

      const response = await action(args);

      expect(response.status).toBe(401);
    });
  });
});
