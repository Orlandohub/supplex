import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Elysia } from "elysia";
import { registerRoute } from "../register";

// Mock dependencies
vi.mock("../../lib/supabase", () => ({
  supabaseAdmin: {
    auth: {
      admin: {
        createUser: vi.fn(),
        deleteUser: vi.fn(),
      },
    },
  },
}));

vi.mock("../../lib/db", () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(),
      })),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(),
        })),
      })),
    })),
  },
}));

vi.mock("@supplex/db/src/schema", () => ({
  tenants: {
    id: "id",
    slug: "slug",
  },
  users: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

const { supabaseAdmin } = await import("../../../lib/supabase");
const { db } = await import("../../../lib/db");

describe("Auth Registration API", () => {
  let app: Elysia;

  beforeEach(() => {
    app = new Elysia().use(registerRoute);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("POST /auth/register", () => {
    const validRegistrationData = {
      email: "test@example.com",
      password: "Password123",
      fullName: "Test User",
      tenantName: "Test Company",
    };

    it("should register user successfully", async () => {
      // Mock successful Supabase user creation
      const mockAuthUser = {
        user: { id: "user-123", email: "test@example.com" },
      };

      supabaseAdmin.auth.admin.createUser.mockResolvedValue({
        data: mockAuthUser,
        error: null,
      });

      // Mock successful tenant creation
      const mockTenant = {
        id: "tenant-123",
        name: "Test Company",
        slug: "test-company",
      };

      db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]), // No existing tenant
          }),
        }),
      });

      db.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockTenant]),
        }),
      });

      // Mock successful user record creation
      const mockUser = {
        id: "user-123",
        tenantId: "tenant-123",
        email: "test@example.com",
        fullName: "Test User",
        role: "admin",
      };

      db.insert
        .mockReturnValueOnce({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockTenant]),
          }),
        })
        .mockReturnValueOnce({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockUser]),
          }),
        });

      const response = await app.handle(
        new Request("http://localhost/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validRegistrationData),
        })
      );

      expect(response.status).toBe(201);

      const result = (await response.json()) as any;
      expect(result?.success).toBe(true);
      expect(result?.data?.user).toMatchObject({
        id: "user-123",
        email: "test@example.com",
        fullName: "Test User",
        role: "admin",
      });
      expect(result?.data?.tenant).toMatchObject({
        id: "tenant-123",
        name: "Test Company",
        slug: "test-company",
      });
    });

    it("should return error for invalid email", async () => {
      const invalidData = {
        ...validRegistrationData,
        email: "invalid-email",
      };

      const response = await app.handle(
        new Request("http://localhost/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(invalidData),
        })
      );

      expect(response.status).toBe(400);
    });

    it("should return error for short password", async () => {
      const invalidData = {
        ...validRegistrationData,
        password: "123",
      };

      const response = await app.handle(
        new Request("http://localhost/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(invalidData),
        })
      );

      expect(response.status).toBe(400);
    });

    it("should handle Supabase auth error", async () => {
      supabaseAdmin.auth.admin.createUser.mockResolvedValue({
        data: { user: null },
        error: { message: "Email already registered" },
      });

      const response = await app.handle(
        new Request("http://localhost/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validRegistrationData),
        })
      );

      expect(response.status).toBe(400);

      const result = (await response.json()) as any;
      expect(result?.success).toBe(false);
      expect(result?.error).toBe("Email already registered");
    });

    it("should rollback on database error", async () => {
      const mockAuthUser = {
        user: { id: "user-123", email: "test@example.com" },
      };

      supabaseAdmin.auth.admin.createUser.mockResolvedValue({
        data: mockAuthUser,
        error: null,
      });

      // Mock database error during tenant creation
      db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      db.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue(new Error("Database error")),
        }),
      });

      const response = await app.handle(
        new Request("http://localhost/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validRegistrationData),
        })
      );

      expect(response.status).toBe(500);

      const result = (await response.json()) as any;
      expect(result?.success).toBe(false);
      expect(result?.error).toBe("Failed to create tenant and user records");

      // Verify rollback was attempted
      expect(supabaseAdmin.auth.admin.deleteUser).toHaveBeenCalledWith(
        "user-123"
      );
    });

    it("should generate unique tenant slug", async () => {
      const mockAuthUser = {
        user: { id: "user-123", email: "test@example.com" },
      };

      supabaseAdmin.auth.admin.createUser.mockResolvedValue({
        data: mockAuthUser,
        error: null,
      });

      // Mock existing tenant with same slug
      db.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: "existing" }]), // Existing tenant
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]), // No conflict with -1 suffix
            }),
          }),
        });

      const mockTenant = {
        id: "tenant-123",
        name: "Test Company",
        slug: "test-company-1", // Should have -1 suffix
      };

      db.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockTenant]),
        }),
      });

      const response = await app.handle(
        new Request("http://localhost/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validRegistrationData),
        })
      );

      expect(response.status).toBe(201);

      const result = (await response.json()) as any;
      expect(result?.data?.tenant?.slug).toBe("test-company-1");
    });
  });

  describe("GET /auth/register/check-tenant-slug/:slug", () => {
    it("should return available for new slug", async () => {
      db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]), // No existing tenant
          }),
        }),
      });

      const response = await app.handle(
        new Request(
          "http://localhost/auth/register/check-tenant-slug/my-company"
        )
      );

      expect(response.status).toBe(200);

      const result = (await response.json()) as any;
      expect(result?.available).toBe(true);
      expect(result?.slug).toBe("my-company");
    });

    it("should return unavailable for existing slug", async () => {
      db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: "existing" }]), // Existing tenant
          }),
        }),
      });

      const response = await app.handle(
        new Request(
          "http://localhost/auth/register/check-tenant-slug/existing-company"
        )
      );

      expect(response.status).toBe(200);

      const result = (await response.json()) as any;
      expect(result?.available).toBe(false);
      expect(result?.slug).toBe("existing-company");
    });

    it("should handle database error", async () => {
      db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockRejectedValue(new Error("Database error")),
          }),
        }),
      });

      const response = await app.handle(
        new Request("http://localhost/auth/register/check-tenant-slug/test")
      );

      expect(response.status).toBe(500);

      const result = (await response.json()) as any;
      expect(result?.available).toBe(false);
      expect(result?.error).toBe("Failed to check slug availability");
    });
  });
});
