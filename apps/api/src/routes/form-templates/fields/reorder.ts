import { Elysia, t } from "elysia";
import { db } from "../../../lib/db";
import { formField, formSection, formTemplate } from "@supplex/db";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { requireAdmin } from "../../../lib/rbac/middleware";
import { ApiError, Errors } from "../../../lib/errors";

/**
 * POST /api/form-templates/sections/:sectionId/fields/reorder
 * Reorder fields within a section (Admin only)
 *
 * Auth: Requires Admin role
 * Tenant: Enforces tenant isolation
 * Validation: Parent template must be in 'draft' status
 * Body: Array of field IDs in desired order
 * Returns: Success response
 */
export const reorderFieldsRoute = new Elysia().use(requireAdmin).post(
  "/sections/:sectionId/fields/reorder",
  async ({ params, body, user, requestLogger }: any) => {
    try {
      const tenantId = user.tenantId as string;
      const { sectionId } = params;
      const { fieldIds } = body;

      const [section] = await db
        .select({
          section: formSection,
          templateStatus: formTemplate.status,
        })
        .from(formSection)
        .innerJoin(
          formTemplate,
          eq(formSection.formTemplateId, formTemplate.id)
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

      if (section.templateStatus !== "draft") {
        throw Errors.badRequest(
          "Cannot reorder fields in published template. Please copy the template to make changes.",
          "TEMPLATE_PUBLISHED"
        );
      }

      const fields = await db
        .select()
        .from(formField)
        .where(
          and(
            eq(formField.formSectionId, sectionId),
            eq(formField.tenantId, tenantId),
            inArray(formField.id, fieldIds),
            isNull(formField.deletedAt)
          )
        );

      if (fields.length !== fieldIds.length) {
        throw Errors.badRequest(
          "Some field IDs are invalid or don't belong to this section",
          "INVALID_FIELD_IDS"
        );
      }

      await db.transaction(async (tx) => {
        for (let i = 0; i < fieldIds.length; i++) {
          await tx
            .update(formField)
            .set({
              fieldOrder: i + 1,
              updatedAt: new Date(),
            })
            .where(eq(formField.id, fieldIds[i]));
        }
      });

      return {
        success: true,
        data: {
          message: "Fields reordered successfully",
        },
      };
    } catch (error: any) {
      if (error instanceof ApiError) throw error;
      requestLogger.error({ err: error }, "Error reordering fields");
      throw Errors.internal("Failed to reorder fields");
    }
  },
  {
    params: t.Object({
      sectionId: t.String({ format: "uuid" }),
    }),
    body: t.Object({
      fieldIds: t.Array(t.String({ format: "uuid" }), { minItems: 1 }),
    }),
    detail: {
      summary: "Reorder fields",
      description:
        "Reorders fields in a section of a draft form template version (Admin only)",
      tags: ["Form Templates - Fields"],
    },
  }
);
