import { Elysia, t } from "elysia";
import { db } from "../../../lib/db";
import { formSection, formTemplate } from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import { authenticate } from "../../../lib/rbac/middleware";
import { UserRole } from "@supplex/types";

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
  .use(authenticate)
  .patch(
    "/sections/:sectionId",
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
                "Cannot modify section in published template. Please copy the template to make changes.",
              timestamp: new Date().toISOString(),
            },
          };
        }

        // Build update object dynamically
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

        // Update section
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
        console.error("Error updating section:", error);

        set.status = 500;
        return {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to update section",
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

