import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { users } from "@supplex/db";
import { eq, and } from "drizzle-orm";
import { requireAdmin } from "../../lib/rbac/middleware";
import { authenticatedRoute } from "../../lib/route-plugins";
import { Errors } from "../../lib/errors";

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
  .use(authenticatedRoute)
  .use(requireAdmin)
  .get(
    "/",
    async ({ query, user, requestLogger }) => {
      try {
        const tenantId = user.tenantId;

        // Compose filter conditions first, then build the query in a single
        // chain to preserve Drizzle's inferred return type without casting.
        const whereClause = query.status
          ? and(
              eq(users.tenantId, tenantId),
              eq(users.isActive, query.status === "active")
            )
          : eq(users.tenantId, tenantId);

        const usersList = await db
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
          .from(users)
          .where(whereClause);

        return {
          success: true,
          data: {
            users: usersList,
            total: usersList.length,
          },
        };
      } catch (error: unknown) {
        requestLogger.error({ err: error }, "Error fetching users");
        throw Errors.internal("Failed to fetch users");
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
