/**
 * Step Completion API Route
 * Story: 2.2.8 - Workflow Execution Engine
 * Updated: Story 2.2.19 - Transaction wrapping, atomic CAS
 *
 * POST /api/workflows/steps/:stepInstanceId/complete
 *
 * Handles submit, approve, and decline actions for workflow steps
 */

import { Elysia, t } from "elysia";
import { ApiError, Errors } from "../../../lib/errors";
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
import { authenticatedRoute } from "../../../lib/route-plugins";
import { verifyTaskAssignment } from "../../../lib/rbac/entity-authorization";
import {
  logWorkflowEventTx,
  WorkflowEventType,
} from "../../../services/workflow-event-logger";
import {
  SUPPLIER_SUBMIT_INVARIANT_ERROR_PREFIX,
  assertSupplierSubmitInvariantInTx,
} from "../../../lib/workflow-engine/assert-supplier-submit-invariants";
import { tryGetErrorMessage } from "../../../lib/error-utils";

export const completeStepRoute = new Elysia().use(authenticatedRoute).post(
  "/steps/:stepInstanceId/complete",
  async ({ params, body, user, requestLogger, correlationId: corrId }) => {
    const { stepInstanceId } = params;
    const { action, comment: declineComment } = body;

    if (!user?.id || !user?.tenantId) {
      throw Errors.unauthorized("Unauthorized");
    }

    try {
      if (action === "submit") {
        // Verify the user has an assigned action/resubmission task for this step
        const taskCheck = await verifyTaskAssignment(
          user,
          stepInstanceId,
          ["action", "resubmission"],
          db
        );
        if (!taskCheck.allowed) {
          throw Errors.forbidden(
            "Not authorized to submit this step: no pending task assigned to you"
          );
        }

        let preSubmitStepStatus: string | null = null;
        const [preSubmitStepRow] = await db
          .select({ status: stepInstance.status })
          .from(stepInstance)
          .where(
            and(
              eq(stepInstance.id, stepInstanceId),
              eq(stepInstance.tenantId, user.tenantId)
            )
          )
          .limit(1);
        preSubmitStepStatus = preSubmitStepRow?.status ?? null;
        requestLogger.debug(
          {
            event: "workflow_step_submit_pre_snapshot",
            correlationId: corrId,
            stepInstanceId,
            actorUserId: user.id,
            preStepStatus: preSubmitStepStatus,
          },
          "workflow step submit pre-transaction snapshot"
        );
        // Wrap engine mutation + event logging in a single transaction
        const result = await db.transaction(async (tx) => {
          const stepResult = await completeStep(tx, {
            tenantId: user.tenantId,
            stepInstanceId,
            completedBy: user.id,
            outcome: "completed",
          });

          if (!stepResult.success) {
            throw new Error(stepResult.error || "Step completion failed");
          }
          await assertSupplierSubmitInvariantInTx(tx, {
            tenantId: user.tenantId,
            stepInstanceId,
            stepResult,
            correlationId: corrId,
            actorUserId: user.id,
            log: requestLogger,
            preStepStatus: preSubmitStepStatus,
          });

          // Read step + process + template inside tx for event context
          const [stepForLog] = await tx
            .select()
            .from(stepInstance)
            .where(
              and(
                eq(stepInstance.id, stepInstanceId),
                eq(stepInstance.tenantId, user.tenantId)
              )
            );

          const [processForLog] = stepForLog
            ? await tx
                .select()
                .from(processInstance)
                .where(eq(processInstance.id, stepForLog.processInstanceId))
            : [undefined];

          if (stepForLog && processForLog) {
            const [stepTmpl] = processForLog.workflowTemplateId
              ? await tx
                  .select()
                  .from(workflowStepTemplate)
                  .where(
                    and(
                      eq(
                        workflowStepTemplate.workflowTemplateId,
                        processForLog.workflowTemplateId
                      ),
                      eq(workflowStepTemplate.tenantId, user.tenantId),
                      eq(workflowStepTemplate.stepOrder, stepForLog.stepOrder),
                      isNull(workflowStepTemplate.deletedAt)
                    )
                  )
              : [undefined];
            const isDocumentStep = stepTmpl?.stepType === "document";
            const isResubmission = stepResult.data?.wasResubmission ?? false;

            await logWorkflowEventTx(tx, {
              tenantId: user.tenantId,
              processInstanceId: processForLog.id,
              stepInstanceId: stepInstanceId,
              eventType: isResubmission
                ? WorkflowEventType.FORM_RESUBMITTED
                : isDocumentStep
                  ? WorkflowEventType.DOCUMENT_UPLOADED
                  : WorkflowEventType.FORM_SUBMITTED,
              eventDescription: isResubmission
                ? `Step ${stepForLog.stepOrder}: ${stepForLog.stepName} — ${isDocumentStep ? "Documents resubmitted" : "Form resubmitted"}`
                : `Step ${stepForLog.stepOrder}: ${stepForLog.stepName} — ${isDocumentStep ? "Documents submitted" : "Form submitted"}`,
              actorUserId: user.id,
              actorName: user.fullName,
              actorRole: user.role,
              correlationId: corrId,
            });

            if (stepResult.data?.processCompleted) {
              await logWorkflowEventTx(tx, {
                tenantId: user.tenantId,
                processInstanceId: processForLog.id,
                eventType: WorkflowEventType.PROCESS_COMPLETED,
                eventDescription: "Workflow completed",
                actorUserId: user.id,
                actorName: user.fullName,
                actorRole: user.role,
                correlationId: corrId,
              });
            } else if (
              stepResult.data?.nextStepActivated &&
              stepResult.data?.nextStepId
            ) {
              const [nextStep] = await tx
                .select({ stepName: stepInstance.stepName })
                .from(stepInstance)
                .where(eq(stepInstance.id, stepResult.data.nextStepId));
              await logWorkflowEventTx(tx, {
                tenantId: user.tenantId,
                processInstanceId: processForLog.id,
                stepInstanceId: stepResult.data.nextStepId,
                eventType: WorkflowEventType.STEP_ACTIVATED,
                eventDescription: `Step - ${nextStep?.stepName ?? "Unknown"} Active`,
                actorUserId: user.id,
                actorName: "Supplex",
                actorRole: "system",
                correlationId: corrId,
              });
            }
          }

          return stepResult;
        });

        return {
          success: true,
          data: {
            action: "submitted",
            stepCompleted: result.data?.stepCompleted ?? true,
            nextStepActivated: result.data?.nextStepActivated ?? false,
          },
        };
      } else if (action === "approve") {
        // Wrap approve mutation + event logging in a single transaction
        const txResult = await db.transaction(async (tx) => {
          const [userTask] = await tx
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

          if (!userTask || userTask.taskType !== "validation") {
            return { found: false as const };
          }

          const validationResult = await approveValidationTask(tx, {
            tenantId: user.tenantId,
            taskInstanceId: userTask.id,
            userId: user.id,
          });

          if (!validationResult.success) {
            return {
              found: true as const,
              validationResult,
              taskId: userTask.id,
            };
          }

          // Event logging — atomic with state changes
          const [stepForLog] = await tx
            .select()
            .from(stepInstance)
            .where(eq(stepInstance.id, stepInstanceId));

          const [processForLog] = stepForLog
            ? await tx
                .select()
                .from(processInstance)
                .where(eq(processInstance.id, stepForLog.processInstanceId))
            : [undefined];

          if (processForLog) {
            await logWorkflowEventTx(tx, {
              tenantId: user.tenantId,
              processInstanceId: processForLog.id,
              stepInstanceId: stepInstanceId,
              taskInstanceId: userTask.id,
              eventType: validationResult.allValidationsComplete
                ? WorkflowEventType.STEP_VALIDATED
                : WorkflowEventType.VALIDATION_APPROVED,
              eventDescription: validationResult.allValidationsComplete
                ? `Validation approved - Step ${stepForLog?.stepOrder}: ${stepForLog?.stepName} Approved`
                : `Validation approved - ${validationResult.remainingApprovals} more approval${(validationResult.remainingApprovals ?? 0) > 1 ? "s" : ""} required for this step`,
              actorUserId: user.id,
              actorName: user.fullName,
              actorRole: user.role,
              correlationId: corrId,
            });

            if (validationResult.allValidationsComplete) {
              if (validationResult.processCompleted) {
                await logWorkflowEventTx(tx, {
                  tenantId: user.tenantId,
                  processInstanceId: processForLog.id,
                  eventType: WorkflowEventType.PROCESS_COMPLETED,
                  eventDescription: "Workflow completed",
                  actorUserId: user.id,
                  actorName: user.fullName,
                  actorRole: user.role,
                  correlationId: corrId,
                });
              } else if (
                validationResult.nextStepActivated &&
                validationResult.nextStepId
              ) {
                const [nextStep] = await tx
                  .select({ stepName: stepInstance.stepName })
                  .from(stepInstance)
                  .where(eq(stepInstance.id, validationResult.nextStepId));
                await logWorkflowEventTx(tx, {
                  tenantId: user.tenantId,
                  processInstanceId: processForLog.id,
                  stepInstanceId: validationResult.nextStepId,
                  eventType: WorkflowEventType.STEP_ACTIVATED,
                  eventDescription: `Step - ${nextStep?.stepName ?? "Unknown"} Active`,
                  actorUserId: user.id,
                  actorName: "Supplex",
                  actorRole: "system",
                  correlationId: corrId,
                });
              }
            }
          }

          return {
            found: true as const,
            taskId: userTask.id,
            validationResult,
          };
        });

        if (!txResult.found) {
          throw Errors.forbidden(
            "No pending validation task found for this user on this step"
          );
        }

        const { validationResult } = txResult;

        if (!validationResult.success) {
          throw Errors.badRequest(
            validationResult.error || "Failed to approve validation task"
          );
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
      } else if (action === "decline") {
        if (!declineComment) {
          throw Errors.badRequest("Comment is required when declining");
        }

        // Wrap entire decline path in a single transaction
        const txResult = await db.transaction(async (tx) => {
          // Atomic CAS: find and claim the user's pending validation task
          const [userTask] = await tx
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

          if (!userTask || userTask.taskType !== "validation") {
            return { found: false as const };
          }

          const [step] = await tx
            .select()
            .from(stepInstance)
            .where(
              and(
                eq(stepInstance.id, stepInstanceId),
                eq(stepInstance.tenantId, user.tenantId)
              )
            );

          if (!step) {
            return { found: false as const };
          }

          const [process] = await tx
            .select()
            .from(processInstance)
            .where(eq(processInstance.id, step.processInstanceId));

          if (!process) {
            return { found: false as const };
          }

          const workflowTemplateId = process.workflowTemplateId;

          const stepTemplateForValidation = workflowTemplateId
            ? (
                await tx
                  .select()
                  .from(workflowStepTemplate)
                  .where(
                    and(
                      eq(
                        workflowStepTemplate.workflowTemplateId,
                        workflowTemplateId
                      ),
                      eq(workflowStepTemplate.tenantId, user.tenantId),
                      eq(workflowStepTemplate.stepOrder, step.stepOrder),
                      isNull(workflowStepTemplate.deletedAt)
                    )
                  )
              )[0]
            : undefined;

          // 1. Save the decline comment
          await tx.insert(commentThread).values({
            tenantId: user.tenantId,
            processInstanceId: process.id,
            stepInstanceId: step.id,
            entityType: "form",
            commentText: declineComment,
            commentedBy: user.id,
          });

          // 2. Atomic CAS: mark the declining task as completed
          const [declinedTask] = await tx
            .update(taskInstance)
            .set({
              status: "completed",
              outcome: "declined",
              completedBy: user.id,
              completedAt: new Date(),
            })
            .where(
              and(
                eq(taskInstance.id, userTask.id),
                eq(taskInstance.status, "pending")
              )
            )
            .returning();

          if (!declinedTask) {
            return { found: true as const, alreadyProcessed: true as const };
          }

          // 3. Auto-close all other pending validation tasks for this step
          await tx
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

          // 4. Atomic CAS: reset the step back to "active"
          const [resetStep] = await tx
            .update(stepInstance)
            .set({ status: "active", updatedAt: new Date() })
            .where(
              and(
                eq(stepInstance.id, stepInstanceId),
                eq(stepInstance.status, "awaiting_validation")
              )
            )
            .returning();

          if (!resetStep) {
            return { found: true as const, alreadyProcessed: true as const };
          }

          // 5. Reset the form submission to "draft"
          await tx
            .update(formSubmission)
            .set({ status: "draft", updatedAt: new Date() })
            .where(
              and(
                eq(formSubmission.stepInstanceId, stepInstanceId),
                eq(formSubmission.tenantId, user.tenantId),
                isNull(formSubmission.deletedAt)
              )
            );

          // 6. Update process status
          await tx
            .update(processInstance)
            .set({
              status: WorkflowProcessStatus.DECLINED_RESUBMIT,
              updatedAt: new Date(),
            })
            .where(eq(processInstance.id, process.id));

          // 7. Create new tasks for the same step (submitter re-edits)
          if (stepTemplateForValidation) {
            await createTasksForStep(
              tx,
              stepInstanceId,
              stepTemplateForValidation.id,
              process.id,
              user.tenantId
            );
          }

          // 8. Event logging — atomic with state changes
          await logWorkflowEventTx(tx, {
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
            correlationId: corrId,
          });

          return {
            found: true as const,
            alreadyProcessed: false as const,
          };
        });

        if (!txResult.found) {
          throw Errors.forbidden(
            "No pending validation task found for this user on this step"
          );
        }

        if (txResult.alreadyProcessed) {
          throw Errors.conflict(
            "Step or task already processed by another request"
          );
        }

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
      } else {
        throw Errors.badRequest(`Invalid action: ${action}`);
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      const invMsg = tryGetErrorMessage(error) ?? "";
      if (invMsg.includes(SUPPLIER_SUBMIT_INVARIANT_ERROR_PREFIX)) {
        requestLogger.error(
          {
            event: "workflow_step_submit_invariant_failed",
            correlationId: corrId,
            stepInstanceId,
            actorUserId: user?.id,
          },
          "workflow step submit invariant failed — transaction rolled back"
        );
        throw Errors.internal("Step completion inconsistent — please retry");
      }
      requestLogger.error({ err: error }, "error completing step");
      throw Errors.internal("Failed to complete step");
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
