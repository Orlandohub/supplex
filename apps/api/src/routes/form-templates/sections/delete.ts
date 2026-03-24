import { Elysia, t } from "elysia";
import { db } from "../../../lib/db";
import { formSection, formTemplate } from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import { authenticate } from "../../../lib/rbac/middleware";
import { UserRole } from "@supplex/types";

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
  .use(authenticate)
  .delete(
    "/sections/:sectionId",
    async ({ params, user, set }: any) => {
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
                "Cannot delete section in published template. Please copy the template to make changes.",
              timestamp: new Date().toISOString(),
            },
          };
        }

        // Soft delete: Set deleted_at timestamp
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
      } catch (error: any) {
        console.error("Error deleting section:", error);

        set.status = 500;
        return {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to delete section",
            timestamp: new Date().toISOString(),
          },
        };
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

