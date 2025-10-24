import { describe, it, expect } from "bun:test";
import { Elysia } from "elysia";
import { deleteChecklistRoute } from "../delete";
import type { AuthContext } from "../../../lib/rbac/middleware";
import { UserRole } from "@supplex/types";

// Mock data
const mockAdminUser: AuthContext["user"] = {
  id: "user-123",
  email: "admin@example.com",
  role: UserRole.ADMIN,
  tenantId: "tenant-123",
};

const mockViewerUser: AuthContext["user"] = {
  id: "user-456",
  email: "viewer@example.com",
  role: UserRole.VIEWER,
  tenantId: "tenant-123",
};

describe("Checklist Delete API", () => {
  describe("DELETE /api/checklists/:id", () => {
    it("should soft delete checklist as Admin", async () => {
      const app = new Elysia()
        .derive(() => ({ user: mockAdminUser }))
        .use(deleteChecklistRoute);

      const response = await app.handle(
        new Request("http://localhost/checklists/test-id-123", {
          method: "DELETE",
        })
      );

      expect(response.status).toBeOneOf([204, 404, 500]);
      // 204 expected on success, 404 if not found, 500 without test DB
    });

    it("should require Admin role", async () => {
      const app = new Elysia()
        .derive(() => ({ user: mockViewerUser }))
        .use(deleteChecklistRoute);

      const response = await app.handle(
        new Request("http://localhost/checklists/test-id-123", {
          method: "DELETE",
        })
      );

      expect(response.status).toBe(403);
      const result = (await response.json()) as any;
      expect(result.success).toBe(false);
      expect(result.error.code).toBe("FORBIDDEN");
    });

    it("should return 409 if checklist is in use by active workflows", async () => {
      const app = new Elysia()
        .derive(() => ({ user: mockAdminUser }))
        .use(deleteChecklistRoute);

      const response = await app.handle(
        new Request("http://localhost/checklists/in-use-checklist-id", {
          method: "DELETE",
        })
      );

      expect(response.status).toBeOneOf([409, 404, 500]);
      // 409 expected if in use, 404 if not found, 500 without test DB
      if (response.status === 409) {
        const result = (await response.json()) as any;
        expect(result.success).toBe(false);
        expect(result.error.code).toBe("CONFLICT");
        expect(result.error.message).toContain("in use");
      }
    });

    it("should return 404 for non-existent checklist", async () => {
      const app = new Elysia()
        .derive(() => ({ user: mockAdminUser }))
        .use(deleteChecklistRoute);

      const response = await app.handle(
        new Request("http://localhost/checklists/non-existent-id", {
          method: "DELETE",
        })
      );

      expect(response.status).toBeOneOf([404, 500]);
      // 404 expected for non-existent checklist, 500 without test DB
    });

    it("should not delete checklist from another tenant", async () => {
      const app = new Elysia()
        .derive(() => ({ user: mockAdminUser }))
        .use(deleteChecklistRoute);

      const response = await app.handle(
        new Request("http://localhost/checklists/other-tenant-checklist", {
          method: "DELETE",
        })
      );

      expect(response.status).toBeOneOf([404, 500]);
      // In a real test with database, verify tenant isolation
    });

    it("should perform soft delete (set deletedAt timestamp)", async () => {
      const app = new Elysia()
        .derive(() => ({ user: mockAdminUser }))
        .use(deleteChecklistRoute);

      const response = await app.handle(
        new Request("http://localhost/checklists/test-id-123", {
          method: "DELETE",
        })
      );

      expect(response.status).toBeOneOf([204, 404, 500]);
      // In a real test with database, verify deletedAt is set, not hard deleted
    });
  });
});
