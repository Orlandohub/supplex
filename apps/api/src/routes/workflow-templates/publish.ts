import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { workflowTemplate, workflowStepTemplate } from "@supplex/db";
import { eq, and, isNull, ne, sql } from "drizzle-orm";
import { requireAdmin } from "../../lib/rbac/middleware";
import {
  logWorkflowEvent,
  WorkflowEventType,
} from "../../services/workflow-event-logger";
import { ApiError, Errors } from "../../lib/errors";

/**
 * PATCH /api/workflow-templates/:id/publish
 * Toggle workflow template publish status (Admin only)
 *
 * Auth: Requires Admin role
 * Tenant: Enforces tenant isolation
 * Validation:
 * - Template must have at least one step to publish
 *
 * Behavior: Toggles between draft ↔ published status
 * Returns: Updated template
 */
export const publishWorkflowTemplateRoute = new Elysia()
  .use(requireAdmin)
  .patch(
    "/:templateId/publish",
    async ({ params, user, requestLogger }: any) => {
      try {
        const tenantId = user.tenantId as string;
        const { templateId } = params;

        // Verify template exists and belongs to user's tenant
        const [template] = await db
          .select()
          .from(workflowTemplate)
          .where(
            and(
              eq(workflowTemplate.id, templateId),
              eq(workflowTemplate.tenantId, tenantId),
              isNull(workflowTemplate.deletedAt)
            )
          )
          .limit(1);

        if (!template) {
          throw Errors.notFound(
            "Workflow template not found or you don't have access to it",
            "TEMPLATE_NOT_FOUND"
          );
        }

        // If publishing (draft → published), validate structure
        if (template.status === "draft") {
          // Verify template has at least one step
          const [stepCount] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(workflowStepTemplate)
            .where(
              and(
                eq(workflowStepTemplate.workflowTemplateId, templateId),
                eq(workflowStepTemplate.tenantId, tenantId),
                isNull(workflowStepTemplate.deletedAt)
              )
            );

          if (!stepCount || stepCount.count === 0) {
            throw Errors.badRequest(
              "Cannot publish template without steps. Please add at least one step.",
              "VALIDATION_ERROR"
            );
          }

          // Duplicate name: only one published template per tenant with a given name
          const [nameConflict] = await db
            .select({ id: workflowTemplate.id })
            .from(workflowTemplate)
            .where(
              and(
                eq(workflowTemplate.tenantId, tenantId),
                eq(workflowTemplate.status, "published"),
                isNull(workflowTemplate.deletedAt),
                ne(workflowTemplate.id, templateId),
                sql`LOWER(TRIM(${workflowTemplate.name})) = LOWER(TRIM(${template.name}))`
              )
            )
            .limit(1);

          if (nameConflict) {
            throw Errors.conflict(
              "A published workflow template with this name already exists. Rename this template before publishing.",
              "DUPLICATE_TEMPLATE_NAME"
            );
          }
        }

        // Toggle status: draft ↔ published
        const newStatus = template.status === "draft" ? "published" : "draft";

        const [updatedTemplate] = await db
          .update(workflowTemplate)
          .set({
            status: newStatus,
            updatedAt: new Date(),
          })
          .where(eq(workflowTemplate.id, templateId))
          .returning();

        logWorkflowEvent({
          tenantId,
          eventType: WorkflowEventType.TEMPLATE_PUBLISHED,
          eventDescription: `Template ${newStatus === "published" ? "published" : "unpublished"}: ${updatedTemplate.name}`,
          actorUserId: user.id,
          actorName: user.fullName,
          actorRole: user.role,
          entityType: "workflow_template",
          entityId: updatedTemplate.id,
          metadata: { newStatus },
        });

        return {
          success: true,
          data: updatedTemplate,
          message: `Template ${newStatus === "published" ? "published" : "unpublished"} successfully`,
        };
      } catch (error: any) {
        if (error instanceof ApiError) throw error;
        requestLogger.error(
          { err: error },
          "Workflow template publish toggle failed"
        );
        throw Errors.internal("Failed to toggle publish status");
      }
    },
    {
      params: t.Object({
        templateId: t.String({ format: "uuid" }),
      }),
      detail: {
        summary: "Toggle workflow template publish status",
        description:
          "Toggles template between draft and published status (Admin only)",
        tags: ["Workflow Templates"],
      },
    }
  );
