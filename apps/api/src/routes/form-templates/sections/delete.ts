import { Elysia, t } from "elysia";
import { db } from "../../../lib/db";
import { formSection, formTemplateVersion } from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import { requireAdmin } from "../../../lib/rbac/middleware";
import { authenticatedRoute } from "../../../lib/route-plugins";
import { ApiError, Errors } from "../../../lib/errors";

/**
 * DELETE /api/form-templates/sections/:sectionId
 * Soft delete a section (Admin only)
 *
 * Auth: Requires Admin role
 * Tenant: Enforces tenant isolation
 * Validation: Parent template must be in 'draft' status
 * Returns: Success response
 */
export const deleteSectionRoute = new Elysia()
  .use(authenticatedRoute)
  .use(requireAdmin)
  .delete(
    "/sections/:sectionId",
    async ({ params, user, requestLogger }) => {
      try {
        const tenantId = user.tenantId;
        const { sectionId } = params;

        const [section] = await db
          .select({
            section: formSection,
            versionNumber: formTemplateVersion.versionNumber,
          })
          .from(formSection)
          .innerJoin(
            formTemplateVersion,
            and(
              eq(formSection.formTemplateVersionId, formTemplateVersion.id),
              eq(formTemplateVersion.tenantId, tenantId)
            )
          )
          .where(
            and(
              eq(formSection.id, sectionId),
              eq(formSection.tenantId, tenantId),
              isNull(formSection.deletedAt)
            )
          )
          .limit(1);

        if (!section) {
          throw Errors.notFound(
            "Section not found or you don't have access to it",
            "SECTION_NOT_FOUND"
          );
        }

        if (section.versionNumber !== null) {
          throw Errors.badRequest(
            "Cannot delete section in an immutable published version snapshot.",
            "IMMUTABLE_FORM_VERSION"
          );
        }

        await db
          .update(formSection)
          .set({
            deletedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(formSection.id, sectionId));

        return {
          success: true,
          data: {
            message: "Section deleted successfully",
          },
        };
      } catch (error: unknown) {
        if (error instanceof ApiError) throw error;
        requestLogger.error({ err: error }, "Error deleting section");
        throw Errors.internal("Failed to delete section");
      }
    },
    {
      params: t.Object({
        sectionId: t.String({ format: "uuid" }),
      }),
      detail: {
        summary: "Delete section",
        description:
          "Soft deletes a section in a draft form template version (Admin only)",
        tags: ["Form Templates - Sections"],
      },
    }
  );
