import { Elysia, t } from "elysia";
import { db } from "../../../lib/db";
import {
  hardDeleteDraftFormSection,
  FormTemplateRowNotFoundError,
  ImmutableFormTemplateStructureError,
} from "@supplex/db";
import { requireAdmin } from "../../../lib/rbac/middleware";
import { authenticatedRoute } from "../../../lib/route-plugins";
import { ApiError, Errors } from "../../../lib/errors";

/**
 * DELETE /api/form-templates/sections/:sectionId
 * Hard delete a draft section and its remaining draft fields with audit snapshots (Admin only)
 *
 * Auth: Requires Admin role
 * Tenant: Enforces tenant isolation
 * Validation: Parent template version must be the mutable draft (versionNumber NULL)
 * Audit: Emits one form_template_audit_event per child field followed by one for
 *        the section itself, all inside the same transaction as the DELETEs (SUP-27).
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

        await db.transaction(async (tx) => {
          await hardDeleteDraftFormSection(tx, {
            tenantId,
            sectionId,
            actorUserId: user.id,
          });
        });

        return {
          success: true,
          data: {
            message: "Section deleted successfully",
          },
        };
      } catch (error: unknown) {
        if (error instanceof ApiError) throw error;
        if (error instanceof FormTemplateRowNotFoundError) {
          throw Errors.notFound(
            "Section not found or you don't have access to it",
            "SECTION_NOT_FOUND"
          );
        }
        if (error instanceof ImmutableFormTemplateStructureError) {
          throw Errors.badRequest(
            "Cannot delete section in an immutable published version snapshot.",
            "IMMUTABLE_FORM_VERSION"
          );
        }
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
          "Hard deletes a section in a draft form template version with audit snapshots (Admin only)",
        tags: ["Form Templates - Sections"],
      },
    }
  );
