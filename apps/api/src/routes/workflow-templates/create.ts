import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { workflowTemplate } from "@supplex/db";
import { authenticate } from "../../lib/rbac/middleware";
import { UserRole } from "@supplex/types";
import { logWorkflowEvent, WorkflowEventType } from "../../services/workflow-event-logger";

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
  .use(authenticate)
  .post(
    "/",
    async ({ body, user, set }: any) => {
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
        const userId = user.id as string;
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
      } catch (error: any) {
        console.error("Error creating workflow template:", error);
        set.status = 500;
        return {
          success: false,
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create workflow template",
            timestamp: new Date().toISOString(),
          },
        };
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


