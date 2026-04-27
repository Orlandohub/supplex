import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { workflowTemplate } from "@supplex/db";
import { requireAdmin } from "../../lib/rbac/middleware";
import { authenticatedRoute } from "../../lib/route-plugins";
import {
  logWorkflowEvent,
  WorkflowEventType,
} from "../../services/workflow-event-logger";
import { ApiError, Errors } from "../../lib/errors";

/**
 * POST /api/workflow-templates
 * Create a new workflow template (Admin only)
 *
 * Auth: Requires Admin role
 * Tenant: Automatically sets tenant_id from authenticated user's JWT
 * Behavior: Creates template with status='draft', active=true
 * Returns: Created template
 */
export const createWorkflowTemplateRoute = new Elysia()
  .use(authenticatedRoute)
  .use(requireAdmin)
  .post(
    "/",
    async ({ body, user, requestLogger }) => {
      try {
        const tenantId = user.tenantId;
        const userId = user.id;
        const { name, description, active } = body;

        // Create workflow template with draft status
        const [newTemplate] = await db
          .insert(workflowTemplate)
          .values({
            tenantId,
            name,
            description,
            active: active ?? true,
            status: "draft",
            createdBy: userId,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        if (!newTemplate) throw new Error("Failed to create workflow template");

        logWorkflowEvent({
          tenantId,
          eventType: WorkflowEventType.TEMPLATE_CREATED,
          eventDescription: `Template created: ${name}`,
          actorUserId: userId,
          actorName: user.fullName,
          actorRole: user.role,
          entityType: "workflow_template",
          entityId: newTemplate.id,
        });

        return {
          success: true,
          data: newTemplate,
        };
      } catch (error: unknown) {
        if (error instanceof ApiError) throw error;
        requestLogger.error(
          { err: error },
          "Workflow template creation failed"
        );
        throw Errors.internal("Failed to create workflow template");
      }
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 255 }),
        description: t.Optional(t.String()),
        active: t.Optional(t.Boolean()),
      }),
    }
  );
