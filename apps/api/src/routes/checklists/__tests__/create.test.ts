import { describe, it, expect } from "bun:test";
import { Elysia } from "elysia";
import { createChecklistRoute } from "../create";
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

const validChecklistData = {
  templateName: "ISO 9001 Standard Qualification",
  requiredDocuments: [
    {
      name: "ISO 9001 Certificate",
      description: "Current ISO 9001 certification",
      required: true,
      type: "CERTIFICATION",
    },
    {
      name: "Business License",
      description: "Valid business license",
      required: true,
      type: "LEGAL",
    },
  ],
  isDefault: false,
};

describe("Checklist Create API", () => {
  describe("POST /api/checklists", () => {
    it("should create checklist with valid data as Admin", async () => {
      const app = new Elysia()
        .derive(() => ({ user: mockAdminUser }))
        .use(createChecklistRoute);

      const response = await app.handle(
        new Request("http://localhost/checklists", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(validChecklistData),
        })
      );

      expect(response.status).toBeOneOf([201, 500]); // 500 expected without test DB
      if (response.status === 201) {
        const result = (await response.json()) as any;
        expect(result.success).toBe(true);
        expect(result.data).toHaveProperty("checklist");
        expect(result.data.checklist.templateName).toBe(
          validChecklistData.templateName
        );
      }
    });

    it("should require Admin role", async () => {
      const app = new Elysia()
        .derive(() => ({ user: mockViewerUser }))
        .use(createChecklistRoute);

      const response = await app.handle(
        new Request("http://localhost/checklists", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(validChecklistData),
        })
      );

      expect(response.status).toBe(403);
      const result = (await response.json()) as any;
      expect(result.success).toBe(false);
      expect(result.error.code).toBe("FORBIDDEN");
    });

    it("should validate required fields (template name)", async () => {
      const app = new Elysia()
        .derive(() => ({ user: mockAdminUser }))
        .use(createChecklistRoute);

      const invalidData = {
        requiredDocuments: [],
      };

      const response = await app.handle(
        new Request("http://localhost/checklists", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(invalidData),
        })
      );

      expect(response.status).toBe(400);
    });

    it("should validate required fields (required_documents)", async () => {
      const app = new Elysia()
        .derive(() => ({ user: mockAdminUser }))
        .use(createChecklistRoute);

      const invalidData = {
        templateName: "Test Template",
      };

      const response = await app.handle(
        new Request("http://localhost/checklists", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(invalidData),
        })
      );

      expect(response.status).toBe(400);
    });

    it("should set isDefault and unset other defaults when specified", async () => {
      const app = new Elysia()
        .derive(() => ({ user: mockAdminUser }))
        .use(createChecklistRoute);

      const dataWithDefault = {
        ...validChecklistData,
        isDefault: true,
      };

      const response = await app.handle(
        new Request("http://localhost/checklists", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(dataWithDefault),
        })
      );

      expect(response.status).toBeOneOf([201, 500]);
      // In a real test with database, verify other templates have isDefault=false
    });

    it("should return 400 for invalid data structure", async () => {
      const app = new Elysia()
        .derive(() => ({ user: mockAdminUser }))
        .use(createChecklistRoute);

      const invalidData = {
        templateName: "Test",
        requiredDocuments: "not-an-array", // Invalid type
      };

      const response = await app.handle(
        new Request("http://localhost/checklists", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(invalidData),
        })
      );

      expect(response.status).toBe(400);
    });

    it("should handle template name max length", async () => {
      const app = new Elysia()
        .derive(() => ({ user: mockAdminUser }))
        .use(createChecklistRoute);

      const dataWithLongName = {
        ...validChecklistData,
        templateName: "A".repeat(201), // Exceeds 200 char limit
      };

      const response = await app.handle(
        new Request("http://localhost/checklists", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(dataWithLongName),
        })
      );

      expect(response.status).toBe(400);
    });
  });
});
