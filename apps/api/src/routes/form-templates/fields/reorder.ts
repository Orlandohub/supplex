import { Elysia, t } from "elysia";
import { db } from "../../../lib/db";
import { formField, formSection, formTemplate } from "@supplex/db";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { authenticate } from "../../../lib/rbac/middleware";
import { UserRole } from "@supplex/types";

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
export const reorderFieldsRoute = new Elysia()
  .use(authenticate)
  .post(
    "/sections/:sectionId/fields/reorder",
    async ({ params, body, user, set }: any) => {
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
        const { sectionId } = params;
        const { fieldIds } = body;

        // Fetch section with template to check status
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
          set.status = 404;
          return {
            success: false,
            error: {
              code: "SECTION_NOT_FOUND",
              message: "Section not found or you don't have access to it",
              timestamp: new Date().toISOString(),
            },
          };
        }

        // Check if parent template is draft
        if (section.templateStatus !== "draft") {
          set.status = 400;
          return {
            success: false,
            error: {
              code: "TEMPLATE_PUBLISHED",
              message:
                "Cannot reorder fields in published template. Please copy the template to make changes.",
              timestamp: new Date().toISOString(),
            },
          };
        }

        // Verify all field IDs belong to this section and tenant
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
          set.status = 400;
          return {
            success: false,
            error: {
              code: "INVALID_FIELD_IDS",
              message:
                "Some field IDs are invalid or don't belong to this section",
              timestamp: new Date().toISOString(),
            },
          };
        }

        // Update field order in transaction
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
        console.error("Error reordering fields:", error);

        set.status = 500;
        return {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to reorder fields",
            timestamp: new Date().toISOString(),
          },
        };
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

