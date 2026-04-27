import { Elysia } from "elysia";
import { supabaseAdmin } from "../supabase";
import {
  UserRole,
  extractRoleFromMetadata,
  hasPermission as checkPermission,
} from "@supplex/types";
import type { PermissionAction } from "@supplex/types";
import { db } from "../db";
import { users } from "@supplex/db";
import { eq, and } from "drizzle-orm";
import { verifyJWT, JWTVerificationError } from "../jwt-verifier";
import { authCache } from "../auth-cache";
import type { CachedUserAuth } from "../auth-cache";
import logger, { getClientIp } from "../logger";
import { Errors } from "../errors";

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
    fullName: string;
  };
}

const authLogger = logger.child({ module: "auth" });

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

  return parts[1] || null;
}

/**
 * Authentication Middleware (Optimized with Cache)
 *
 * Performance-optimized authentication using JWT local verification + two-tier caching.
 *
 * Fast Path (99% of requests):
 * 1. Verify JWT locally (~0.1ms)
 * 2. Check L1 cache (memory) → return user (~0.1ms)
 * Total: ~0.2ms ✅ (vs 100ms before)
 *
 * Slow Path (1% of requests - cache miss every 5 min):
 * 1. Verify JWT locally (~0.1ms)
 * 2. Check L2 cache (Redis) → return user (~5ms) OR
 * 3. Call Supabase API (~50ms)
 * 4. Query database (~20ms)
 * 5. Cache result (~5ms)
 * Total: ~80ms (only once per 5 min per user)
 *
 * Security:
 * - JWT signature verified locally (same security as Supabase API)
 * - User deactivation propagates within 5 minutes
 * - Can be invalidated immediately via authCache.invalidate()
 *
 * Pattern from: https://elysiajs.com/blog/elysia-supabase
 * Optimized with: Auth0, Stripe, GitHub caching patterns
 */
