import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { formTemplate, formSection, formField } from "@supplex/db";
import { eq, and, isNull, sql } from "drizzle-orm";
import { authenticate } from "../../lib/rbac/middleware";
import { UserRole } from "@supplex/types";

/**
 * PATCH /api/form-templates/:id/publish
 * Toggle form template publish status (Admin only)
 *
 * Auth: Requires Admin role
 * Tenant: Enforces tenant isolation
 * Validation:
 * - Template must have at least one section with one field to publish
 * 
 * Behavior: Toggles between draft ↔ published status
 * Returns: Updated template
 */
export const publishVersionRoute = new Elysia()
  .use(authenticate)
  .patch(
    "/:id/publish",
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
        const { id } = params;

        // Verify template exists, belongs to user's tenant
        const [template] = await db
          .select()
          .from(formTemplate)
          .where(
            and(
              eq(formTemplate.id, id),
              eq(formTemplate.tenantId, tenantId),
              isNull(formTemplate.deletedAt)
            )
          )
          .limit(1);

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

        // If publishing (draft → published), validate structure
        if (template.status === "draft") {
          // Verify template has at least one section
          const [sectionCount] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(formSection)
            .where(
              and(
                eq(formSection.formTemplateId, id),
                eq(formSection.tenantId, tenantId),
                isNull(formSection.deletedAt)
              )
            );

          if (!sectionCount || sectionCount.count === 0) {
            set.status = 400;
            return {
              success: false,
              error: {
                code: "VALIDATION_ERROR",
                message:
                  "Cannot publish template without sections. Please add at least one section.",
                timestamp: new Date().toISOString(),
              },
            };
          }

          // Verify template has at least one field
          const [fieldCount] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(formField)
            .innerJoin(
              formSection,
              eq(formField.formSectionId, formSection.id)
            )
            .where(
              and(
                eq(formSection.formTemplateId, id),
                eq(formField.tenantId, tenantId),
                isNull(formField.deletedAt),
                isNull(formSection.deletedAt)
              )
            );

          if (!fieldCount || fieldCount.count === 0) {
            set.status = 400;
            return {
              success: false,
              error: {
                code: "VALIDATION_ERROR",
                message:
                  "Cannot publish template without fields. Please add at least one field to a section.",
                timestamp: new Date().toISOString(),
              },
            };
          }
        }

        // Toggle status: draft ↔ published
        const newStatus = template.status === "draft" ? "published" : "draft";

        const [updatedTemplate] = await db
          .update(formTemplate)
          .set({
            status: newStatus,
            updatedAt: new Date(),
          })
          .where(eq(formTemplate.id, id))
          .returning();

        return {
          success: true,
          data: updatedTemplate,
          message: `Template ${newStatus === "published" ? "published" : "unpublished"} successfully`,
        };
      } catch (error: any) {
        console.error("Error toggling publish status:", error);

        set.status = 500;
        return {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to toggle publish status",
            timestamp: new Date().toISOString(),
          },
        };
      }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      detail: {
        summary: "Toggle form template publish status",
        description:
          "Toggles template between draft and published status (Admin only)",
        tags: ["Form Templates"],
      },
    }
  );

