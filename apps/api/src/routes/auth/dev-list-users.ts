import { Elysia } from "elysia";
import { config } from "../../config";
import { db } from "../../lib/db";
import { tenants, users, suppliers } from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";

/**
 * Development Quick Login - List Users Endpoint
 * 
 * DEVELOPMENT ONLY - Returns all users organized by tenant for quick login testing.
 * This endpoint is disabled in production (returns 404).
 * 
 * Security: Environment check ensures this route is never accessible in production.
 */
export const devListUsersRoute = new Elysia({ prefix: "/auth" })
  .get("/dev/users", async ({ set }) => {
    // CRITICAL: Environment check FIRST - reject in production
    if (config.nodeEnv !== "development") {
      set.status = 404;
      return { error: "Not found" };
    }

    try {
      // Query all active tenants
      const allTenants = await db
        .select({
          id: tenants.id,
          name: tenants.name,
        })
        .from(tenants)
        .where(eq(tenants.status, "active"));

      // Build response for each tenant with their users
      const tenantsWithUsers = await Promise.all(
        allTenants.map(async (tenant) => {
          // Query tenant users (users belonging to this tenant directly)
          const tenantUsers = await db
            .select({
              id: users.id,
              email: users.email,
              role: users.role,
              fullName: users.fullName,
              isActive: users.isActive,
            })
            .from(users)
            .where(
              and(
                eq(users.tenantId, tenant.id),
                eq(users.isActive, true)
              )
            );

          // Query supplier users (users associated with suppliers for this tenant)
          const tenantSuppliers = await db
            .select({
              supplierId: suppliers.id,
              supplierName: suppliers.name,
              userId: users.id,
              email: users.email,
              role: users.role,
              fullName: users.fullName,
              isActive: users.isActive,
            })
            .from(suppliers)
            .innerJoin(users, eq(suppliers.supplierUserId, users.id))
            .where(
              and(
                eq(suppliers.tenantId, tenant.id),
                isNull(suppliers.deletedAt),
                eq(users.isActive, true)
              )
            );

          // Format supplier users with supplier context
          const supplierUsers = tenantSuppliers.map((s) => ({
            id: s.userId,
            email: s.email,
            role: s.role,
            fullName: s.fullName,
            isActive: s.isActive,
            supplierId: s.supplierId,
            supplierName: s.supplierName,
          }));

          return {
            id: tenant.id,
            name: tenant.name,
            users: tenantUsers,
            supplierUsers: supplierUsers,
          };
        })
      );

      return {
        tenants: tenantsWithUsers,
      };
    } catch (error) {
      console.error("❌ Dev list users error:", error);
      set.status = 500;
      return {
        error: "Failed to fetch users for development quick login",
      };
    }
  }, {
    detail: {
      summary: "List users for dev quick login (Development Only)",
      description: "Returns all active users grouped by tenant for development quick login. Returns 404 in production.",
      tags: ["Authentication", "Development"],
    },
  });
