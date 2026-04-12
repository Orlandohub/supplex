import { Elysia, t } from "elysia";
import { db } from "../../../lib/db";
import {
  workflowTemplate,
  workflowStepTemplate,
  formTemplate,
} from "@supplex/db";
import { requireAdmin } from "../../../lib/rbac/middleware";
import { eq, and, isNull } from "drizzle-orm";
import { ApiError, Errors } from "../../../lib/errors";

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
  .use(requireAdmin)
  .put(
    "/:workflowId/steps/:stepId",
    async ({ params, body, user, set, requestLogger }: any) => {
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
          throw Errors.notFound("Workflow template not found");
        }

        // Enforce immutability
        if (template.status !== "draft") {
          throw Errors.badRequest("Cannot modify published template. Please copy the template to make changes.", "TEMPLATE_PUBLISHED");
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
          throw Errors.notFound("Step not found");
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

          // Verify template is published
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
            declineReturnsToStepOffset: body.declineReturnsToStepOffset ?? 1,
            requiresValidation: body.requiresValidation ?? false,
            validationConfig: body.validationConfig ?? {},
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
        if (error instanceof ApiError) throw error;
        requestLogger.error({ err: error }, "Workflow step update failed");
        throw Errors.internal("Failed to update step");
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

