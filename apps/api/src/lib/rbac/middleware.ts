import { Elysia } from "elysia";
import { supabase } from "../supabase";
import {
  UserRole,
  extractRoleFromMetadata,
  hasPermission as checkPermission,
} from "@supplex/types";
import type { PermissionAction } from "@supplex/types";

/**
 * Authenticated User Context
 * Attached to request context after successful authentication
 */
export interface AuthContext {
  user: {
    id: string;
    email: string;
    role: UserRole;
    tenantId: string;
  };
}

/**
 * Extract JWT token from Authorization header
 */
function extractBearerToken(authorization: string | undefined): string | null {
  if (!authorization) {
    return null;
  }

  const parts = authorization.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return null;
  }

  return parts[1];
}

/**
 * Authentication Middleware
 * Validates JWT and extracts user information
 * Attaches user context to request
 */
export const authenticate = new Elysia({ name: "auth" }).derive(
  async ({ headers, set }) => {
    const token = extractBearerToken(headers.authorization);

    if (!token) {
      set.status = 401;
      throw new Error(
        JSON.stringify({
          error: {
            code: "UNAUTHORIZED",
            message: "Missing or invalid authorization token",
            timestamp: new Date().toISOString(),
          },
        })
      );
    }

    // Validate JWT with Supabase
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      set.status = 401;
      throw new Error(
        JSON.stringify({
          error: {
            code: "UNAUTHORIZED",
            message: "Invalid or expired token",
            timestamp: new Date().toISOString(),
          },
        })
      );
    }

    // Extract role and tenant_id from user metadata
    const role = extractRoleFromMetadata(user.user_metadata);
    const tenantId = user.user_metadata?.tenant_id;

    if (!tenantId) {
      set.status = 401;
      throw new Error(
        JSON.stringify({
          error: {
            code: "UNAUTHORIZED",
            message: "User is not associated with a tenant",
            timestamp: new Date().toISOString(),
          },
        })
      );
    }

    // Return authenticated user context
    return {
      user: {
        id: user.id,
        email: user.email || "",
        role,
        tenantId,
      },
    } as AuthContext;
  }
);

/**
 * Role-Based Authorization Middleware Factory
 * Requires user to have one of the specified roles
 *
 * Usage:
 * ```ts
 * app.get('/admin', requireRole([UserRole.ADMIN]), ({ user }) => {
 *   // Only admins can access this route
 * })
 * ```
 */
export function requireRole(allowedRoles: UserRole[]) {
  return new Elysia({ name: "require-role" })
    .use(authenticate)
    .derive(({ user, set }) => {
      if (!allowedRoles.includes(user.role)) {
        set.status = 403;
        throw new Error(
          JSON.stringify({
            error: {
              code: "FORBIDDEN",
              message: `Access denied. Required role(s): ${allowedRoles.join(", ")}. Your role: ${user.role}`,
              timestamp: new Date().toISOString(),
            },
          })
        );
      }

      return { user };
    });
}

/**
 * Permission-Based Authorization Middleware Factory
 * Requires user to have a specific permission
 *
 * Usage:
 * ```ts
 * app.post('/suppliers', requirePermission(PermissionAction.CREATE_SUPPLIERS), ({ user }) => {
 *   // Only users with CREATE_SUPPLIERS permission can access
 * })
 * ```
 */
export function requirePermission(permission: PermissionAction) {
  return new Elysia({ name: "require-permission" })
    .use(authenticate)
    .derive(({ user, set }) => {
      if (!checkPermission(user.role, permission)) {
        set.status = 403;
        throw new Error(
          JSON.stringify({
            error: {
              code: "FORBIDDEN",
              message: `Access denied. Required permission: ${permission}. Your role (${user.role}) does not have this permission.`,
              timestamp: new Date().toISOString(),
            },
          })
        );
      }

      return { user };
    });
}

/**
 * Admin-Only Middleware
 * Shorthand for requireRole([UserRole.ADMIN])
 */
export const requireAdmin = requireRole([UserRole.ADMIN]);

/**
 * Helper to check if user has permission
 * Can be used within route handlers for conditional logic
 */
export function hasPermission(
  user: AuthContext["user"],
  permission: PermissionAction
): boolean {
  return checkPermission(user.role, permission);
}

/**
 * Error Response Formatter
 * Standardizes error responses across the API
 */
export function createErrorResponse(
  code: string,
  message: string,
  statusCode: number = 500
): {
  error: { code: string; message: string; timestamp: string };
  statusCode: number;
} {
  return {
    error: {
      code,
      message,
      timestamp: new Date().toISOString(),
    },
    statusCode,
  };
}
