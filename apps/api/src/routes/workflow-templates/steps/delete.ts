import { Elysia, t } from "elysia";
import { db } from "../../../lib/db";
import { workflowTemplate, workflowStepTemplate } from "@supplex/db";
import { requireAdmin } from "../../../lib/rbac/middleware";
import { authenticatedRoute } from "../../../lib/route-plugins";
import { eq, and, isNull } from "drizzle-orm";
import { ApiError, Errors } from "../../../lib/errors";

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
  .use(authenticatedRoute)
  .use(requireAdmin)
  .delete(
    "/:workflowId/steps/:stepId",
    async ({ params, user, requestLogger }) => {
      try {
        const tenantId = user.tenantId;
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
          throw Errors.notFound("Workflow template not found");
        }

        // Enforce immutability
        if (template.status !== "draft") {
          throw Errors.badRequest(
            "Cannot modify published template. Please copy the template to make changes.",
            "TEMPLATE_PUBLISHED"
          );
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
          throw Errors.notFound("Step not found");
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
      } catch (error: unknown) {
        if (error instanceof ApiError) throw error;
        requestLogger.error({ err: error }, "Workflow step delete failed");
        throw Errors.internal("Failed to delete step");
      }
    },
    {
      params: t.Object({
        workflowId: t.String(),
        stepId: t.String(),
      }),
    }
  );
