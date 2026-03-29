import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { workflowTemplate } from "@supplex/db";
import { authenticate } from "../../lib/rbac/middleware";
import { UserRole } from "@supplex/types";
import { eq, and, isNull } from "drizzle-orm";

/**
 * PATCH /api/workflow-templates/:templateId/toggle-active
 * Toggle workflow template active status (Admin only)
 *
 * Auth: Requires Admin role
 * Tenant: Automatically filters by tenant_id from authenticated user's JWT
 * Behavior: Toggles active status between true and false
 * Returns: Updated template
 */
export const toggleActiveWorkflowTemplateRoute = new Elysia()
  .use(authenticate)
  .patch(
    "/:templateId/toggle-active",
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
        const { templateId } = params;

        // Fetch template and verify tenant ownership
        const existing = await db.query.workflowTemplate.findFirst({
          where: and(
            eq(workflowTemplate.id, templateId),
            eq(workflowTemplate.tenantId, tenantId),
            isNull(workflowTemplate.deletedAt)
          ),
        });

        if (!existing) {
          set.status = 404;
          return {
            success: false,
            error: {
              code: "NOT_FOUND",
              message: "Workflow template not found",
              timestamp: new Date().toISOString(),
            },
          };
        }

        if (existing.status !== "published") {
          set.status = 400;
          return {
            success: false,
            error: {
              code: "INVALID_STATE",
              message:
                "Active/inactive is only available for published templates. Publish the template first.",
              timestamp: new Date().toISOString(),
            },
          };
        }

        // Toggle active status
        const [updated] = await db
          .update(workflowTemplate)
          .set({
            active: !existing.active,
            updatedAt: new Date(),
          })
          .where(eq(workflowTemplate.id, templateId))
          .returning();

        return {
          success: true,
          data: updated,
        };
      } catch (error: any) {
        console.error("Error toggling workflow template active status:", error);
        set.status = 500;
        return {
          success: false,
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to toggle workflow template active status",
            timestamp: new Date().toISOString(),
          },
        };
      }
    },
    {
      params: t.Object({
        templateId: t.String(),
      }),
    }
  );

