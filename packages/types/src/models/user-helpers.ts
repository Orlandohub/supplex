import { UserRole } from "./user";

/**
 * Authorization claims stored in Supabase app_metadata (not user-modifiable).
 * Written only via Admin/service_role API.
 */
export interface UserAuthMetadata {
  role: UserRole;
  tenant_id: string;
}

/**
 * Profile data stored in Supabase user_metadata (user-modifiable, non-sensitive).
 */
export interface UserProfileMetadata {
  full_name: string;
}

/**
 * @deprecated Use UserAuthMetadata + UserProfileMetadata instead.
 * Kept temporarily for downstream migration — will be removed in SEC-010.
 */
export interface UserMetadata {
  role: UserRole;
  tenant_id: string;
  full_name: string;
}

/**
 * Extended User with Tenant Information
 * Used in authenticated contexts
 */
export interface AuthenticatedUser {
  id: string;
  tenantId: string;
  email: string;
  fullName: string;
  role: UserRole;
  avatarUrl: string | null;
  isActive: boolean;
  lastLoginAt: Date | null;
  tenant: {
    id: string;
    name: string;
  };
}

/**
 * Create authorization claims for Supabase app_metadata.
 */
export function createUserAuthMetadata(
  role: UserRole,
  tenantId: string
): UserAuthMetadata {
  return {
    role,
    tenant_id: tenantId,
  };
}

/**
 * Create profile data for Supabase user_metadata.
 */
export function createUserProfileMetadata(
  fullName: string
): UserProfileMetadata {
  return {
    full_name: fullName,
  };
}

/**
 * @deprecated Use createUserAuthMetadata + createUserProfileMetadata instead.
 * Kept temporarily for downstream migration — will be removed in SEC-010.
 */
export function createUserMetadata(
  role: UserRole,
  tenantId: string,
  fullName: string
): UserMetadata {
  return {
    role,
    tenant_id: tenantId,
    full_name: fullName,
  };
}

/**
 * Extract user role from Supabase Auth metadata (app_metadata).
 * Throws on missing or invalid role — silent downgrade to VIEWER is a security risk.
 */
export function extractRoleFromMetadata(
  metadata: Record<string, any> | undefined
): UserRole {
  if (!metadata || !metadata.role) {
    throw new Error(
      `Missing role in auth metadata. Got: ${JSON.stringify(metadata ?? null)}`
    );
  }

  const role = metadata.role as string;
  if (Object.values(UserRole).includes(role as UserRole)) {
    return role as UserRole;
  }

  throw new Error(
    `Invalid role "${role}" in auth metadata. Valid roles: ${Object.values(UserRole).join(", ")}`
  );
}

/**
 * Helper to check if a role is valid
 */
export function isValidRole(role: string): role is UserRole {
  return Object.values(UserRole).includes(role as UserRole);
}

/**
 * Helper to determine if this is the first user in a tenant (should be admin)
 */
export function shouldBeInitialAdmin(isFirstUser: boolean): boolean {
  return isFirstUser;
}

/**
 * Helper to get default role for new users
 */
export function getDefaultRole(isFirstUser: boolean): UserRole {
  return isFirstUser ? UserRole.ADMIN : UserRole.VIEWER;
}
