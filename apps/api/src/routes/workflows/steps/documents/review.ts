import { Elysia, t } from "elysia";
import { db } from "../../../../lib/db";
import {
  workflowStepDocument,
  stepInstance,
  processInstance,
  taskInstance,
} from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import { WorkflowProcessStatus } from "@supplex/types";
import { authenticate } from "../../../../lib/rbac/middleware";
import { transitionToNextStep } from "../../../../lib/workflow-engine/transition-to-next-step";
import { createTasksForStep } from "../../../../lib/workflow-engine/create-tasks-for-step";
import { logWorkflowEvent, WorkflowEventType } from "../../../../services/workflow-event-logger";

/**
 * POST /api/workflows/steps/:stepId/documents/review
 * Batch review: approve/decline individual documents.
 *
 * If any document is declined the step returns to active for re-upload.
 * If all are approved the step completes and workflow advances.
 */
export const reviewStepDocumentsRoute = new Elysia()
  .use(authenticate)
  .post(
    "/steps/:stepInstanceId/documents/review",
    async ({ params, body, user, set }) => {
      if (!user?.id || !user?.tenantId) {
        set.status = 401;
        return { success: false, error: "Unauthorized" };
      }

      const stepId = params.stepInstanceId;
      const { decisions } = body;

      const [step] = await db
        .select()
        .from(stepInstance)
        .where(
          and(
            eq(stepInstance.id, stepId),
            eq(stepInstance.tenantId, user.tenantId)
          )
        );

      if (!step) {
        set.status = 404;
        return { success: false, error: "Step not found" };
      }

      if (step.status !== "awaiting_validation") {
        set.status = 400;
        return { success: false, error: "Step is not awaiting validation" };
      }

      const existingDocs = await db
        .select()
        .from(workflowStepDocument)
        .where(
          and(
            eq(workflowStepDocument.stepInstanceId, stepId),
            eq(workflowStepDocument.tenantId, user.tenantId),
            isNull(workflowStepDocument.deletedAt)
          )
        );

      const docMap = new Map(existingDocs.map((d) => [d.requiredDocumentName, d]));

      const hasDeclines = decisions.some((d: any) => d.action === "decline");

      for (const decision of decisions) {
        const doc = docMap.get(decision.requiredDocumentName);
        if (!doc) continue;

        if (decision.action === "approve") {
          await db
            .update(workflowStepDocument)
            .set({
              status: "approved",
              declineComment: null,
              reviewedBy: user.id,
              reviewedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(workflowStepDocument.id, doc.id));
        } else if (decision.action === "decline") {
          await db
            .update(workflowStepDocument)
            .set({
              status: "declined",
              declineComment: decision.comment || null,
              reviewedBy: user.id,
              reviewedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(workflowStepDocument.id, doc.id));
        }
      }

      if (hasDeclines) {
        // Reset declined docs to pending for re-upload
        for (const decision of decisions) {
          if (decision.action === "decline") {
            const doc = docMap.get(decision.requiredDocumentName);
            if (doc) {
              await db
                .update(workflowStepDocument)
                .set({
                  status: "pending",
                  documentId: null,
                  updatedAt: new Date(),
                })
                .where(eq(workflowStepDocument.id, doc.id));
            }
          }
        }

        // Return step to active so uploader can re-upload
        await db
          .update(stepInstance)
          .set({ status: "active", updatedAt: new Date() })
          .where(eq(stepInstance.id, stepId));

        // Mark the validator's task as completed
        await db
          .update(taskInstance)
          .set({
            status: "completed",
            completedBy: user.id,
            completedAt: new Date(),
          })
          .where(
            and(
              eq(taskInstance.stepInstanceId, stepId),
              eq(taskInstance.tenantId, user.tenantId),
              eq(taskInstance.status, "pending")
            )
          );

        await db
          .update(processInstance)
          .set({
            status: WorkflowProcessStatus.DECLINED_RESUBMIT,
            updatedAt: new Date(),
          })
          .where(eq(processInstance.id, step.processInstanceId));

        // Re-create tasks for the step (for the uploader to re-upload)
        const [proc] = await db
          .select({ workflowTemplateId: processInstance.workflowTemplateId })
          .from(processInstance)
          .where(eq(processInstance.id, step.processInstanceId));
        const workflowTemplateId = proc?.workflowTemplateId;

        if (workflowTemplateId) {
          const { workflowStepTemplate } = await import("@supplex/db");
          const [stepTmpl] = await db
            .select()
            .from(workflowStepTemplate)
            .where(
              and(
                eq(workflowStepTemplate.workflowTemplateId, workflowTemplateId),
                eq(workflowStepTemplate.tenantId, user.tenantId),
                eq(workflowStepTemplate.stepOrder, step.stepOrder),
                isNull(workflowStepTemplate.deletedAt)
              )
            );

          if (stepTmpl) {
            await createTasksForStep(
              stepId,
              stepTmpl.id,
              step.processInstanceId,
              user.tenantId
            );
          }
        }

        const declinedNames = decisions
          .filter((d: any) => d.action === "decline")
          .map((d: any) => d.requiredDocumentName);

        logWorkflowEvent({
          tenantId: user.tenantId,
          processInstanceId: step.processInstanceId,
          stepInstanceId: stepId,
          eventType: WorkflowEventType.DOCUMENT_DECLINED,
          eventDescription: `Validation declined - Step ${step.stepName} returned for revision (${declinedNames.length} document${declinedNames.length > 1 ? "s" : ""} declined)`,
          actorUserId: user.id,
          actorName: user.fullName,
          actorRole: user.role,
          metadata: { declinedDocuments: declinedNames },
        });

        return {
          success: true,
          data: {
            action: "declined",
            declinedCount: declinedNames.length,
            approvedCount: decisions.filter((d: any) => d.action === "approve").length,
          },
        };
      }

      // All approved — mark step completed and transition

      // Mark validator's tasks as completed
      await db
        .update(taskInstance)
        .set({
          status: "completed",
          completedBy: user.id,
          completedAt: new Date(),
        })
        .where(
          and(
            eq(taskInstance.stepInstanceId, stepId),
            eq(taskInstance.tenantId, user.tenantId),
            eq(taskInstance.status, "pending")
          )
        );

      // Mark step as validated (documents reviewed and approved)
      await db
        .update(stepInstance)
        .set({
          status: "validated",
          completedBy: user.id,
          completedDate: new Date(),
        })
        .where(eq(stepInstance.id, stepId));

      // Transition to next step
      const transitionResult = await transitionToNextStep(
        stepId,
        step.processInstanceId,
        user.tenantId,
        db
      );

      logWorkflowEvent({
        tenantId: user.tenantId,
        processInstanceId: step.processInstanceId,
        stepInstanceId: stepId,
        eventType: WorkflowEventType.DOCUMENT_APPROVED,
        eventDescription: `Validation approved - Step ${step.stepName} Approved (${decisions.length} document${decisions.length > 1 ? "s" : ""})`,
        actorUserId: user.id,
        actorName: user.fullName,
        actorRole: user.role,
      });

      if (transitionResult.processCompleted) {
        logWorkflowEvent({
          tenantId: user.tenantId,
          processInstanceId: step.processInstanceId,
          eventType: WorkflowEventType.PROCESS_COMPLETED,
          eventDescription: "Workflow completed",
          actorUserId: user.id,
          actorName: user.fullName,
          actorRole: user.role,
        });
      } else if (transitionResult.nextStepActivated && transitionResult.nextStepId) {
        const [nextStep] = await db
          .select({ stepName: stepInstance.stepName })
          .from(stepInstance)
          .where(eq(stepInstance.id, transitionResult.nextStepId));
        logWorkflowEvent({
          tenantId: user.tenantId,
          processInstanceId: step.processInstanceId,
          stepInstanceId: transitionResult.nextStepId,
          eventType: WorkflowEventType.STEP_ACTIVATED,
          eventDescription: `Step - ${nextStep?.stepName ?? "Unknown"} Active`,
          actorUserId: user.id,
          actorName: "Supplex",
          actorRole: "system",
        });
      }

      return {
        success: true,
        data: {
          action: "all_approved",
          approvedCount: decisions.length,
          stepCompleted: true,
          nextStepActivated: transitionResult.nextStepActivated,
          processCompleted: transitionResult.processCompleted,
        },
      };
    },
    {
      params: t.Object({
        stepInstanceId: t.String({ format: "uuid" }),
      }),
      body: t.Object({
        decisions: t.Array(
          t.Object({
            requiredDocumentName: t.String(),
            action: t.Union([t.Literal("approve"), t.Literal("decline")]),
            comment: t.Optional(t.String()),
          })
        ),
      }),
    }
  );
