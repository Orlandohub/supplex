import { Elysia, t } from "elysia";
import { db } from "../../../lib/db";
import {
  workflowTemplate,
  workflowStepTemplate,
  stepApprover,
} from "@supplex/db";
import { authenticate } from "../../../lib/rbac/middleware";
import { UserRole } from "@supplex/types";
import { eq, and, isNull } from "drizzle-orm";

/**
 * DELETE /api/workflow-templates/:workflowId/steps/:stepId/approvers/:approverId
 * Remove an approver from a step
 *
 * Auth: Requires Admin role
 * Tenant: Automatically filters by tenant_id from authenticated user's JWT
 * Behavior: Soft delete (sets deleted_at)
 * Immutability: Rejects if template is published/archived
 * Returns: Success message
 */
export const deleteApproverRoute = new Elysia()
  .use(authenticate)
  .delete(
    "/:workflowId/steps/:stepId/approvers/:approverId",
    async ({ params, user, set }: any) => {
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
        const { workflowId, stepId, approverId } = params;

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

        // Verify approver exists
        const approver = await db.query.stepApprover.findFirst({
          where: and(
            eq(stepApprover.id, approverId),
            eq(stepApprover.workflowStepTemplateId, stepId),
            eq(stepApprover.tenantId, tenantId),
            isNull(stepApprover.deletedAt)
          ),
        });

        if (!approver) {
          set.status = 404;
          return {
            success: false,
            error: {
              code: "NOT_FOUND",
              message: "Approver not found",
              timestamp: new Date().toISOString(),
            },
          };
        }

        // Soft delete approver
        await db
          .update(stepApprover)
          .set({
            deletedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(stepApprover.id, approverId));

        return {
          success: true,
          message: "Approver deleted successfully",
        };
      } catch (error: any) {
        console.error("Error deleting approver:", error);
        set.status = 500;
        return {
          success: false,
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to delete approver",
            timestamp: new Date().toISOString(),
          },
        };
      }
    },
    {
      params: t.Object({
        workflowId: t.String(),
        stepId: t.String(),
        approverId: t.String(),
      }),
    }
  );




