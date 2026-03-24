import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { formTemplate } from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import { authenticate } from "../../lib/rbac/middleware";
import { UserRole } from "@supplex/types";

/**
 * DELETE /api/form-templates/:id
 * Soft delete a form template (Admin only)
 *
 * Auth: Requires Admin role
 * Tenant: Enforces tenant isolation - returns 403 for cross-tenant access
 * Behavior: Sets deleted_at timestamp (soft delete, preserves audit trail)
 * Returns: Success response
 */
export const deleteFormTemplateRoute = new Elysia()
  .use(authenticate)
  .delete(
    "/:id",
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
        const templateId = params.id;

        // Verify template exists and belongs to user's tenant
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
          set.status = 404;
          return {
            success: false,
            error: {
              code: "TEMPLATE_NOT_FOUND",
              message:
                "Form template not found or you don't have access to it",
              timestamp: new Date().toISOString(),
            },
          };
        }

        // Soft delete: Set deleted_at timestamp
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
        console.error("Error deleting form template:", error);

        set.status = 500;
        return {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to delete form template",
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
        summary: "Delete form template",
        description:
          "Soft deletes form template by setting deleted_at timestamp (Admin only)",
        tags: ["Form Templates"],
      },
    }
  );

