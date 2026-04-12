import { describe, it, expect } from "vitest";
import {
  createUserMetadata,
  createUserAuthMetadata,
  createUserProfileMetadata,
  extractRoleFromMetadata,
  isValidRole,
  shouldBeInitialAdmin,
  getDefaultRole,
  type UserMetadata,
  type UserAuthMetadata,
  type UserProfileMetadata,
} from "../user-helpers";
import { UserRole } from "../user";

describe("User Helpers", () => {
  describe("createUserAuthMetadata", () => {
    it("should create correct auth metadata shape", () => {
      const metadata = createUserAuthMetadata(UserRole.ADMIN, "tenant-123");

      expect(metadata).toEqual({
        role: UserRole.ADMIN,
        tenant_id: "tenant-123",
      });
    });

    it("should produce correct shape for all valid roles", () => {
      const roles = [
        UserRole.ADMIN,
        UserRole.PROCUREMENT_MANAGER,
        UserRole.QUALITY_MANAGER,
        UserRole.VIEWER,
        UserRole.SUPPLIER_USER,
      ];

      roles.forEach((role) => {
        const metadata = createUserAuthMetadata(role, "tenant-abc");
        expect(metadata).toEqual({ role, tenant_id: "tenant-abc" });
      });
    });
  });

  describe("createUserProfileMetadata", () => {
    it("should create correct profile metadata shape", () => {
      const metadata = createUserProfileMetadata("John Doe");

      expect(metadata).toEqual({
        full_name: "John Doe",
      });
    });
  });

  describe("createUserMetadata (deprecated)", () => {
    it("should still create combined metadata for backward compat", () => {
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
  });

  describe("extractRoleFromMetadata", () => {
    it("should extract valid role from metadata", () => {
      const metadata = { role: UserRole.ADMIN, tenant_id: "tenant-123" };
      expect(extractRoleFromMetadata(metadata)).toBe(UserRole.ADMIN);
    });

    it("should throw on undefined metadata", () => {
      expect(() => extractRoleFromMetadata(undefined)).toThrow(
        /Missing role in auth metadata/
      );
    });

    it("should throw on null metadata", () => {
      expect(() =>
        extractRoleFromMetadata(null as unknown as Record<string, any>)
      ).toThrow(/Missing role in auth metadata/);
    });

    it("should throw on empty object", () => {
      expect(() => extractRoleFromMetadata({})).toThrow(
        /Missing role in auth metadata/
      );
    });

    it("should throw on invalid role string", () => {
      expect(() =>
        extractRoleFromMetadata({ role: "super_admin" })
      ).toThrow(/Invalid role "super_admin"/);
    });

    it("should return correct role for all valid UserRole values", () => {
      const roles = [
        UserRole.ADMIN,
        UserRole.PROCUREMENT_MANAGER,
        UserRole.QUALITY_MANAGER,
        UserRole.VIEWER,
        UserRole.SUPPLIER_USER,
      ];

      roles.forEach((testRole) => {
        expect(extractRoleFromMetadata({ role: testRole })).toBe(testRole);
      });
    });
  });

  describe("isValidRole", () => {
    it("should return true for valid roles", () => {
      expect(isValidRole(UserRole.ADMIN)).toBe(true);
      expect(isValidRole(UserRole.PROCUREMENT_MANAGER)).toBe(true);
      expect(isValidRole(UserRole.QUALITY_MANAGER)).toBe(true);
      expect(isValidRole(UserRole.VIEWER)).toBe(true);
      expect(isValidRole(UserRole.SUPPLIER_USER)).toBe(true);
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
      expect(getDefaultRole(true)).toBe(UserRole.ADMIN);
    });

    it("should return VIEWER for non-first user", () => {
      expect(getDefaultRole(false)).toBe(UserRole.VIEWER);
    });
  });

  describe("UserAuthMetadata type", () => {
    it("should have correct structure", () => {
      const metadata: UserAuthMetadata = {
        role: UserRole.ADMIN,
        tenant_id: "tenant-123",
      };

      expect(metadata).toHaveProperty("role");
      expect(metadata).toHaveProperty("tenant_id");
      expect(metadata).not.toHaveProperty("full_name");
    });
  });

  describe("UserProfileMetadata type", () => {
    it("should have correct structure", () => {
      const metadata: UserProfileMetadata = {
        full_name: "John Doe",
      };

      expect(metadata).toHaveProperty("full_name");
      expect(metadata).not.toHaveProperty("role");
      expect(metadata).not.toHaveProperty("tenant_id");
    });
  });

  describe("UserMetadata type (deprecated)", () => {
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
