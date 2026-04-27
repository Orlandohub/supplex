import { Elysia, t } from "elysia";
import { db } from "../../../lib/db";
import { formSection, formTemplate } from "@supplex/db";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { requireAdmin } from "../../../lib/rbac/middleware";
import { authenticatedRoute } from "../../../lib/route-plugins";
import { ApiError, Errors } from "../../../lib/errors";

/**
 * POST /api/form-templates/:templateId/sections/reorder
 * Reorder sections within a form template (Admin only)
 *
 * Auth: Requires Admin role
 * Tenant: Enforces tenant isolation
 * Validation: Template must be in 'draft' status
 * Body: Array of section IDs in desired order
 * Returns: Success response
 */
export const reorderSectionsRoute = new Elysia()
  .use(authenticatedRoute)
  .use(requireAdmin)
  .post(
    "/:templateId/sections/reorder",
    async ({ params, body, user, requestLogger }) => {
      try {
        const tenantId = user.tenantId;
        const { templateId } = params;
        const { sectionIds } = body;

        const template = await db.query.formTemplate.findFirst({
          where: and(
            eq(formTemplate.id, templateId),
            eq(formTemplate.tenantId, tenantId),
            isNull(formTemplate.deletedAt)
          ),
        });

        if (!template) {
          throw Errors.notFound(
            "Form template not found or you don't have access to it",
            "TEMPLATE_NOT_FOUND"
          );
        }

        if (template.status !== "draft") {
          throw Errors.badRequest(
            "Cannot reorder sections in published template. Please copy the template to make changes.",
            "TEMPLATE_PUBLISHED"
          );
        }

        const sections = await db
          .select()
          .from(formSection)
          .where(
            and(
              eq(formSection.formTemplateId, templateId),
              eq(formSection.tenantId, tenantId),
              inArray(formSection.id, sectionIds),
              isNull(formSection.deletedAt)
            )
          );

        if (sections.length !== sectionIds.length) {
          throw Errors.badRequest(
            "Some section IDs are invalid or don't belong to this version",
            "INVALID_SECTION_IDS"
          );
        }

        await db.transaction(async (tx) => {
          for (const [i, sectionId] of sectionIds.entries()) {
            await tx
              .update(formSection)
              .set({
                sectionOrder: i + 1,
                updatedAt: new Date(),
              })
              .where(eq(formSection.id, sectionId));
          }
        });

        return {
          success: true,
          data: {
            message: "Sections reordered successfully",
          },
        };
      } catch (error: unknown) {
        if (error instanceof ApiError) throw error;
        requestLogger.error({ err: error }, "Error reordering sections");
        throw Errors.internal("Failed to reorder sections");
      }
    },
    {
      params: t.Object({
        templateId: t.String({ format: "uuid" }),
      }),
      body: t.Object({
        sectionIds: t.Array(t.String({ format: "uuid" }), { minItems: 1 }),
      }),
      detail: {
        summary: "Reorder sections",
        description: "Reorders sections in a draft form template (Admin only)",
        tags: ["Form Templates - Sections"],
      },
    }
  );
