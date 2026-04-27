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
