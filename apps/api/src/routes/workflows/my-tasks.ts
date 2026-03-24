import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { taskInstance, processInstance, stepInstance, suppliers } from "@supplex/db";
import { eq, and, isNull, sql, asc, desc } from "drizzle-orm";
import { authenticate } from "../../lib/rbac/middleware";

/**
 * GET /api/workflows/my-tasks?status=pending|completed|all
 * Get list of workflow tasks assigned to current user (NEW WORKFLOW ENGINE)
 *
 * Returns tasks from task_instance table (new system)
 * Filters by assignee (role or user) and optional status filter
 * Default: all tasks, sorted by pending first then creation date ASC
 *
 * Auth: Requires authenticated user
 * Tenant Scoping: Returns only tasks for workflows in user's tenant
 */
export const myTasksRoute = new Elysia().use(authenticate).get(
  "/my-tasks",
  async ({ user, set, query }) => {
    try {
      const userId = user!.id as string;
      const userRole = user!.role as string;
      const tenantId = user!.tenantId as string;

      const statusFilter = (query as any)?.status as string | undefined;

      const statusCondition =
        statusFilter === "pending"
          ? eq(taskInstance.status, "pending")
          : statusFilter === "completed"
            ? eq(taskInstance.status, "completed")
            : undefined; // "all" or undefined → no status filter

      const conditions = [
        eq(taskInstance.tenantId, tenantId),
        sql`(
          (${taskInstance.assigneeType} = 'role' AND ${taskInstance.assigneeRole} = ${userRole})
          OR
          (${taskInstance.assigneeType} = 'user' AND ${taskInstance.assigneeUserId} = ${userId})
        )`,
        isNull(taskInstance.deletedAt),
        isNull(processInstance.deletedAt),
        isNull(stepInstance.deletedAt),
      ];

      if (statusCondition) {
        conditions.push(statusCondition);
      }

      const tasks = await db
        .select({
          taskId: taskInstance.id,
          processId: taskInstance.processInstanceId,
          stepId: taskInstance.stepInstanceId,
          taskTitle: taskInstance.title,
          taskDescription: taskInstance.description,
          taskStatus: taskInstance.status,
          dueAt: taskInstance.dueAt,
          assigneeType: taskInstance.assigneeType,
          assigneeRole: taskInstance.assigneeRole,
          taskMetadata: taskInstance.metadata,
          createdAt: taskInstance.createdAt,
          completedAt: taskInstance.completedAt,
          processStatus: processInstance.status,
          processType: processInstance.processType,
          entityType: processInstance.entityType,
          entityId: processInstance.entityId,
          initiatedDate: processInstance.initiatedDate,
          initiatedBy: processInstance.initiatedBy,
          stepStatus: stepInstance.status,
        })
        .from(taskInstance)
        .innerJoin(
          processInstance,
          eq(taskInstance.processInstanceId, processInstance.id)
        )
        .innerJoin(
          stepInstance,
          eq(taskInstance.stepInstanceId, stepInstance.id)
        )
        .where(and(...conditions))
        .orderBy(
          asc(sql`CASE WHEN ${taskInstance.status} = 'pending' THEN 0 ELSE 1 END`),
          asc(taskInstance.createdAt)
        );

      // Now fetch entity details (supplier name, etc.) for each task
      // For MVP, we'll focus on entity_type = 'supplier'
      const tasksWithDetails = await Promise.all(
        tasks.map(async (task) => {
          let entityName = "Unknown";
          
          if (task.entityType === "supplier" && task.entityId) {
            // Query supplier name
            const supplier = await db.query.suppliers.findFirst({
              where: (suppliers, { eq, and, isNull }) => 
                and(
                  eq(suppliers.id, task.entityId),
                  isNull(suppliers.deletedAt)
                ),
              columns: { name: true },
            });
            entityName = supplier?.name || "Unknown Supplier";
          }

          // Get initiator name
          let initiatedByName = "Unknown User";
          if (task.initiatedBy) {
            const initiator = await db.query.users.findFirst({
              where: (users, { eq }) => eq(users.id, task.initiatedBy),
              columns: { fullName: true },
            });
            initiatedByName = initiator?.fullName || "Unknown User";
          }

          // Calculate days pending
          const daysPending = Math.floor(
            (new Date().getTime() - new Date(task.createdAt).getTime()) /
              (1000 * 60 * 60 * 24)
          );

          return {
            taskId: task.taskId,
            processId: task.processId,
            stepId: task.stepId,
            taskTitle: task.taskTitle,
            taskDescription: task.taskDescription,
            taskStatus: task.taskStatus,
            dueAt: task.dueAt,
            entityType: task.entityType,
            entityId: task.entityId,
            entityName,
            processStatus: task.processStatus,
            processType: task.processType,
            initiatedDate: task.initiatedDate,
            initiatedBy: initiatedByName,
            daysPending,
            createdAt: task.createdAt,
            completedAt: task.completedAt,
            isResubmission: !!(task.taskMetadata as any)?.isResubmission,
          };
        })
      );

      return {
        success: true,
        data: {
          tasks: tasksWithDetails,
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
    query: t.Object({
      status: t.Optional(t.Union([
        t.Literal("pending"),
        t.Literal("completed"),
        t.Literal("all"),
      ])),
    }),
    detail: {
      summary: "Get my tasks (New Workflow Engine)",
      description: "Fetches list of workflow tasks from task_instance table assigned to current user. Supports status filter.",
      tags: ["Workflows", "Tasks"],
    },
  }
);
