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
  const { userRecord } = useAuth();

  // Transform User to UserContext (they have the same shape)
  const userContext = userRecord
    ? {
        id: userRecord.id,
        email: userRecord.email,
        role: userRecord.role,
        tenantId: userRecord.tenantId,
      }
    : null;

  return {
    // User Management
    canManageUsers: canManageUsers(userContext),

    // Supplier Management
    canViewSuppliers: !!userContext, // All authenticated users can view
    canCreateSuppliers: canCreateSuppliers(userContext),
    canEditSupplier: canEditSupplier(userContext),
    canDeleteSuppliers: canDeleteSuppliers(userContext),

    // Document Management
    canUploadDocuments: canUploadDocuments(userContext),

    // Evaluation Management
    canCreateEvaluations: canCreateEvaluations(userContext),

    // CAPA Management
    canManageCapa: canManageCapa(userContext),

    // Analytics
    canViewAnalytics: canViewAnalytics(userContext),

    // Settings
    canAccessSettings: canAccessSettings(userContext),

    // Role Checks
    isAdmin: isAdmin(userContext),
    isViewer: isViewer(userContext),
  };
}
