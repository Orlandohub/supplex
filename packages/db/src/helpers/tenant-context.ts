/**
 * Tenant Context Helper Functions
 * Enforce tenant isolation in Drizzle queries
 */

import { eq, and, isNull } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

/**
 * Error thrown when tenant context is missing
 */
export class TenantContextError extends Error {
  constructor(message: string = "Tenant context is required but not provided") {
    super(message);
    this.name = "TenantContextError";
  }
}

/**
 * Tenant Context Interface
 * Represents the authenticated user's tenant information
 */
export interface TenantContext {
  tenantId: string; // UUID
  userId?: string; // UUID (optional, for audit trails)
  role?: string; // User role (optional, for authorization)
}

/**
 * Helper function to create a tenant filter condition
 *
 * @param tenantIdColumn - The tenant_id column from your table
 * @param tenantId - The tenant UUID to filter by
 * @returns SQL condition for Drizzle where clause
 *
 * @example
 * ```typescript
 * import { db, suppliers } from "@supplex/db";
 * import { withTenantId } from "@supplex/db/helpers/tenant-context";
 *
 * const results = await db
 *   .select()
 *   .from(suppliers)
 *   .where(withTenantId(suppliers.tenantId, "tenant-uuid-here"));
 * ```
 */
export function withTenantId(tenantIdColumn: PgColumn, tenantId: string): SQL {
  if (!tenantId) {
    throw new TenantContextError("Tenant ID is required");
  }
  return eq(tenantIdColumn, tenantId);
}

/**
 * Helper function to create a tenant filter with soft-delete check
 * Combines tenant isolation with deleted_at IS NULL check
 *
 * @param tenantIdColumn - The tenant_id column from your table
 * @param deletedAtColumn - The deleted_at column from your table
 * @param tenantId - The tenant UUID to filter by
 * @returns Combined SQL condition for Drizzle where clause
 *
 * @example
 * ```typescript
 * import { db, suppliers } from "@supplex/db";
 * import { withTenantIdAndNotDeleted } from "@supplex/db/helpers/tenant-context";
 *
 * const activeSuppliers = await db
 *   .select()
 *   .from(suppliers)
 *   .where(withTenantIdAndNotDeleted(
 *     suppliers.tenantId,
 *     suppliers.deletedAt,
 *     "tenant-uuid-here"
 *   ));
 * ```
 */
export function withTenantIdAndNotDeleted(
  tenantIdColumn: PgColumn,
  deletedAtColumn: PgColumn,
  tenantId: string
): SQL {
  if (!tenantId) {
    throw new TenantContextError("Tenant ID is required");
  }
  // Drizzle's `and()` returns `SQL | undefined` (undefined only when called
  // with zero conditions). We always pass two non-empty conditions, so the
  // result is always defined - assert that invariant rather than using `!`.
  const condition = and(eq(tenantIdColumn, tenantId), isNull(deletedAtColumn));
  if (!condition) {
    throw new TenantContextError("Failed to build tenant scope predicate");
  }
  return condition;
}

/**
 * Extract tenant context from ElysiaJS request
 * Assumes tenant_id is stored in JWT app_metadata
 *
 * @param request - ElysiaJS request context
 * @returns TenantContext object
 * @throws TenantContextError if tenant_id is missing
 *
 * @example
 * ```typescript
 * import { Elysia } from "elysia";
 * import { extractTenantContext } from "@supplex/db/helpers/tenant-context";
 *
 * const app = new Elysia()
 *   .derive(async ({ request }) => {
 *     const tenantContext = extractTenantContext(request);
 *     return { tenantContext };
 *   });
 * ```
 */
export function extractTenantContext(request: Request): TenantContext {
  // Extract JWT from Authorization header
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new TenantContextError("Authorization header is missing or invalid");
  }

  // Parse JWT (simplified - in production, use proper JWT library)
  try {
    const token = authHeader.substring(7);
    const parts = token.split(".");
    if (parts.length < 2 || !parts[1]) {
      throw new TenantContextError("Invalid JWT format");
    }
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64").toString("utf-8")
    );

    const tenantId = payload.app_metadata?.tenant_id;
    const userId = payload.sub;
    const role = payload.app_metadata?.role;

    if (!tenantId) {
      throw new TenantContextError("Tenant ID not found in JWT app_metadata");
    }

    return {
      tenantId,
      userId,
      role,
    };
  } catch (error) {
    throw new TenantContextError(
      `Failed to extract tenant context from JWT: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * ElysiaJS middleware factory to require tenant context
 * Throws error if tenant context is missing
 *
 * @returns Elysia derive function that adds tenantContext to request
 *
 * @example
 * ```typescript
 * import { Elysia } from "elysia";
 * import { requireTenant } from "@supplex/db/helpers/tenant-context";
 *
 * const app = new Elysia()
 *   .use(requireTenant())
 *   .get("/api/suppliers", async ({ tenantContext, db }) => {
 *     // tenantContext is now available
 *     const suppliers = await db
 *       .select()
 *       .from(suppliers)
 *       .where(withTenantId(suppliers.tenantId, tenantContext.tenantId));
 *
 *     return suppliers;
 *   });
 * ```
 */
/**
 * Structural shape of the subset of an Elysia app that this helper needs.
 *
 * `packages/db` intentionally does not depend on `elysia` (it would couple the
 * data layer to a web framework), so we type against the minimal contract
 * required to call `.derive(...)`. Real Elysia instances satisfy this shape.
 */
interface ElysiaAppLike {
  derive<TDerived>(
    fn: (ctx: { request: Request }) => TDerived | Promise<TDerived>
  ): unknown;
}

export function requireTenant() {
  return <App extends ElysiaAppLike>(app: App) =>
    app.derive(async ({ request }: { request: Request }) => {
      const tenantContext = extractTenantContext(request);
      return { tenantContext };
    });
}

/**
 * Create a scoped database client with automatic tenant filtering
 * WARNING: This is a simplified version. Production code should use a proper proxy.
 *
 * @param db - Drizzle database instance
 * @param tenantId - Tenant UUID
 * @returns Object with tenant context
 *
 * @example
 * ```typescript
 * import { db } from "@supplex/db";
 * import { getTenantDb } from "@supplex/db/helpers/tenant-context";
 *
 * const tenantDb = getTenantDb(db, "tenant-uuid-here");
 * // Now all queries should manually include tenant filtering
 * ```
 */
export function getTenantDb<TDb>(
  db: TDb,
  tenantId: string
): { db: TDb; tenantId: string } {
  if (!tenantId) {
    throw new TenantContextError("Tenant ID is required");
  }

  return {
    db,
    tenantId,
  };
}

/**
 * Validate that a UUID string is properly formatted
 *
 * @param uuid - The UUID string to validate
 * @returns true if valid, false otherwise
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validate tenant context object
 *
 * @param context - The tenant context to validate
 * @throws TenantContextError if validation fails
 */
export function validateTenantContext(context: TenantContext): void {
  if (!context.tenantId) {
    throw new TenantContextError("Tenant ID is missing from context");
  }

  if (!isValidUUID(context.tenantId)) {
    throw new TenantContextError("Tenant ID is not a valid UUID");
  }

  if (context.userId && !isValidUUID(context.userId)) {
    throw new TenantContextError("User ID is not a valid UUID");
  }
}
