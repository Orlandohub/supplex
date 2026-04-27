import { Elysia, t } from "elysia";
import { db } from "../../../lib/db";
import { formField, formSection, formTemplate } from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import { requireAdmin } from "../../../lib/rbac/middleware";
import { authenticatedRoute } from "../../../lib/route-plugins";
import { ApiError, Errors } from "../../../lib/errors";

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
  .use(authenticatedRoute)
  .use(requireAdmin)
  .delete(
    "/fields/:fieldId",
    async ({ params, user, requestLogger }) => {
      try {
        const tenantId = user.tenantId;
        const { fieldId } = params;

        const [field] = await db
          .select({
            field: formField,
            templateStatus: formTemplate.status,
          })
          .from(formField)
          .innerJoin(formSection, eq(formField.formSectionId, formSection.id))
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
          throw Errors.notFound(
            "Field not found or you don't have access to it",
            "FIELD_NOT_FOUND"
          );
        }

        if (field.templateStatus !== "draft") {
          throw Errors.badRequest(
            "Cannot delete field in published template. Please copy the template to make changes.",
            "TEMPLATE_PUBLISHED"
          );
        }

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
      } catch (error: unknown) {
        if (error instanceof ApiError) throw error;
        requestLogger.error({ err: error }, "Error deleting field");
        throw Errors.internal("Failed to delete field");
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
