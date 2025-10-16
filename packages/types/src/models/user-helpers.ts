import { UserRole } from "./user";

/**
 * User Metadata Structure for Supabase Auth
 * This structure is stored in auth.users.user_metadata field
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
 * Helper to create user metadata for Supabase Auth
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
 * Helper to extract user role from Supabase Auth metadata
 */
export function extractRoleFromMetadata(
  metadata: Record<string, any> | undefined
): UserRole {
  if (!metadata || !metadata.role) {
    // Default to viewer if no role is set
    return UserRole.VIEWER;
  }

  // Validate that the role is a valid UserRole
  const role = metadata.role as string;
  if (Object.values(UserRole).includes(role as UserRole)) {
    return role as UserRole;
  }

  // Default to viewer if invalid role
  return UserRole.VIEWER;
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
