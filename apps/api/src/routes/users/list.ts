import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { users } from "@supplex/db";
import { eq, and } from "drizzle-orm";
import { authenticate } from "../../lib/rbac/middleware";
import { UserRole } from "@supplex/types";

/**
 * GET /api/users
 * Returns list of users in the authenticated user's tenant
 *
 * Query params:
 * - status: 'active' | 'inactive' (optional filter)
 *
 * Auth: Requires Admin role
 */
export const listUsersRoute = new Elysia({ prefix: "/users" })
  .use(authenticate)
  .get(
    "/",
    async ({ query, user, set }: any) => {
      try {
        // Check for admin role (following pattern from my-tasks-count.ts)
        if (!user?.role || user.role !== UserRole.ADMIN) {
          set.status = 403;
          return {
            success: false,
            error: "Access denied. Admin role required.",
          };
        }

        const tenantId = user.tenantId as string;

        // Build query with optional status filter
        let queryBuilder = db
          .select({
            id: users.id,
            tenantId: users.tenantId,
            email: users.email,
            fullName: users.fullName,
            role: users.role,
            avatarUrl: users.avatarUrl,
            isActive: users.isActive,
            lastLoginAt: users.lastLoginAt,
            createdAt: users.createdAt,
            updatedAt: users.updatedAt,
          })
          .from(users);

        // Apply tenant filter
        if (query.status) {
          const isActive = query.status === "active";
          queryBuilder = queryBuilder.where(
            and(eq(users.tenantId, tenantId), eq(users.isActive, isActive))
          ) as any;
        } else {
          queryBuilder = queryBuilder.where(
            eq(users.tenantId, tenantId)
          ) as any;
        }

        const usersList = await queryBuilder;

        return {
          success: true,
          data: {
            users: usersList,
            total: usersList.length,
          },
        };
      } catch (error: any) {
        console.error("Error fetching users:", error);
        set.status = 500;
        return {
          success: false,
          error: "Failed to fetch users",
        };
      }
    },
    {
      query: t.Object({
        status: t.Optional(
          t.Union([t.Literal("active"), t.Literal("inactive")])
        ),
      }),
      detail: {
        summary: "List users in tenant",
        description:
          "Returns all users in the authenticated user's tenant with optional status filter",
        tags: ["Users"],
      },
    }
  );
