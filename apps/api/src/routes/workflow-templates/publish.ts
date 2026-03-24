import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { workflowTemplate, workflowStepTemplate } from "@supplex/db";
import { eq, and, isNull, sql } from "drizzle-orm";
import { authenticate } from "../../lib/rbac/middleware";
import { UserRole } from "@supplex/types";
import { logWorkflowEvent, WorkflowEventType } from "../../services/workflow-event-logger";

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
  .use(authenticate)
  .patch(
    "/:templateId/publish",
    async ({ params, user, set }: any) => {
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
          set.status = 404;
          return {
            success: false,
            error: {
              code: "TEMPLATE_NOT_FOUND",
              message:
                "Workflow template not found or you don't have access to it",
              timestamp: new Date().toISOString(),
            },
          };
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
            set.status = 400;
            return {
              success: false,
              error: {
                code: "VALIDATION_ERROR",
                message:
                  "Cannot publish template without steps. Please add at least one step.",
                timestamp: new Date().toISOString(),
              },
            };
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
        console.error("Error toggling publish status:", error);

        set.status = 500;
        return {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to toggle publish status",
            timestamp: new Date().toISOString(),
          },
        };
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
