import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { formTemplate, formSection, formField } from "@supplex/db";
import { eq, and, isNull, sql } from "drizzle-orm";
import { requireAdmin } from "../../lib/rbac/middleware";
import { authenticatedRoute } from "../../lib/route-plugins";
import { ApiError, Errors } from "../../lib/errors";

/**
 * PATCH /api/form-templates/:id/publish
 * Toggle form template publish status (Admin only)
 *
 * Auth: Requires Admin role
 * Tenant: Enforces tenant isolation
 * Validation:
 * - Template must have at least one section with one field to publish
 *
 * Behavior: Toggles between draft ↔ published status
 * Returns: Updated template
 */
export const publishVersionRoute = new Elysia()
  .use(authenticatedRoute)
  .use(requireAdmin)
  .patch(
    "/:id/publish",
    async ({ params, user, requestLogger }) => {
      try {
        const tenantId = user.tenantId;
        const { id } = params;

        const [template] = await db
          .select()
          .from(formTemplate)
          .where(
            and(
              eq(formTemplate.id, id),
              eq(formTemplate.tenantId, tenantId),
              isNull(formTemplate.deletedAt)
            )
          )
          .limit(1);

        if (!template) {
          throw Errors.notFound(
            "Form template not found or you don't have access to it",
            "TEMPLATE_NOT_FOUND"
          );
        }

        if (template.status === "draft") {
          const [sectionCount] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(formSection)
            .where(
              and(
                eq(formSection.formTemplateId, id),
                eq(formSection.tenantId, tenantId),
                isNull(formSection.deletedAt)
              )
            );

          if (!sectionCount || sectionCount.count === 0) {
            throw Errors.badRequest(
              "Cannot publish template without sections. Please add at least one section.",
              "VALIDATION_ERROR"
            );
          }

          const [fieldCount] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(formField)
            .innerJoin(formSection, eq(formField.formSectionId, formSection.id))
            .where(
              and(
                eq(formSection.formTemplateId, id),
                eq(formField.tenantId, tenantId),
                isNull(formField.deletedAt),
                isNull(formSection.deletedAt)
              )
            );

          if (!fieldCount || fieldCount.count === 0) {
            throw Errors.badRequest(
              "Cannot publish template without fields. Please add at least one field to a section.",
              "VALIDATION_ERROR"
            );
          }
        }

        const newStatus = template.status === "draft" ? "published" : "draft";

        const [updatedTemplate] = await db
          .update(formTemplate)
          .set({
            status: newStatus,
            updatedAt: new Date(),
          })
          .where(eq(formTemplate.id, id))
          .returning();

        return {
          success: true,
          data: updatedTemplate,
          message: `Template ${newStatus === "published" ? "published" : "unpublished"} successfully`,
        };
      } catch (error: any) {
        if (error instanceof ApiError) throw error;
        requestLogger.error({ err: error }, "Error toggling publish status");
        throw Errors.internal("Failed to toggle publish status");
      }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      detail: {
        summary: "Toggle form template publish status",
        description:
          "Toggles template between draft and published status (Admin only)",
        tags: ["Form Templates"],
      },
    }
  );