export const authenticate = new Elysia({ name: "auth" }).derive(
  { as: "global" },
  async ({ headers, request }) => {
    authLogger.debug("Starting authentication...");

    const token = extractBearerToken(headers.authorization);
    authLogger.debug({ tokenPresent: !!token }, "Token extraction complete");

    if (!token) {
      authLogger.warn(
        {
          event: "authn_denied",
          reason: "MISSING_TOKEN",
          route: request.url,
          method: request.method,
          clientIp: getClientIp(request),
        },
        "Authentication failed: Missing token"
      );
      throw Errors.unauthorized(
        "Missing or invalid authorization token",
        "MISSING_TOKEN"
      );
    }

    // STEP 1: Verify JWT locally (fast, no API call)
    authLogger.debug("Verifying JWT locally...");
    let jwtPayload;
    try {
      jwtPayload = await verifyJWT(token);
    } catch (error) {
      if (error instanceof JWTVerificationError) {
        authLogger.warn(
          {
            event: "authn_denied",
            reason: error.code,
            route: request.url,
            method: request.method,
            clientIp: getClientIp(request),
          },
          `Authentication failed: ${error.code}`
        );
        throw Errors.unauthorized(error.message, error.code);
      }
      authLogger.error(
        {
          err: error,
          event: "authn_denied",
          reason: "INVALID_TOKEN",
          route: request.url,
          method: request.method,
          clientIp: getClientIp(request),
        },
        "Authentication failed: JWT verification error"
      );
      throw Errors.unauthorized("JWT verification failed", "INVALID_TOKEN");
    }

    const userId = jwtPayload.sub;
    authLogger.debug({ userId }, "JWT verified");

    // STEP 2: Check cache (L1 memory, L2 Redis)
    authLogger.debug("Checking auth cache...");
    const cached = await authCache.get(userId);

    if (cached) {
      // FAST PATH: Cache hit (~0.2ms total)
      authLogger.debug("Cache hit - returning cached user");

      // Verify user is still active
      if (!cached.isActive) {
        authLogger.warn(
          {
            event: "authn_denied",
            reason: "USER_DEACTIVATED",
            userId,
            route: request.url,
            method: request.method,
            clientIp: getClientIp(request),
          },
          "Authentication failed: Cached user deactivated"
        );
        throw Errors.forbidden(
          "Your user has been deactivated, please contact your company's admin",
          "USER_DEACTIVATED"
        );
      }

      return {
        user: {
          id: cached.userId,
          email: cached.email,
          role: cached.role,
          tenantId: cached.tenantId,
          fullName: cached.fullName,
        },
      };
    }

    // SLOW PATH: Cache miss - validate with Supabase + DB (~80ms total, once per 5 min)
    authLogger.debug("Cache miss - validating with Supabase + database...");

    // Extract role from app_metadata (authorization claims)
    let role;
    try {
      role = extractRoleFromMetadata(jwtPayload.app_metadata);
    } catch (error) {
      const msg =
        error instanceof Error
          ? error.message
          : "Unknown role extraction error";
      authLogger.error(
        {
          err: error,
          userId,
          route: request.url,
          method: request.method,
          clientIp: getClientIp(request),
        },
        "Authentication failed: INVALID_ROLE"
      );
      throw Errors.unauthorized(msg, "INVALID_ROLE");
    }

    const tenantId: string | null =
      (jwtPayload.app_metadata?.tenant_id as string | null) ?? null;

    if (!tenantId) {
      authLogger.error(
        {
          userId,
          route: request.url,
          method: request.method,
          clientIp: getClientIp(request),
        },
        "Authentication failed: Missing tenant ID"
      );
      throw Errors.unauthorized(
        "User is not associated with a tenant",
        "MISSING_TENANT"
      );
    }

    // Validate with Supabase (ensures token isn't revoked)
    const {
      data: { user: supabaseUser },
      error: supabaseError,
    } = await supabaseAdmin.auth.getUser(token);

    if (supabaseError || !supabaseUser) {
      authLogger.error(
        {
          err: supabaseError,
          userId,
          route: request.url,
          method: request.method,
          clientIp: getClientIp(request),
        },
        "Authentication failed: Supabase validation failed"
      );
      throw Errors.unauthorized(
        supabaseError?.message || "Token validation failed",
        "INVALID_TOKEN"
      );
    }

    // Check user status in database
    const [userRecord] = await db
      .select({
        isActive: users.isActive,
        fullName: users.fullName,
        email: users.email,
        tenantId: users.tenantId,
      })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)))
      .limit(1);

    if (!userRecord) {
      authLogger.error(
        {
          userId,
          tenantId,
          route: request.url,
          method: request.method,
          clientIp: getClientIp(request),
        },
        "Authentication failed: User not found in database"
      );
      throw Errors.unauthorized("User not found in system", "USER_NOT_FOUND");
    }

    if (!userRecord.isActive) {
      authLogger.warn(
        {
          event: "authn_denied",
          reason: "USER_DEACTIVATED",
          userId,
          tenantId,
          route: request.url,
          method: request.method,
          clientIp: getClientIp(request),
        },
        "Authentication failed: User deactivated"
      );

      // Query for active admin in same tenant
      const [adminUser] = await db
        .select({ fullName: users.fullName, email: users.email })
        .from(users)
        .where(
          and(
            eq(users.tenantId, tenantId),
            eq(users.role, "admin"),
            eq(users.isActive, true)
          )
        )
        .limit(1);

      const adminInfo = adminUser
        ? `${adminUser.fullName}\n${adminUser.email}`
        : "your company's admin";

      throw Errors.forbidden(
        `Your user has been deactivated, please contact your company's admin:\n${adminInfo}`,
        "USER_DEACTIVATED"
      );
    }

    // Cache the validated user data
    const cacheData: CachedUserAuth = {
      userId,
      email: userRecord.email,
      role,
      tenantId,
      isActive: userRecord.isActive,
      fullName: userRecord.fullName,
      cachedAt: Date.now(),
    };

    await authCache.set(userId, cacheData);
    authLogger.debug("User cached successfully");

    // Return authenticated user context
    authLogger.debug("Authentication successful (cache populated)");
    return {
      user: {
        id: userId,
        email: userRecord.email,
        role,
        tenantId,
        fullName: userRecord.fullName,
      },
    };
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
  return (
    new Elysia({ name: "require-role" })
      .use(authenticate)
      .onBeforeHandle(({ user, request }) => {
        if (!user?.role || !allowedRoles.includes(user.role)) {
          authLogger.warn(
            {
              event: "authz_denied",
              userId: user?.id,
              userRole: user?.role,
              requiredRoles: allowedRoles,
              route: request.url,
              method: request.method,
              correlationId: request.headers.get("x-correlation-id"),
              clientIp: getClientIp(request),
            },
            "Authorization denied: insufficient role"
          );
          throw Errors.forbidden(
            `Access denied. Required role(s): ${allowedRoles.join(", ")}. Your role: ${user?.role || "unknown"}`
          );
        }
      })
      // Then, explicitly pass user context forward using derive
      .derive({ as: "scoped" }, ({ user }) => {
        return { user };
      })
  );
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
  return (
    new Elysia({ name: "require-permission" })
      .use(authenticate)
      .onBeforeHandle(({ user, request }) => {
        if (!user?.role || !checkPermission(user.role, permission)) {
          authLogger.warn(
            {
              event: "authz_denied",
              userId: user?.id,
              userRole: user?.role,
              requiredPermission: permission,
              route: request.url,
              method: request.method,
              correlationId: request.headers.get("x-correlation-id"),
              clientIp: getClientIp(request),
            },
            "Authorization denied: insufficient permission"
          );
          throw Errors.forbidden(
            `Access denied. Required permission: ${permission}. Your role (${user?.role || "unknown"}) does not have this permission.`
          );
        }
      })
      // Then, explicitly pass user context forward using derive
      .derive({ as: "scoped" }, ({ user }) => {
        return { user };
      })
  );
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
