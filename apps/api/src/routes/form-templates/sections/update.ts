import { Elysia, t } from "elysia";
import { db } from "../../../lib/db";
import { formSection, formTemplate } from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import { requireAdmin } from "../../../lib/rbac/middleware";
import { ApiError, Errors } from "../../../lib/errors";

/**
 * PATCH /api/form-templates/sections/:sectionId
 * Update a section (Admin only)
 *
 * Auth: Requires Admin role
 * Tenant: Enforces tenant isolation
 * Validation: Parent template must be in 'draft' status
 * Returns: Updated section
 */
export const updateSectionRoute = new Elysia()
  .use(requireAdmin)
  .patch(
    "/sections/:sectionId",
    async ({ params, body, user, set, requestLogger }: any) => {
      try {
        const tenantId = user.tenantId as string;
        const { sectionId } = params;

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
          throw Errors.notFound("Section not found or you don't have access to it", "SECTION_NOT_FOUND");
        }

        if (section.templateStatus !== "draft") {
          throw Errors.badRequest(
            "Cannot modify section in published template. Please copy the template to make changes.",
            "TEMPLATE_PUBLISHED"
          );
        }

        const updateData: any = {
          updatedAt: new Date(),
        };

        if (body.title !== undefined) {
          updateData.title = body.title;
        }

        if (body.description !== undefined) {
          updateData.description = body.description || null;
        }

        if (body.sectionOrder !== undefined) {
          updateData.sectionOrder = body.sectionOrder;
        }

        const [updatedSection] = await db
          .update(formSection)
          .set(updateData)
          .where(eq(formSection.id, sectionId))
          .returning();

        return {
          success: true,
          data: {
            section: updatedSection,
          },
        };
      } catch (error: any) {
        if (error instanceof ApiError) throw error;
        requestLogger.error({ err: error }, "Error updating section");
        throw Errors.internal("Failed to update section");
      }
    },
    {
      params: t.Object({
        sectionId: t.String({ format: "uuid" }),
      }),
      body: t.Object({
        title: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
        description: t.Optional(t.String()),
        sectionOrder: t.Optional(t.Integer({ minimum: 1 })),
      }),
      detail: {
        summary: "Update section",
        description: "Updates a section in a draft form template version (Admin only)",
        tags: ["Form Templates - Sections"],
      },
    }
  );
