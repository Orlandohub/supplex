import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { formTemplate } from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import { authenticate } from "../../lib/rbac/middleware";
import { UserRole } from "@supplex/types";

/**
 * PATCH /api/form-templates/:id
 * Update a form template (Admin only)
 *
 * Auth: Requires Admin role
 * Tenant: Enforces tenant isolation - returns 403 for cross-tenant access
 * Updates: Template name and/or status
 * Returns: Updated template
 */
export const updateFormTemplateRoute = new Elysia()
  .use(authenticate)
  .patch(
    "/:id",
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
        const templateId = params.id;

        // Verify template exists and belongs to user's tenant
        const [existingTemplate] = await db
          .select()
          .from(formTemplate)
          .where(
            and(
              eq(formTemplate.id, templateId),
              eq(formTemplate.tenantId, tenantId),
              isNull(formTemplate.deletedAt)
            )
          )
          .limit(1);

        if (!existingTemplate) {
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

        // Build update object dynamically
        const updateData: any = {
          updatedAt: new Date(),
        };

        if (body.name !== undefined) {
          updateData.name = body.name;
        }

        if (body.status !== undefined) {
          updateData.status = body.status;
        }

        // Update template
        const [updatedTemplate] = await db
          .update(formTemplate)
          .set(updateData)
          .where(eq(formTemplate.id, templateId))
          .returning();

        return {
          success: true,
          data: {
            template: updatedTemplate,
          },
        };
      } catch (error: any) {
        console.error("Error updating form template:", error);

        set.status = 500;
        return {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to update form template",
            timestamp: new Date().toISOString(),
          },
        };
      }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
        status: t.Optional(
          t.Union([
            t.Literal("draft"),
            t.Literal("published"),
            t.Literal("archived"),
          ])
        ),
      }),
      detail: {
        summary: "Update form template",
        description:
          "Updates form template name and/or status (Admin only)",
        tags: ["Form Templates"],
      },
    }
  );

