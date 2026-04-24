import { Elysia, t } from "elysia";
import { db } from "../../../lib/db";
import { workflowTemplate, workflowStepTemplate } from "@supplex/db";
import { requireAdmin } from "../../../lib/rbac/middleware";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { ApiError, Errors } from "../../../lib/errors";

/**
 * PUT /api/workflow-templates/:workflowId/steps/reorder
 * Reorder workflow steps
 *
 * Auth: Requires Admin role
 * Tenant: Automatically filters by tenant_id from authenticated user's JWT
 * Behavior: Updates step_order for multiple steps
 * Immutability: Rejects if template is published/archived
 * Returns: Updated steps
 */
export const reorderStepsRoute = new Elysia().use(requireAdmin).put(
  "/:workflowId/steps/reorder",
  async ({ params, body, user, requestLogger }: any) => {
    try {
      const tenantId = user.tenantId as string;
      const { workflowId } = params;
      const { stepOrders } = body; // Array of { stepId, order }

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

      // Enforce immutability
      if (template.status !== "draft") {
        throw Errors.badRequest(
          "Cannot modify published template. Please copy the template to make changes.",
          "TEMPLATE_PUBLISHED"
        );
      }

      // Update step orders in transaction
      await db.transaction(async (tx) => {
        for (const { stepId, order } of stepOrders) {
          await tx
            .update(workflowStepTemplate)
            .set({
              stepOrder: order,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(workflowStepTemplate.id, stepId),
                eq(workflowStepTemplate.workflowTemplateId, workflowId),
                eq(workflowStepTemplate.tenantId, tenantId),
                isNull(workflowStepTemplate.deletedAt)
              )
            );
        }
      });

      // Fetch updated steps
      const stepIds = stepOrders.map((s: any) => s.stepId);
      const updatedSteps = await db.query.workflowStepTemplate.findMany({
        where: and(
          inArray(workflowStepTemplate.id, stepIds),
          eq(workflowStepTemplate.tenantId, tenantId),
          isNull(workflowStepTemplate.deletedAt)
        ),
      });

      return {
        success: true,
        data: updatedSteps,
      };
    } catch (error: any) {
      if (error instanceof ApiError) throw error;
      requestLogger.error({ err: error }, "Workflow steps reorder failed");
      throw Errors.internal("Failed to reorder steps");
    }
  },
  {
    params: t.Object({
      workflowId: t.String(),
    }),
    body: t.Object({
      stepOrders: t.Array(
        t.Object({
          stepId: t.String(),
          order: t.Number(),
        })
      ),
    }),
  }
);
