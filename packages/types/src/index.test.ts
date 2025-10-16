import { describe, it, expect } from "vitest";
import { HealthCheckSchema, UserRoleSchema, schemas } from "./index";
import type { HealthCheck, ApiResponse } from "./index";

describe("Shared Types Package", () => {
  describe("HealthCheckSchema", () => {
    it("should validate a valid health check response", () => {
      const validHealthCheck = {
        status: "ok" as const,
        timestamp: new Date().toISOString(),
        version: "1.0.0",
      };

      const result = HealthCheckSchema.safeParse(validHealthCheck);
      expect(result.success).toBe(true);
    });

    it("should reject invalid status", () => {
      const invalidHealthCheck = {
        status: "invalid",
        timestamp: new Date().toISOString(),
      };

      const result = HealthCheckSchema.safeParse(invalidHealthCheck);
      expect(result.success).toBe(false);
    });

    it("should accept health check without version", () => {
      const healthCheck = {
        status: "ok" as const,
        timestamp: new Date().toISOString(),
      };

      const result = HealthCheckSchema.safeParse(healthCheck);
      expect(result.success).toBe(true);
    });
  });

  describe("UserRole", () => {
    it("should validate admin role", () => {
      const result = UserRoleSchema.safeParse("admin");
      expect(result.success).toBe(true);
    });

    it("should validate procurement role", () => {
      const result = UserRoleSchema.safeParse("procurement");
      expect(result.success).toBe(true);
    });

    it("should validate quality role", () => {
      const result = UserRoleSchema.safeParse("quality");
      expect(result.success).toBe(true);
    });

    it("should validate viewer role", () => {
      const result = UserRoleSchema.safeParse("viewer");
      expect(result.success).toBe(true);
    });

    it("should reject invalid role", () => {
      const result = UserRoleSchema.safeParse("invalid_role");
      expect(result.success).toBe(false);
    });
  });

  describe("ApiResponse type", () => {
    it("should allow success response with data", () => {
      const response: ApiResponse<string> = {
        success: true,
        data: "test data",
      };

      expect(response.success).toBe(true);
      expect(response.data).toBe("test data");
    });

    it("should allow error response", () => {
      const response: ApiResponse = {
        success: false,
        error: "Something went wrong",
      };

      expect(response.success).toBe(false);
      expect(response.error).toBe("Something went wrong");
    });
  });

  describe("schemas export", () => {
    it("should export all schemas", () => {
      expect(schemas).toHaveProperty("HealthCheckSchema");
      expect(schemas).toHaveProperty("UserRoleSchema");
    });
  });

  describe("TypeScript type inference", () => {
    it("should infer HealthCheck type from schema", () => {
      const healthCheck: HealthCheck = {
        status: "ok",
        timestamp: "2025-10-13T00:00:00.000Z",
      };

      expect(healthCheck.status).toBe("ok");
    });
  });
});
