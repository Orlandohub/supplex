/**
 * Workflow Instantiation API Route
 * Story: 2.2.8 - Workflow Execution Engine
 * Updated: 2.2.14 - Remove Template Versioning
 * 
 * POST /api/workflows/instantiate
 * 
 * Creates a new workflow process instance from a published workflow template
 */

import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import {
  workflowTemplate,
  workflowStepTemplate,
  processInstance,
  stepInstance,
} from "@supplex/db";
import { eq, and, asc, isNull } from "drizzle-orm";
import { createTasksForStep } from "../../lib/workflow-engine/create-tasks-for-step";
import { seedStepDocuments } from "../../lib/workflow-engine/seed-step-documents";
import { authenticate } from "../../lib/rbac/middleware";
import { logWorkflowEvent, WorkflowEventType } from "../../services/workflow-event-logger";
import { WorkflowProcessStatus } from "@supplex/types";

export const instantiateRoute = new Elysia()
  .use(authenticate)
  .post(
    "/instantiate",
    async ({ body, user }) => {
      const { workflowTemplateId, entityType, entityId, metadata } =
        body;

      // Validate user authentication
      if (!user?.id || !user?.tenantId) {
        return {
          success: false,
          error: "Unauthorized",
        };
      }

      try {
        // Query workflow template (with tenant filter)
        const template = await db.query.workflowTemplate.findFirst({
          where: and(
            eq(workflowTemplate.id, workflowTemplateId),
            eq(workflowTemplate.tenantId, user.tenantId),
            isNull(workflowTemplate.deletedAt)
          ),
        });

        if (!template) {
          return {
            success: false,
            error: "Workflow template not found",
          };
        }

        // Verify status = 'published' and active
        if (template.status !== "published") {
          return {
            success: false,
            error: "Workflow template is not published",
          };
        }

        if (!template.active) {
          return {
            success: false,
            error: "Workflow template is not active",
          };
        }

        // Create process_instance with workflow name in metadata
        const [process] = await db
          .insert(processInstance)
          .values({
            tenantId: user.tenantId,
            processType: metadata?.processType || "workflow_execution",
            entityType: entityType || "workflow",
            entityId: entityId || workflowTemplateId,
            status: "in_progress",
            workflowTemplateId,
            workflowName: template.name,
            initiatedBy: user.id,
            initiatedDate: new Date(),
            metadata: metadata || {},
          })
          .returning();

        // Query all workflow step templates (ordered by step_order)
        const stepTemplates = await db
          .select()
          .from(workflowStepTemplate)
          .where(
            and(
              eq(
                workflowStepTemplate.workflowTemplateId,
                workflowTemplateId
              ),
              eq(workflowStepTemplate.tenantId, user.tenantId),
              isNull(workflowStepTemplate.deletedAt)
            )
          )
          .orderBy(asc(workflowStepTemplate.stepOrder));

        if (stepTemplates.length === 0) {
          // Rollback: delete process if no steps exist
          await db
            .delete(processInstance)
            .where(eq(processInstance.id, process.id));

          return {
            success: false,
            error: "Workflow template has no steps",
          };
        }

        // Create step_instance records for ALL steps
        const createdSteps: typeof stepInstance.$inferSelect[] = [];

        for (const stepTemplate of stepTemplates) {
          const isFirstStep = stepTemplate.stepOrder === 1;

          const [step] = await db
            .insert(stepInstance)
            .values({
              tenantId: user.tenantId,
              processInstanceId: process.id,
              stepOrder: stepTemplate.stepOrder,
              stepName: stepTemplate.name,
              stepType: stepTemplate.stepType,
              workflowStepTemplateId: stepTemplate.id,
              status: isFirstStep ? "active" : "blocked",
              metadata: {},
            })
            .returning();

          createdSteps.push(step);

          // For the first step, create tasks and seed documents immediately
          if (isFirstStep) {
            await createTasksForStep(
              step.id,
              stepTemplate.id,
              process.id,
              user.tenantId
            );

            if (stepTemplate.stepType === "document" && stepTemplate.documentTemplateId) {
              await seedStepDocuments(
                step.id,
                process.id,
                stepTemplate.id,
                user.tenantId
              );
            }
          }
        }

        const firstStep = createdSteps.find((s) => s.stepOrder === 1);

        await db
          .update(processInstance)
          .set({
            status: WorkflowProcessStatus.IN_PROGRESS,
            currentStepInstanceId: firstStep?.id ?? null,
            updatedAt: new Date(),
          })
          .where(eq(processInstance.id, process.id));

        logWorkflowEvent({
          tenantId: user.tenantId,
          processInstanceId: process.id,
          stepInstanceId: firstStep?.id,
          eventType: WorkflowEventType.PROCESS_INSTANTIATED,
          eventDescription: firstStep
            ? `Workflow Started: ${template.name} - Step ${firstStep.stepName} Active`
            : `Workflow Started: ${template.name}`,
          actorUserId: user.id,
          actorName: user.fullName,
          actorRole: user.role,
          metadata: { workflowTemplateName: template.name, totalSteps: createdSteps.length },
        });

        return {
          success: true,
          data: {
            processInstanceId: process.id,
            firstStepId: firstStep?.id,
            status: WorkflowProcessStatus.IN_PROGRESS,
            initiatedDate: process.initiatedDate,
            totalSteps: createdSteps.length,
          },
        };
      } catch (error) {
        console.error("Error instantiating workflow:", error);
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to instantiate workflow",
        };
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

