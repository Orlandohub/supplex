import { Elysia, t } from "elysia";
import { db } from "../../../lib/db";
import { workflowTemplate, workflowStepTemplate } from "@supplex/db";
import { requireAdmin } from "../../../lib/rbac/middleware";
import { authenticatedRoute } from "../../../lib/route-plugins";
import { eq, and, isNull, asc } from "drizzle-orm";
import { ApiError, Errors } from "../../../lib/errors";

/**
 * GET /api/workflow-templates/:workflowId/steps
 * Get ordered list of steps for a workflow template
 *
 * Auth: Requires Admin role
 * Tenant: Automatically filters by tenant_id from authenticated user's JWT
 * Returns: Array of steps ordered by step_order
 */
export const listStepsRoute = new Elysia()
  .use(authenticatedRoute)
  .use(requireAdmin)
  .get(
    "/:workflowId/steps",
    async ({ params, user, requestLogger }) => {
      try {
        const tenantId = user.tenantId;
        const { workflowId } = params;

        // Verify template exists
        const template = await db.query.workflowTemplate.findFirst({
          where: and(
            eq(workflowTemplate.id, workflowId),
            eq(workflowTemplate.tenantId, tenantId),
            isNull(workflowTemplate.deletedAt)
          ),
        });

        if (!template) {
          throw Errors.notFound("Workflow template not found");
        }

        const steps = await db.query.workflowStepTemplate.findMany({
          where: and(
            eq(workflowStepTemplate.workflowTemplateId, workflowId),
            eq(workflowStepTemplate.tenantId, tenantId),
            isNull(workflowStepTemplate.deletedAt)
          ),
          orderBy: [asc(workflowStepTemplate.stepOrder)],
        });

        return {
          success: true,
          data: steps,
        };
      } catch (error: unknown) {
        if (error instanceof ApiError) throw error;
        requestLogger.error({ err: error }, "Workflow steps list failed");
        throw Errors.internal("Failed to list steps");
      }
    },
    {
      params: t.Object({
        workflowId: t.String(),
      }),
    }
  );
