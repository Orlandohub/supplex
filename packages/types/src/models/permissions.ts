import { z } from "zod";
import { UserRole } from "./user";

/**
 * Permission Actions
 * Defines all possible actions in the system that require authorization
 */
export enum PermissionAction {
  // User Management
  MANAGE_USERS = "manage_users",
  INVITE_USERS = "invite_users",
  CHANGE_USER_ROLES = "change_user_roles",
  DEACTIVATE_USERS = "deactivate_users",

  // Supplier Management
  VIEW_SUPPLIERS = "view_suppliers",
  CREATE_SUPPLIERS = "create_suppliers",
  EDIT_SUPPLIERS = "edit_suppliers",
  DELETE_SUPPLIERS = "delete_suppliers",

  // Document Management
  VIEW_DOCUMENTS = "view_documents",
  UPLOAD_DOCUMENTS = "upload_documents",
  DELETE_DOCUMENTS = "delete_documents",

  // Qualification Management
  VIEW_QUALIFICATIONS = "view_qualifications",
  CREATE_QUALIFICATIONS = "create_qualifications",
  APPROVE_QUALIFICATIONS = "approve_qualifications",

  // Evaluation Management
  VIEW_EVALUATIONS = "view_evaluations",
  CREATE_EVALUATIONS = "create_evaluations",
  SUBMIT_EVALUATIONS = "submit_evaluations",

  // Complaint & CAPA Management
  VIEW_COMPLAINTS = "view_complaints",
  FILE_COMPLAINTS = "file_complaints",
  MANAGE_CAPA = "manage_capa",

  // Analytics & Reporting
  VIEW_ANALYTICS = "view_analytics",
  EXPORT_REPORTS = "export_reports",

  // Settings & Configuration
  ACCESS_SETTINGS = "access_settings",
  MANAGE_TENANT_SETTINGS = "manage_tenant_settings",
}

/**
 * Permission Matrix
 * Maps roles to their allowed actions
 */
export const PERMISSION_MATRIX: Record<UserRole, PermissionAction[]> = {
  [UserRole.ADMIN]: [
    // Full access to everything
    PermissionAction.MANAGE_USERS,
    PermissionAction.INVITE_USERS,
    PermissionAction.CHANGE_USER_ROLES,
    PermissionAction.DEACTIVATE_USERS,
    PermissionAction.VIEW_SUPPLIERS,
    PermissionAction.CREATE_SUPPLIERS,
    PermissionAction.EDIT_SUPPLIERS,
    PermissionAction.DELETE_SUPPLIERS,
    PermissionAction.VIEW_DOCUMENTS,
    PermissionAction.UPLOAD_DOCUMENTS,
    PermissionAction.DELETE_DOCUMENTS,
    PermissionAction.VIEW_QUALIFICATIONS,
    PermissionAction.CREATE_QUALIFICATIONS,
    PermissionAction.APPROVE_QUALIFICATIONS,
    PermissionAction.VIEW_EVALUATIONS,
    PermissionAction.CREATE_EVALUATIONS,
    PermissionAction.SUBMIT_EVALUATIONS,
    PermissionAction.VIEW_COMPLAINTS,
    PermissionAction.FILE_COMPLAINTS,
    PermissionAction.MANAGE_CAPA,
    PermissionAction.VIEW_ANALYTICS,
    PermissionAction.EXPORT_REPORTS,
    PermissionAction.ACCESS_SETTINGS,
    PermissionAction.MANAGE_TENANT_SETTINGS,
  ],
  [UserRole.PROCUREMENT_MANAGER]: [
    // Supplier and qualification management, no user management
    PermissionAction.VIEW_SUPPLIERS,
    PermissionAction.CREATE_SUPPLIERS,
    PermissionAction.EDIT_SUPPLIERS,
    PermissionAction.DELETE_SUPPLIERS,
    PermissionAction.VIEW_DOCUMENTS,
    PermissionAction.UPLOAD_DOCUMENTS,
    PermissionAction.VIEW_QUALIFICATIONS,
    PermissionAction.CREATE_QUALIFICATIONS,
    PermissionAction.VIEW_EVALUATIONS,
    PermissionAction.VIEW_COMPLAINTS,
    PermissionAction.FILE_COMPLAINTS,
    PermissionAction.VIEW_ANALYTICS,
    PermissionAction.EXPORT_REPORTS,
  ],
  [UserRole.QUALITY_MANAGER]: [
    // Evaluation and CAPA management, document uploads, no supplier editing
    PermissionAction.VIEW_SUPPLIERS,
    PermissionAction.VIEW_DOCUMENTS,
    PermissionAction.UPLOAD_DOCUMENTS,
    PermissionAction.VIEW_QUALIFICATIONS,
    PermissionAction.VIEW_EVALUATIONS,
    PermissionAction.CREATE_EVALUATIONS,
    PermissionAction.SUBMIT_EVALUATIONS,
    PermissionAction.VIEW_COMPLAINTS,
    PermissionAction.FILE_COMPLAINTS,
    PermissionAction.MANAGE_CAPA,
    PermissionAction.VIEW_ANALYTICS,
    PermissionAction.EXPORT_REPORTS,
  ],
  [UserRole.VIEWER]: [
    // Read-only access
    PermissionAction.VIEW_SUPPLIERS,
    PermissionAction.VIEW_DOCUMENTS,
    PermissionAction.VIEW_QUALIFICATIONS,
    PermissionAction.VIEW_EVALUATIONS,
    PermissionAction.VIEW_COMPLAINTS,
    PermissionAction.VIEW_ANALYTICS,
  ],
};

