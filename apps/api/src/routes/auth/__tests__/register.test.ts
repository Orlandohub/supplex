import { describe, it, expect, mock, beforeEach } from "bun:test";
import { Elysia } from "elysia";
import {
  withApiErrorHandler,
  mockDbChain,
  type MockDb,
} from "../../../lib/test-utils";

// ─────────────────────────────────────────────────────────────────────────────
// Module mocks
//
// IMPORTANT: `mock.module(...)` paths are resolved relative to *this* file
// (`apps/api/src/routes/auth/__tests__/register.test.ts`). Earlier
// revisions used `../../lib/...` which silently no-op'd because that path
// resolves to a non-existent module; `vi.mock(...)` was used too, but Bun's
// vi-shim does not match Vitest's hoisting semantics. The result was that
// the production code under test ran against the real `supabaseAdmin` and
// real `db`, and every assertion that depended on a mocked response failed.
//
// SUP-9d corrects both the path and the API: we use Bun's `mock.module`
// directly with `../../../lib/...` (climbing __tests__, auth, routes to
// reach `apps/api/src/lib/`) and bind typed references to the inner
// `mock(...)` instances so per-test `mockResolvedValueOnce(...)` overrides
// don't need `as any`.
// ─────────────────────────────────────────────────────────────────────────────

interface SupabaseAuthUser {
  id: string;
  email: string | null;
}

interface SupabaseCreateUserResponse {
  data: { user: SupabaseAuthUser | null };
  error: { message: string } | null;
}

interface SupabaseDeleteUserResponse {
  data: Record<string, unknown> | null;
  error: { message: string } | null;
}

const mockCreateUser = mock(
  (..._args: readonly unknown[]): Promise<SupabaseCreateUserResponse> =>
    Promise.resolve({
      data: { user: null },
      error: { message: "Mock not configured" },
    })
);

const mockDeleteUser = mock(
  (..._args: readonly unknown[]): Promise<SupabaseDeleteUserResponse> =>
    Promise.resolve({ data: null, error: null })
);

// `updateUserById` is invoked from the registration flow to attach
// `app_metadata` (role + tenant_id) once the tenant exists. The original
// tests omitted it, so requests crashed with `updateUserById is not a function`
// once the mock path was wired correctly.
const mockUpdateUserById = mock(
  (..._args: readonly unknown[]): Promise<SupabaseDeleteUserResponse> =>
    Promise.resolve({ data: null, error: null })
);

mock.module("../../../lib/supabase", () => ({
  supabaseAdmin: {
    auth: {
      admin: {
        createUser: mockCreateUser,
        deleteUser: mockDeleteUser,
        updateUserById: mockUpdateUserById,
      },
    },
  },
}));

// Typed db mock: full chain shape so leakage to other test files is
// non-fatal, plus typed `mockReturnValueOnce` to control specific
// `select(...).from(...).where(...).limit(...)` paths per test.
const mockDb: MockDb = {
  select: mock(() => mockDbChain<unknown>([])),
  selectDistinct: mock(() => mockDbChain<unknown>([])),
  insert: mock(() => mockDbChain<unknown>([])),
  update: mock(() => mockDbChain<unknown>([])),
  delete: mock(() => mockDbChain<unknown>([])),
  execute: mock(() => Promise.resolve(undefined)),
  transaction: mock(
    async (callback: (tx: MockDb) => unknown | Promise<unknown>) => {
      return await callback(mockDb);
    }
  ),
  query: {},
};

mock.module("../../../lib/db", () => ({
  db: mockDb,
}));

// Import the route under test AFTER mocks are registered.
import { registerRoute } from "../register";

// ─── Typed response shapes for `app.handle(...).then(r => r.json())` ────────

interface RegisteredTenant {
  id: string;
  name: string;
  slug: string;
}

interface RegisteredUser {
  id: string;
  tenantId: string;
  email: string;
  fullName: string;
  role: string;
}

interface RegisterSuccessBody {
  success: true;
  data: {
    user: RegisteredUser;
    tenant: RegisteredTenant;
  };
}

interface RegisterErrorBody {
  success: false;
  error: { code: string; message: string };
}

type RegisterResponseBody = RegisterSuccessBody | RegisterErrorBody;

interface SlugCheckSuccess {
  available: boolean;
  slug: string;
}

interface SlugCheckError {
  success: false;
  error: { code: string; message: string };
}

