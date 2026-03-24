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

/**
 * Logging configuration
 * Enable verbose auth logs only in development or when AUTH_DEBUG is set
 */
const AUTH_DEBUG = process.env.AUTH_DEBUG === "true" || process.env.NODE_ENV === "development";
const LOG_LEVEL = process.env.LOG_LEVEL || "error"; // error, warn, info, debug

/**
 * Structured logger for auth middleware
 * Only logs based on environment and log level
 */
const authLogger = {
  debug: (...args: any[]) => {
    if (AUTH_DEBUG && (LOG_LEVEL === "debug")) {
      console.log("[AUTH DEBUG]", ...args);
    }
  },
  info: (...args: any[]) => {
    if (AUTH_DEBUG && ["debug", "info"].includes(LOG_LEVEL)) {
      console.log("[AUTH INFO]", ...args);
    }
  },
  warn: (...args: any[]) => {
    if (["debug", "info", "warn"].includes(LOG_LEVEL)) {
      console.warn("[AUTH WARN]", ...args);
    }
  },
  error: (...args: any[]) => {
    // Always log errors
    console.error("[AUTH ERROR]", ...args);
  },
};

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
  async ({ headers, set }) => {
    authLogger.debug("Starting authentication...");

    const token = extractBearerToken(headers.authorization);
    authLogger.debug("Token extracted:", token ? "present" : "missing");

    if (!token) {
      authLogger.warn("Authentication failed: Missing token");
      set.status = 401;
      throw new Error(
        JSON.stringify({
          error: {
            code: "MISSING_TOKEN",
            message: "Missing or invalid authorization token",
            timestamp: new Date().toISOString(),
          },
        })
      );
    }

    // STEP 1: Verify JWT locally (fast, no API call)
    authLogger.debug("Verifying JWT locally...");
    let jwtPayload;
    try {
      jwtPayload = await verifyJWT(token);
    } catch (error) {
      if (error instanceof JWTVerificationError) {
        authLogger.warn(`Authentication failed: ${error.code} -`, error.message);
        set.status = 401;
        throw new Error(
          JSON.stringify({
            error: {
              code: error.code,
              message: error.message,
              timestamp: new Date().toISOString(),
            },
          })
        );
      }
      // Unknown error
      authLogger.error("Authentication failed: JWT verification error -", error);
      set.status = 401;
      throw new Error(
        JSON.stringify({
          error: {
            code: "INVALID_TOKEN",
            message: "JWT verification failed",
            timestamp: new Date().toISOString(),
          },
        })
      );
    }

    const userId = jwtPayload.sub;
    authLogger.debug("JWT verified:", { userId });

    // STEP 2: Check cache (L1 memory, L2 Redis)
    authLogger.debug("Checking auth cache...");
    const cached = await authCache.get(userId);
    
    if (cached) {
      // FAST PATH: Cache hit (~0.2ms total)
      authLogger.debug("Cache hit - returning cached user");
      
      // Verify user is still active
      if (!cached.isActive) {
        authLogger.warn("Authentication failed: Cached user deactivated -", userId);
        set.status = 401;
        throw new Error(
          JSON.stringify({
            error: {
              code: "USER_DEACTIVATED",
              message: "Your user has been deactivated, please contact your company's admin",
              timestamp: new Date().toISOString(),
            },
          })
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

    // Extract role and tenant_id from JWT
    const role = extractRoleFromMetadata(jwtPayload.user_metadata);
    const tenantId: string | null =
      (jwtPayload.user_metadata?.tenant_id as string | null) ?? null;

    if (!tenantId) {
      authLogger.error("Authentication failed: Missing tenant ID for user", userId);
      set.status = 401;
      throw new Error(
        JSON.stringify({
          error: {
            code: "MISSING_TENANT",
            message: "User is not associated with a tenant",
            timestamp: new Date().toISOString(),
          },
        })
      );
    }

    // Validate with Supabase (ensures token isn't revoked)
    const {
      data: { user: supabaseUser },
      error: supabaseError,
    } = await supabaseAdmin.auth.getUser(token);

    if (supabaseError || !supabaseUser) {
      authLogger.error("Authentication failed: Supabase validation failed -", supabaseError?.message);
      set.status = 401;
      throw new Error(
        JSON.stringify({
          error: {
            code: "INVALID_TOKEN",
            message: supabaseError?.message || "Token validation failed",
            timestamp: new Date().toISOString(),
          },
        })
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
      .where(and(
        eq(users.id, userId),
        eq(users.tenantId, tenantId)
      ))
      .limit(1);

    if (!userRecord) {
      authLogger.error("Authentication failed: User not found in database -", userId);
      set.status = 401;
      throw new Error(
        JSON.stringify({
          error: {
            code: "USER_NOT_FOUND",
            message: "User not found",
            timestamp: new Date().toISOString(),
          },
        })
      );
    }

    if (!userRecord.isActive) {
      authLogger.warn("Authentication failed: User deactivated -", userId);
      
      // Query for active admin in same tenant
      const [adminUser] = await db
        .select({ fullName: users.fullName, email: users.email })
        .from(users)
        .where(and(
          eq(users.tenantId, tenantId),
          eq(users.role, "admin"),
          eq(users.isActive, true)
        ))
        .limit(1);
      
      const adminInfo = adminUser 
        ? `${adminUser.fullName}\n${adminUser.email}`
        : "your company's admin";
      
      set.status = 401;
      throw new Error(
        JSON.stringify({
          error: {
            code: "USER_DEACTIVATED",
            message: `Your user has been deactivated, please contact your company's admin:\n${adminInfo}`,
            timestamp: new Date().toISOString(),
          },
        })
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
  return new Elysia({ name: "require-role" })
    .use(authenticate)
    // First, validate the role
    .onBeforeHandle(({ user, set }: any) => {
      // Null check for user
      if (!user?.role || !allowedRoles.includes(user.role)) {
        set.status = 403;
        throw new Error(
          JSON.stringify({
            error: {
              code: "FORBIDDEN",
              message: `Access denied. Required role(s): ${allowedRoles.join(", ")}. Your role: ${user?.role || "unknown"}`,
              timestamp: new Date().toISOString(),
            },
          })
        );
      }
    })
    // Then, explicitly pass user context forward using derive
    .derive({ as: "scoped" }, ({ user }: any) => {
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
    // First, validate the permission
    .onBeforeHandle(({ user, set }: any) => {
      if (!user?.role || !checkPermission(user.role, permission)) {
        set.status = 403;
        throw new Error(
          JSON.stringify({
            error: {
              code: "FORBIDDEN",
              message: `Access denied. Required permission: ${permission}. Your role (${user?.role || "unknown"}) does not have this permission.`,
              timestamp: new Date().toISOString(),
            },
          })
        );
      }
    })
    // Then, explicitly pass user context forward using derive
    .derive({ as: "scoped" }, ({ user }: any) => {
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
