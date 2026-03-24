import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { workflowTemplate } from "@supplex/db";
import { authenticate } from "../../lib/rbac/middleware";
import { UserRole } from "@supplex/types";
import { eq, and, isNull } from "drizzle-orm";

/**
 * DELETE /api/workflow-templates/:workflowId
 * Soft delete workflow template
 *
 * Auth: Requires Admin role
 * Tenant: Automatically filters by tenant_id from authenticated user's JWT
 * Behavior: Soft delete (sets deleted_at timestamp)
 * Returns: Success message
 */
export const deleteWorkflowTemplateRoute = new Elysia()
  .use(authenticate)
  .delete(
    "/:workflowId",
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
        const { workflowId } = params;

        // Check if template exists and belongs to tenant
        const existing = await db.query.workflowTemplate.findFirst({
          where: and(
            eq(workflowTemplate.id, workflowId),
            eq(workflowTemplate.tenantId, tenantId),
            isNull(workflowTemplate.deletedAt)
          ),
        });

        if (!existing) {
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

        // Soft delete template (cascade will handle versions/steps/approvers)
        await db
          .update(workflowTemplate)
          .set({
            deletedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(workflowTemplate.id, workflowId));

        return {
          success: true,
          message: "Workflow template deleted successfully",
        };
      } catch (error: any) {
        console.error("Error deleting workflow template:", error);
        set.status = 500;
        return {
          success: false,
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to delete workflow template",
            timestamp: new Date().toISOString(),
          },
        };
      }
    },
    {
      params: t.Object({
        workflowId: t.String(),
      }),
    }
  );




