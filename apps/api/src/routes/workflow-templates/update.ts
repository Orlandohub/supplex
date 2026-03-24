import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { workflowTemplate } from "@supplex/db";
import { authenticate } from "../../lib/rbac/middleware";
import { UserRole } from "@supplex/types";
import { logWorkflowEvent, WorkflowEventType } from "../../services/workflow-event-logger";
import { eq, and, isNull } from "drizzle-orm";

/**
 * PUT /api/workflow-templates/:workflowId
 * Update workflow template metadata (name, description only)
 *
 * Auth: Requires Admin role
 * Tenant: Automatically filters by tenant_id from authenticated user's JWT
 * Behavior: Updates only metadata fields, not status or configuration
 * Returns: Updated template
 */
export const updateWorkflowTemplateRoute = new Elysia()
  .use(authenticate)
  .put(
    "/:workflowId",
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
        const { name, description, active, workflowTypeId } = body;

        // Check if template exists and belongs to tenant
        const existing = await db.query.workflowTemplate.findFirst({
          where: and(
            eq(workflowTemplate.id, workflowId),
            eq(workflowTemplate.tenantId, tenantId),
            isNull(workflowTemplate.deletedAt)
          ),
        });

        if (!existing) {
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

        // Build update object
        const updates: any = {
          updatedAt: new Date(),
        };

        if (name !== undefined) {
          updates.name = name;
        }

        if (description !== undefined) {
          updates.description = description;
        }

        if (active !== undefined) {
          updates.active = active;
        }

        if (workflowTypeId !== undefined) {
          updates.workflowTypeId = workflowTypeId;
        }

        // Update template metadata
        const [updated] = await db
          .update(workflowTemplate)
          .set(updates)
          .where(eq(workflowTemplate.id, workflowId))
          .returning();

        logWorkflowEvent({
          tenantId,
          eventType: WorkflowEventType.TEMPLATE_UPDATED,
          eventDescription: `Template updated: ${updated.name}`,
          actorUserId: user.id,
          actorName: user.fullName,
          actorRole: user.role,
          entityType: "workflow_template",
          entityId: updated.id,
        });

        return {
          success: true,
          data: updated,
        };
      } catch (error: any) {
        console.error("Error updating workflow template:", error);
        set.status = 500;
        return {
          success: false,
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to update workflow template",
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
        name: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
        description: t.Optional(t.String()),
        active: t.Optional(t.Boolean()),
        workflowTypeId: t.Optional(t.Nullable(t.String())),
      }),
    }
  );


