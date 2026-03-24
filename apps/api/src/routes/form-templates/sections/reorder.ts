import { Elysia, t } from "elysia";
import { db } from "../../../lib/db";
import { formSection, formTemplate } from "@supplex/db";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { authenticate } from "../../../lib/rbac/middleware";
import { UserRole } from "@supplex/types";

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
  .use(authenticate)
  .post(
    "/:templateId/sections/reorder",
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
        const { templateId } = params;
        const { sectionIds } = body;

        // Verify template exists, belongs to user's tenant, and is draft
        const template = await db.query.formTemplate.findFirst({
          where: and(
            eq(formTemplate.id, templateId),
            eq(formTemplate.tenantId, tenantId),
            isNull(formTemplate.deletedAt)
          ),
        });

        if (!template) {
          set.status = 404;
          return {
            success: false,
            error: {
              code: "TEMPLATE_NOT_FOUND",
              message:
                "Form template not found or you don't have access to it",
              timestamp: new Date().toISOString(),
            },
          };
        }

        // Check if template is draft
        if (template.status !== "draft") {
          set.status = 400;
          return {
            success: false,
            error: {
              code: "TEMPLATE_PUBLISHED",
              message:
                "Cannot reorder sections in published template. Please copy the template to make changes.",
              timestamp: new Date().toISOString(),
            },
          };
        }

        // Verify all section IDs belong to this template and tenant
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
          set.status = 400;
          return {
            success: false,
            error: {
              code: "INVALID_SECTION_IDS",
              message:
                "Some section IDs are invalid or don't belong to this version",
              timestamp: new Date().toISOString(),
            },
          };
        }

        // Update section order in transaction
        await db.transaction(async (tx) => {
          for (let i = 0; i < sectionIds.length; i++) {
            await tx
              .update(formSection)
              .set({
                sectionOrder: i + 1,
                updatedAt: new Date(),
              })
              .where(eq(formSection.id, sectionIds[i]));
          }
        });

        return {
          success: true,
          data: {
            message: "Sections reordered successfully",
          },
        };
      } catch (error: any) {
        console.error("Error reordering sections:", error);

        set.status = 500;
        return {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to reorder sections",
            timestamp: new Date().toISOString(),
          },
        };
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
        description:
          "Reorders sections in a draft form template (Admin only)",
        tags: ["Form Templates - Sections"],
      },
    }
  );

