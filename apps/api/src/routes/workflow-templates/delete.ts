import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { workflowTemplate } from "@supplex/db";
import { requireAdmin } from "../../lib/rbac/middleware";
import { AuditAction } from "@supplex/types";
import { eq, and, isNull } from "drizzle-orm";
import { logAuditEvent } from "../../lib/audit/logger";
import { ApiError, Errors } from "../../lib/errors";

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
  .use(requireAdmin)
  .delete(
    "/:workflowId",
    async ({ params, user, requestLogger }: any) => {
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
          throw Errors.notFound("Workflow template not found");
        }

        await db
          .update(workflowTemplate)
          .set({
            deletedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(workflowTemplate.id, workflowId));

        await logAuditEvent({
          tenantId,
          userId: user.id,
          action: AuditAction.WORKFLOW_TEMPLATE_DELETED,
          details: {
            templateId: workflowId,
            templateName: existing.name,
            templateStatus: existing.status,
          },
        });

        return {
          success: true,
          message: "Workflow template deleted successfully",
        };
      } catch (error: any) {
        if (error instanceof ApiError) throw error;
        requestLogger.error({ err: error }, "Workflow template delete failed");
        throw Errors.internal("Failed to delete workflow template");
      }
    },
    {
      params: t.Object({
        workflowId: t.String(),
      }),
    }
  );
