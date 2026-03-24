import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import {
  formSubmission,
  formAnswer,
  formTemplate,
  formSection,
  formField,
} from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import { authenticate } from "../../lib/rbac/middleware";
import { validateAnswerFormat } from "../../lib/validation/form-answer-validation";

/**
 * POST /api/form-submissions/draft
 * Create or update a draft submission
 *
 * Auth: Requires authenticated user
 * Tenant: Enforces tenant isolation
 * Behavior:
 * - Verifies form_template belongs to user's tenant
 * - If draft exists for user + template (+ process_instance if provided): updates answers
 * - If new: creates form_submission with status='draft', then inserts answers
 * - Does NOT validate required fields (AC: 2 - drafts can be saved without required fields)
 * - DOES validate answer format based on field_type
 * Returns: Full submission with nested answers
 */
export const createDraftRoute = new Elysia().use(authenticate).post(
  "/draft",
  async ({ body, user, set }: any) => {
    try {
      const tenantId = user.tenantId as string;
      const userId = user.id as string;
      const { formTemplateId, processInstanceId, stepInstanceId, answers } = body;

      // Verify form_template exists and belongs to tenant (tenant isolation)
      const templateRecord = await db.query.formTemplate.findFirst({
        where: and(
          eq(formTemplate.id, formTemplateId),
          eq(formTemplate.tenantId, tenantId),
          isNull(formTemplate.deletedAt)
        ),
      });

      if (!templateRecord) {
        set.status = 404;
        return {
          success: false,
          error: {
            code: "TEMPLATE_NOT_FOUND",
            message:
              "Form template not found or you don't have access to it",
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Check if template is archived
      if (templateRecord.status === "archived") {
        set.status = 400;
        return {
          success: false,
          error: {
            code: "TEMPLATE_ARCHIVED",
            message: "Cannot create submission for archived template",
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Load all fields for validation
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
            eq(formSection.formTemplateId, formTemplateId),
            eq(formField.tenantId, tenantId),
            isNull(formField.deletedAt),
            isNull(formSection.deletedAt)
          )
        );

      const fieldMap = new Map(
        fieldsData.map((row) => [row.field.id, row.field])
      );

      // Validate all provided answers
      for (const answer of answers) {
        const field = fieldMap.get(answer.formFieldId);

        if (!field) {
          set.status = 400;
          return {
            success: false,
            error: {
              code: "INVALID_FIELD_ID",
              message: `Field ${answer.formFieldId} does not belong to this form template version`,
              timestamp: new Date().toISOString(),
            },
          };
        }

        // Validate answer format based on field_type
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

      // Check if draft submission already exists for this user + version + process + step
      const existingDraftQuery = db
        .select()
        .from(formSubmission)
        .where(
          and(
            eq(formSubmission.formTemplateId, formTemplateId),
            eq(formSubmission.submittedBy, userId),
            eq(formSubmission.tenantId, tenantId),
            eq(formSubmission.status, "draft"),
            isNull(formSubmission.deletedAt),
            processInstanceId
              ? eq(formSubmission.processInstanceId, processInstanceId)
              : isNull(formSubmission.processInstanceId),
            stepInstanceId
              ? eq(formSubmission.stepInstanceId, stepInstanceId)
              : isNull(formSubmission.stepInstanceId)
          )
        )
        .limit(1);

      const [existingDraft] = await existingDraftQuery;

      let submission;

      if (existingDraft) {
        // Update existing draft - update timestamp
        const [updatedSubmission] = await db
          .update(formSubmission)
          .set({
            updatedAt: new Date(),
          })
          .where(eq(formSubmission.id, existingDraft.id))
          .returning();

        submission = updatedSubmission;

        // Upsert answers using ON CONFLICT
        for (const answer of answers) {
          await db
            .insert(formAnswer)
            .values({
              formSubmissionId: submission.id,
              formFieldId: answer.formFieldId,
              tenantId,
              answerValue: answer.answerValue,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: [formAnswer.formSubmissionId, formAnswer.formFieldId],
              set: {
                answerValue: answer.answerValue,
                updatedAt: new Date(),
              },
            });
        }
      } else {
        // Create new draft submission
        const [newSubmission] = await db
          .insert(formSubmission)
          .values({
            tenantId,
            formTemplateId,
            processInstanceId: processInstanceId || null,
            stepInstanceId: stepInstanceId || null,
            submittedBy: userId,
            status: "draft",
            submittedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        submission = newSubmission;

        // Insert answers
        if (answers.length > 0) {
          await db.insert(formAnswer).values(
            answers.map((answer: any) => ({
              formSubmissionId: submission.id,
              formFieldId: answer.formFieldId,
              tenantId,
              answerValue: answer.answerValue,
              createdAt: new Date(),
              updatedAt: new Date(),
            }))
          );
        }
      }

      // Fetch full submission with answers
      const submissionAnswers = await db
        .select()
        .from(formAnswer)
        .where(
          and(
            eq(formAnswer.formSubmissionId, submission.id),
            eq(formAnswer.tenantId, tenantId)
          )
        );

      set.status = existingDraft ? 200 : 201;
      return {
        success: true,
        data: {
          submission: {
            ...submission,
            answers: submissionAnswers,
          },
        },
      };
    } catch (error: any) {
      console.error("Error creating/updating draft submission:", error);

      set.status = 500;
      return {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to create/update draft submission",
          timestamp: new Date().toISOString(),
        },
      };
    }
  },
  {
    body: t.Object({
      formTemplateId: t.String({ format: "uuid" }),
      processInstanceId: t.Optional(
        t.Union([t.String({ format: "uuid" }), t.Null()])
      ),
      stepInstanceId: t.Optional(
        t.Union([t.String({ format: "uuid" }), t.Null()])
      ),
      answers: t.Array(
        t.Object({
          formFieldId: t.String({ format: "uuid" }),
          answerValue: t.String(),
        })
      ),
    }),
  }
);

