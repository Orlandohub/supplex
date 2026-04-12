/**
 * Copy Workflow Template Endpoint
 * Story: 2.2.14 - Remove Template Versioning, Add Copy Functionality
 *
 * POST /api/workflow-templates/:id/copy
 * Creates a deep copy of a workflow template with all steps and approvers
 */

import { Elysia, t } from "elysia";
import { db } from "@supplex/db";
import {
  workflowTemplate,
  workflowStepTemplate,
} from "@supplex/db";
import { eq, and, isNull, asc } from "drizzle-orm";
import { requireAdmin } from "../../lib/rbac/middleware";
import { logWorkflowEvent, WorkflowEventType } from "../../services/workflow-event-logger";
import { Errors } from "../../lib/errors";

export const copyWorkflowTemplate = new Elysia()
  .use(requireAdmin)
  .post(
    "/workflow-templates/:id/copy",
    async ({ params, body, user, set }: any) => {
      const { id } = params;

      // Fetch original template with tenant isolation
      const [originalTemplate] = await db
        .select()
        .from(workflowTemplate)
        .where(
          and(
            eq(workflowTemplate.id, id),
            eq(workflowTemplate.tenantId, user.tenantId),
            isNull(workflowTemplate.deletedAt)
          )
        );

      if (!originalTemplate) {
        throw Errors.notFound("Workflow template not found");
      }

      // Generate copy name and description
      const copyName = body.name || `Copy of ${originalTemplate.name}`;
      const copyDescription =
        body.description ||
        (originalTemplate.description
          ? `Copy of: ${originalTemplate.description}`
          : null);

      // Start transaction for deep copy
      const result = await db.transaction(async (tx) => {
        // 1. Create new workflow template
        const [newTemplate] = await tx
          .insert(workflowTemplate)
          .values({
            tenantId: user.tenantId,
            name: copyName,
            description: copyDescription,
            active: true,
            status: "draft",
            createdBy: user.id,
          })
          .returning();

        // 2. Fetch all steps from original template
        const steps = await tx
          .select()
          .from(workflowStepTemplate)
          .where(
            and(
              eq(workflowStepTemplate.workflowTemplateId, originalTemplate.id),
              eq(workflowStepTemplate.tenantId, user.tenantId),
              isNull(workflowStepTemplate.deletedAt)
            )
          )
          .orderBy(asc(workflowStepTemplate.stepOrder));

        // 3. Copy steps
        for (const step of steps) {
          await tx
            .insert(workflowStepTemplate)
            .values({
              workflowTemplateId: newTemplate.id,
              tenantId: user.tenantId,
              stepOrder: step.stepOrder,
              name: step.name,
              stepType: step.stepType,
              taskTitle: step.taskTitle,
              taskDescription: step.taskDescription,
              dueDays: step.dueDays,
              assigneeType: step.assigneeType,
              assigneeRole: step.assigneeRole,
              assigneeUserId: step.assigneeUserId,
              formTemplateId: step.formTemplateId,
              formActionMode: step.formActionMode,
              documentTemplateId: step.documentTemplateId,
              documentActionMode: step.documentActionMode,
              declineReturnsToStepOffset: step.declineReturnsToStepOffset,
              requiresValidation: step.requiresValidation,
              validationConfig: step.validationConfig,
              metadata: step.metadata,
            })
            .returning();
        }

        return newTemplate;
      });

      logWorkflowEvent({
        tenantId: user.tenantId,
        eventType: WorkflowEventType.TEMPLATE_COPIED,
        eventDescription: `Template copied: ${copyName} (from ${originalTemplate.name})`,
        actorUserId: user.id,
        actorName: user.fullName,
        actorRole: user.role,
        entityType: "workflow_template",
        entityId: result.id,
        metadata: { sourceTemplateId: originalTemplate.id },
      });

      return {
        success: true,
        data: result,
        message: `Workflow template "${copyName}" created successfully`,
      };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        name: t.Optional(t.String()),
        description: t.Optional(t.String()),
      }),
      detail: {
        summary: "Copy workflow template",
        description:
          "Creates a deep copy of a workflow template with all steps and approvers. Copy is created as draft.",
        tags: ["Workflow Templates"],
      },
    }
  );
