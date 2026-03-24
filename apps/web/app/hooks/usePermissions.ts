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
  canDeleteDocuments,
  canCreateEvaluations,
  canManageCapa,
  canViewAnalytics,
  canCreateSuppliers,
  canDeleteSuppliers,
  isAdmin,
  isViewer,
  isSupplierUser,
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
  canUploadDocument: boolean;
  canDeleteDocument: boolean;

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
  isSupplierUser: boolean;
}

/**
 * Hook to access user permissions
 * Returns an object with boolean flags for all permissions
 *
 * ⚠️ IMPORTANT: For SSR routes (loaders/components), prefer using permissions
 * from the parent _app loader to avoid flash of unauthorized content (FOUC).
 * 
 * This hook is best for:
 * - Client-side only logic (event handlers, effects)
 * - Non-SSR components (modals, dialogs)
 * - Gradual migration from old pattern
 *
 * @example SSR-First Pattern (Recommended):
 * ```tsx
 * // In your component
 * const appData = useRouteLoaderData<AppLoaderData>("routes/_app");
 * const permissions = appData?.permissions;
 * 
 * return (
 *   <>
 *     {permissions?.canEditSupplier && <EditButton />}
 *   </>
 * );
 * ```
 *
 * @example Client-Side Only (This Hook):
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
    canUploadDocument: canUploadDocuments(userContext),
    canDeleteDocument: canDeleteDocuments(userContext),

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
    isSupplierUser: isSupplierUser(userContext),
  };
}
