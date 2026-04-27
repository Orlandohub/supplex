import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { workflowTemplate } from "@supplex/db";
import { requireAdmin } from "../../lib/rbac/middleware";
import { authenticatedRoute } from "../../lib/route-plugins";
import {
  logWorkflowEvent,
  WorkflowEventType,
} from "../../services/workflow-event-logger";
import { eq, and, isNull } from "drizzle-orm";
import { ApiError, Errors } from "../../lib/errors";

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
  .use(authenticatedRoute)
  .use(requireAdmin)
  .put(
    "/:workflowId",
    async ({ params, body, user, requestLogger }) => {
      try {
        const tenantId = user.tenantId;
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
          throw Errors.notFound("Workflow template not found");
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

        if (!updated) throw new Error("Failed to update workflow template");

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
        if (error instanceof ApiError) throw error;
        requestLogger.error({ err: error }, "Workflow template update failed");
        throw Errors.internal("Failed to update workflow template");
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
