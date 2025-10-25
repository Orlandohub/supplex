import { Elysia } from "elysia";
import { db } from "../../lib/db";
import { qualificationStages, qualificationWorkflows } from "@supplex/db";
import { eq, and, isNull, sql } from "drizzle-orm";
import { authenticate } from "../../lib/rbac/middleware";

/**
 * GET /api/workflows/my-tasks/count
 * Get count of workflows pending review for current user (for badge display)
 *
 * Auth: Requires authenticated user
 * Tenant Scoping: Counts only tasks for workflows in user's tenant
 *
 * AC 1, 3: Returns count of pending tasks for navigation badge
 */
export const myTasksCountRoute = new Elysia().use(authenticate).get(
  "/my-tasks/count",
  async ({ user, set }) => {
    try {
      const userId = user!.id as string;
      const tenantId = user!.tenantId as string;

      // Efficient count query with JOIN to ensure tenant isolation
      const result = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(qualificationStages)
        .innerJoin(
          qualificationWorkflows,
          eq(qualificationStages.workflowId, qualificationWorkflows.id)
        )
        .where(
          and(
            eq(qualificationStages.assignedTo, userId),
            eq(qualificationStages.status, "Pending"),
            eq(qualificationWorkflows.tenantId, tenantId),
            isNull(qualificationStages.deletedAt),
            isNull(qualificationWorkflows.deletedAt)
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
      summary: "Get my pending tasks count",
      description: "Returns count of workflows awaiting review (for badge)",
      tags: ["Workflows", "Tasks"],
    },
  }
);
