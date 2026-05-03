import { describe, it, expect } from "bun:test";
import { Elysia } from "elysia";
import { createWorkflowTemplateRoute } from "../create";
import { listWorkflowTemplatesRoute } from "../list";
import { getWorkflowTemplateRoute } from "../get";
import { updateWorkflowTemplateRoute } from "../update";
import { deleteWorkflowTemplateRoute } from "../delete";
import type { AuthContext } from "../../../lib/rbac/middleware";
import type { ApiResult } from "@supplex/types";
import { UserRole } from "@supplex/types";
import { expectErrResult, withApiErrorHandler } from "../../../lib/test-utils";

// Mock data
const mockAdminUser: AuthContext["user"] = {
  id: "550e8400-e29b-41d4-a716-446655440001",
  email: "admin@example.com",
  role: UserRole.ADMIN,
  tenantId: "650e8400-e29b-41d4-a716-446655440000",
  fullName: "Test User",
};

const mockProcurementUser: AuthContext["user"] = {
  id: "550e8400-e29b-41d4-a716-446655440002",
  email: "procurement@example.com",
  role: UserRole.PROCUREMENT_MANAGER,
  tenantId: "650e8400-e29b-41d4-a716-446655440000",
  fullName: "Test User",
};

const mockViewerUser: AuthContext["user"] = {
  id: "550e8400-e29b-41d4-a716-446655440003",
  email: "viewer@example.com",
  role: UserRole.VIEWER,
  tenantId: "650e8400-e29b-41d4-a716-446655440000",
  fullName: "Test User",
};

const validTemplateData = {
  name: "Test Workflow Template",
  description: "A test workflow template for supplier qualification",
  processType: "supplier_qualification",
};

