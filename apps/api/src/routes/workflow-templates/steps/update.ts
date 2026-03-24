import { Elysia, t } from "elysia";
import { db } from "../../../lib/db";
import {
  workflowTemplate,
  workflowStepTemplate,
  formTemplate,
} from "@supplex/db";
import { authenticate } from "../../../lib/rbac/middleware";
import { UserRole } from "@supplex/types";
import { eq, and, isNull } from "drizzle-orm";

/**
 * PUT /api/workflow-templates/:workflowId/steps/:stepId
 * Update a workflow step
 *
 * Auth: Requires Admin role
 * Tenant: Automatically filters by tenant_id from authenticated user's JWT
 * Immutability: Rejects if template is published/archived
 * Returns: Updated step
 */
export const updateStepRoute = new Elysia()
  .use(authenticate)
  .put(
    "/:workflowId/steps/:stepId",
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

        // Validate form template if provided
        if (body.formTemplateId) {
          const formTemplateRecord = await db.query.formTemplate.findFirst({
            where: and(
              eq(formTemplate.id, body.formTemplateId),
              eq(formTemplate.tenantId, tenantId),
              isNull(formTemplate.deletedAt)
            ),
          });

          if (!formTemplateRecord) {
            set.status = 400;
            return {
              success: false,
              error: {
                code: "INVALID_FORM_TEMPLATE",
                message: "Form template not found",
                timestamp: new Date().toISOString(),
              },
            };
          }

          // Verify template is published
          if (formTemplateRecord.status !== "published") {
            set.status = 400;
            return {
              success: false,
              error: {
                code: "FORM_TEMPLATE_NOT_PUBLISHED",
                message: "Only published form templates can be used in workflow templates",
                timestamp: new Date().toISOString(),
              },
            };
          }
        }

        // Document template validation removed - legacy feature (Migration 0017)

        // Validation config validation (Story 2.2.15)
        if (body.requiresValidation) {
          if (!body.validationConfig?.approverRoles || body.validationConfig.approverRoles.length === 0) {
            set.status = 400;
            return {
              success: false,
              error: {
                code: "INVALID_VALIDATION_CONFIG",
                message: "When requiresValidation is true, validationConfig.approverRoles must be a non-empty array",
                timestamp: new Date().toISOString(),
              },
            };
          }
        }

        // Update step
        const [updated] = await db
          .update(workflowStepTemplate)
          .set({
            name: body.name,
            stepType: body.stepType,
            taskTitle: body.taskTitle || null,
            taskDescription: body.taskDescription || null,
            dueDays: body.dueDays || null,
            assigneeType: body.assigneeType || null,
            assigneeRole: body.assigneeRole || null,
            assigneeUserId: body.assigneeUserId || null,
            formTemplateId: body.formTemplateId || null,
            formActionMode: body.formActionMode || null,
            documentTemplateId: body.documentTemplateId || null,
            documentActionMode: body.documentActionMode || null,
            multiApprover: body.multiApprover ?? false,
            approverCount: body.approverCount || null,
            declineReturnsToStepOffset: body.declineReturnsToStepOffset ?? 1,
            requiresValidation: body.requiresValidation ?? false,
            validationConfig: body.validationConfig ?? {},
            completionStatus: body.completionStatus !== undefined ? body.completionStatus : step.completionStatus,
            workflowStatusId: body.workflowStatusId !== undefined ? (body.workflowStatusId || null) : step.workflowStatusId,
            metadata: body.metadata || {},
            updatedAt: new Date(),
          })
          .where(eq(workflowStepTemplate.id, stepId))
          .returning();

        return {
          success: true,
          data: updated,
        };
      } catch (error: any) {
        console.error("Error updating step:", error);
        set.status = 500;
        return {
          success: false,
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to update step",
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
        name: t.String({ minLength: 1, maxLength: 255 }),
        stepType: t.Union([
          t.Literal("form"),
          t.Literal("approval"),
          t.Literal("document"),
          t.Literal("task"),
        ]),
        taskTitle: t.Optional(t.String({ maxLength: 300 })),
        taskDescription: t.Optional(t.String()),
        dueDays: t.Optional(t.Number()),
        assigneeType: t.Optional(t.Union([t.Literal("role"), t.Literal("user")])),
        assigneeRole: t.Optional(t.String({ maxLength: 50 })),
        assigneeUserId: t.Optional(t.Nullable(t.String())),
        formTemplateId: t.Optional(t.String()),
        formActionMode: t.Optional(t.Nullable(
          t.Union([t.Literal("fill_out"), t.Literal("validate")])
        )),
        documentTemplateId: t.Optional(t.String()),
        documentActionMode: t.Optional(t.Nullable(
          t.Union([t.Literal("upload"), t.Literal("validate")])
        )),
        multiApprover: t.Optional(t.Boolean()),
        approverCount: t.Optional(t.Number()),
        declineReturnsToStepOffset: t.Optional(t.Number()),
        requiresValidation: t.Optional(t.Boolean()),
        validationConfig: t.Optional(
          t.Object({
            approverRoles: t.Array(t.String()),
            requireAllApprovals: t.Optional(t.Boolean()),
          })
        ),
        completionStatus: t.Optional(t.Union([t.String({ maxLength: 100 }), t.Null()])),
        workflowStatusId: t.Optional(t.Nullable(t.String())),
        metadata: t.Optional(t.Any()),
      }),
    }
  );

