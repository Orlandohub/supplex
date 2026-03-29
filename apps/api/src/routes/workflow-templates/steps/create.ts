import { Elysia, t } from "elysia";
import { db } from "../../../lib/db";
import {
  workflowTemplate,
  workflowStepTemplate,
  formTemplate,
} from "@supplex/db";
import { authenticate } from "../../../lib/rbac/middleware";
import { UserRole } from "@supplex/types";
import { eq, and, isNull, desc } from "drizzle-orm";

/**
 * POST /api/workflow-templates/:workflowId/steps
 * Create a new step in a workflow template
 *
 * Auth: Requires Admin role
 * Tenant: Automatically sets tenant_id from authenticated user's JWT
 * Behavior: Creates step, auto-assigns step_order (max + 1)
 * Immutability: Rejects if template is published/archived
 * Returns: Created step
 */
export const createStepRoute = new Elysia()
  .use(authenticate)
  .post(
    "/:workflowId/steps",
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

          // Verify it's published (only published templates should be referenced in workflow templates)
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

        // Get max step_order
        const maxStepOrder = await db.query.workflowStepTemplate.findFirst({
          where: and(
            eq(workflowStepTemplate.workflowTemplateId, workflowId),
            eq(workflowStepTemplate.tenantId, tenantId),
            isNull(workflowStepTemplate.deletedAt)
          ),
          orderBy: [desc(workflowStepTemplate.stepOrder)],
        });

        const nextOrder = maxStepOrder ? maxStepOrder.stepOrder + 1 : 1;

        // Create step
        const [newStep] = await db
          .insert(workflowStepTemplate)
          .values({
            workflowTemplateId: workflowId,
            tenantId,
            stepOrder: nextOrder,
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
            multiApprover: body.multiApprover || false,
            approverCount: body.approverCount || null,
            declineReturnsToStepOffset: body.declineReturnsToStepOffset || 1,
            requiresValidation: body.requiresValidation || false,
            validationConfig: body.validationConfig || {},
            metadata: body.metadata || {},
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        return {
          success: true,
          data: newStep,
        };
      } catch (error: any) {
        console.error("Error creating step:", error);
        set.status = 500;
        return {
          success: false,
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create step",
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
        metadata: t.Optional(t.Any()),
      }),
    }
  );