type SlugCheckBody = SlugCheckSuccess | SlugCheckError;

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("Auth Registration API", () => {
  type RegisterApp = ReturnType<typeof buildRegisterApp>;
  let app: RegisterApp;

  function buildRegisterApp() {
    return withApiErrorHandler(new Elysia().use(registerRoute));
  }

  beforeEach(() => {
    app = buildRegisterApp();
    mockCreateUser.mockReset();
    mockDeleteUser.mockReset();
    mockDb.select.mockReset();
    mockDb.insert.mockReset();
    // Reset to no-op default chains so test files only need to override the
    // calls they care about.
    mockDb.select.mockImplementation(() => mockDbChain<unknown>([]));
    mockDb.insert.mockImplementation(() => mockDbChain<unknown>([]));
  });

  describe("POST /auth/register", () => {
    const validRegistrationData = {
      email: "test@example.com",
      password: "Password123",
      fullName: "Test User",
      tenantName: "Test Company",
    };

    it("should register user successfully", async () => {
      mockCreateUser.mockResolvedValueOnce({
        data: { user: { id: "user-123", email: "test@example.com" } },
        error: null,
      });

      const mockTenant: RegisteredTenant = {
        id: "tenant-123",
        name: "Test Company",
        slug: "test-company",
      };
      const mockUser: RegisteredUser = {
        id: "user-123",
        tenantId: "tenant-123",
        email: "test@example.com",
        fullName: "Test User",
        role: "admin",
      };

      // First select returns no existing tenant (slug is available).
      mockDb.select.mockReturnValueOnce(mockDbChain<RegisteredTenant>([]));
      // First insert resolves to the tenant; second to the user.
      mockDb.insert
        .mockReturnValueOnce(mockDbChain<RegisteredTenant>([mockTenant]))
        .mockReturnValueOnce(mockDbChain<RegisteredUser>([mockUser]));

      const response = await app.handle(
        new Request("http://localhost/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validRegistrationData),
        })
      );

      expect(response.status).toBe(201);

      const result = (await response.json()) as RegisterResponseBody;
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.user).toMatchObject({
        id: "user-123",
        email: "test@example.com",
        fullName: "Test User",
        role: "admin",
      });
      expect(result.data.tenant).toMatchObject({
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

      // Elysia returns 422 (Unprocessable Entity) for schema validation
      // failures on `t.Object(...)` body schemas.
      expect(response.status).toBe(422);
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

      expect(response.status).toBe(422);
    });

    it("should handle Supabase auth error", async () => {
      mockCreateUser.mockResolvedValueOnce({
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

      const result = (await response.json()) as RegisterResponseBody;
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error.message).toBe("Email already registered");
    });

    it("should rollback on database error", async () => {
      mockCreateUser.mockResolvedValueOnce({
        data: { user: { id: "user-123", email: "test@example.com" } },
        error: null,
      });

      mockDb.select.mockReturnValueOnce(mockDbChain<RegisteredTenant>([]));

      // Insert call rejects — represents a tenant-creation failure.
      const failingChain = {
        values: mock(() => ({
          returning: mock(() => Promise.reject(new Error("Database error"))),
        })),
      };
      mockDb.insert.mockReturnValueOnce(
        failingChain as unknown as ReturnType<typeof mockDbChain>
      );

      const response = await app.handle(
        new Request("http://localhost/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validRegistrationData),
        })
      );

      expect(response.status).toBe(500);

      const result = (await response.json()) as RegisterResponseBody;
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error.message).toBe(
        "Failed to create tenant and user records"
      );

      expect(mockDeleteUser).toHaveBeenCalledWith("user-123");
    });

    it("should generate unique tenant slug", async () => {
      mockCreateUser.mockResolvedValueOnce({
        data: { user: { id: "user-123", email: "test@example.com" } },
        error: null,
      });

      // First slug check finds an existing tenant -> bumps to -1 suffix.
      // Second check returns empty -> -1 is free.
      mockDb.select
        .mockReturnValueOnce(mockDbChain<{ id: string }>([{ id: "existing" }]))
        .mockReturnValueOnce(mockDbChain<{ id: string }>([]));

      const mockTenant: RegisteredTenant = {
        id: "tenant-123",
        name: "Test Company",
        slug: "test-company-1",
      };
      const mockUser: RegisteredUser = {
        id: "user-123",
        tenantId: "tenant-123",
        email: "test@example.com",
        fullName: "Test User",
        role: "admin",
      };
      mockDb.insert
        .mockReturnValueOnce(mockDbChain<RegisteredTenant>([mockTenant]))
        .mockReturnValueOnce(mockDbChain<RegisteredUser>([mockUser]));

      const response = await app.handle(
        new Request("http://localhost/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validRegistrationData),
        })
      );

      expect(response.status).toBe(201);

      const result = (await response.json()) as RegisterResponseBody;
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.tenant.slug).toBe("test-company-1");
    });
  });

  describe("GET /auth/register/check-tenant-slug/:slug", () => {
    it("should return available for new slug", async () => {
      mockDb.select.mockReturnValueOnce(mockDbChain<{ id: string }>([]));

      const response = await app.handle(
        new Request(
          "http://localhost/auth/register/check-tenant-slug/my-company"
        )
      );

      expect(response.status).toBe(200);

      const result = (await response.json()) as SlugCheckBody;
      expect("available" in result && result.available).toBe(true);
      expect("slug" in result && result.slug).toBe("my-company");
    });

    it("should return unavailable for existing slug", async () => {
      mockDb.select.mockReturnValueOnce(
        mockDbChain<{ id: string }>([{ id: "existing" }])
      );

      const response = await app.handle(
        new Request(
          "http://localhost/auth/register/check-tenant-slug/existing-company"
        )
      );

      expect(response.status).toBe(200);

      const result = (await response.json()) as SlugCheckBody;
      expect("available" in result && result.available).toBe(false);
      expect("slug" in result && result.slug).toBe("existing-company");
    });

    it("should handle database error", async () => {
      // Build a failing chain so `select(...).from(...).where(...).limit(...)`
      // rejects. Note that `mockDbChain` is awaitable directly, so we wrap
      // a thenable that rejects.
      const failingChain = {
        from: mock(() => ({
          where: mock(() => ({
            limit: mock(() => Promise.reject(new Error("Database error"))),
          })),
        })),
      };
      mockDb.select.mockReturnValueOnce(
        failingChain as unknown as ReturnType<typeof mockDbChain>
      );

      const response = await app.handle(
        new Request("http://localhost/auth/register/check-tenant-slug/test")
      );

      expect(response.status).toBe(500);

      const result = (await response.json()) as SlugCheckBody;
      expect("success" in result && result.success).toBe(false);
      if ("success" in result && !result.success) {
        expect(result.error.message).toBe("Failed to check slug availability");
      }
    });
  });
});
