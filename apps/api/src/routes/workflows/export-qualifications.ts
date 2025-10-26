import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import {
  qualificationWorkflows,
  qualificationStages,
  suppliers,
  users,
  StageStatus,
} from "@supplex/db";
import {
  eq,
  and,
  isNull,
  like,
  or,
  sql,
  lt,
  gte,
  lte,
  gt,
  desc,
  asc,
} from "drizzle-orm";
import { authenticate } from "../../lib/rbac/middleware";

/**
 * GET /api/workflows/qualifications/export
 * Export qualification workflows to CSV
 *
 * Auth: Required (any authenticated user)
 * Tenant Scoping: Automatic from JWT
 *
 * Query Parameters: Same as list endpoint (no pagination)
 * - status: Filter by workflow status
 * - stage: Filter by current stage
 * - riskLevel: Filter by risk level
 * - search: Search by supplier name
 * - sortBy: Sort field
 * - sortOrder: Sort direction
 * - tab: Tab filter (all, myTasks, myInitiated)
 */
export const exportQualificationsRoute = new Elysia().use(authenticate).get(
  "/qualifications/export",
  async ({ query, user, set }) => {
    try {
      const tenantId = user.tenantId as string;
      const userId = user.id as string;

      // Parse query parameters
      const {
        status,
        stage,
        riskLevel,
        search,
        sortBy = "initiated_date",
        sortOrder = "desc",
        tab = "all",
      } = query;

      // Build WHERE conditions
      const whereConditions = [
        eq(qualificationWorkflows.tenantId, tenantId),
        isNull(qualificationWorkflows.deletedAt),
      ];

      // Status filter
      if (status && status !== "All") {
        if (status === "InProgress") {
          whereConditions.push(
            or(
              eq(qualificationWorkflows.status, "Stage1"),
              eq(qualificationWorkflows.status, "Stage2"),
              eq(qualificationWorkflows.status, "Stage3")
            )!
          );
        } else {
          whereConditions.push(eq(qualificationWorkflows.status, status));
        }
      }

      // Stage filter
      if (stage && stage !== "All") {
        const stageNum =
          typeof stage === "string" ? parseInt(stage, 10) : stage;
        if (!isNaN(stageNum)) {
          whereConditions.push(
            eq(qualificationWorkflows.currentStage, stageNum)
          );
        }
      }

      // Risk level filter
      if (riskLevel && riskLevel !== "All") {
        if (riskLevel === "Low") {
          whereConditions.push(lt(qualificationWorkflows.riskScore, "3.0"));
        } else if (riskLevel === "Medium") {
          whereConditions.push(
            and(
              gte(qualificationWorkflows.riskScore, "3.0"),
              lte(qualificationWorkflows.riskScore, "6.0")
            )!
          );
        } else if (riskLevel === "High") {
          whereConditions.push(gt(qualificationWorkflows.riskScore, "6.0"));
        }
      }

      // Search filter
      let searchCondition = undefined;
      if (search) {
        searchCondition = like(suppliers.name, `%${search}%`);
      }

      // Tab filtering
      let tabQuery;

      if (tab === "myTasks") {
        tabQuery = db
          .selectDistinct({
            id: qualificationWorkflows.id,
            supplierName: suppliers.name,
            status: qualificationWorkflows.status,
            currentStage: qualificationWorkflows.currentStage,
            initiatedBy: users.fullName,
            initiatedDate: qualificationWorkflows.initiatedDate,
            riskScore: qualificationWorkflows.riskScore,
          })
          .from(qualificationWorkflows)
          .leftJoin(
            suppliers,
            eq(qualificationWorkflows.supplierId, suppliers.id)
          )
          .leftJoin(users, eq(qualificationWorkflows.initiatedBy, users.id))
          .leftJoin(
            qualificationStages,
            and(
              eq(qualificationStages.workflowId, qualificationWorkflows.id),
              eq(
                qualificationStages.stageNumber,
                qualificationWorkflows.currentStage
              ),
              eq(qualificationStages.assignedTo, userId),
              eq(qualificationStages.status, StageStatus.PENDING)
            )
          )
          .where(
            and(
              ...whereConditions,
              searchCondition,
              sql`${qualificationStages.id} IS NOT NULL`
            )
          );
      } else if (tab === "myInitiated") {
        whereConditions.push(eq(qualificationWorkflows.initiatedBy, userId));

        tabQuery = db
          .select({
            id: qualificationWorkflows.id,
            supplierName: suppliers.name,
            status: qualificationWorkflows.status,
            currentStage: qualificationWorkflows.currentStage,
            initiatedBy: users.fullName,
            initiatedDate: qualificationWorkflows.initiatedDate,
            riskScore: qualificationWorkflows.riskScore,
          })
          .from(qualificationWorkflows)
          .leftJoin(
            suppliers,
            eq(qualificationWorkflows.supplierId, suppliers.id)
          )
          .leftJoin(users, eq(qualificationWorkflows.initiatedBy, users.id))
          .where(and(...whereConditions, searchCondition));
      } else {
        tabQuery = db
          .select({
            id: qualificationWorkflows.id,
            supplierName: suppliers.name,
            status: qualificationWorkflows.status,
            currentStage: qualificationWorkflows.currentStage,
            initiatedBy: users.fullName,
            initiatedDate: qualificationWorkflows.initiatedDate,
            riskScore: qualificationWorkflows.riskScore,
          })
          .from(qualificationWorkflows)
          .leftJoin(
            suppliers,
            eq(qualificationWorkflows.supplierId, suppliers.id)
          )
          .leftJoin(users, eq(qualificationWorkflows.initiatedBy, users.id))
          .where(and(...whereConditions, searchCondition));
      }

      // Apply sorting
      const sortColumn =
        sortBy === "risk_score"
          ? qualificationWorkflows.riskScore
          : sortBy === "initiated_date"
            ? qualificationWorkflows.initiatedDate
            : qualificationWorkflows.initiatedDate;

      const orderFn = sortOrder === "asc" ? asc : desc;

      // Execute query with sorting (no pagination for export)
      const workflows = await tabQuery.orderBy(orderFn(sortColumn));

      // Calculate days in progress and format current stage
      const workflowsWithDetails = workflows.map((w) => {
        const daysInProgress = w.initiatedDate
          ? Math.floor(
              (Date.now() - new Date(w.initiatedDate).getTime()) /
                (1000 * 60 * 60 * 24)
            )
          : 0;

        // Format current stage for display
        let currentStageDisplay = "Draft";
        if (w.status === "Approved") {
          currentStageDisplay = "Approved";
        } else if (w.status === "Rejected") {
          currentStageDisplay = "Rejected";
        } else if (w.currentStage && w.currentStage > 0) {
          currentStageDisplay = `Stage ${w.currentStage}`;
        }

        return {
          supplierName: w.supplierName || "Unknown Supplier",
          status: w.status,
          currentStage: currentStageDisplay,
          initiatedBy: w.initiatedBy || "Unknown User",
          initiatedDate: w.initiatedDate
            ? new Date(w.initiatedDate).toISOString().split("T")[0]
            : "N/A",
          daysInProgress,
          riskScore: w.riskScore ? parseFloat(w.riskScore).toFixed(2) : "N/A",
        };
      });

      // Sort by days_in_progress if requested
      if (sortBy === "days_in_progress") {
        workflowsWithDetails.sort((a, b) => {
          return sortOrder === "asc"
            ? a.daysInProgress - b.daysInProgress
            : b.daysInProgress - a.daysInProgress;
        });
      }

      // Generate CSV content
      const headers = [
        "Supplier Name",
        "Status",
        "Current Stage",
        "Initiated By",
        "Initiated Date",
        "Days In Progress",
        "Risk Score",
      ];

      const csvRows = [
        headers.join(","),
        ...workflowsWithDetails.map((w) =>
          [
            `"${w.supplierName.replace(/"/g, '""')}"`, // Escape quotes in names
            w.status,
            w.currentStage,
            `"${w.initiatedBy.replace(/"/g, '""')}"`,
            w.initiatedDate,
            w.daysInProgress.toString(),
            w.riskScore,
          ].join(",")
        ),
      ];

      const csvContent = csvRows.join("\n");

      // Generate filename with current date
      const filename = `qualifications-${new Date().toISOString().split("T")[0]}.csv`;

      // Set response headers for CSV download
      set.headers["Content-Type"] = "text/csv; charset=utf-8";
      set.headers["Content-Disposition"] = `attachment; filename="${filename}"`;

      return csvContent;
    } catch (error) {
      console.error("Error exporting workflows:", error);
      set.status = 500;
      return {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to export workflows",
          timestamp: new Date().toISOString(),
        },
      };
    }
  },
  {
    query: t.Object({
      status: t.Optional(
        t.Union([
          t.Literal("All"),
          t.Literal("Draft"),
          t.Literal("InProgress"),
          t.Literal("Stage1"),
          t.Literal("Stage2"),
          t.Literal("Stage3"),
          t.Literal("Approved"),
          t.Literal("Rejected"),
        ])
      ),
      stage: t.Optional(
        t.Union([
          t.Literal("All"),
          t.Literal("1"),
          t.Literal("2"),
          t.Literal("3"),
          t.Number(),
        ])
      ),
      riskLevel: t.Optional(
        t.Union([
          t.Literal("All"),
          t.Literal("Low"),
          t.Literal("Medium"),
          t.Literal("High"),
        ])
      ),
      search: t.Optional(t.String()),
      sortBy: t.Optional(
        t.Union([
          t.Literal("initiated_date"),
          t.Literal("days_in_progress"),
          t.Literal("risk_score"),
        ])
      ),
      sortOrder: t.Optional(t.Union([t.Literal("asc"), t.Literal("desc")])),
      tab: t.Optional(
        t.Union([
          t.Literal("all"),
          t.Literal("myTasks"),
          t.Literal("myInitiated"),
        ])
      ),
    }),
  }
);
