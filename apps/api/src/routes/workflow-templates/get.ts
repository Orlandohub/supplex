import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { workflowTemplate } from "@supplex/db";
import { requireAdmin } from "../../lib/rbac/middleware";
import { eq, and, isNull } from "drizzle-orm";
import { ApiError, Errors } from "../../lib/errors";

/**
 * GET /api/workflow-templates/:workflowId
 * Get a single workflow template by ID
 *
 * Auth: Requires Admin role
 * Tenant: Automatically filters by tenant_id from authenticated user's JWT
 * Returns: Template with steps and approvers
 */
export const getWorkflowTemplateRoute = new Elysia()
  .use(requireAdmin)
  .get(
    "/:workflowId",
    async ({ params, user, set, requestLogger }: any) => {
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
          throw Errors.notFound("Workflow template not found");
        }

        return {
          success: true,
          data: template,
        };
      } catch (error: any) {
        if (error instanceof ApiError) throw error;
        requestLogger.error({ err: error }, "Workflow template fetch failed");
        throw Errors.internal("Failed to fetch workflow template");
      }
    },
    {
      params: t.Object({
        workflowId: t.String(),
      }),
    }
  );




