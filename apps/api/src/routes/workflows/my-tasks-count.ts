import { Elysia } from "elysia";
import { db } from "../../lib/db";
import { taskInstance } from "@supplex/db";
import { eq, and, isNull, sql } from "drizzle-orm";
import { authenticate } from "../../lib/rbac/middleware";

/**
 * GET /api/workflows/my-tasks/count
 * Get count of workflow tasks pending for current user (NEW WORKFLOW ENGINE)
 *
 * Returns count of open tasks from task_instance table
 * Used for navigation badge display
 *
 * Auth: Requires authenticated user
 * Tenant Scoping: Counts only tasks in user's tenant
 *
 * AC 1, 3: Returns count of pending tasks for navigation badge
 */
export const myTasksCountRoute = new Elysia().use(authenticate).get(
  "/my-tasks/count",
  async ({ user, set }) => {
    try {
      const userId = user!.id as string;
      const userRole = user!.role as string;
      const tenantId = user!.tenantId as string;

      // Efficient count query for open tasks assigned to current user
      const result = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(taskInstance)
        .where(
          and(
            eq(taskInstance.tenantId, tenantId),
            eq(taskInstance.status, "pending"),
            // Task is assigned to current user (by role OR by userId)
            sql`(
              (${taskInstance.assigneeType} = 'role' AND ${taskInstance.assigneeRole} = ${userRole})
              OR
              (${taskInstance.assigneeType} = 'user' AND ${taskInstance.assigneeUserId} = ${userId})
            )`,
            isNull(taskInstance.deletedAt)
          )
        );

      const count = result[0]?.count ?? 0;

      return {
        success: true,
        data: {
          count,
        },
      };
    } catch (error: unknown) {
      console.error("Error fetching my tasks count:", error);
      set.status = 500;
      return {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch task count",
          timestamp: new Date().toISOString(),
        },
      };
    }
  },
  {
    detail: {
      summary: "Get my pending tasks count (New Workflow Engine)",
      description: "Returns count of workflow tasks from task_instance table awaiting action (for badge)",
      tags: ["Workflows", "Tasks"],
    },
  }
);
