import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import {
  qualificationStages,
  qualificationWorkflows,
  suppliers,
} from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import { authenticate } from "../../lib/rbac/middleware";
import { sendStageRejectedEmail } from "../../services/email-notification.service";

/**
 * POST /api/workflows/:id/stages/:stageId/reject
 * Reject a workflow stage and return workflow to Draft status
 *
 * Auth: Requires authenticated user with Procurement Manager or Admin role
 * Authorization: User must be assigned to the stage
 * Tenant Scoping: Only workflows in user's tenant
 *
 * AC 7, 9, 11, 12, 14: Reject stage, revert workflow to Draft, revert supplier status, send notification
 */
export const rejectStageRoute = new Elysia().use(authenticate).post(
  "/:workflowId/stages/:stageId/reject",
  async ({ params, user, body, set }) => {
    try {
      const userId = user!.id as string;
      const tenantId = user!.tenantId as string;
      const userRole = user!.role as string;
      const userFullName = user!.fullName as string;

      // Validate comments (required, minimum 10 characters)
      if (!body.comments || body.comments.trim().length < 10) {
        set.status = 400;
        return {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Rejection comments required (minimum 10 characters)",
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Role check will be done after fetching stage to determine which stage is being rejected

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

      // Role-based access control based on stage number
      const stageNumber = stage.stageNumber;
      if (stageNumber === 1) {
        // Stage 1: Procurement Manager or Admin
        if (userRole !== "procurement_manager" && userRole !== "admin") {
          set.status = 403;
          return {
            success: false,
            error: {
              code: "FORBIDDEN",
              message:
                "Access denied. Procurement Manager or Admin role required for Stage 1.",
              timestamp: new Date().toISOString(),
            },
          };
        }
      } else if (stageNumber === 2) {
        // Stage 2: Quality Manager or Admin
        if (userRole !== "quality_manager" && userRole !== "admin") {
          set.status = 403;
          return {
            success: false,
            error: {
              code: "FORBIDDEN",
              message:
                "Access denied. Quality Manager or Admin role required for Stage 2.",
              timestamp: new Date().toISOString(),
            },
          };
        }
      } else if (stageNumber === 3) {
        // Stage 3: Admin only
        if (userRole !== "admin") {
          set.status = 403;
          return {
            success: false,
            error: {
              code: "FORBIDDEN",
              message: "Access denied. Admin role required for Stage 3.",
              timestamp: new Date().toISOString(),
            },
          };
        }
      }

      // Begin transaction
      const result = await db.transaction(async (tx) => {
        // 1. Update current stage to Rejected
        const rejectedStages = await tx
          .update(qualificationStages)
          .set({
            status: "Rejected",
            reviewedBy: userId,
            reviewedDate: new Date(),
            comments: body.comments,
            updatedAt: new Date(),
          })
          .where(eq(qualificationStages.id, stage.id))
          .returning();

        const rejectedStage = rejectedStages[0];

        // 2. Revert workflow to Draft, currentStage = 0
        const updatedWorkflows = await tx
          .update(qualificationWorkflows)
          .set({
            status: "Draft",
            currentStage: 0,
            updatedAt: new Date(),
          })
          .where(eq(qualificationWorkflows.id, stage.workflowId))
          .returning();

        const updatedWorkflow = updatedWorkflows[0];

        // 3. Revert supplier status to Prospect
        const updatedSuppliers = await tx
          .update(suppliers)
          .set({
            status: "prospect",
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(suppliers.id, stage.workflow.supplierId),
              eq(suppliers.tenantId, tenantId)
            )
          )
          .returning();

        const updatedSupplier = updatedSuppliers[0];

        // 4. Create audit log entry (placeholder for Story 2.10)
        // TODO: Implement audit logging in Story 2.10
        // await createAuditLog(tx, {
        //   eventType: "stage_rejected",
        //   stageNumber: stageNumber,
        //   reviewerId: userId,
        //   comments: body.comments,
        // });

        return {
          workflow: updatedWorkflow,
          rejectedStage,
          supplier: updatedSupplier,
        };
      });

      // Queue email notification (stub for Story 2.8)
      await sendStageRejectedEmail({
        workflowId: stage.workflowId,
        initiatorEmail: stage.workflow.initiator?.email || "",
        initiatorName: stage.workflow.initiator?.fullName || "Unknown",
        supplierName: stage.workflow.supplier?.name || "Unknown Supplier",
        reviewerName: userFullName,
        stageNumber: stageNumber,
        rejectionComments: body.comments,
        workflowLink: `/workflows/${stage.workflowId}`,
      });

      set.status = 200;
      return {
        success: true,
        data: result,
      };
    } catch (error: unknown) {
      console.error("Error rejecting stage:", error);
      set.status = 500;
      return {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to reject stage",
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
      comments: t.String({ minLength: 10 }),
    }),
    detail: {
      summary: "Reject workflow stage",
      description:
        "Rejects a stage and returns workflow to Draft (Procurement Manager/Admin only)",
      tags: ["Workflows", "Tasks"],
    },
  }
);
