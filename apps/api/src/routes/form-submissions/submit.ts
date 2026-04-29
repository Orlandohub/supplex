import { Elysia } from "elysia";
import { db } from "../../lib/db";
import {
  formSubmission,
  formAnswer,
  formSection,
  formField,
  stepInstance,
} from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import { authenticatedRoute } from "../../lib/route-plugins";
import { validateAnswerFormat } from "../../lib/validation/form-answer-validation";
import {
  completeStep,
  type CompleteStepResult,
} from "../../lib/workflow-engine/complete-step";
import { verifyTaskAssignment } from "../../lib/rbac/entity-authorization";
import {
  logWorkflowEventTx,
  WorkflowEventType,
} from "../../services/workflow-event-logger";
import { ApiError, Errors } from "../../lib/errors";
import {
  isApiErrorLike,
  tryGetErrorMessage,
  getErrorName,
} from "../../lib/error-utils";

/**
 * POST /api/form-submissions/:submissionId/submit
 * Submit a draft form submission
 *
 * Auth: Requires authenticated user
 * Tenant: Enforces tenant isolation
 * Behavior:
 * - Verifies submission belongs to user's tenant and user is the submitter
 * - Verifies task assignment for workflow-linked forms
 * - Validates ALL required fields have answers
 * - Validates all answer formats
 * - For workflow-linked forms: wraps form status update + completeStep in a single transaction
 * - For standalone forms: updates form status directly
 * Returns: Updated submission
 */
