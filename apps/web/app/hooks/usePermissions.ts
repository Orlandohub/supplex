/**
 * usePermissions Hook
 * Provides easy access to permission checks based on the current user
 */

import { useAuth } from "./useAuth";
import {
  canManageUsers,
  canEditSupplier,
  canAccessSettings,
  canUploadDocuments,
  canCreateEvaluations,
  canManageCapa,
  canViewAnalytics,
  canCreateSuppliers,
  canDeleteSuppliers,
  isAdmin,
  isViewer,
} from "../lib/rbac/permissions";

export interface Permissions {
  // User Management
  canManageUsers: boolean;

  // Supplier Management
  canViewSuppliers: boolean;
  canCreateSuppliers: boolean;
  canEditSupplier: boolean;
  canDeleteSuppliers: boolean;

  // Document Management
  canUploadDocuments: boolean;

  // Evaluation Management
  canCreateEvaluations: boolean;

  // CAPA Management
  canManageCapa: boolean;

  // Analytics
  canViewAnalytics: boolean;

  // Settings
  canAccessSettings: boolean;

  // Role Checks
  isAdmin: boolean;
  isViewer: boolean;
}

/**
 * Hook to access user permissions
 * Returns an object with boolean flags for all permissions
 *
 * @example
 * ```tsx
 * const permissions = usePermissions();
 *
 * return (
 *   <>
 *     {permissions.canEditSupplier && <EditButton />}
 *     {permissions.canManageUsers && <UserManagementLink />}
 *   </>
 * );
 * ```
 */
export function usePermissions(): Permissions {
  const { user } = useAuth();

  return {
    // User Management
    canManageUsers: canManageUsers(user),

    // Supplier Management
    canViewSuppliers: !!user, // All authenticated users can view
    canCreateSuppliers: canCreateSuppliers(user),
    canEditSupplier: canEditSupplier(user),
    canDeleteSuppliers: canDeleteSuppliers(user),

    // Document Management
    canUploadDocuments: canUploadDocuments(user),

    // Evaluation Management
    canCreateEvaluations: canCreateEvaluations(user),

    // CAPA Management
    canManageCapa: canManageCapa(user),

    // Analytics
    canViewAnalytics: canViewAnalytics(user),

    // Settings
    canAccessSettings: canAccessSettings(user),

    // Role Checks
    isAdmin: isAdmin(user),
    isViewer: isViewer(user),
  };
}
