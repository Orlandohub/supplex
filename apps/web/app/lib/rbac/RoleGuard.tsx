/**
 * RoleGuard Component
 * Conditionally renders children based on user role
 */

import type { ReactNode } from "react";
import { useAuth } from "../../hooks/useAuth";
import { UserRole } from "@supplex/types";

export interface RoleGuardProps {
  /**
   * Roles that are allowed to see the content
   */
  allowedRoles: UserRole[];

  /**
   * Content to render if user has permission
   */
  children: ReactNode;

  /**
   * Optional fallback content to render if user lacks permission
   */
  fallback?: ReactNode;
}

/**
 * RoleGuard Component
 * Conditionally renders children based on user role
 *
 * @example
 * ```tsx
 * <RoleGuard allowedRoles={[UserRole.ADMIN, UserRole.PROCUREMENT_MANAGER]}>
 *   <EditSupplierButton />
 * </RoleGuard>
 * ```
 *
 * @example With fallback
 * ```tsx
 * <RoleGuard
 *   allowedRoles={[UserRole.ADMIN]}
 *   fallback={<p>Admin access required</p>}
 * >
 *   <AdminPanel />
 * </RoleGuard>
 * ```
 */
export function RoleGuard({
  allowedRoles,
  children,
  fallback = null,
}: RoleGuardProps) {
  const { user } = useAuth();

  // No user logged in
  if (!user) {
    return <>{fallback}</>;
  }

  // User doesn't have required role
  if (!allowedRoles.includes(user.role)) {
    return <>{fallback}</>;
  }

  // User has required role
  return <>{children}</>;
}

/**
 * Admin-only guard
 * Shorthand for RoleGuard with only admin role
 */
export function AdminOnly({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <RoleGuard allowedRoles={[UserRole.ADMIN]} fallback={fallback}>
      {children}
    </RoleGuard>
  );
}

/**
 * Non-Viewer guard
 * Shows content to all roles except viewers
 */
export function NonViewerOnly({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <RoleGuard
      allowedRoles={[
        UserRole.ADMIN,
        UserRole.PROCUREMENT_MANAGER,
        UserRole.QUALITY_MANAGER,
      ]}
      fallback={fallback}
    >
      {children}
    </RoleGuard>
  );
}
