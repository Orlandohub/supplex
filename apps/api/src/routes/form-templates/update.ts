import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { formTemplate } from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import { requireAdmin } from "../../lib/rbac/middleware";
import { authenticatedRoute } from "../../lib/route-plugins";
import { ApiError, Errors } from "../../lib/errors";

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
  .use(authenticatedRoute)
  .use(requireAdmin)
  .patch(
    "/:id",
    async ({ params, body, user, requestLogger }) => {
      try {
        const tenantId = user.tenantId;
        const templateId = params.id;

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
          throw Errors.notFound(
            "Form template not found or you don't have access to it",
            "TEMPLATE_NOT_FOUND"
          );
        }

        const updateData: any = {
          updatedAt: new Date(),
        };

        if (body.name !== undefined) {
          updateData.name = body.name;
        }

        if (body.status !== undefined) {
          updateData.status = body.status;
        }

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
      } catch (error: unknown) {
        if (error instanceof ApiError) throw error;
        requestLogger.error({ err: error }, "Error updating form template");
        throw Errors.internal("Failed to update form template");
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
        description: "Updates form template name and/or status (Admin only)",
        tags: ["Form Templates"],
      },
    }
  );
