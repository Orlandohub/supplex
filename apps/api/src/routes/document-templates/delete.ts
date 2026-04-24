import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { documentTemplate, workflowStepTemplate } from "@supplex/db";
import { eq, and, isNull, sql } from "drizzle-orm";
import { requireAdmin } from "../../lib/rbac/middleware";
import { ApiError, Errors } from "../../lib/errors";

/**
 * DELETE /api/document-templates/:id
 * Soft delete a document template
 *
 * Auth: Admin only
 * Params: id (UUID)
 * Returns: Success message
 * Error: 400 if template is in use by workflow steps
 */
export const deleteDocumentTemplateRoute = new Elysia()
  .use(requireAdmin)
  .delete(
    "/:id",
    async ({ params, user, requestLogger }: any) => {
      try {
        const tenantId = user.tenantId as string;
        const templateId = params.id;

        // Verify template exists and belongs to tenant
        const [existingTemplate] = await db
          .select()
          .from(documentTemplate)
          .where(
            and(
              eq(documentTemplate.id, templateId),
              eq(documentTemplate.tenantId, tenantId),
              isNull(documentTemplate.deletedAt)
            )
          )
          .limit(1);

        if (!existingTemplate) {
          throw Errors.notFound("Document template not found");
        }

        // Check if template is referenced by any workflow steps
        const [usageCount] = await db
          .select({ count: sql<number>`COUNT(*)::int` })
          .from(workflowStepTemplate)
          .where(
            and(
              eq(workflowStepTemplate.documentTemplateId, templateId),
              isNull(workflowStepTemplate.deletedAt)
            )
          );

        if (usageCount.count > 0) {
          throw new ApiError(
            400,
            "TEMPLATE_IN_USE",
            `Cannot delete document template in use by ${usageCount.count} workflow step(s)`
          );
        }

        // Soft delete template
        await db
          .update(documentTemplate)
          .set({ deletedAt: new Date() })
          .where(eq(documentTemplate.id, templateId));

        return {
          success: true,
          message: "Document template deleted successfully",
        };
      } catch (error: any) {
        if (error instanceof ApiError) throw error;
        requestLogger.error(
          { err: error },
          "Document template deletion failed"
        );
        throw Errors.internal("Failed to delete document template");
      }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      detail: {
        summary: "Delete document template",
        description:
          "Soft delete a document template (admin only, fails if in use)",
        tags: ["Document Templates"],
      },
    }
  );
