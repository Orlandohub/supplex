import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { workflowTemplate } from "@supplex/db";
import { requireAdmin } from "../../lib/rbac/middleware";
import { eq, and, isNull } from "drizzle-orm";
import { ApiError, Errors } from "../../lib/errors";

/**
 * PATCH /api/workflow-templates/:templateId/toggle-active
 * Toggle workflow template active status (Admin only)
 *
 * Auth: Requires Admin role
 * Tenant: Automatically filters by tenant_id from authenticated user's JWT
 * Behavior: Toggles active status between true and false
 * Returns: Updated template
 */
export const toggleActiveWorkflowTemplateRoute = new Elysia()
  .use(requireAdmin)
  .patch(
    "/:templateId/toggle-active",
    async ({ params, user, requestLogger }: any) => {
      try {
        const tenantId = user.tenantId as string;
        const { templateId } = params;

        // Fetch template and verify tenant ownership
        const existing = await db.query.workflowTemplate.findFirst({
          where: and(
            eq(workflowTemplate.id, templateId),
            eq(workflowTemplate.tenantId, tenantId),
            isNull(workflowTemplate.deletedAt)
          ),
        });

        if (!existing) {
          throw Errors.notFound("Workflow template not found");
        }

        if (existing.status !== "published") {
          throw Errors.badRequest(
            "Active/inactive is only available for published templates. Publish the template first.",
            "INVALID_STATE"
          );
        }

        // Toggle active status
        const [updated] = await db
          .update(workflowTemplate)
          .set({
            active: !existing.active,
            updatedAt: new Date(),
          })
          .where(eq(workflowTemplate.id, templateId))
          .returning();

        return {
          success: true,
          data: updated,
        };
      } catch (error: any) {
        if (error instanceof ApiError) throw error;
        requestLogger.error(
          { err: error },
          "Workflow template active toggle failed"
        );
        throw Errors.internal(
          "Failed to toggle workflow template active status"
        );
      }
    },
    {
      params: t.Object({
        templateId: t.String(),
      }),
    }
  );
