import { Elysia } from "elysia";
import { db } from "../../lib/db";
import {
  formSubmission,
  formAnswer,
  formTemplate,
  formSection,
  formField,
  users,
  taskInstance,
} from "@supplex/db";
import { eq, and, isNull, or } from "drizzle-orm";
import { authenticatedRoute } from "../../lib/route-plugins";
import { ApiError, Errors } from "../../lib/errors";

/**
 * GET /api/form-submissions/:submissionId
 * Get a submission with all answers and metadata
 *
 * Auth: Requires authenticated user
 * Tenant: Enforces tenant isolation
 * Access Control: User must be submitter OR have permission to view submissions
 * Returns: Full submission with answers and field metadata for rendering
 */
export const getSubmissionRoute = new Elysia()
  .use(authenticatedRoute)
  .get("/:submissionId", async ({ params, user, set, requestLogger }) => {
    try {
      const tenantId = user.tenantId;
      const userId = user.id;
      const { submissionId } = params;

      // Fetch submission with tenant verification
      const [submissionRecord] = await db
        .select({
          submission: formSubmission,
          template: formTemplate,
          submittedByUser: {
            id: users.id,
            fullName: users.fullName,
            email: users.email,
          },
        })
        .from(formSubmission)
        .innerJoin(
          formTemplate,
          eq(formSubmission.formTemplateId, formTemplate.id)
        )
        .innerJoin(users, eq(formSubmission.submittedBy, users.id))
        .where(
          and(
            eq(formSubmission.id, submissionId),
            eq(formSubmission.tenantId, tenantId),
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

      // Always check whether the current user has a pending *validation* task
      // for this step. This must run regardless of who submitted the form so
      // that a user who is both submitter and validator (e.g. a Procurement
      // Manager acting on behalf of a supplier with no user) still gets the
      // validator UI rather than a plain read-only view.
      //
      // The taskType filter is critical: a step can also have a pending
      // "action" / "resubmission" task assigned to the same user (e.g. when
      // a fresh form step has just been activated and a draft submission
      // was auto-created). Those are NOT validation tasks and must not
      // surface Approve/Decline controls on the draft form.
      let canValidate = false;
      if (submissionRecord.submission.stepInstanceId) {
        const [validationTask] = await db
          .select({ id: taskInstance.id })
          .from(taskInstance)
          .where(
            and(
              eq(
                taskInstance.stepInstanceId,
                submissionRecord.submission.stepInstanceId
              ),
              eq(taskInstance.tenantId, tenantId),
              eq(taskInstance.status, "pending"),
              eq(taskInstance.taskType, "validation"),
              or(
                eq(taskInstance.assigneeUserId, userId),
                and(
                  eq(taskInstance.assigneeType, "role"),
                  eq(taskInstance.assigneeRole, user.role),
                  isNull(taskInstance.assigneeUserId)
                )
              )
            )
          )
          .limit(1);

        canValidate = !!validationTask;
      }

      const isSubmitter = submissionRecord.submission.submittedBy === userId;

      // Access control: submitter always allowed; otherwise validator or
      // privileged roles may view read-only.
      let isReadOnly = false;
      if (!isSubmitter) {
        if (
          !canValidate &&
          !["admin", "quality_manager", "procurement_manager"].includes(
            user.role
          )
        ) {
          throw Errors.forbidden(
            "You don't have permission to view this submission",
            "PERMISSION_DENIED"
          );
        }
        isReadOnly = true;
      }

      // A submitter who is also the validator must not be able to re-edit
      // their already-submitted answers while reviewing.
      if (canValidate) {
        isReadOnly = true;
      }

      // Fetch all answers with field metadata
      const answersWithFields = await db
        .select({
          answer: formAnswer,
          field: formField,
        })
        .from(formAnswer)
        .innerJoin(formField, eq(formAnswer.formFieldId, formField.id))
        .where(
          and(
            eq(formAnswer.formSubmissionId, submissionId),
            eq(formAnswer.tenantId, tenantId),
            isNull(formField.deletedAt)
          )
        );

      // Fetch all sections for the form structure
      const sections = await db
        .select()
        .from(formSection)
        .where(
          and(
            eq(
              formSection.formTemplateId,
              submissionRecord.submission.formTemplateId
            ),
            eq(formSection.tenantId, tenantId),
            isNull(formSection.deletedAt)
          )
        )
        .orderBy(formSection.sectionOrder);

      // Fetch all fields for complete form structure
      const allFields = await db
        .select({
          field: formField,
          section: formSection,
        })
        .from(formField)
        .innerJoin(formSection, eq(formField.formSectionId, formSection.id))
        .where(
          and(
            eq(
              formSection.formTemplateId,
              submissionRecord.submission.formTemplateId
            ),
            eq(formField.tenantId, tenantId),
            isNull(formField.deletedAt),
            isNull(formSection.deletedAt)
          )
        )
        .orderBy(formSection.sectionOrder, formField.fieldOrder);

      set.status = 200;
      return {
        success: true,
        data: {
          submission: submissionRecord.submission,
          formTemplate: submissionRecord.template,
          submittedByUser: submissionRecord.submittedByUser,
          isReadOnly,
          canValidate,
          answers: answersWithFields.map((row) => ({
            ...row.answer,
            field: row.field,
          })),
          formStructure: {
            sections: sections.map((section) => ({
              ...section,
              fields: allFields
                .filter((f) => f.section.id === section.id)
                .map((f) => f.field),
            })),
          },
        },
      };
    } catch (error: any) {
      if (error instanceof ApiError) throw error;
      requestLogger.error({ err: error }, "Submission fetch failed");
      throw Errors.internal("Failed to fetch submission");
    }
  });
