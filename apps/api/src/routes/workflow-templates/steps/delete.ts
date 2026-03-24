import { Elysia, t } from "elysia";
import { db } from "../../../lib/db";
import {
  workflowTemplate,
  workflowStepTemplate,
} from "@supplex/db";
import { authenticate } from "../../../lib/rbac/middleware";
import { UserRole } from "@supplex/types";
import { eq, and, isNull } from "drizzle-orm";

/**
 * DELETE /api/workflow-templates/:workflowId/steps/:stepId
 * Delete a workflow step
 *
 * Auth: Requires Admin role
 * Tenant: Automatically filters by tenant_id from authenticated user's JWT
 * Behavior: Soft delete (sets deleted_at)
 * Immutability: Rejects if template is published/archived
 * Returns: Success message
 */
export const deleteStepRoute = new Elysia()
  .use(authenticate)
  .delete(
    "/:workflowId/steps/:stepId",
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
        const { workflowId, stepId } = params;

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

        // Soft delete step
        await db
          .update(workflowStepTemplate)
          .set({
            deletedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(workflowStepTemplate.id, stepId));

        return {
          success: true,
          message: "Step deleted successfully",
        };
      } catch (error: any) {
        console.error("Error deleting step:", error);
        set.status = 500;
        return {
          success: false,
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to delete step",
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
    }
  );




