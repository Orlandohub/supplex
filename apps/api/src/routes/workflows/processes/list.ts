import { Elysia, t } from "elysia";
import { ApiError, Errors } from "../../../lib/errors";
import { db } from "../../../lib/db";
import { processInstance, suppliers, users, stepInstance } from "@supplex/db";
import { eq, and, isNull, desc, asc, sql, or, ilike } from "drizzle-orm";
import { authenticatedRoute } from "../../../lib/route-plugins";
import { UserRole } from "@supplex/types";

const ROLE_DISPLAY_LABELS: Record<string, string> = {
  supplier_user: "Supplier Contact",
  quality_manager: "Quality Team",
  procurement_manager: "Procurement",
  admin: "Admin",
  viewer: "Viewer",
};

function roleToDisplayLabel(role: string): string {
  return (
    ROLE_DISPLAY_LABELS[role] ??
    role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

/**
 * GET /api/workflows/processes
 * Paginated, filterable, searchable workflow process list
 *
 * Query params:
 *   page, pageSize, search, status, view, sortBy, sortOrder
 *
 * Returns lean payload with counts for the summary strip.
 */
export const listProcessesRoute = new Elysia().use(authenticatedRoute).get(
  "/processes",
  async ({ user, query, requestLogger }) => {
    const tenantId = user.tenantId;
    const userRole = user.role;
    const userId = user.id;

    try {
      const page = Math.max(1, Number(query.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 25));
      const offset = (page - 1) * pageSize;
      const search = query.search?.trim() || null;
      const statusFilter = query.status || null;
      const view = query.view || "all";
      const sortBy = query.sortBy || "updatedAt";
      const sortOrder = query.sortOrder || "desc";

      // Supplier-user scoping
      let supplierEntityId: string | null = null;
      if (userRole === UserRole.SUPPLIER_USER) {
        const supplier = await db.query.suppliers.findFirst({
          where: and(
            eq(suppliers.supplierUserId, userId),
            eq(suppliers.tenantId, tenantId),
            isNull(suppliers.deletedAt)
          ),
          columns: { id: true },
        });
        if (!supplier) {
          throw Errors.forbidden(
            "Supplier user is not associated with a supplier"
          );
        }
        supplierEntityId = supplier.id;
      }

      // --- Build WHERE conditions ---
      const baseConditions = [
        eq(processInstance.tenantId, tenantId),
        isNull(processInstance.deletedAt),
      ];

      if (supplierEntityId) {
        baseConditions.push(
          eq(processInstance.entityType, "supplier"),
          eq(processInstance.entityId, supplierEntityId)
        );
      }

      if (statusFilter) {
        baseConditions.push(eq(processInstance.status, statusFilter as any));
      }

      if (search) {
        const searchPattern = `%${search}%`;
        baseConditions.push(
          or(
            ilike(processInstance.workflowName, searchPattern),
            ilike(suppliers.name, searchPattern),
            ilike(processInstance.processType, searchPattern)
          )!
        );
      }

      if (view === "my_work") {
        baseConditions.push(sql`EXISTS (
            SELECT 1 FROM task_instance ti
            WHERE ti.step_instance_id = ${processInstance.currentStepInstanceId}
              AND ti.status = 'pending'
              AND ti.deleted_at IS NULL
              AND (
                (ti.assignee_type = 'role' AND ti.assignee_role = ${userRole})
                OR (ti.assignee_type = 'user' AND ti.assignee_user_id = ${userId})
              )
          )`);
      } else if (view === "waiting_supplier") {
        baseConditions.push(sql`EXISTS (
            SELECT 1 FROM task_instance ti
            LEFT JOIN users u ON u.id = ti.assignee_user_id
            WHERE ti.step_instance_id = ${processInstance.currentStepInstanceId}
              AND ti.status = 'pending'
              AND ti.deleted_at IS NULL
              AND (ti.assignee_role = 'supplier_user' OR u.role = 'supplier_user')
          )`);
      } else if (view === "waiting_internal") {
        baseConditions.push(sql`EXISTS (
            SELECT 1 FROM task_instance ti
            LEFT JOIN users u ON u.id = ti.assignee_user_id
            WHERE ti.step_instance_id = ${processInstance.currentStepInstanceId}
              AND ti.status = 'pending'
              AND ti.deleted_at IS NULL
              AND (
                ti.task_type = 'validation'
                OR (ti.assignee_role IS NOT NULL AND ti.assignee_role != 'supplier_user')
                OR (u.id IS NOT NULL AND u.role != 'supplier_user')
              )
          )`);
      } else if (view === "overdue") {
        baseConditions.push(sql`EXISTS (
            SELECT 1 FROM task_instance ti
            WHERE ti.step_instance_id = ${processInstance.currentStepInstanceId}
              AND ti.status = 'pending'
              AND ti.deleted_at IS NULL
              AND ti.due_at < NOW()
          )`);
      } else if (view === "completed") {
        baseConditions.push(eq(processInstance.status, "complete"));
      }

      const whereClause = and(...baseConditions);

      // --- Sorting ---
      const sortColumn = (() => {
        switch (sortBy) {
          case "initiatedDate":
            return processInstance.initiatedDate;
          case "workflowName":
            return processInstance.workflowName;
          case "status":
            return processInstance.status;
          default:
            return processInstance.updatedAt;
        }
      })();
      const orderFn = sortOrder === "asc" ? asc : desc;

      const pendingTaskCountSq = sql<number>`(
          SELECT COUNT(*)::int FROM task_instance ti
          WHERE ti.step_instance_id = ${processInstance.currentStepInstanceId}
            AND ti.status = 'pending'
            AND ti.deleted_at IS NULL
        )`.as("pendingTaskCount");

      const overdueTaskCountSq = sql<number>`(
          SELECT COUNT(*)::int FROM task_instance ti
          WHERE ti.step_instance_id = ${processInstance.currentStepInstanceId}
            AND ti.status = 'pending'
            AND ti.deleted_at IS NULL
            AND ti.due_at < NOW()
        )`.as("overdueTaskCount");

      const earliestDueAtSq = sql<string | null>`(
          SELECT MIN(ti.due_at) FROM task_instance ti
          WHERE ti.step_instance_id = ${processInstance.currentStepInstanceId}
            AND ti.status = 'pending'
            AND ti.deleted_at IS NULL
        )`.as("earliestDueAt");

      const isAssignedToMeSq = sql<boolean>`EXISTS (
          SELECT 1 FROM task_instance ti
          WHERE ti.step_instance_id = ${processInstance.currentStepInstanceId}
            AND ti.status = 'pending'
            AND ti.deleted_at IS NULL
            AND (
              (ti.assignee_type = 'role' AND ti.assignee_role = ${userRole})
              OR (ti.assignee_type = 'user' AND ti.assignee_user_id = ${userId})
            )
        )`.as("isAssignedToMe");

      const myTaskTypeSq = sql<string | null>`(
          SELECT ti.task_type FROM task_instance ti
          WHERE ti.step_instance_id = ${processInstance.currentStepInstanceId}
            AND ti.status = 'pending'
            AND ti.deleted_at IS NULL
            AND (
              (ti.assignee_type = 'role' AND ti.assignee_role = ${userRole})
              OR (ti.assignee_type = 'user' AND ti.assignee_user_id = ${userId})
            )
          LIMIT 1
        )`.as("myTaskType");

      // Waiting-on: pick the first pending task on current step
      const waitingOnUserNameSq = sql<string | null>`(
          SELECT u.full_name FROM task_instance ti
          LEFT JOIN users u ON u.id = ti.assignee_user_id
          WHERE ti.step_instance_id = ${processInstance.currentStepInstanceId}
            AND ti.status = 'pending'
            AND ti.deleted_at IS NULL
            AND ti.assignee_type = 'user'
            AND ti.assignee_user_id IS NOT NULL
          LIMIT 1
        )`.as("waitingOnUserName");

      const waitingOnRoleSq = sql<string | null>`(
          SELECT COALESCE(ti.assignee_role, u.role) FROM task_instance ti
          LEFT JOIN users u ON u.id = ti.assignee_user_id
          WHERE ti.step_instance_id = ${processInstance.currentStepInstanceId}
            AND ti.status = 'pending'
            AND ti.deleted_at IS NULL
          LIMIT 1
        )`.as("waitingOnRole");

      // Use an alias for the initiator user join to avoid conflicts
      const initiatorUser = db
        .select({ id: users.id, fullName: users.fullName })
        .from(users)
        .as("initiator_user");

      // --- Main paginated query ---
      const [processes, countResult] = await Promise.all([
        db
          .select({
            id: processInstance.id,
            processType: processInstance.processType,
            entityType: processInstance.entityType,
            entityId: processInstance.entityId,
            status: processInstance.status,
            initiatedBy: processInstance.initiatedBy,
            initiatedDate: processInstance.initiatedDate,
            completedDate: processInstance.completedDate,
            updatedAt: processInstance.updatedAt,
            currentStepInstanceId: processInstance.currentStepInstanceId,
            supplierName: suppliers.name,
            initiatorName: initiatorUser.fullName,
            currentStepName: stepInstance.stepName,
            currentStepOrder: stepInstance.stepOrder,
            currentStepType: stepInstance.stepType,
            workflowName: processInstance.workflowName,
            totalStepCount: processInstance.totalSteps,
            completedStepCount: processInstance.completedSteps,
            pendingTaskCount: pendingTaskCountSq,
            overdueTaskCount: overdueTaskCountSq,
            earliestDueAt: earliestDueAtSq,
            isAssignedToMe: isAssignedToMeSq,
            myTaskType: myTaskTypeSq,
            waitingOnUserName: waitingOnUserNameSq,
            waitingOnRole: waitingOnRoleSq,
          })
          .from(processInstance)
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
          .leftJoin(
            stepInstance,
            eq(stepInstance.id, processInstance.currentStepInstanceId)
          )
          .where(whereClause)
          .orderBy(orderFn(sortColumn))
          .limit(pageSize)
          .offset(offset),

        db
          .select({ count: sql<number>`COUNT(*)::int` })
          .from(processInstance)
          .leftJoin(
            suppliers,
            and(
              eq(processInstance.entityType, "supplier"),
              eq(processInstance.entityId, suppliers.id)
            )
          )
          .where(whereClause),
      ]);

      const total = countResult[0]?.count ?? 0;

      // --- Summary counts (conditional aggregation) ---
      const supplierScopeConditions = [
        eq(processInstance.tenantId, tenantId),
        isNull(processInstance.deletedAt),
      ];
      if (supplierEntityId) {
        supplierScopeConditions.push(
          eq(processInstance.entityType, "supplier"),
          eq(processInstance.entityId, supplierEntityId)
        );
      }

      const [countsRow] = await db
        .select({
          active: sql<number>`COUNT(*) FILTER (WHERE ${processInstance.status} IN ('in_progress', 'pending_validation', 'declined_resubmit'))::int`,
          waitingOnSupplier: sql<number>`COUNT(*) FILTER (WHERE EXISTS (
              SELECT 1 FROM task_instance ti
              LEFT JOIN users u ON u.id = ti.assignee_user_id
              WHERE ti.step_instance_id = ${processInstance.currentStepInstanceId}
                AND ti.status = 'pending' AND ti.deleted_at IS NULL
                AND (ti.assignee_role = 'supplier_user' OR u.role = 'supplier_user')
            ))::int`,
          waitingOnInternal: sql<number>`COUNT(*) FILTER (WHERE EXISTS (
              SELECT 1 FROM task_instance ti
              LEFT JOIN users u ON u.id = ti.assignee_user_id
              WHERE ti.step_instance_id = ${processInstance.currentStepInstanceId}
                AND ti.status = 'pending' AND ti.deleted_at IS NULL
                AND (
                  ti.task_type = 'validation'
                  OR (ti.assignee_role IS NOT NULL AND ti.assignee_role != 'supplier_user')
                  OR (u.id IS NOT NULL AND u.role != 'supplier_user')
                )
            ))::int`,
          overdue: sql<number>`COUNT(*) FILTER (WHERE EXISTS (
              SELECT 1 FROM task_instance ti
              WHERE ti.step_instance_id = ${processInstance.currentStepInstanceId}
                AND ti.status = 'pending' AND ti.deleted_at IS NULL
                AND ti.due_at < NOW()
            ))::int`,
          completedThisMonth: sql<number>`COUNT(*) FILTER (WHERE ${processInstance.status} = 'complete' AND ${processInstance.completedDate} >= date_trunc('month', NOW()))::int`,
        })
        .from(processInstance)
        .where(and(...supplierScopeConditions));

      // --- Map results with human-readable waitingOnLabel ---
      const mappedProcesses = processes.map((p) => {
        let waitingOnLabel: string;
        let waitingOnIsSupplier = false;

        if (p.waitingOnUserName) {
          waitingOnLabel = p.waitingOnUserName;
          waitingOnIsSupplier = p.waitingOnRole === "supplier_user";
        } else if (p.waitingOnRole) {
          waitingOnLabel = roleToDisplayLabel(p.waitingOnRole);
          waitingOnIsSupplier = p.waitingOnRole === "supplier_user";
        } else {
          waitingOnLabel = "Unassigned";
        }

        return {
          id: p.id,
          workflowName: p.workflowName,
          processType: p.processType,
          entityType: p.entityType,
          entityId: p.entityId,
          supplierName: p.supplierName,
          status: p.status,
          currentStepName: p.currentStepName,
          currentStepOrder: p.currentStepOrder,
          currentStepType: p.currentStepType,
          currentStepInstanceId: p.currentStepInstanceId,
          totalStepCount: p.totalStepCount ?? 0,
          completedStepCount: p.completedStepCount ?? 0,
          waitingOnLabel,
          waitingOnIsSupplier,
          pendingTaskCount: p.pendingTaskCount ?? 0,
          overdueTaskCount: p.overdueTaskCount ?? 0,
          earliestDueAt: p.earliestDueAt,
          isAssignedToMe: p.isAssignedToMe ?? false,
          myTaskType: p.myTaskType,
          initiatorName: p.initiatorName,
          initiatedDate: p.initiatedDate,
          completedDate: p.completedDate,
          updatedAt: p.updatedAt,
        };
      });

      return {
        success: true,
        data: {
          processes: mappedProcesses,
          total,
          page,
          pageSize,
          counts: countsRow ?? {
            active: 0,
            waitingOnSupplier: 0,
            waitingOnInternal: 0,
            overdue: 0,
            completedThisMonth: 0,
          },
        },
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      requestLogger.error({ err: error }, "error fetching workflow processes");
      throw Errors.internal("Failed to fetch workflow processes");
    }
  },
  {
    query: t.Object({
      page: t.Optional(t.String()),
      pageSize: t.Optional(t.String()),
      search: t.Optional(t.String()),
      status: t.Optional(t.String()),
      view: t.Optional(
        t.Union([
          t.Literal("all"),
          t.Literal("my_work"),
          t.Literal("waiting_supplier"),
          t.Literal("waiting_internal"),
          t.Literal("overdue"),
          t.Literal("completed"),
        ])
      ),
      sortBy: t.Optional(
        t.Union([
          t.Literal("updatedAt"),
          t.Literal("initiatedDate"),
          t.Literal("workflowName"),
          t.Literal("status"),
        ])
      ),
      sortOrder: t.Optional(t.Union([t.Literal("asc"), t.Literal("desc")])),
    }),
    detail: {
      summary: "List workflow processes (paginated)",
      description:
        "Paginated, filterable, searchable workflow process list with summary counts",
      tags: ["Workflows", "Processes"],
    },
  }
);
