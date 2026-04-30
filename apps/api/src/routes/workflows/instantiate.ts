/**
 * Workflow Instantiation API Route
 * Story: 2.2.8 - Workflow Execution Engine
 * Updated: 2.2.14 - Remove Template Versioning
 * Updated: 2.2.19 - Delegate to library function (remove duplicate code)
 *
 * POST /api/workflows/instantiate
 *
 * Creates a new workflow process instance from a published workflow template
 */

import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { workflowTemplate } from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import { requirePermission } from "../../lib/rbac/middleware";
import { authenticatedRoute } from "../../lib/route-plugins";
import { PermissionAction } from "@supplex/types";
import {
  logWorkflowEvent,
  WorkflowEventType,
} from "../../services/workflow-event-logger";
import { instantiateWorkflow } from "../../lib/workflow-engine/instantiate-workflow";
import { WorkflowProcessStatus } from "@supplex/types";
import { ApiError, Errors } from "../../lib/errors";

export const instantiateRoute = new Elysia()
  .use(authenticatedRoute)
  .use(requirePermission(PermissionAction.CREATE_QUALIFICATIONS))
  .post(
    "/instantiate",
    async ({ body, user, requestLogger, correlationId: corrId }) => {
      const { workflowTemplateId, entityType, entityId, metadata } = body;

      if (!user?.id || !user?.tenantId) {
        throw Errors.unauthorized("Unauthorized");
      }

      try {
        // Read template name for logging (outside the transaction)
        const [template] = await db
          .select({ name: workflowTemplate.name })
          .from(workflowTemplate)
          .where(
            and(
              eq(workflowTemplate.id, workflowTemplateId),
              eq(workflowTemplate.tenantId, user.tenantId),
              isNull(workflowTemplate.deletedAt)
            )
          );

        const result = await instantiateWorkflow(db, {
          tenantId: user.tenantId,
          workflowTemplateId,
          entityType: entityType || "workflow",
          entityId: entityId || workflowTemplateId,
          initiatedBy: user.id,
          workflowName: template?.name,
          metadata: metadata || {},
        });

        if (!result.success) {
          throw Errors.badRequest(
            result.error ?? "Failed to instantiate workflow"
          );
        }

        const { processInstance: process, steps } = result.data;
        const firstStep = steps.find((s) => s.stepOrder === 1);

        // Event logging OUTSIDE the transaction (fire-and-forget)
        logWorkflowEvent({
          tenantId: user.tenantId,
          processInstanceId: process.id,
          stepInstanceId: firstStep?.id,
          eventType: WorkflowEventType.PROCESS_INSTANTIATED,
          eventDescription: firstStep
            ? `Workflow Started: ${template?.name ?? "Unknown"} - Step ${firstStep.stepName} Active`
            : `Workflow Started: ${template?.name ?? "Unknown"}`,
          actorUserId: user.id,
          actorName: user.fullName,
          actorRole: user.role,
          metadata: {
            workflowTemplateName: template?.name,
            totalSteps: steps.length,
          },
          correlationId: corrId,
        });

        return {
          success: true,
          data: {
            processInstanceId: process.id,
            firstStepId: firstStep?.id,
            status: WorkflowProcessStatus.IN_PROGRESS,
            initiatedDate: process.initiatedDate,
            totalSteps: steps.length,
          },
        };
      } catch (error) {
        if (error instanceof ApiError) throw error;
        requestLogger.error({ err: error }, "error instantiating workflow");
        throw Errors.internal("Failed to instantiate workflow");
      }
    },
    {
      body: t.Object({
        workflowTemplateId: t.String({ format: "uuid" }),
        entityType: t.Optional(t.String()),
        entityId: t.Optional(t.String({ format: "uuid" })),
        metadata: t.Optional(t.Record(t.String(), t.Any())),
      }),
      detail: {
        summary: "Instantiate Workflow",
        description:
          "Creates a new workflow process instance from a published workflow template",
        tags: ["Workflows"],
      },
    }
  );
