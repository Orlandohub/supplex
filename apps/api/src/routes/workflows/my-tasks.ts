import { Elysia } from "elysia";
import { db } from "../../lib/db";
import { qualificationStages, qualificationWorkflows } from "@supplex/db";
import { eq, and, isNull, sql } from "drizzle-orm";
import { authenticate } from "../../lib/rbac/middleware";

/**
 * GET /api/workflows/my-tasks
 * Get list of workflows pending review for current user
 *
 * Auth: Requires authenticated user
 * Tenant Scoping: Returns only tasks for workflows in user's tenant
 *
 * AC 1, 2: Returns task queue with supplier name, initiator, date, risk score, days pending
 */
export const myTasksRoute = new Elysia().use(authenticate).get(
  "/my-tasks",
  async ({ user, set }) => {
    try {
      const userId = user!.id as string;
      const tenantId = user!.tenantId as string;

      // Query stages assigned to current user with Pending status
      // Join with workflows to get supplier and initiator info
      const tasks = await db
        .select({
          stageId: qualificationStages.id,
          workflowId: qualificationStages.workflowId,
          stageNumber: qualificationStages.stageNumber,
          stageName: qualificationStages.stageName,
          stageCreatedAt: qualificationStages.createdAt,
          workflowStatus: qualificationWorkflows.status,
          supplierId: qualificationWorkflows.supplierId,
          riskScore: qualificationWorkflows.riskScore,
          initiatedDate: qualificationWorkflows.initiatedDate,
        })
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
        )
        .orderBy(sql`${qualificationStages.createdAt} ASC`); // Oldest first

      // Now fetch supplier and initiator details for each task
      const enrichedTasks = await Promise.all(
        tasks.map(async (task) => {
          // Get workflow with supplier and initiator
          const workflow = await db.query.qualificationWorkflows.findFirst({
            where: eq(qualificationWorkflows.id, task.workflowId),
            with: {
              supplier: true,
              initiator: true,
            },
          });

          if (!workflow) {
            return null;
          }

          // Calculate days pending
          const daysPending = Math.floor(
            (Date.now() - task.stageCreatedAt.getTime()) / (1000 * 60 * 60 * 24)
          );

          return {
            workflowId: task.workflowId,
            stageId: task.stageId,
            supplierId: task.supplierId,
            supplierName: workflow.supplier?.name || "Unknown Supplier",
            initiatedBy: workflow.initiator?.fullName || "Unknown User",
            initiatedDate: task.initiatedDate,
            riskScore: task.riskScore ? parseFloat(task.riskScore) : 0,
            daysPending,
            stageNumber: task.stageNumber,
            stageName: task.stageName,
          };
        })
      );

      // Filter out any null results (shouldn't happen but being safe)
      const validTasks = enrichedTasks.filter((task) => task !== null);

      return {
        success: true,
        data: {
          tasks: validTasks,
        },
      };
    } catch (error: unknown) {
      console.error("Error fetching my tasks:", error);
      set.status = 500;
      return {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch pending tasks",
          timestamp: new Date().toISOString(),
        },
      };
    }
  },
  {
    detail: {
      summary: "Get my pending tasks",
      description: "Fetches list of workflows awaiting review by current user",
      tags: ["Workflows", "Tasks"],
    },
  }
);
