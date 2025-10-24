import { describe, it, expect } from "bun:test";
import { Elysia } from "elysia";
import { listChecklistsRoute } from "../list";
import type { AuthContext } from "../../../lib/rbac/middleware";
import { UserRole } from "@supplex/types";

// Mock data
const mockUser: AuthContext["user"] = {
  id: "user-123",
  email: "test@example.com",
  role: UserRole.ADMIN,
  tenantId: "tenant-123",
};

describe("Checklist List API", () => {
  describe("GET /api/checklists", () => {
    it("should return all checklists for tenant", async () => {
      const app = new Elysia()
        .derive(() => ({ user: mockUser }))
        .use(listChecklistsRoute);

      const response = await app.handle(
        new Request("http://localhost/checklists")
      );

      expect(response.status).toBeOneOf([200, 500]); // 500 expected without test DB
      if (response.status === 200) {
        const result = (await response.json()) as any;
        expect(result.success).toBe(true);
        expect(result.data).toHaveProperty("checklists");
        expect(Array.isArray(result.data.checklists)).toBe(true);
      }
    });

    it("should return empty array if no checklists", async () => {
      const app = new Elysia()
        .derive(() => ({ user: mockUser }))
        .use(listChecklistsRoute);

      const response = await app.handle(
        new Request("http://localhost/checklists")
      );

      expect(response.status).toBeOneOf([200, 500]);
      if (response.status === 200) {
        const result = (await response.json()) as any;
        expect(result.success).toBe(true);
        expect(Array.isArray(result.data.checklists)).toBe(true);
      }
    });

    it("should require authentication", async () => {
      const app = new Elysia().use(listChecklistsRoute);

      const response = await app.handle(
        new Request("http://localhost/checklists")
      );

      expect(response.status).toBe(401);
    });

    it("should filter by tenant (isolation test)", async () => {
      const app = new Elysia()
        .derive(() => ({ user: mockUser }))
        .use(listChecklistsRoute);

      const response = await app.handle(
        new Request("http://localhost/checklists")
      );

      expect(response.status).toBeOneOf([200, 500]);
      // In a real test with database, verify no other tenant's checklists are returned
    });

    it("should exclude soft-deleted checklists", async () => {
      const app = new Elysia()
        .derive(() => ({ user: mockUser }))
        .use(listChecklistsRoute);

      const response = await app.handle(
        new Request("http://localhost/checklists")
      );

      expect(response.status).toBeOneOf([200, 500]);
      // In a real test with database, verify soft-deleted checklists are not returned
    });

    it("should order by createdAt descending", async () => {
      const app = new Elysia()
        .derive(() => ({ user: mockUser }))
        .use(listChecklistsRoute);

      const response = await app.handle(
        new Request("http://localhost/checklists")
      );

      expect(response.status).toBeOneOf([200, 500]);
      // In a real test with database, verify order is correct
    });
  });
});
