import { Elysia, t } from "elysia";
import { db } from "../../../lib/db";
import {
  workflowTemplate,
  workflowStepTemplate,
  formTemplate,
} from "@supplex/db";
import { requireAdmin } from "../../../lib/rbac/middleware";
import { eq, and, isNull, desc } from "drizzle-orm";
import { ApiError, Errors } from "../../../lib/errors";

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
  .use(requireAdmin)
  .post(
    "/:workflowId/steps",
    async ({ params, body, user, set, requestLogger }: any) => {
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
          throw Errors.notFound("Workflow template not found");
        }

        // Enforce immutability
        if (template.status !== "draft") {
          throw Errors.badRequest("Cannot modify published template. Please copy the template to make changes.", "TEMPLATE_PUBLISHED");
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
            throw Errors.badRequest("Form template not found", "INVALID_FORM_TEMPLATE");
          }

          // Verify it's published (only published templates should be referenced in workflow templates)
          if (formTemplateRecord.status !== "published") {
            throw Errors.badRequest("Only published form templates can be used in workflow templates", "FORM_TEMPLATE_NOT_PUBLISHED");
          }
        }

        // Mandatory template selection (Story 2.2.18)
        if (body.stepType === "form" && !body.formTemplateId) {
          throw Errors.badRequest("A form template is required for form steps", "MISSING_FORM_TEMPLATE");
        }
        if (body.stepType === "document" && !body.documentTemplateId) {
          throw Errors.badRequest("A document template is required for document steps", "MISSING_DOCUMENT_TEMPLATE");
        }

        // Validation config validation (Story 2.2.15)
        if (body.requiresValidation) {
          if (!body.validationConfig?.approverRoles || body.validationConfig.approverRoles.length === 0) {
            throw Errors.badRequest("When requiresValidation is true, validationConfig.approverRoles must be a non-empty array", "INVALID_VALIDATION_CONFIG");
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
        if (error instanceof ApiError) throw error;
        requestLogger.error({ err: error }, "Workflow step creation failed");
        throw Errors.internal("Failed to create step");
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
        declineReturnsToStepOffset: t.Optional(t.Number()),
        requiresValidation: t.Optional(t.Boolean()),
        validationConfig: t.Optional(
          t.Object({
            approverRoles: t.Array(t.String()),
            requireAllApprovals: t.Optional(t.Boolean()),
            validationDueDays: t.Optional(t.Number()),
          })
        ),
        metadata: t.Optional(t.Any()),
      }),
    }
  );

