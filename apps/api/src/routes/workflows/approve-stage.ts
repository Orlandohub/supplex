import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import {
  qualificationStages,
  qualificationWorkflows,
  suppliers,
} from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import { authenticate } from "../../lib/rbac/middleware";
import {
  getStage2Reviewer,
  getStage3Reviewer,
} from "../../services/reviewer-assignment.service";
import {
  sendStageApprovedEmail,
  sendSupplierApprovalCongratulations,
} from "../../services/email-notification.service";

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

      // Role check will be done after fetching stage to determine which stage is being approved

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
        // Stage 3: Admin only (or designated approver - checked via assignment)
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
        // 1. Update current stage to Approved
        // For Stage 2, include quality checklist in attachments JSONB field
        const updateData: any = {
          status: "Approved",
          reviewedBy: userId,
          reviewedDate: new Date(),
          comments: body.comments || null,
          updatedAt: new Date(),
        };

        // If Stage 2 and quality checklist provided, save to attachments
        if (stageNumber === 2 && body.qualityChecklist) {
          updateData.attachments = body.qualityChecklist;
        }

        const approvedStages = await tx
          .update(qualificationStages)
          .set(updateData)
          .where(eq(qualificationStages.id, stage.id))
          .returning();

        const approvedStage = approvedStages[0];

        let updatedWorkflow;
        let nextStage = null;
        let updatedSupplier = null;

        // 2. Stage-specific logic
        if (stageNumber === 1) {
          // Stage 1 → Stage 2 (Quality Review)
          const stage2Reviewer = await getStage2Reviewer(tenantId);
          if (!stage2Reviewer) {
            throw new Error("No reviewer available for Stage 2");
          }

          // Update workflow to Stage2
          const updatedWorkflows = await tx
            .update(qualificationWorkflows)
            .set({
              status: "Stage2",
              currentStage: 2,
              updatedAt: new Date(),
            })
            .where(eq(qualificationWorkflows.id, stage.workflowId))
            .returning();

          updatedWorkflow = updatedWorkflows[0];

          // Create Stage 2 record
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

          nextStage = nextStages[0];
        } else if (stageNumber === 2) {
          // Stage 2 → Stage 3 (Management Approval)
          const stage3Reviewer = await getStage3Reviewer(tenantId);
          if (!stage3Reviewer) {
            throw new Error("No reviewer available for Stage 3");
          }

          // Update workflow to Stage3
          const updatedWorkflows = await tx
            .update(qualificationWorkflows)
            .set({
              status: "Stage3",
              currentStage: 3,
              updatedAt: new Date(),
            })
            .where(eq(qualificationWorkflows.id, stage.workflowId))
            .returning();

          updatedWorkflow = updatedWorkflows[0];

          // Create Stage 3 record
          const nextStages = await tx
            .insert(qualificationStages)
            .values({
              workflowId: stage.workflowId,
              stageNumber: 3,
              stageName: "Management Approval",
              assignedTo: stage3Reviewer.id,
              status: "Pending",
            })
            .returning();

          nextStage = nextStages[0];
        } else if (stageNumber === 3) {
          // Stage 3 → Approved (Final state)
          // Update workflow to Approved
          const updatedWorkflows = await tx
            .update(qualificationWorkflows)
            .set({
              status: "Approved",
              currentStage: 3,
              updatedAt: new Date(),
            })
            .where(eq(qualificationWorkflows.id, stage.workflowId))
            .returning();

          updatedWorkflow = updatedWorkflows[0];

          // Update supplier status to Approved
          const updatedSuppliers = await tx
            .update(suppliers)
            .set({
              status: "approved",
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(suppliers.id, stage.workflow.supplierId),
                eq(suppliers.tenantId, tenantId)
              )
            )
            .returning();

          updatedSupplier = updatedSuppliers[0];
        }

        // 3. Create audit log entry (placeholder for Story 2.10)
        // TODO: Implement audit logging in Story 2.10
        // await createAuditLog(tx, {
        //   eventType: "stage_approved",
        //   stageNumber: stageNumber,
        //   reviewerId: userId,
        //   comments: body.comments,
        // });

        return {
          workflow: updatedWorkflow,
          approvedStage,
          nextStage,
          supplier: updatedSupplier,
        };
      });

      // Queue email notifications (stubs for Story 2.8)
      if (stageNumber === 1 || stageNumber === 2) {
        const nextStageName =
          stageNumber === 1 ? "Quality Review" : "Management Approval";
        await sendStageApprovedEmail({
          workflowId: stage.workflowId,
          initiatorEmail: stage.workflow.initiator?.email || "",
          initiatorName: stage.workflow.initiator?.fullName || "Unknown",
          supplierName: stage.workflow.supplier?.name || "Unknown Supplier",
          reviewerName: userFullName,
          stageNumber: stageNumber,
          nextStage: nextStageName,
          workflowLink: `/workflows/${stage.workflowId}`,
        });
      } else if (stageNumber === 3) {
        // Send congratulatory email to supplier on final approval (if enabled in tenant settings)
        // TODO Story 2.8: Check tenant.settings.enableSupplierApprovalEmails before sending
        // For now, always send (stub implementation)
        await sendSupplierApprovalCongratulations({
          supplierName: stage.workflow.supplier?.name || "Unknown Supplier",
          supplierEmail: stage.workflow.supplier?.contactEmail || "",
          workflowId: stage.workflowId,
        });
      }

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
      qualityChecklist: t.Optional(
        t.Object({
          qualityManualReviewed: t.Boolean(),
          qualityCertificationsVerified: t.Boolean(),
          qualityAuditFindings: t.String(),
        })
      ),
    }),
    detail: {
      summary: "Approve workflow stage",
      description:
        "Approves a stage and advances workflow to next stage (Procurement Manager/Admin only)",
      tags: ["Workflows", "Tasks"],
    },
  }
);
