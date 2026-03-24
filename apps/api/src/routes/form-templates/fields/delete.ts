import { Elysia, t } from "elysia";
import { db } from "../../../lib/db";
import { formField, formSection, formTemplate } from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import { authenticate } from "../../../lib/rbac/middleware";
import { UserRole } from "@supplex/types";

/**
 * DELETE /api/form-templates/fields/:fieldId
 * Soft delete a field (Admin only)
 *
 * Auth: Requires Admin role
 * Tenant: Enforces tenant isolation
 * Validation: Parent template must be in 'draft' status
 * Returns: Success response
 */
export const deleteFieldRoute = new Elysia()
  .use(authenticate)
  .delete(
    "/fields/:fieldId",
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
        const { fieldId } = params;

        // Fetch field with section and template to check status
        const [field] = await db
          .select({
            field: formField,
            templateStatus: formTemplate.status,
          })
          .from(formField)
          .innerJoin(
            formSection,
            eq(formField.formSectionId, formSection.id)
          )
          .innerJoin(
            formTemplate,
            eq(formSection.formTemplateId, formTemplate.id)
          )
          .where(
            and(
              eq(formField.id, fieldId),
              eq(formField.tenantId, tenantId),
              isNull(formField.deletedAt)
            )
          )
          .limit(1);

        if (!field) {
          set.status = 404;
          return {
            success: false,
            error: {
              code: "FIELD_NOT_FOUND",
              message: "Field not found or you don't have access to it",
              timestamp: new Date().toISOString(),
            },
          };
        }

        // Check if parent template is draft
        if (field.templateStatus !== "draft") {
          set.status = 400;
          return {
            success: false,
            error: {
              code: "TEMPLATE_PUBLISHED",
              message:
                "Cannot delete field in published template. Please copy the template to make changes.",
              timestamp: new Date().toISOString(),
            },
          };
        }

        // Soft delete: Set deleted_at timestamp
        await db
          .update(formField)
          .set({
            deletedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(formField.id, fieldId));

        return {
          success: true,
          data: {
            message: "Field deleted successfully",
          },
        };
      } catch (error: any) {
        console.error("Error deleting field:", error);

        set.status = 500;
        return {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to delete field",
            timestamp: new Date().toISOString(),
          },
        };
      }
    },
    {
      params: t.Object({
        fieldId: t.String({ format: "uuid" }),
      }),
      detail: {
        summary: "Delete field",
        description:
          "Soft deletes a field in a draft form template version (Admin only)",
        tags: ["Form Templates - Fields"],
      },
    }
  );

