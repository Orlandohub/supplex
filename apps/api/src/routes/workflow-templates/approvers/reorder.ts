import { Elysia, t } from "elysia";
import { db } from "../../../lib/db";
import {
  workflowTemplate,
  workflowStepTemplate,
  stepApprover,
} from "@supplex/db";
import { authenticate } from "../../../lib/rbac/middleware";
import { UserRole } from "@supplex/types";
import { eq, and, isNull, inArray } from "drizzle-orm";

/**
 * PUT /api/workflow-templates/:workflowId/steps/:stepId/approvers/reorder
 * Reorder approvers for a step
 *
 * Auth: Requires Admin role
 * Tenant: Automatically filters by tenant_id from authenticated user's JWT
 * Behavior: Updates approver_order for multiple approvers
 * Immutability: Rejects if template is published/archived
 * Returns: Updated approvers
 */
export const reorderApproversRoute = new Elysia()
  .use(authenticate)
  .put(
    "/:workflowId/steps/:stepId/approvers/reorder",
    async ({ params, body, user, set }: any) => {
      // Check role permission - Admin only
      if (!user?.role || user.role !== UserRole.ADMIN) {
        set.status = 403;
        return {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Access denied. Required role: Admin",
            timestamp: new Date().toISOString(),
          },
        };
      }

      try {
        const tenantId = user.tenantId as string;
        const { workflowId, stepId } = params;
        const { approverOrders } = body; // Array of { approverId, order }

        // Verify template and step exist
        const template = await db.query.workflowTemplate.findFirst({
          where: and(
            eq(workflowTemplate.id, workflowId),
            eq(workflowTemplate.tenantId, tenantId),
            isNull(workflowTemplate.deletedAt)
          ),
        });

        if (!template) {
          set.status = 404;
          return {
            success: false,
            error: {
              code: "NOT_FOUND",
              message: "Workflow template not found",
              timestamp: new Date().toISOString(),
            },
          };
        }

        // Enforce immutability
        if (template.status !== "draft") {
          set.status = 400;
          return {
            success: false,
            error: {
              code: "TEMPLATE_PUBLISHED",
              message: "Cannot modify published template. Please copy the template to make changes.",
              timestamp: new Date().toISOString(),
            },
          };
        }

        const step = await db.query.workflowStepTemplate.findFirst({
          where: and(
            eq(workflowStepTemplate.id, stepId),
            eq(workflowStepTemplate.workflowTemplateId, workflowId),
            eq(workflowStepTemplate.tenantId, tenantId),
            isNull(workflowStepTemplate.deletedAt)
          ),
        });

        if (!step) {
          set.status = 404;
          return {
            success: false,
            error: {
              code: "NOT_FOUND",
              message: "Step not found",
              timestamp: new Date().toISOString(),
            },
          };
        }

        // Update approver orders in transaction
        await db.transaction(async (tx) => {
          for (const { approverId, order } of approverOrders) {
            await tx
              .update(stepApprover)
              .set({
                approverOrder: order,
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(stepApprover.id, approverId),
                  eq(stepApprover.workflowStepTemplateId, stepId),
                  eq(stepApprover.tenantId, tenantId),
                  isNull(stepApprover.deletedAt)
                )
              );
          }
        });

        // Fetch updated approvers
        const approverIds = approverOrders.map((a: any) => a.approverId);
        const updatedApprovers = await db.query.stepApprover.findMany({
          where: and(
            inArray(stepApprover.id, approverIds),
            eq(stepApprover.tenantId, tenantId),
            isNull(stepApprover.deletedAt)
          ),
        });

        return {
          success: true,
          data: updatedApprovers,
        };
      } catch (error: any) {
        console.error("Error reordering approvers:", error);
        set.status = 500;
        return {
          success: false,
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to reorder approvers",
            timestamp: new Date().toISOString(),
          },
        };
      }
    },
    {
      params: t.Object({
        workflowId: t.String(),
        stepId: t.String(),
      }),
      body: t.Object({
        approverOrders: t.Array(
          t.Object({
            approverId: t.String(),
            order: t.Number(),
          })
        ),
      }),
    }
  );




