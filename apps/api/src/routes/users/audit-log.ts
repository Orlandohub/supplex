import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { auditLogs } from "@supplex/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAdmin } from "../../lib/rbac/middleware";

/**
 * GET /api/users/:id/audit
 * Returns audit log for a specific user's management actions
 *
 * Query params:
 * - limit: Number of records to return (default: 20, max: 100)
 * - offset: Pagination offset (default: 0)
 *
 * Auth: Requires Admin role
 */
export const auditLogRoute = new Elysia({ prefix: "/users" })
  .use(requireAdmin)
  .get(
    "/:id/audit",
    async ({ params, query, user, set }) => {
      try {
        const { id: targetUserId } = params;
        const tenantId = user.tenantId;

        const limit = Math.min(query.limit || 20, 100);
        const offset = query.offset || 0;

        // Query audit logs for the target user
        const logs = await db
          .select()
          .from(auditLogs)
          .where(
            and(
              eq(auditLogs.tenantId, tenantId),
              eq(auditLogs.targetUserId, targetUserId)
            )
          )
          .orderBy(desc(auditLogs.createdAt))
          .limit(limit)
          .offset(offset);

        // Get total count for pagination
        // TODO: Use proper count query in production
        // const [countResult] = await db
        //   .select()
        //   .from(auditLogs)
        //   .where(
        //     and(
        //       eq(auditLogs.tenantId, tenantId),
        //       eq(auditLogs.targetUserId, targetUserId)
        //     )
        //   );

        return {
          success: true,
          data: {
            logs,
            total: logs.length, // Simplified - in production, use count query
            limit,
            offset,
          },
        };
      } catch (error: any) {
        console.error("Error fetching audit logs:", error);
        set.status = 500;
        return {
          success: false,
          error: "Failed to fetch audit logs",
        };
      }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      query: t.Object({
        limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
        offset: t.Optional(t.Number({ minimum: 0 })),
      }),
      detail: {
        summary: "Get user audit log",
        description:
          "Returns audit history for user management actions on a specific user",
        tags: ["Users"],
      },
    }
  );
