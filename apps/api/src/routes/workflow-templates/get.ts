import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { workflowTemplate } from "@supplex/db";
import { authenticate } from "../../lib/rbac/middleware";
import { UserRole } from "@supplex/types";
import { eq, and, isNull } from "drizzle-orm";

/**
 * GET /api/workflow-templates/:workflowId
 * Get a single workflow template by ID
 *
 * Auth: Requires Admin role
 * Tenant: Automatically filters by tenant_id from authenticated user's JWT
 * Returns: Template with steps and approvers
 */
export const getWorkflowTemplateRoute = new Elysia()
  .use(authenticate)
  .get(
    "/:workflowId",
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
        const { workflowId } = params;

        // Fetch template with its steps and approvers
        const template = await db.query.workflowTemplate.findFirst({
          where: and(
            eq(workflowTemplate.id, workflowId),
            eq(workflowTemplate.tenantId, tenantId),
            isNull(workflowTemplate.deletedAt)
          ),
          with: {
            steps: true,
          },
        });

        if (!template) {
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

        return {
          success: true,
          data: template,
        };
      } catch (error: any) {
        console.error("Error fetching workflow template:", error);
        set.status = 500;
        return {
          success: false,
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to fetch workflow template",
            timestamp: new Date().toISOString(),
          },
        };
      }
    },
    {
      params: t.Object({
        workflowId: t.String(),
      }),
    }
  );