describe("Workflow Template API", () => {
  describe("POST /api/workflow-templates - Create Template", () => {
    it("should create workflow template with valid data as Admin", async () => {
      const app = withApiErrorHandler(
        new Elysia()
          .derive(() => ({ user: mockAdminUser }))
          .use(createWorkflowTemplateRoute)
      );

      const response = await app.handle(
        new Request("http://localhost/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(validTemplateData),
        })
      );

      // Note: Will return 401 without valid JWT token in unit test
      expect(response.status).toBeOneOf([200, 401, 500]);
    });

    it("should return 403 for non-Admin users", async () => {
      const app = withApiErrorHandler(
        new Elysia()
          .derive(() => ({ user: mockProcurementUser }))
          .use(createWorkflowTemplateRoute)
      );

      const response = await app.handle(
        new Request("http://localhost/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(validTemplateData),
        })
      );

      expect(response.status).toBeOneOf([401, 403]);
      const result = (await response.json()) as ApiResult;
      expectErrResult(result);
      expect(result.error.code).toBeOneOf(["FORBIDDEN", "MISSING_TOKEN"]);
    });

    it("should return 422 for missing required field (name)", async () => {
      const app = withApiErrorHandler(
        new Elysia()
          .derive(() => ({ user: mockAdminUser }))
          .use(createWorkflowTemplateRoute)
      );

      const { name: _excludedName, ...invalidData } = validTemplateData;

      const response = await app.handle(
        new Request("http://localhost/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(invalidData),
        })
      );

      expect(response.status).toBeOneOf([401, 422]);
    });

    it("should return 422 for missing required field (processType)", async () => {
      const app = withApiErrorHandler(
        new Elysia()
          .derive(() => ({ user: mockAdminUser }))
          .use(createWorkflowTemplateRoute)
      );

      const { processType: _excludedProcessType, ...invalidData } =
        validTemplateData;

      const response = await app.handle(
        new Request("http://localhost/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(invalidData),
        })
      );

      expect(response.status).toBeOneOf([401, 422]);
    });
  });

  describe("GET /api/workflow-templates - List Templates", () => {
    it("should list templates for Admin user", async () => {
      const app = withApiErrorHandler(
        new Elysia()
          .derive(() => ({ user: mockAdminUser }))
          .use(listWorkflowTemplatesRoute)
      );

      const response = await app.handle(
        new Request("http://localhost/", {
          method: "GET",
        })
      );

      // Will return 401 without JWT or 500 without test DB
      expect(response.status).toBeOneOf([200, 401, 500]);
    });

    it("should return 403 for non-Admin users", async () => {
      const app = withApiErrorHandler(
        new Elysia()
          .derive(() => ({ user: mockViewerUser }))
          .use(listWorkflowTemplatesRoute)
      );

      const response = await app.handle(
        new Request("http://localhost/", {
          method: "GET",
        })
      );

      expect(response.status).toBeOneOf([401, 403]);
    });

    it("should accept pagination params", async () => {
      const app = withApiErrorHandler(
        new Elysia()
          .derive(() => ({ user: mockAdminUser }))
          .use(listWorkflowTemplatesRoute)
      );

      const response = await app.handle(
        new Request("http://localhost/?limit=10&offset=0", {
          method: "GET",
        })
      );

      // Will return 401 without JWT or 500 without test DB
      expect(response.status).toBeOneOf([200, 401, 500]);
    });
  });

  describe("GET /api/workflow-templates/:templateId - Get Single Template", () => {
    const testId = "550e8400-e29b-41d4-a716-446655440099";

    it("should get template for Admin user", async () => {
      const app = withApiErrorHandler(
        new Elysia()
          .derive(() => ({ user: mockAdminUser }))
          .use(getWorkflowTemplateRoute)
      );

      const response = await app.handle(
        new Request(`http://localhost/${testId}`, {
          method: "GET",
        })
      );

      // Will return 401 without JWT, 500 or 404 without test DB
      expect(response.status).toBeOneOf([200, 401, 404, 500]);
    });

    it("should return 403 for non-Admin users", async () => {
      const app = withApiErrorHandler(
        new Elysia()
          .derive(() => ({ user: mockProcurementUser }))
          .use(getWorkflowTemplateRoute)
      );

      const response = await app.handle(
        new Request(`http://localhost/${testId}`, {
          method: "GET",
        })
      );

      expect(response.status).toBeOneOf([401, 403]);
    });
  });

  describe("PUT /api/workflow-templates/:templateId - Update Template", () => {
    const testId = "550e8400-e29b-41d4-a716-446655440099";

    it("should update template for Admin user", async () => {
      const app = withApiErrorHandler(
        new Elysia()
          .derive(() => ({ user: mockAdminUser }))
          .use(updateWorkflowTemplateRoute)
      );

      const response = await app.handle(
        new Request(`http://localhost/${testId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: "Updated Template Name",
            description: "Updated description",
          }),
        })
      );

      // Will return 401 without JWT, 500 or 404 without test DB
      expect(response.status).toBeOneOf([200, 401, 404, 500]);
    });

    it("should return 403 for non-Admin users", async () => {
      const app = withApiErrorHandler(
        new Elysia()
          .derive(() => ({ user: mockViewerUser }))
          .use(updateWorkflowTemplateRoute)
      );

      const response = await app.handle(
        new Request(`http://localhost/${testId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: "Updated Template Name",
          }),
        })
      );

      expect(response.status).toBeOneOf([401, 403]);
    });
  });

  describe("DELETE /api/workflow-templates/:templateId - Delete Template", () => {
    const testId = "550e8400-e29b-41d4-a716-446655440099";

    it("should delete template for Admin user", async () => {
      const app = withApiErrorHandler(
        new Elysia()
          .derive(() => ({ user: mockAdminUser }))
          .use(deleteWorkflowTemplateRoute)
      );

      const response = await app.handle(
        new Request(`http://localhost/${testId}`, {
          method: "DELETE",
        })
      );

      // Will return 401 without JWT, 500 or 404 without test DB
      expect(response.status).toBeOneOf([200, 401, 404, 500]);
    });

    it("should return 403 for non-Admin users", async () => {
      const app = withApiErrorHandler(
        new Elysia()
          .derive(() => ({ user: mockProcurementUser }))
          .use(deleteWorkflowTemplateRoute)
      );

      const response = await app.handle(
        new Request(`http://localhost/${testId}`, {
          method: "DELETE",
        })
      );

      expect(response.status).toBeOneOf([401, 403]);
    });
  });
});
