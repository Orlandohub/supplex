import { describe, it, expect } from "vitest";
import {
  PermissionAction,
  PERMISSION_MATRIX,
  hasPermission,
  canManageUsers,
  canEditSupplier,
  canCreateEvaluation,
  canManageCAPA,
  canAccessSettings,
  canUploadDocuments,
  getRolePermissions,
  hasAnyPermission,
  hasAllPermissions,
} from "../permissions";
import { UserRole } from "../user";

describe("Permission System", () => {
  describe("PERMISSION_MATRIX", () => {
    it("should define permissions for all user roles", () => {
      expect(PERMISSION_MATRIX[UserRole.ADMIN]).toBeDefined();
      expect(PERMISSION_MATRIX[UserRole.PROCUREMENT_MANAGER]).toBeDefined();
      expect(PERMISSION_MATRIX[UserRole.QUALITY_MANAGER]).toBeDefined();
      expect(PERMISSION_MATRIX[UserRole.VIEWER]).toBeDefined();
    });

    it("admin should have all permissions", () => {
      const adminPermissions = PERMISSION_MATRIX[UserRole.ADMIN];
      expect(adminPermissions).toContain(PermissionAction.MANAGE_USERS);
      expect(adminPermissions).toContain(PermissionAction.EDIT_SUPPLIERS);
      expect(adminPermissions).toContain(PermissionAction.CREATE_EVALUATIONS);
      expect(adminPermissions).toContain(PermissionAction.MANAGE_CAPA);
      expect(adminPermissions).toContain(PermissionAction.ACCESS_SETTINGS);
    });

    it("viewer should only have read permissions", () => {
      const viewerPermissions = PERMISSION_MATRIX[UserRole.VIEWER];
      expect(viewerPermissions).toContain(PermissionAction.VIEW_SUPPLIERS);
      expect(viewerPermissions).toContain(PermissionAction.VIEW_DOCUMENTS);
      expect(viewerPermissions).not.toContain(PermissionAction.EDIT_SUPPLIERS);
      expect(viewerPermissions).not.toContain(
        PermissionAction.UPLOAD_DOCUMENTS
      );
      expect(viewerPermissions).not.toContain(PermissionAction.MANAGE_USERS);
    });
  });

  describe("hasPermission", () => {
    it("should return true when user has permission", () => {
      expect(hasPermission(UserRole.ADMIN, PermissionAction.MANAGE_USERS)).toBe(
        true
      );
      expect(
        hasPermission(
          UserRole.PROCUREMENT_MANAGER,
          PermissionAction.EDIT_SUPPLIERS
        )
      ).toBe(true);
      expect(
        hasPermission(
          UserRole.QUALITY_MANAGER,
          PermissionAction.CREATE_EVALUATIONS
        )
      ).toBe(true);
      expect(
        hasPermission(UserRole.VIEWER, PermissionAction.VIEW_SUPPLIERS)
      ).toBe(true);
    });

    it("should return false when user does not have permission", () => {
      expect(
        hasPermission(UserRole.VIEWER, PermissionAction.EDIT_SUPPLIERS)
      ).toBe(false);
      expect(
        hasPermission(
          UserRole.PROCUREMENT_MANAGER,
          PermissionAction.MANAGE_USERS
        )
      ).toBe(false);
      expect(
        hasPermission(UserRole.QUALITY_MANAGER, PermissionAction.EDIT_SUPPLIERS)
      ).toBe(false);
    });
  });

  describe("canManageUsers", () => {
    it("should return true only for admin", () => {
      expect(canManageUsers(UserRole.ADMIN)).toBe(true);
      expect(canManageUsers(UserRole.PROCUREMENT_MANAGER)).toBe(false);
      expect(canManageUsers(UserRole.QUALITY_MANAGER)).toBe(false);
      expect(canManageUsers(UserRole.VIEWER)).toBe(false);
    });
  });

  describe("canEditSupplier", () => {
    it("should return true for admin and procurement manager", () => {
      expect(canEditSupplier(UserRole.ADMIN)).toBe(true);
      expect(canEditSupplier(UserRole.PROCUREMENT_MANAGER)).toBe(true);
    });

    it("should return false for quality manager and viewer", () => {
      expect(canEditSupplier(UserRole.QUALITY_MANAGER)).toBe(false);
      expect(canEditSupplier(UserRole.VIEWER)).toBe(false);
    });
  });

  describe("canCreateEvaluation", () => {
    it("should return true for admin and quality manager", () => {
      expect(canCreateEvaluation(UserRole.ADMIN)).toBe(true);
      expect(canCreateEvaluation(UserRole.QUALITY_MANAGER)).toBe(true);
    });

    it("should return false for procurement manager and viewer", () => {
      expect(canCreateEvaluation(UserRole.PROCUREMENT_MANAGER)).toBe(false);
      expect(canCreateEvaluation(UserRole.VIEWER)).toBe(false);
    });
  });

  describe("canManageCAPA", () => {
    it("should return true for admin and quality manager", () => {
      expect(canManageCAPA(UserRole.ADMIN)).toBe(true);
      expect(canManageCAPA(UserRole.QUALITY_MANAGER)).toBe(true);
    });

    it("should return false for procurement manager and viewer", () => {
      expect(canManageCAPA(UserRole.PROCUREMENT_MANAGER)).toBe(false);
      expect(canManageCAPA(UserRole.VIEWER)).toBe(false);
    });
  });

  describe("canAccessSettings", () => {
    it("should return true only for admin", () => {
      expect(canAccessSettings(UserRole.ADMIN)).toBe(true);
      expect(canAccessSettings(UserRole.PROCUREMENT_MANAGER)).toBe(false);
      expect(canAccessSettings(UserRole.QUALITY_MANAGER)).toBe(false);
      expect(canAccessSettings(UserRole.VIEWER)).toBe(false);
    });
  });

  describe("canUploadDocuments", () => {
    it("should return true for admin, procurement manager, and quality manager", () => {
      expect(canUploadDocuments(UserRole.ADMIN)).toBe(true);
      expect(canUploadDocuments(UserRole.PROCUREMENT_MANAGER)).toBe(true);
      expect(canUploadDocuments(UserRole.QUALITY_MANAGER)).toBe(true);
    });

    it("should return false for viewer", () => {
      expect(canUploadDocuments(UserRole.VIEWER)).toBe(false);
    });
  });

  describe("getRolePermissions", () => {
    it("should return all permissions for a role", () => {
      const adminPermissions = getRolePermissions(UserRole.ADMIN);
      expect(adminPermissions).toBeInstanceOf(Array);
      expect(adminPermissions.length).toBeGreaterThan(0);
      expect(adminPermissions).toEqual(PERMISSION_MATRIX[UserRole.ADMIN]);
    });
  });

  describe("hasAnyPermission", () => {
    it("should return true if user has at least one permission", () => {
      expect(
        hasAnyPermission(UserRole.VIEWER, [
          PermissionAction.VIEW_SUPPLIERS,
          PermissionAction.EDIT_SUPPLIERS,
        ])
      ).toBe(true);
    });

    it("should return false if user has none of the permissions", () => {
      expect(
        hasAnyPermission(UserRole.VIEWER, [
          PermissionAction.EDIT_SUPPLIERS,
          PermissionAction.MANAGE_USERS,
        ])
      ).toBe(false);
    });
  });

  describe("hasAllPermissions", () => {
    it("should return true if user has all specified permissions", () => {
      expect(
        hasAllPermissions(UserRole.ADMIN, [
          PermissionAction.MANAGE_USERS,
          PermissionAction.EDIT_SUPPLIERS,
          PermissionAction.ACCESS_SETTINGS,
        ])
      ).toBe(true);
    });

    it("should return false if user is missing any permission", () => {
      expect(
        hasAllPermissions(UserRole.PROCUREMENT_MANAGER, [
          PermissionAction.EDIT_SUPPLIERS,
          PermissionAction.MANAGE_USERS, // Procurement manager doesn't have this
        ])
      ).toBe(false);
    });
  });

  describe("Permission Matrix Business Rules", () => {
    it("only admin should be able to manage users", () => {
      expect(PERMISSION_MATRIX[UserRole.ADMIN]).toContain(
        PermissionAction.MANAGE_USERS
      );
      expect(PERMISSION_MATRIX[UserRole.PROCUREMENT_MANAGER]).not.toContain(
        PermissionAction.MANAGE_USERS
      );
      expect(PERMISSION_MATRIX[UserRole.QUALITY_MANAGER]).not.toContain(
        PermissionAction.MANAGE_USERS
      );
      expect(PERMISSION_MATRIX[UserRole.VIEWER]).not.toContain(
        PermissionAction.MANAGE_USERS
      );
    });

    it("procurement manager should edit suppliers but not create evaluations", () => {
      expect(PERMISSION_MATRIX[UserRole.PROCUREMENT_MANAGER]).toContain(
        PermissionAction.EDIT_SUPPLIERS
      );
      expect(PERMISSION_MATRIX[UserRole.PROCUREMENT_MANAGER]).not.toContain(
        PermissionAction.CREATE_EVALUATIONS
      );
    });

    it("quality manager should create evaluations but not edit suppliers", () => {
      expect(PERMISSION_MATRIX[UserRole.QUALITY_MANAGER]).toContain(
        PermissionAction.CREATE_EVALUATIONS
      );
      expect(PERMISSION_MATRIX[UserRole.QUALITY_MANAGER]).not.toContain(
        PermissionAction.EDIT_SUPPLIERS
      );
    });

    it("quality manager should manage CAPA but procurement manager should not", () => {
      expect(PERMISSION_MATRIX[UserRole.QUALITY_MANAGER]).toContain(
        PermissionAction.MANAGE_CAPA
      );
      expect(PERMISSION_MATRIX[UserRole.PROCUREMENT_MANAGER]).not.toContain(
        PermissionAction.MANAGE_CAPA
      );
    });

    it("viewer should have only view permissions, no write permissions", () => {
      const viewerPermissions = PERMISSION_MATRIX[UserRole.VIEWER];
      const viewActions = viewerPermissions.filter((p) =>
        p.startsWith("view_")
      );
      const writeActions = viewerPermissions.filter(
        (p) =>
          p.includes("create_") ||
          p.includes("edit_") ||
          p.includes("delete_") ||
          p.includes("manage_") ||
          p.includes("upload_")
      );

      expect(viewActions.length).toBeGreaterThan(0);
      expect(writeActions.length).toBe(0);
    });
  });
});
