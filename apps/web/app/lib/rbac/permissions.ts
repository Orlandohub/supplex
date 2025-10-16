/**
 * Frontend Permission Helpers
 * Client-side permission checking for UI rendering and route protection
 */

import {
  UserRole,
  PermissionAction,
  hasPermission,
  canManageUsers as canManageUsersBase,
  canEditSupplier as canEditSupplierBase,
  canAccessSettings as canAccessSettingsBase,
  canUploadDocuments as canUploadDocumentsBase,
  canCreateEvaluation,
  canManageCAPA,
} from "@supplex/types";

/**
 * User Context (from AuthProvider)
 */
export interface UserContext {
  id: string;
  email: string;
  role: UserRole;
  tenantId: string;
}

/**
 * Check if user can manage other users
 * Only admins can manage users
 */
export function canManageUsers(user: UserContext | null): boolean {
  if (!user) return false;
  return canManageUsersBase(user.role);
}

/**
 * Check if user can edit suppliers
 * Admins and Procurement Managers can edit suppliers
 */
export function canEditSupplier(user: UserContext | null): boolean {
  if (!user) return false;
  return canEditSupplierBase(user.role);
}

/**
 * Check if user can access settings
 * Only admins can access settings
 */
export function canAccessSettings(user: UserContext | null): boolean {
  if (!user) return false;
  return canAccessSettingsBase(user.role);
}

/**
 * Check if user can upload documents
 * Admins, Procurement Managers, and Quality Managers can upload
 */
export function canUploadDocuments(user: UserContext | null): boolean {
  if (!user) return false;
  return canUploadDocumentsBase(user.role);
}

/**
 * Check if user can create evaluations
 * Admins and Quality Managers can create evaluations
 */
export function canCreateEvaluations(user: UserContext | null): boolean {
  if (!user) return false;
  return canCreateEvaluation(user.role);
}

/**
 * Check if user can manage CAPA
 * Admins and Quality Managers can manage CAPA
 */
export function canManageCapa(user: UserContext | null): boolean {
  if (!user) return false;
  return canManageCAPA(user.role);
}

/**
 * Check if user can view analytics
 * All authenticated users can view analytics
 */
export function canViewAnalytics(user: UserContext | null): boolean {
  if (!user) return false;
  return hasPermission(user.role, PermissionAction.VIEW_ANALYTICS);
}

/**
 * Check if user can create suppliers
 * Admins and Procurement Managers can create suppliers
 */
export function canCreateSuppliers(user: UserContext | null): boolean {
  if (!user) return false;
  return hasPermission(user.role, PermissionAction.CREATE_SUPPLIERS);
}

/**
 * Check if user can delete suppliers
 * Admins and Procurement Managers can delete suppliers
 */
export function canDeleteSuppliers(user: UserContext | null): boolean {
  if (!user) return false;
  return hasPermission(user.role, PermissionAction.DELETE_SUPPLIERS);
}

/**
 * Check if user is an admin
 */
export function isAdmin(user: UserContext | null): boolean {
  if (!user) return false;
  return user.role === UserRole.ADMIN;
}

/**
 * Check if user is a viewer (read-only)
 */
export function isViewer(user: UserContext | null): boolean {
  if (!user) return false;
  return user.role === UserRole.VIEWER;
}

/**
 * Get user-friendly role display name
 */
export function getRoleDisplayName(role: UserRole): string {
  const roleNames: Record<UserRole, string> = {
    [UserRole.ADMIN]: "Administrator",
    [UserRole.PROCUREMENT_MANAGER]: "Procurement Manager",
    [UserRole.QUALITY_MANAGER]: "Quality Manager",
    [UserRole.VIEWER]: "Viewer",
  };

  return roleNames[role];
}

/**
 * Get role color for badge display
 */
export function getRoleColor(role: UserRole): string {
  const roleColors: Record<UserRole, string> = {
    [UserRole.ADMIN]: "red",
    [UserRole.PROCUREMENT_MANAGER]: "blue",
    [UserRole.QUALITY_MANAGER]: "green",
    [UserRole.VIEWER]: "gray",
  };

  return roleColors[role];
}
