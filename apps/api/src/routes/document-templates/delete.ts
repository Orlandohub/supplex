import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { documentTemplate, workflowStepTemplate } from "@supplex/db";
import { eq, and, isNull, sql } from "drizzle-orm";
import { requireAdmin } from "../../lib/rbac/middleware";

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
    async ({ params, user, set }: any) => {
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
          set.status = 404;
          return {
            success: false,
            error: {
              code: "NOT_FOUND",
              message: "Document template not found",
              timestamp: new Date().toISOString(),
            },
          };
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
          set.status = 400;
          return {
            success: false,
            error: {
              code: "TEMPLATE_IN_USE",
              message: `Cannot delete document template in use by ${usageCount.count} workflow step(s)`,
              timestamp: new Date().toISOString(),
            },
          };
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
        console.error("Error deleting document template:", error);

        set.status = 500;
        return {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to delete document template",
            timestamp: new Date().toISOString(),
          },
        };
      }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      detail: {
        summary: "Delete document template",
        description: "Soft delete a document template (admin only, fails if in use)",
        tags: ["Document Templates"],
      },
    }
  );