/**
 * Permission checking utility functions
 */

/**
 * Check if a user has a specific permission
 */
export function hasPermission(
  userRole: UserRole,
  action: PermissionAction
): boolean {
  const rolePermissions = PERMISSION_MATRIX[userRole];
  return rolePermissions.includes(action);
}

/**
 * Check if a user can manage users (Admin only)
 */
export function canManageUsers(userRole: UserRole): boolean {
  return hasPermission(userRole, PermissionAction.MANAGE_USERS);
}

/**
 * Check if a user can edit suppliers
 */
export function canEditSupplier(userRole: UserRole): boolean {
  return hasPermission(userRole, PermissionAction.EDIT_SUPPLIERS);
}

/**
 * Check if a user can create evaluations
 */
export function canCreateEvaluation(userRole: UserRole): boolean {
  return hasPermission(userRole, PermissionAction.CREATE_EVALUATIONS);
}

/**
 * Check if a user can manage CAPA
 */
export function canManageCAPA(userRole: UserRole): boolean {
  return hasPermission(userRole, PermissionAction.MANAGE_CAPA);
}

/**
 * Check if a user can access settings
 */
export function canAccessSettings(userRole: UserRole): boolean {
  return hasPermission(userRole, PermissionAction.ACCESS_SETTINGS);
}

/**
 * Check if a user can upload documents
 */
export function canUploadDocuments(userRole: UserRole): boolean {
  return hasPermission(userRole, PermissionAction.UPLOAD_DOCUMENTS);
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(userRole: UserRole): PermissionAction[] {
  return PERMISSION_MATRIX[userRole];
}

/**
 * Check if a user has any of the specified permissions (OR logic)
 */
export function hasAnyPermission(
  userRole: UserRole,
  actions: PermissionAction[]
): boolean {
  return actions.some((action) => hasPermission(userRole, action));
}

/**
 * Check if a user has all of the specified permissions (AND logic)
 */
export function hasAllPermissions(
  userRole: UserRole,
  actions: PermissionAction[]
): boolean {
  return actions.every((action) => hasPermission(userRole, action));
}

/**
 * Zod Schemas for validation
 */
export const PermissionActionSchema = z.nativeEnum(PermissionAction);

export const PermissionCheckSchema = z.object({
  role: z.nativeEnum(UserRole),
  action: PermissionActionSchema,
});

export type PermissionCheck = z.infer<typeof PermissionCheckSchema>;
