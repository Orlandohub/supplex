import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { formTemplate } from "@supplex/db";
import { authenticate } from "../../lib/rbac/middleware";
import { UserRole } from "@supplex/types";

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
  .use(authenticate)
  .post(
    "/",
    async ({ body, user, set }: any) => {
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
        const { name } = body;

        // Create form template with draft status
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
          throw new Error("Failed to create form template");
        }

        set.status = 201;
        return {
          success: true,
          data: newTemplate,
        };
      } catch (error: any) {
        console.error("Error creating form template:", error);

        set.status = 500;
        return {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to create form template",
            timestamp: new Date().toISOString(),
          },
        };
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

