/**
 * Step Completion API Route
 * Story: 2.2.8 - Workflow Execution Engine
 * 
 * POST /api/workflows/steps/:stepInstanceId/complete
 * 
 * Handles submit, approve, and decline actions for workflow steps
 */

import { Elysia, t } from "elysia";
import { db } from "../../../lib/db";
import {
  stepInstance,
  processInstance,
  workflowStepTemplate,
  taskInstance,
  commentThread,
  formSubmission,
} from "@supplex/db";
import { eq, and, or, isNull } from "drizzle-orm";
import { WorkflowProcessStatus } from "@supplex/types";
import { approveValidationTask } from "../../../lib/workflow-engine/approve-validation-task";
import { completeStep } from "../../../lib/workflow-engine/complete-step";
import { createTasksForStep } from "../../../lib/workflow-engine/create-tasks-for-step";
import { authenticate } from "../../../lib/rbac/middleware";
import { logWorkflowEvent, WorkflowEventType } from "../../../services/workflow-event-logger";

export const completeStepRoute = new Elysia()
  .use(authenticate)
  .post(
    "/steps/:stepInstanceId/complete",
    async ({ params, body, user }) => {
      const { stepInstanceId } = params;
      const { action, comment: declineComment } = body;

      // Validate user authentication
      if (!user?.id || !user?.tenantId) {
        return {
          success: false,
          error: "Unauthorized",
        };
      }

      try {
        // Query step instance (with tenant filter)
        const [step] = await db
          .select()
          .from(stepInstance)
          .where(
            and(
              eq(stepInstance.id, stepInstanceId),
              eq(stepInstance.tenantId, user.tenantId)
            )
          );

        if (!step) {
          return {
            success: false,
            error: "Step instance not found",
          };
        }

        // Query process instance
        const [process] = await db
          .select()
          .from(processInstance)
          .where(eq(processInstance.id, step.processInstanceId));

        if (!process) {
          return {
            success: false,
            error: "Process instance not found",
          };
        }

        const workflowTemplateId = process.workflowTemplateId;

        const stepTemplates = await db
          .select()
          .from(workflowStepTemplate)
          .where(
            and(
              eq(workflowStepTemplate.tenantId, user.tenantId),
              ...(workflowTemplateId
                ? [eq(workflowStepTemplate.workflowTemplateId, workflowTemplateId)]
                : []),
              eq(workflowStepTemplate.stepOrder, step.stepOrder),
              isNull(workflowStepTemplate.deletedAt)
            )
          );

        if (stepTemplates.length === 0) {
          return {
            success: false,
            error: "Workflow step template not found",
          };
        }

        const stepTemplate = stepTemplates[0];

        // Handle different actions
        if (action === "submit") {
          // Use the engine's completeStep() which handles validation checks
          const result = await completeStep(db, {
            tenantId: user.tenantId,
            stepInstanceId,
            completedBy: user.id,
            outcome: "completed",
          });

          if (!result.success) {
            return { success: false, error: result.error || "Failed to complete step" };
          }

          const isResubmission = step.status === "active" && step.completedDate !== null;
          const isDocumentStep = stepTemplate.stepType === "document";
          logWorkflowEvent({
            tenantId: user.tenantId,
            processInstanceId: process.id,
            stepInstanceId: stepInstanceId,
            eventType: isResubmission
              ? WorkflowEventType.FORM_RESUBMITTED
              : isDocumentStep ? WorkflowEventType.DOCUMENT_UPLOADED : WorkflowEventType.FORM_SUBMITTED,
            eventDescription: isResubmission
              ? `Step ${step.stepOrder}: ${step.stepName} — ${isDocumentStep ? "Documents resubmitted" : "Form resubmitted"}`
              : `Step ${step.stepOrder}: ${step.stepName} — ${isDocumentStep ? "Documents submitted" : "Form submitted"}`,
            actorUserId: user.id,
            actorName: user.fullName,
            actorRole: user.role,
          });

          if (result.data?.processCompleted) {
            logWorkflowEvent({
              tenantId: user.tenantId,
              processInstanceId: process.id,
              eventType: WorkflowEventType.PROCESS_COMPLETED,
              eventDescription: "Workflow completed",
              actorUserId: user.id,
              actorName: user.fullName,
              actorRole: user.role,
            });
          } else if (result.data?.nextStepActivated && result.data?.nextStepId) {
            const [nextStep] = await db
              .select({ stepName: stepInstance.stepName })
              .from(stepInstance)
              .where(eq(stepInstance.id, result.data.nextStepId));
            logWorkflowEvent({
              tenantId: user.tenantId,
              processInstanceId: process.id,
              stepInstanceId: result.data.nextStepId,
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
              action: "submitted",
              stepCompleted: result.data?.stepCompleted ?? true,
              nextStepActivated: result.data?.nextStepActivated ?? false,
            },
          };
        } else if (action === "approve") {
          // Story 2.2.15: Check if this is a validation task approval
          // Match by userId OR by role (validation tasks use role-based assignment)
          const [userTask] = await db
            .select()
            .from(taskInstance)
            .where(
              and(
                eq(taskInstance.stepInstanceId, stepInstanceId),
                eq(taskInstance.tenantId, user.tenantId),
                eq(taskInstance.status, "pending"),
                or(
                  eq(taskInstance.assigneeUserId, user.id),
                  and(
                    eq(taskInstance.assigneeType, "role"),
                    eq(taskInstance.assigneeRole, user.role),
                    isNull(taskInstance.assigneeUserId)
                  )
                )
              )
            );

          if (userTask && userTask.taskType === "validation") {
            const validationResult = await approveValidationTask(db, {
              tenantId: user.tenantId,
              taskInstanceId: userTask.id,
              userId: user.id,
            });

            if (!validationResult.success) {
              return {
                success: false,
                error: validationResult.error || "Failed to approve validation task",
              };
            }

            logWorkflowEvent({
              tenantId: user.tenantId,
              processInstanceId: process.id,
              stepInstanceId: stepInstanceId,
              taskInstanceId: userTask.id,
              eventType: validationResult.allValidationsComplete
                ? WorkflowEventType.STEP_VALIDATED
                : WorkflowEventType.VALIDATION_APPROVED,
              eventDescription: validationResult.allValidationsComplete
                ? `Validation approved - Step ${step.stepOrder}: ${step.stepName} Approved`
                : `Validation approved - ${validationResult.remainingApprovals} more approval${(validationResult.remainingApprovals ?? 0) > 1 ? "s" : ""} required for this step`,
              actorUserId: user.id,
              actorName: user.fullName,
              actorRole: user.role,
            });

            if (validationResult.allValidationsComplete) {
              if (validationResult.processCompleted) {
                logWorkflowEvent({
                  tenantId: user.tenantId,
                  processInstanceId: process.id,
                  eventType: WorkflowEventType.PROCESS_COMPLETED,
                  eventDescription: "Workflow completed",
                  actorUserId: user.id,
                  actorName: user.fullName,
                  actorRole: user.role,
                });
              } else if (validationResult.nextStepActivated && validationResult.nextStepId) {
                const [nextStep] = await db
                  .select({ stepName: stepInstance.stepName })
                  .from(stepInstance)
                  .where(eq(stepInstance.id, validationResult.nextStepId));
                logWorkflowEvent({
                  tenantId: user.tenantId,
                  processInstanceId: process.id,
                  stepInstanceId: validationResult.nextStepId,
                  eventType: WorkflowEventType.STEP_ACTIVATED,
                  eventDescription: `Step - ${nextStep?.stepName ?? "Unknown"} Active`,
                  actorUserId: user.id,
                  actorName: "Supplex",
                  actorRole: "system",
                });
              }
            }

            return {
              success: true,
              data: {
                action: "approved",
                stepCompleted: validationResult.allValidationsComplete,
                nextStepActivated: validationResult.nextStepActivated,
                message: validationResult.allValidationsComplete
                  ? "All validations complete, next step activated"
                  : "Validation approved, waiting for additional approvals",
              },
            };
          }

          // No legacy approve path — all approvals go through validation tasks
          return {
            success: false,
            error: "No pending validation task found for this user on this step",
          };
        } else if (action === "decline") {
          // Verify comment is provided
          if (!declineComment) {
            return {
              success: false,
              error: "Comment is required when declining",
            };
          }

          // Story 2.2.15: Check if this is a validation task decline
          // Match by userId OR by role (validation tasks use role-based assignment)
          const [userTask] = await db
            .select()
            .from(taskInstance)
            .where(
              and(
                eq(taskInstance.stepInstanceId, stepInstanceId),
                eq(taskInstance.tenantId, user.tenantId),
                eq(taskInstance.status, "pending"),
                or(
                  eq(taskInstance.assigneeUserId, user.id),
                  and(
                    eq(taskInstance.assigneeType, "role"),
                    eq(taskInstance.assigneeRole, user.role),
                    isNull(taskInstance.assigneeUserId)
                  )
                )
              )
            );

          if (userTask && userTask.taskType === "validation") {
            const stepTemplateForValidation = workflowTemplateId
              ? (await db
                  .select()
                  .from(workflowStepTemplate)
                  .where(
                    and(
                      eq(workflowStepTemplate.workflowTemplateId, workflowTemplateId),
                      eq(workflowStepTemplate.tenantId, user.tenantId),
                      eq(workflowStepTemplate.stepOrder, step.stepOrder),
                      isNull(workflowStepTemplate.deletedAt)
                    )
                  ))[0]
              : undefined;

            // 1. Save the decline comment
            await db.insert(commentThread).values({
              tenantId: user.tenantId,
              processInstanceId: process.id,
              stepInstanceId: step.id,
              entityType: "form",
              commentText: declineComment,
              commentedBy: user.id,
            });

            await db
              .update(taskInstance)
              .set({
                status: "completed",
                outcome: "declined",
                completedBy: user.id,
                completedAt: new Date(),
              })
              .where(eq(taskInstance.id, userTask.id));

            // Auto-close all other pending validation tasks for this step
            await db
              .update(taskInstance)
              .set({
                status: "completed",
                outcome: "auto_closed",
                completedAt: new Date(),
              })
              .where(
                and(
                  eq(taskInstance.stepInstanceId, stepInstanceId),
                  eq(taskInstance.tenantId, user.tenantId),
                  eq(taskInstance.status, "pending")
                )
              );

            // 3. Reset the step back to "active" (same step, not previous)
            await db
              .update(stepInstance)
              .set({ status: "active" })
              .where(eq(stepInstance.id, stepInstanceId));

            // 4. Reset the form submission to "draft" so the user can re-edit
            await db
              .update(formSubmission)
              .set({ status: "draft", updatedAt: new Date() })
              .where(
                and(
                  eq(formSubmission.stepInstanceId, stepInstanceId),
                  eq(formSubmission.tenantId, user.tenantId),
                  isNull(formSubmission.deletedAt)
                )
              );

            await db
              .update(processInstance)
              .set({
                status: WorkflowProcessStatus.DECLINED_RESUBMIT,
                updatedAt: new Date(),
              })
              .where(eq(processInstance.id, process.id));

            // 6. Create new tasks for the same step (submitter gets a task to re-edit)
            if (stepTemplateForValidation) {
              await createTasksForStep(
                stepInstanceId,
                stepTemplateForValidation.id,
                process.id,
                user.tenantId
              );
            }

            logWorkflowEvent({
              tenantId: user.tenantId,
              processInstanceId: process.id,
              stepInstanceId: stepInstanceId,
              taskInstanceId: userTask.id,
              eventType: WorkflowEventType.VALIDATION_DECLINED,
              eventDescription: `Validation declined - Step ${step.stepName} returned for revision`,
              actorUserId: user.id,
              actorName: user.fullName,
              actorRole: user.role,
              comment: declineComment,
            });

            return {
              success: true,
              data: {
                action: "declined",
                commentCreated: true,
                currentStepDeclined: false,
                targetStepActivated: true,
                targetStepId: stepInstanceId,
              },
            };
          }

          // No legacy decline path — all declines go through validation tasks
          return {
            success: false,
            error: "No pending validation task found for this user on this step",
          };
        } else {
          return {
            success: false,
            error: `Invalid action: ${action}`,
          };
        }
      } catch (error) {
        console.error("Error completing step:", error);
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to complete step",
        };
      }
    },
    {
      params: t.Object({
        stepInstanceId: t.String({ format: "uuid" }),
      }),
      body: t.Object({
        action: t.Union([
          t.Literal("submit"),
          t.Literal("approve"),
          t.Literal("decline"),
        ]),
        comment: t.Optional(t.String()),
      }),
      detail: {
        summary: "Complete Workflow Step",
        description:
          "Submit, approve, or decline a workflow step with optional comments",
        tags: ["Workflows"],
      },
    }
  );

