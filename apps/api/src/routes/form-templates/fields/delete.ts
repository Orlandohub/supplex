import { Elysia, t } from "elysia";
import { db } from "../../../lib/db";
import {
  hardDeleteDraftFormField,
  FormTemplateRowNotFoundError,
  ImmutableFormTemplateStructureError,
} from "@supplex/db";
import { requireAdmin } from "../../../lib/rbac/middleware";
import { authenticatedRoute } from "../../../lib/route-plugins";
import { ApiError, Errors } from "../../../lib/errors";

/**
 * DELETE /api/form-templates/fields/:fieldId
 * Hard delete a draft field with audit snapshot (Admin only)
 *
 * Auth: Requires Admin role
 * Tenant: Enforces tenant isolation
 * Validation: Parent template version must be the mutable draft (versionNumber NULL)
 * Audit: Persists a full `before` row snapshot to form_template_audit_event
 *        in the same transaction as the DELETE (SUP-27).
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

        await db.transaction(async (tx) => {
          await hardDeleteDraftFormField(tx, {
            tenantId,
            fieldId,
            actorUserId: user.id,
          });
        });

        return {
          success: true,
          data: {
            message: "Field deleted successfully",
          },
        };
      } catch (error: unknown) {
        if (error instanceof ApiError) throw error;
        if (error instanceof FormTemplateRowNotFoundError) {
          throw Errors.notFound(
            "Field not found or you don't have access to it",
            "FIELD_NOT_FOUND"
          );
        }
        if (error instanceof ImmutableFormTemplateStructureError) {
          throw Errors.conflict(
            "Cannot delete field in an immutable published version snapshot.",
            "IMMUTABLE_FORM_VERSION"
          );
        }
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
          "Hard deletes a field in a draft form template version with audit snapshot (Admin only)",
        tags: ["Form Templates - Fields"],
      },
    }
  );
