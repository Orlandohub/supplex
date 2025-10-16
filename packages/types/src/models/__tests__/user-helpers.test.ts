import { describe, it, expect } from "vitest";
import {
  createUserMetadata,
  extractRoleFromMetadata,
  isValidRole,
  shouldBeInitialAdmin,
  getDefaultRole,
  type UserMetadata,
} from "../user-helpers";
import { UserRole } from "../user";

describe("User Helpers", () => {
  describe("createUserMetadata", () => {
    it("should create valid user metadata structure", () => {
      const metadata = createUserMetadata(
        UserRole.ADMIN,
        "tenant-123",
        "John Doe"
      );

      expect(metadata).toEqual({
        role: UserRole.ADMIN,
        tenant_id: "tenant-123",
        full_name: "John Doe",
      });
    });

    it("should create metadata for all role types", () => {
      const roles = [
        UserRole.ADMIN,
        UserRole.PROCUREMENT_MANAGER,
        UserRole.QUALITY_MANAGER,
        UserRole.VIEWER,
      ];

      roles.forEach((role) => {
        const metadata = createUserMetadata(role, "tenant-123", "Test User");
        expect(metadata.role).toBe(role);
      });
    });
  });

  describe("extractRoleFromMetadata", () => {
    it("should extract valid role from metadata", () => {
      const metadata = {
        role: UserRole.ADMIN,
        tenant_id: "tenant-123",
        full_name: "John Doe",
      };

      const role = extractRoleFromMetadata(metadata);
      expect(role).toBe(UserRole.ADMIN);
    });

    it("should return VIEWER for undefined metadata", () => {
      const role = extractRoleFromMetadata(undefined);
      expect(role).toBe(UserRole.VIEWER);
    });

    it("should return VIEWER for metadata without role", () => {
      const metadata = {
        tenant_id: "tenant-123",
        full_name: "John Doe",
      };

      const role = extractRoleFromMetadata(metadata);
      expect(role).toBe(UserRole.VIEWER);
    });

    it("should return VIEWER for invalid role", () => {
      const metadata = {
        role: "invalid_role",
        tenant_id: "tenant-123",
        full_name: "John Doe",
      };

      const role = extractRoleFromMetadata(metadata);
      expect(role).toBe(UserRole.VIEWER);
    });

    it("should handle all valid roles", () => {
      const roles = [
        UserRole.ADMIN,
        UserRole.PROCUREMENT_MANAGER,
        UserRole.QUALITY_MANAGER,
        UserRole.VIEWER,
      ];

      roles.forEach((testRole) => {
        const metadata = { role: testRole };
        const extractedRole = extractRoleFromMetadata(metadata);
        expect(extractedRole).toBe(testRole);
      });
    });
  });

  describe("isValidRole", () => {
    it("should return true for valid roles", () => {
      expect(isValidRole(UserRole.ADMIN)).toBe(true);
      expect(isValidRole(UserRole.PROCUREMENT_MANAGER)).toBe(true);
      expect(isValidRole(UserRole.QUALITY_MANAGER)).toBe(true);
      expect(isValidRole(UserRole.VIEWER)).toBe(true);
    });

    it("should return false for invalid roles", () => {
      expect(isValidRole("invalid_role")).toBe(false);
      expect(isValidRole("super_admin")).toBe(false);
      expect(isValidRole("")).toBe(false);
    });
  });

  describe("shouldBeInitialAdmin", () => {
    it("should return true for first user", () => {
      expect(shouldBeInitialAdmin(true)).toBe(true);
    });

    it("should return false for non-first user", () => {
      expect(shouldBeInitialAdmin(false)).toBe(false);
    });
  });

  describe("getDefaultRole", () => {
    it("should return ADMIN for first user", () => {
      const role = getDefaultRole(true);
      expect(role).toBe(UserRole.ADMIN);
    });

    it("should return VIEWER for non-first user", () => {
      const role = getDefaultRole(false);
      expect(role).toBe(UserRole.VIEWER);
    });
  });

  describe("UserMetadata type", () => {
    it("should have correct structure", () => {
      const metadata: UserMetadata = {
        role: UserRole.ADMIN,
        tenant_id: "tenant-123",
        full_name: "John Doe",
      };

      expect(metadata).toHaveProperty("role");
      expect(metadata).toHaveProperty("tenant_id");
      expect(metadata).toHaveProperty("full_name");
    });
  });
});
