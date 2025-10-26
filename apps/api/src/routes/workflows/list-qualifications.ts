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
import type { WorkflowListItem } from "@supplex/types";

/**
 * GET /api/workflows/qualifications
 * List qualification workflows with filtering, sorting, and pagination
 *
 * Auth: Required (any authenticated user)
 * Tenant Scoping: Automatic from JWT
 *
 * Query Parameters:
 * - status: Filter by workflow status (Draft, Stage1, Stage2, Stage3, Approved, Rejected)
 * - stage: Filter by current stage (1, 2, 3)
 * - riskLevel: Filter by risk level (Low, Medium, High)
 * - search: Search by supplier name (partial match)
 * - sortBy: Sort field (initiated_date, days_in_progress, risk_score)
 * - sortOrder: Sort direction (asc, desc)
 * - page: Page number (default 1)
 * - limit: Items per page (default 20, max 100)
 * - tab: Tab filter (all, myTasks, myInitiated)
 */
export const listQualificationsRoute = new Elysia().use(authenticate).get(
  "/qualifications",
  async ({ query, user, set }) => {
    try {
      const tenantId = user.tenantId as string;
      const userId = user.id as string;

      // Parse and validate query parameters
      const {
        status,
        stage,
        riskLevel,
        search,
        sortBy = "initiated_date",
        sortOrder = "desc",
        page = 1,
        limit = 20,
        tab = "all",
      } = query;

      // Validate page and limit
      const pageNum = Math.max(1, page);
      const limitNum = Math.min(100, Math.max(1, limit));
      const offset = (pageNum - 1) * limitNum;

      // Build WHERE conditions
      const whereConditions = [
        eq(qualificationWorkflows.tenantId, tenantId),
        isNull(qualificationWorkflows.deletedAt),
      ];

      // Status filter
      if (status && status !== "All") {
        if (status === "InProgress") {
          // InProgress = Stage1, Stage2, or Stage3
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

      // Search filter (supplier name)
      let searchCondition = undefined;
      if (search) {
        searchCondition = like(suppliers.name, `%${search}%`);
      }

      // Tab filtering
      let tabQuery;

      if (tab === "myTasks") {
        // My Tasks: Workflows where user is assigned to current stage and stage is pending
        tabQuery = db
          .selectDistinct({
            id: qualificationWorkflows.id,
            supplierName: suppliers.name,
            supplierId: qualificationWorkflows.supplierId,
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
              // Only include workflows where the join succeeded (user is assigned)
              sql`${qualificationStages.id} IS NOT NULL`
            )
          );
      } else if (tab === "myInitiated") {
        // My Initiated: Workflows initiated by current user
        whereConditions.push(eq(qualificationWorkflows.initiatedBy, userId));

        tabQuery = db
          .select({
            id: qualificationWorkflows.id,
            supplierName: suppliers.name,
            supplierId: qualificationWorkflows.supplierId,
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
        // All: All workflows in tenant
        tabQuery = db
          .select({
            id: qualificationWorkflows.id,
            supplierName: suppliers.name,
            supplierId: qualificationWorkflows.supplierId,
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
            : qualificationWorkflows.initiatedDate; // Default to initiatedDate

      const orderFn = sortOrder === "asc" ? asc : desc;

      // Execute query with sorting and pagination
      const workflows = await tabQuery
        .orderBy(orderFn(sortColumn))
        .limit(limitNum)
        .offset(offset);

      // Get total count (without pagination)
      const countQuery =
        tab === "myTasks"
          ? db
              .select({
                count: sql<number>`count(DISTINCT ${qualificationWorkflows.id})`,
              })
              .from(qualificationWorkflows)
              .leftJoin(
                suppliers,
                eq(qualificationWorkflows.supplierId, suppliers.id)
              )
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
              )
          : db
              .select({ count: sql<number>`count(*)` })
              .from(qualificationWorkflows)
              .leftJoin(
                suppliers,
                eq(qualificationWorkflows.supplierId, suppliers.id)
              )
              .where(and(...whereConditions, searchCondition));

      const totalResult = await countQuery;
      const total = Number(totalResult[0]?.count || 0);

      // Calculate days in progress for each workflow
      const workflowsWithDays: WorkflowListItem[] = workflows.map((w) => {
        const daysInProgress = w.initiatedDate
          ? Math.floor(
              (Date.now() - new Date(w.initiatedDate).getTime()) /
                (1000 * 60 * 60 * 24)
            )
          : 0;

        return {
          id: w.id,
          supplierName: w.supplierName || "Unknown Supplier",
          supplierId: w.supplierId,
          status: w.status as any,
          currentStage: w.currentStage || 0,
          initiatedBy: w.initiatedBy || "Unknown User",
          initiatedDate: w.initiatedDate,
          daysInProgress,
          riskScore: w.riskScore ? parseFloat(w.riskScore) : null,
        };
      });

      // Sort by days_in_progress if requested (calculated field)
      if (sortBy === "days_in_progress") {
        workflowsWithDays.sort((a, b) => {
          return sortOrder === "asc"
            ? a.daysInProgress - b.daysInProgress
            : b.daysInProgress - a.daysInProgress;
        });
      }

      return {
        success: true,
        data: {
          workflows: workflowsWithDays,
          total,
          page: pageNum,
          limit: limitNum,
        },
      };
    } catch (error) {
      console.error("Error listing workflows:", error);
      set.status = 500;
      return {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to list workflows",
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
      page: t.Optional(t.Number({ minimum: 1 })),
      limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
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
