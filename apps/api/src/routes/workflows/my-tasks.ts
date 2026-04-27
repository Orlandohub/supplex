import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import {
  taskInstance,
  processInstance,
  stepInstance,
  suppliers,
  users,
} from "@supplex/db";
import { eq, and, isNull, sql, asc } from "drizzle-orm";
import { authenticatedRoute } from "../../lib/route-plugins";
import { ApiError, Errors } from "../../lib/errors";

/**
 * GET /api/workflows/my-tasks?view=pending|due_today|overdue|waiting_review|completed_this_week|all&search=...
 * Get list of workflow tasks assigned to current user (NEW WORKFLOW ENGINE)
 *
 * Returns tasks from task_instance table (new system)
 * Filters by assignee (role or user) and optional view/search filters
 * Also returns summary counts for all views.
 *
 * Auth: Requires authenticated user
 * Tenant Scoping: Returns only tasks for workflows in user's tenant
 */
export const myTasksRoute = new Elysia().use(authenticatedRoute).get(
  "/my-tasks",
  async ({ user, query, requestLogger }) => {
    try {
      const userId = user.id;
      const userRole = user.role;
      const tenantId = user.tenantId;

      const view = query.view;
      const statusFilter = query.status;
      const search = query.search;

      const assigneeCondition = sql`(
        (${taskInstance.assigneeType} = 'role' AND ${taskInstance.assigneeRole} = ${userRole})
        OR
        (${taskInstance.assigneeType} = 'user' AND ${taskInstance.assigneeUserId} = ${userId})
      )`;

      const baseConditions = [
        eq(taskInstance.tenantId, tenantId),
        assigneeCondition,
        isNull(taskInstance.deletedAt),
        isNull(processInstance.deletedAt),
        isNull(stepInstance.deletedAt),
      ];

      // View-based filtering (takes priority over legacy status param)
      const effectiveView =
        view ||
        (statusFilter === "completed"
          ? "completed_this_week"
          : statusFilter === "all"
            ? "all"
            : "pending");

      const viewConditions: Record<
        string,
        ReturnType<typeof sql> | ReturnType<typeof eq> | undefined
      > = {
        pending: eq(taskInstance.status, "pending"),
        due_today: sql`${taskInstance.status} = 'pending' AND ${taskInstance.dueAt}::date = CURRENT_DATE`,
        overdue: sql`${taskInstance.status} = 'pending' AND ${taskInstance.dueAt} < NOW()`,
        waiting_review: sql`${taskInstance.status} = 'pending' AND ${taskInstance.taskType} = 'validation'`,
        completed_this_week: sql`${taskInstance.status} = 'completed' AND ${taskInstance.completedAt} >= date_trunc('week', CURRENT_DATE)`,
        all: undefined,
      };

      const viewCondition = viewConditions[effectiveView];
      const conditions = [...baseConditions];
      if (viewCondition) {
        conditions.push(viewCondition);
      }

      // Search condition
      if (search && search.trim()) {
        const searchTerm = `%${search.trim()}%`;
        conditions.push(
          sql`(
            ${taskInstance.title} ILIKE ${searchTerm}
            OR ${suppliers.name} ILIKE ${searchTerm}
            OR ${processInstance.workflowName} ILIKE ${searchTerm}
          )`
        );
      }

      const initiatorUser = db
        .select({ id: users.id, fullName: users.fullName })
        .from(users)
        .as("initiator_user");

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
          taskType: taskInstance.taskType,
          createdAt: taskInstance.createdAt,
          completedAt: taskInstance.completedAt,
          processStatus: processInstance.status,
          processType: processInstance.processType,
          entityType: processInstance.entityType,
          entityId: processInstance.entityId,
          initiatedDate: processInstance.initiatedDate,
          initiatedByUserId: processInstance.initiatedBy,
          stepStatus: stepInstance.status,
          stepName: stepInstance.stepName,
          supplierName: suppliers.name,
          initiatorName: initiatorUser.fullName,
          workflowName: processInstance.workflowName,
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
        .leftJoin(
          suppliers,
          and(
            eq(processInstance.entityType, "supplier"),
            eq(processInstance.entityId, suppliers.id)
          )
        )
        .leftJoin(
          initiatorUser,
          eq(processInstance.initiatedBy, initiatorUser.id)
        )
        .where(and(...conditions))
        .orderBy(
          asc(
            sql`CASE WHEN ${taskInstance.status} = 'pending' THEN 0 ELSE 1 END`
          ),
          asc(taskInstance.createdAt)
        );

      // Summary counts (single query with conditional aggregation)
      const countsResult = await db
        .select({
          pending: sql<number>`COUNT(*) FILTER (WHERE ${taskInstance.status} = 'pending')`,
          dueToday: sql<number>`COUNT(*) FILTER (WHERE ${taskInstance.status} = 'pending' AND ${taskInstance.dueAt}::date = CURRENT_DATE)`,
          overdue: sql<number>`COUNT(*) FILTER (WHERE ${taskInstance.status} = 'pending' AND ${taskInstance.dueAt} < NOW())`,
          waitingReview: sql<number>`COUNT(*) FILTER (WHERE ${taskInstance.status} = 'pending' AND ${taskInstance.taskType} = 'validation')`,
          completedThisWeek: sql<number>`COUNT(*) FILTER (WHERE ${taskInstance.status} = 'completed' AND ${taskInstance.completedAt} >= date_trunc('week', CURRENT_DATE))`,
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
        .where(and(...baseConditions));

      const counts = countsResult[0] ?? {
        pending: 0,
        dueToday: 0,
        overdue: 0,
        waitingReview: 0,
        completedThisWeek: 0,
      };

      const tasksWithDetails = tasks.map((task) => {
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
          entityName:
            task.supplierName ||
            (task.entityType === "supplier" ? "Unknown Supplier" : "Unknown"),
          processStatus: task.processStatus,
          processType: task.processType,
          workflowName: task.workflowName,
          initiatedDate: task.initiatedDate,
          initiatedBy: task.initiatorName || "Unknown User",
          daysPending,
          createdAt: task.createdAt,
          completedAt: task.completedAt,
          stepName: task.stepName,
          isResubmission: task.taskType === "resubmission",
        };
      });

      return {
        success: true,
        data: {
          tasks: tasksWithDetails,
          counts: {
            pending: Number(counts.pending) || 0,
            dueToday: Number(counts.dueToday) || 0,
            overdue: Number(counts.overdue) || 0,
            waitingReview: Number(counts.waitingReview) || 0,
            completedThisWeek: Number(counts.completedThisWeek) || 0,
          },
        },
      };
    } catch (error: unknown) {
      if (error instanceof ApiError) throw error;
      requestLogger.error({ err: error }, "error fetching my tasks");
      throw Errors.internal("Failed to fetch pending tasks");
    }
  },
  {
    query: t.Object({
      status: t.Optional(
        t.Union([
          t.Literal("pending"),
          t.Literal("completed"),
          t.Literal("all"),
        ])
      ),
      view: t.Optional(
        t.Union([
          t.Literal("pending"),
          t.Literal("due_today"),
          t.Literal("overdue"),
          t.Literal("waiting_review"),
          t.Literal("completed_this_week"),
          t.Literal("all"),
        ])
      ),
      search: t.Optional(t.String()),
    }),
    detail: {
      summary: "Get my tasks (New Workflow Engine)",
      description:
        "Fetches list of workflow tasks from task_instance table assigned to current user. Supports view-based filtering and search.",
      tags: ["Workflows", "Tasks"],
    },
  }
);
