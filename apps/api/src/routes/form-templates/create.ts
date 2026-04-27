import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { formTemplate } from "@supplex/db";
import { requireAdmin } from "../../lib/rbac/middleware";
import { authenticatedRoute } from "../../lib/route-plugins";
import { ApiError, Errors } from "../../lib/errors";

/**
 * POST /api/form-templates
 * Create a new form template (Admin only)
 *
 * Auth: Requires Admin role
 * Tenant: Automatically sets tenant_id from authenticated user's JWT
 * Behavior: Creates template with status='draft', isActive=true
 * Returns: Created template
 */
export const createFormTemplateRoute = new Elysia()
  .use(authenticatedRoute)
  .use(requireAdmin)
  .post(
    "/",
    async ({ body, user, set, requestLogger }) => {
      try {
        const tenantId = user.tenantId;
        const { name } = body;

        const [newTemplate] = await db
          .insert(formTemplate)
          .values({
            tenantId,
            name,
            status: "draft",
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        if (!newTemplate) {
          throw Errors.internal("Failed to create form template");
        }

        set.status = 201;
        return {
          success: true,
          data: newTemplate,
        };
      } catch (error: unknown) {
        if (error instanceof ApiError) throw error;
        requestLogger.error({ err: error }, "Error creating form template");
        throw Errors.internal("Failed to create form template");
      }
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 255 }),
      }),
      detail: {
        summary: "Create new form template",
        description:
          "Creates a new form template with draft status (Admin only)",
        tags: ["Form Templates"],
      },
    }
  );
