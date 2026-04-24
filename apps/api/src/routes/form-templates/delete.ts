import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { formTemplate } from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import { requireAdmin } from "../../lib/rbac/middleware";
import { ApiError, Errors } from "../../lib/errors";

/**
 * DELETE /api/form-templates/:id
 * Soft delete a form template (Admin only)
 *
 * Auth: Requires Admin role
 * Tenant: Enforces tenant isolation - returns 403 for cross-tenant access
 * Behavior: Sets deleted_at timestamp (soft delete, preserves audit trail)
 * Returns: Success response
 */
export const deleteFormTemplateRoute = new Elysia().use(requireAdmin).delete(
  "/:id",
  async ({ params, user, requestLogger }: any) => {
    try {
      const tenantId = user.tenantId as string;
      const templateId = params.id;

      const [existingTemplate] = await db
        .select()
        .from(formTemplate)
        .where(
          and(
            eq(formTemplate.id, templateId),
            eq(formTemplate.tenantId, tenantId),
            isNull(formTemplate.deletedAt)
          )
        )
        .limit(1);

      if (!existingTemplate) {
        throw Errors.notFound(
          "Form template not found or you don't have access to it",
          "TEMPLATE_NOT_FOUND"
        );
      }

      await db
        .update(formTemplate)
        .set({
          deletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(formTemplate.id, templateId));

      return {
        success: true,
        data: {
          message: "Form template deleted successfully",
        },
      };
    } catch (error: any) {
      if (error instanceof ApiError) throw error;
      requestLogger.error({ err: error }, "Error deleting form template");
      throw Errors.internal("Failed to delete form template");
    }
  },
  {
    params: t.Object({
      id: t.String({ format: "uuid" }),
    }),
    detail: {
      summary: "Delete form template",
      description:
        "Soft deletes form template by setting deleted_at timestamp (Admin only)",
      tags: ["Form Templates"],
    },
  }
);
