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
import { authenticate } from "../../lib/rbac/middleware";
import { validateAnswerFormat } from "../../lib/validation/form-answer-validation";
import { completeStep } from "../../lib/workflow-engine/complete-step";
import { logWorkflowEvent, WorkflowEventType } from "../../services/workflow-event-logger";

/**
 * POST /api/form-submissions/:submissionId/submit
 * Submit a draft form submission
 *
 * Auth: Requires authenticated user
 * Tenant: Enforces tenant isolation
 * Behavior:
 * - Verifies submission belongs to user's tenant and user is the submitter
 * - Validates ALL required fields have answers (AC: 4)
 * - Validates all answer formats
 * - Updates submission status to 'submitted'
 * - Sets submitted_at timestamp
 * - After submit, form becomes immutable (AC: 5)
 * Returns: Updated submission
 */
export const submitRoute = new Elysia().use(authenticate).post(
  "/:submissionId/submit",
  async ({ params, user, set }: any) => {
    try {
      const tenantId = user.tenantId as string;
      const userId = user.id as string;
      const { submissionId } = params;

      // Fetch submission with tenant and user verification
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
        set.status = 404;
        return {
          success: false,
          error: {
            code: "SUBMISSION_NOT_FOUND",
            message:
              "Submission not found or you don't have access to it",
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Check if already submitted
      if (submissionRecord.status === "submitted") {
        set.status = 400;
        return {
          success: false,
          error: {
            code: "ALREADY_SUBMITTED",
            message: "This form has already been submitted and cannot be modified",
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Load all fields for the form_template
      const fieldsData = await db
        .select({
          field: formField,
        })
        .from(formField)
        .innerJoin(
          formSection,
          eq(formField.formSectionId, formSection.id)
        )
        .where(
          and(
            eq(
              formSection.formTemplateId,
              submissionRecord.formTemplateId
            ),
            eq(formField.tenantId, tenantId),
            isNull(formField.deletedAt),
            isNull(formSection.deletedAt)
          )
        );

      const allFields = fieldsData.map((row) => row.field);
      const requiredFields = allFields.filter((f) => f.required);

      // Load all answers for this submission
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

      // Validate all required fields have answers (AC: 4)
      const missingFields: string[] = [];
      for (const field of requiredFields) {
        const answer = answerMap.get(field.id);
        if (!answer || answer.trim() === "") {
          missingFields.push(field.label);
        }
      }

      if (missingFields.length > 0) {
        set.status = 400;
        return {
          success: false,
          error: {
            code: "REQUIRED_FIELD_MISSING",
            message: `Missing required fields: ${missingFields.join(", ")}`,
            details: {
              missingFields,
            },
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Validate answer formats for all provided answers
      const fieldMap = new Map(allFields.map((f) => [f.id, f]));
      for (const answer of answers) {
        const field = fieldMap.get(answer.formFieldId);
        if (!field) continue; // Skip if field was deleted

        if (answer.answerValue) {
          const validationError = validateAnswerFormat(
            answer.answerValue,
            field
          );
          if (validationError) {
            set.status = 400;
            return {
              success: false,
              error: {
                code: "INVALID_ANSWER_FORMAT",
                message: `${field.label}: ${validationError}`,
                timestamp: new Date().toISOString(),
              },
            };
          }
        }
      }

      // Update submission to submitted status
      const [updatedSubmission] = await db
        .update(formSubmission)
        .set({
          status: "submitted",
          submittedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(formSubmission.id, submissionId))
        .returning();

      let stepCompletionResult = null;
      if (submissionRecord.stepInstanceId) {
        try {
          const [step] = await db
            .select({ stepOrder: stepInstance.stepOrder, stepName: stepInstance.stepName, completedDate: stepInstance.completedDate })
            .from(stepInstance)
            .where(eq(stepInstance.id, submissionRecord.stepInstanceId));

          stepCompletionResult = await completeStep(db, {
            tenantId,
            stepInstanceId: submissionRecord.stepInstanceId,
            completedBy: userId,
            outcome: "completed",
          });

          if (stepCompletionResult.success && step) {
            const isResubmission = step.completedDate !== null;
            logWorkflowEvent({
              tenantId,
              processInstanceId: submissionRecord.processInstanceId ?? undefined,
              stepInstanceId: submissionRecord.stepInstanceId,
              eventType: isResubmission ? WorkflowEventType.FORM_RESUBMITTED : WorkflowEventType.FORM_SUBMITTED,
              eventDescription: isResubmission
                ? `Step ${step.stepOrder}: ${step.stepName} — Form resubmitted`
                : `Step ${step.stepOrder}: ${step.stepName} — Form submitted`,
              actorUserId: userId,
              actorName: user.fullName,
              actorRole: user.role,
            });

            if (stepCompletionResult.data?.processCompleted) {
              logWorkflowEvent({
                tenantId,
                processInstanceId: submissionRecord.processInstanceId ?? undefined,
                eventType: WorkflowEventType.PROCESS_COMPLETED,
                eventDescription: "Workflow completed",
                actorUserId: userId,
                actorName: user.fullName,
                actorRole: user.role,
              });
            } else if (stepCompletionResult.data?.nextStepActivated && stepCompletionResult.data?.nextStepId) {
              const [nextStep] = await db
                .select({ stepName: stepInstance.stepName })
                .from(stepInstance)
                .where(eq(stepInstance.id, stepCompletionResult.data.nextStepId));
              logWorkflowEvent({
                tenantId,
                processInstanceId: submissionRecord.processInstanceId ?? undefined,
                stepInstanceId: stepCompletionResult.data.nextStepId,
                eventType: WorkflowEventType.STEP_ACTIVATED,
                eventDescription: `Step - ${nextStep?.stepName ?? "Unknown"} Active`,
                actorUserId: userId,
                actorName: "Supplex",
                actorRole: "system",
              });
            }
          } else if (!stepCompletionResult.success) {
            console.warn(
              `[FormSubmit] Step auto-complete failed: ${stepCompletionResult.error}`
            );
          }
        } catch (err) {
          console.error("[FormSubmit] Error auto-completing step:", err);
        }
      }

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
    } catch (error: any) {
      console.error("Error submitting form:", error);

      set.status = 500;
      return {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to submit form",
          timestamp: new Date().toISOString(),
        },
      };
    }
  }
);

