import { Elysia, t } from "elysia";
import { db } from "../../../lib/db";
import {
  workflowTemplate,
  workflowStepTemplate,
} from "@supplex/db";
import { authenticate } from "../../../lib/rbac/middleware";
import { UserRole } from "@supplex/types";
import { eq, and, isNull, inArray } from "drizzle-orm";

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
export const reorderStepsRoute = new Elysia()
  .use(authenticate)
  .put(
    "/:workflowId/steps/reorder",
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

        // Enforce immutability
        if (template.status !== "draft") {
          set.status = 400;
          return {
            success: false,
            error: {
              code: "TEMPLATE_PUBLISHED",
              message: "Cannot modify published template. Please copy the template to make changes.",
              timestamp: new Date().toISOString(),
            },
          };
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
        console.error("Error reordering steps:", error);
        set.status = 500;
        return {
          success: false,
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to reorder steps",
            timestamp: new Date().toISOString(),
          },
        };
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