export const submitRoute = new Elysia()
  .use(authenticatedRoute)
  .post(
    "/:submissionId/submit",
    async ({ params, user, set, requestLogger }) => {
      try {
        const tenantId = user.tenantId;
        const userId = user.id;
        const { submissionId } = params;

        // 1. Fetch submission with tenant and user verification
        const [submissionRecord] = await db
          .select()
          .from(formSubmission)
          .where(
            and(
              eq(formSubmission.id, submissionId),
              eq(formSubmission.tenantId, tenantId),
              eq(formSubmission.submittedBy, userId),
              isNull(formSubmission.deletedAt)
            )
          )
          .limit(1);

        if (!submissionRecord) {
          throw Errors.notFound(
            "Submission not found or you don't have access to it",
            "SUBMISSION_NOT_FOUND"
          );
        }

        // 2. ALREADY_SUBMITTED guard
        if (submissionRecord.status === "submitted") {
          throw Errors.badRequest(
            "This form has already been submitted and cannot be modified",
            "ALREADY_SUBMITTED"
          );
        }

        // 3. Task assignment verification (workflow-linked forms only, outside tx)
        if (submissionRecord.stepInstanceId) {
          const taskCheck = await verifyTaskAssignment(
            user,
            submissionRecord.stepInstanceId,
            ["action", "resubmission"],
            db
          );
          if (!taskCheck.allowed) {
            throw Errors.forbidden(
              "Not authorized to submit this step: no pending task assigned to you"
            );
          }
        }

        // 4. Load all fields for the form_template
        const fieldsData = await db
          .select({
            field: formField,
          })
          .from(formField)
          .innerJoin(formSection, eq(formField.formSectionId, formSection.id))
          .where(
            and(
              eq(formSection.formTemplateId, submissionRecord.formTemplateId),
              eq(formField.tenantId, tenantId),
              isNull(formField.deletedAt),
              isNull(formSection.deletedAt)
            )
          );

        const allFields = fieldsData.map((row) => row.field);
        const requiredFields = allFields.filter((f) => f.required);

        // 5. Load all answers for this submission
        const answers = await db
          .select()
          .from(formAnswer)
          .where(
            and(
              eq(formAnswer.formSubmissionId, submissionId),
              eq(formAnswer.tenantId, tenantId)
            )
          );

        const answerMap = new Map(
          answers.map((a) => [a.formFieldId, a.answerValue])
        );

        // 6. Validate required fields
        const missingFields: string[] = [];
        for (const field of requiredFields) {
          const answer = answerMap.get(field.id);
          if (!answer || answer.trim() === "") {
            missingFields.push(field.label);
          }
        }

        if (missingFields.length > 0) {
          throw Errors.badRequest(
            `Missing required fields: ${missingFields.join(", ")}`,
            "REQUIRED_FIELD_MISSING"
          );
        }

        // Validate answer formats
        const fieldMap = new Map(allFields.map((f) => [f.id, f]));
        for (const answer of answers) {
          const field = fieldMap.get(answer.formFieldId);
          if (!field) continue;

          if (answer.answerValue) {
            const validationError = validateAnswerFormat(
              answer.answerValue,
              field
            );
            if (validationError) {
              throw Errors.badRequest(
                `${field.label}: ${validationError}`,
                "INVALID_ANSWER_FORMAT"
              );
            }
          }
        }

        // 7. Mutation block
        let updatedSubmission: typeof formSubmission.$inferSelect | undefined;
        let stepCompletionResult: CompleteStepResult | null = null;

        if (submissionRecord.stepInstanceId) {
          // Capture the narrowed `stepInstanceId` so the transaction callback
          // (a separate closure) preserves the non-null type without `!`.
          const stepInstanceIdLocal = submissionRecord.stepInstanceId;
          // Workflow-linked: wrap form update + completeStep + event logging in a single transaction
          try {
            const txResult = await db.transaction(async (tx) => {
              const [txSubmission] = await tx
                .update(formSubmission)
                .set({
                  status: "submitted",
                  submittedAt: new Date(),
                  updatedAt: new Date(),
                })
                .where(eq(formSubmission.id, submissionId))
                .returning();

              const stepResult = await completeStep(tx, {
                tenantId,
                stepInstanceId: stepInstanceIdLocal,
                completedBy: userId,
                outcome: "completed",
              });

              if (!stepResult.success) {
                throw new Error(stepResult.error || "Step completion failed");
              }

              // Event logging — atomic with state changes
              const [step] = await tx
                .select({
                  stepOrder: stepInstance.stepOrder,
                  stepName: stepInstance.stepName,
                })
                .from(stepInstance)
                .where(eq(stepInstance.id, stepInstanceIdLocal));

              if (step) {
                const isResubmission =
                  stepResult.data?.wasResubmission ?? false;
                await logWorkflowEventTx(tx, {
                  tenantId,
                  processInstanceId:
                    submissionRecord.processInstanceId ?? undefined,
                  stepInstanceId: stepInstanceIdLocal,
                  eventType: isResubmission
                    ? WorkflowEventType.FORM_RESUBMITTED
                    : WorkflowEventType.FORM_SUBMITTED,
                  eventDescription: isResubmission
                    ? `Step ${step.stepOrder}: ${step.stepName} — Form resubmitted`
                    : `Step ${step.stepOrder}: ${step.stepName} — Form submitted`,
                  actorUserId: userId,
                  actorName: user.fullName,
                  actorRole: user.role,
                });

                if (stepResult.data?.processCompleted) {
                  await logWorkflowEventTx(tx, {
                    tenantId,
                    processInstanceId:
                      submissionRecord.processInstanceId ?? undefined,
                    eventType: WorkflowEventType.PROCESS_COMPLETED,
                    eventDescription: "Workflow completed",
                    actorUserId: userId,
                    actorName: user.fullName,
                    actorRole: user.role,
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
                    tenantId,
                    processInstanceId:
                      submissionRecord.processInstanceId ?? undefined,
                    stepInstanceId: stepResult.data.nextStepId,
                    eventType: WorkflowEventType.STEP_ACTIVATED,
                    eventDescription: `Step - ${nextStep?.stepName ?? "Unknown"} Active`,
                    actorUserId: userId,
                    actorName: "Supplex",
                    actorRole: "system",
                  });
                }
              }

              return { updatedSubmission: txSubmission, stepResult };
            });

            updatedSubmission = txResult.updatedSubmission;
            stepCompletionResult = txResult.stepResult;

            // Post-commit verification: read back step + form status to detect phantom commits
            const [verifyStep] = await db
              .select({ status: stepInstance.status })
              .from(stepInstance)
              .where(eq(stepInstance.id, stepInstanceIdLocal));

            const [verifyForm] = await db
              .select({ status: formSubmission.status })
              .from(formSubmission)
              .where(eq(formSubmission.id, submissionId));

            if (
              verifyStep?.status === "active" ||
              verifyForm?.status !== "submitted"
            ) {
              requestLogger.error(
                {
                  submissionId,
                  stepId: submissionRecord.stepInstanceId,
                  verifiedStepStatus: verifyStep?.status,
                  verifiedFormStatus: verifyForm?.status,
                },
                "PHANTOM COMMIT DETECTED: transaction reported success but state unchanged"
              );
              throw Errors.internal("Submission failed — please try again");
            }
          } catch (txError: unknown) {
            if (txError instanceof ApiError || isApiErrorLike(txError))
              throw txError;
            requestLogger.error(
              {
                submissionId,
                stepId: submissionRecord.stepInstanceId,
                errorMessage: tryGetErrorMessage(txError),
                errorName: getErrorName(txError),
              },
              "form submit transaction failed"
            );
            const msg = tryGetErrorMessage(txError) ?? "";
            if (
              msg.includes("not in active state") ||
              msg.includes("already processed")
            ) {
              throw Errors.conflict(
                "Step already processed or not in active state"
              );
            }
            throw Errors.badRequest(msg || "Step completion failed");
          }
        } else {
          // Standalone form: single write, no transaction wrapping needed
          [updatedSubmission] = await db
            .update(formSubmission)
            .set({
              status: "submitted",
              submittedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(formSubmission.id, submissionId))
            .returning();
        }

        // 9. Return response
        set.status = 200;
        return {
          success: true,
          data: {
            submission: {
              ...updatedSubmission,
              answers,
            },
            processInstanceId: submissionRecord.processInstanceId || null,
            stepCompleted: stepCompletionResult?.success ?? false,
          },
        };
      } catch (error: unknown) {
        if (error instanceof ApiError || isApiErrorLike(error)) throw error;
        requestLogger.error({ err: error }, "Form submit failed");
        throw Errors.internal("Failed to submit form");
      }
    }
  );
