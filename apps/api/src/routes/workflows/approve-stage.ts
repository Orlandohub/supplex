import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { qualificationStages, qualificationWorkflows } from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import { authenticate } from "../../lib/rbac/middleware";
import { getStage2Reviewer } from "../../services/reviewer-assignment.service";
import { sendStageApprovedEmail } from "../../services/email-notification.service";

/**
 * POST /api/workflows/:id/stages/:stageId/approve
 * Approve a workflow stage and advance to next stage
 *
 * Auth: Requires authenticated user with Procurement Manager or Admin role
 * Authorization: User must be assigned to the stage
 * Tenant Scoping: Only workflows in user's tenant
 *
 * AC 7, 8, 12, 13, 14: Approve stage, update workflow, create next stage, send notification
 */
export const approveStageRoute = new Elysia().use(authenticate).post(
  "/:workflowId/stages/:stageId/approve",
  async ({ params, user, body, set }) => {
    try {
      const userId = user!.id as string;
      const tenantId = user!.tenantId as string;
      const userRole = user!.role as string;
      const userFullName = user!.fullName as string;

      // Role check: Procurement Manager or Admin only
      if (userRole !== "procurement_manager" && userRole !== "admin") {
        set.status = 403;
        return {
          success: false,
          error: {
            code: "FORBIDDEN",
            message:
              "Access denied. Procurement Manager or Admin role required.",
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Fetch stage with workflow info
      const stage = await db.query.qualificationStages.findFirst({
        where: and(
          eq(qualificationStages.id, params.stageId),
          eq(qualificationStages.workflowId, params.workflowId),
          isNull(qualificationStages.deletedAt)
        ),
        with: {
          workflow: {
            with: {
              supplier: true,
              initiator: true,
            },
          },
        },
      });

      if (!stage) {
        set.status = 404;
        return {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Stage not found",
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Verify tenant isolation
      if (stage.workflow.tenantId !== tenantId) {
        set.status = 403;
        return {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Access denied",
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Check if stage is assigned to current user
      if (stage.assignedTo !== userId) {
        set.status = 403;
        return {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Not assigned to review this stage",
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Check if stage is Pending (not already reviewed)
      if (stage.status !== "Pending") {
        set.status = 400;
        return {
          success: false,
          error: {
            code: "INVALID_STATE",
            message: "Stage already reviewed",
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Get Stage 2 reviewer
      const stage2Reviewer = await getStage2Reviewer(tenantId);
      if (!stage2Reviewer) {
        set.status = 500;
        return {
          success: false,
          error: {
            code: "NO_REVIEWER",
            message: "No reviewer available for Stage 2",
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Begin transaction
      const result = await db.transaction(async (tx) => {
        // 1. Update current stage to Approved
        const approvedStages = await tx
          .update(qualificationStages)
          .set({
            status: "Approved",
            reviewedBy: userId,
            reviewedDate: new Date(),
            comments: body.comments || null,
            updatedAt: new Date(),
          })
          .where(eq(qualificationStages.id, stage.id))
          .returning();

        const approvedStage = approvedStages[0];

        // 2. Update workflow to Stage2, currentStage = 2
        const updatedWorkflows = await tx
          .update(qualificationWorkflows)
          .set({
            status: "Stage2",
            currentStage: 2,
            updatedAt: new Date(),
          })
          .where(eq(qualificationWorkflows.id, stage.workflowId))
          .returning();

        const updatedWorkflow = updatedWorkflows[0];

        // 3. Create Stage 2 record
        const nextStages = await tx
          .insert(qualificationStages)
          .values({
            workflowId: stage.workflowId,
            stageNumber: 2,
            stageName: "Quality Review",
            assignedTo: stage2Reviewer.id,
            status: "Pending",
          })
          .returning();

        const nextStage = nextStages[0];

        // 4. Create audit log entry (placeholder for Story 2.10)
        // TODO: Implement audit logging in Story 2.10
        // await createAuditLog(tx, {
        //   eventType: "stage_approved",
        //   stageNumber: 1,
        //   reviewerId: userId,
        //   comments: body.comments,
        // });

        return {
          workflow: updatedWorkflow,
          approvedStage,
          nextStage,
        };
      });

      // Queue email notification (stub for Story 2.8)
      await sendStageApprovedEmail({
        workflowId: stage.workflowId,
        initiatorEmail: stage.workflow.initiator?.email || "",
        initiatorName: stage.workflow.initiator?.fullName || "Unknown",
        supplierName: stage.workflow.supplier?.name || "Unknown Supplier",
        reviewerName: userFullName,
        stageNumber: 1,
        nextStage: "Quality Review",
        workflowLink: `/workflows/${stage.workflowId}`,
      });

      set.status = 200;
      return {
        success: true,
        data: result,
      };
    } catch (error: unknown) {
      console.error("Error approving stage:", error);
      set.status = 500;
      return {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to approve stage",
          timestamp: new Date().toISOString(),
        },
      };
    }
  },
  {
    params: t.Object({
      workflowId: t.String({ format: "uuid" }),
      stageId: t.String({ format: "uuid" }),
    }),
    body: t.Object({
      comments: t.Optional(t.String()),
    }),
    detail: {
      summary: "Approve workflow stage",
      description:
        "Approves a stage and advances workflow to next stage (Procurement Manager/Admin only)",
      tags: ["Workflows", "Tasks"],
    },
  }
);
