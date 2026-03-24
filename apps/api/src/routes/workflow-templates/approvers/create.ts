import { Elysia, t } from "elysia";
import { db } from "../../../lib/db";
import {
  workflowTemplate,
  workflowStepTemplate,
  stepApprover,
} from "@supplex/db";
import { authenticate } from "../../../lib/rbac/middleware";
import { UserRole } from "@supplex/types";
import { eq, and, isNull, desc } from "drizzle-orm";

/**
 * POST /api/workflow-templates/:workflowId/steps/:stepId/approvers
 * Add an approver to a step
 *
 * Auth: Requires Admin role
 * Tenant: Automatically sets tenant_id from authenticated user's JWT
 * Behavior: Creates approver, auto-assigns approver_order (max + 1)
 * Immutability: Rejects if template is published/archived
 * Returns: Created approver
 */
export const createApproverRoute = new Elysia()
  .use(authenticate)
  .post(
    "/:workflowId/steps/:stepId/approvers",
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
        const { workflowId, stepId } = params;

        // Verify template and step exist
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

        const step = await db.query.workflowStepTemplate.findFirst({
          where: and(
            eq(workflowStepTemplate.id, stepId),
            eq(workflowStepTemplate.workflowTemplateId, workflowId),
            eq(workflowStepTemplate.tenantId, tenantId),
            isNull(workflowStepTemplate.deletedAt)
          ),
        });

        if (!step) {
          set.status = 404;
          return {
            success: false,
            error: {
              code: "NOT_FOUND",
              message: "Step not found",
              timestamp: new Date().toISOString(),
            },
          };
        }

        // Validate approver configuration
        const { approverType, approverRole, approverUserId } = body;

        if (approverType === "role" && !approverRole) {
          set.status = 400;
          return {
            success: false,
            error: {
              code: "VALIDATION_ERROR",
              message: "approverRole is required when approverType is 'role'",
              timestamp: new Date().toISOString(),
            },
          };
        }

        if (approverType === "user" && !approverUserId) {
          set.status = 400;
          return {
            success: false,
            error: {
              code: "VALIDATION_ERROR",
              message: "approverUserId is required when approverType is 'user'",
              timestamp: new Date().toISOString(),
            },
          };
        }

        // Get max approver_order
        const maxApproverOrder = await db.query.stepApprover.findFirst({
          where: and(
            eq(stepApprover.workflowStepTemplateId, stepId),
            eq(stepApprover.tenantId, tenantId),
            isNull(stepApprover.deletedAt)
          ),
          orderBy: [desc(stepApprover.approverOrder)],
        });

        const nextOrder = maxApproverOrder ? maxApproverOrder.approverOrder + 1 : 1;

        // Create approver
        const [newApprover] = await db
          .insert(stepApprover)
          .values({
            workflowStepTemplateId: stepId,
            tenantId,
            approverOrder: nextOrder,
            approverType,
            approverRole: approverRole || null,
            approverUserId: approverUserId || null,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        return {
          success: true,
          data: newApprover,
        };
      } catch (error: any) {
        console.error("Error creating approver:", error);
        set.status = 500;
        return {
          success: false,
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create approver",
            timestamp: new Date().toISOString(),
          },
        };
      }
    },
    {
      params: t.Object({
        workflowId: t.String(),
        stepId: t.String(),
      }),
      body: t.Object({
        approverType: t.Union([t.Literal("role"), t.Literal("user")]),
        approverRole: t.Optional(t.String({ maxLength: 50 })),
        approverUserId: t.Optional(t.Nullable(t.String())),
      }),
    }
  );


