import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import {
  formSubmission,
  formAnswer,
  formTemplate,
  processInstance,
  stepInstance,
  formTemplateVersion,
  resolveFormTemplateVersionIdForStructure,
  loadFormStructureForVersion,
} from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import { authenticatedRoute } from "../../lib/route-plugins";
import { verifyProcessAccess } from "../../lib/rbac/entity-authorization";
import { validateAnswerFormat } from "../../lib/validation/form-answer-validation";
import { ApiError, Errors } from "../../lib/errors";

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
export const createDraftRoute = new Elysia().use(authenticatedRoute).post(
  "/draft",
  async ({ body, user, set, requestLogger }) => {
    try {
      const tenantId = user.tenantId;
      const userId = user.id;
      const { formTemplateId, processInstanceId, stepInstanceId, answers } =
        body;

      // Verify form_template exists and belongs to tenant (tenant isolation)
      const templateRecord = await db.query.formTemplate.findFirst({
        where: and(
          eq(formTemplate.id, formTemplateId),
          eq(formTemplate.tenantId, tenantId),
          isNull(formTemplate.deletedAt)
        ),
      });

      if (!templateRecord) {
        throw Errors.notFound(
          "Form template not found or you don't have access to it",
          "TEMPLATE_NOT_FOUND"
        );
      }

      if (processInstanceId) {
        const [process] = await db
          .select({
            entityType: processInstance.entityType,
            entityId: processInstance.entityId,
          })
          .from(processInstance)
          .where(
            and(
              eq(processInstance.id, processInstanceId),
              eq(processInstance.tenantId, tenantId)
            )
          );

        if (!process) {
          throw Errors.notFound("Process not found", "PROCESS_NOT_FOUND");
        }

        const access = await verifyProcessAccess(user, process, db);
        if (!access.allowed) {
          throw Errors.forbidden("Access denied", "ACCESS_DENIED");
        }
      }

      // Check if template is archived
      if (templateRecord.status === "archived") {
        throw Errors.badRequest(
          "Cannot create submission for archived template",
          "TEMPLATE_ARCHIVED"
        );
      }

      let stepPin: string | null = null;
      if (stepInstanceId) {
        const [stepRow] = await db
          .select({
            pinnedFormTemplateVersionId:
              stepInstance.pinnedFormTemplateVersionId,
          })
          .from(stepInstance)
          .where(
            and(
              eq(stepInstance.id, stepInstanceId),
              eq(stepInstance.tenantId, tenantId)
            )
          )
          .limit(1);

        if (!stepRow) {
          throw Errors.notFound("Step not found", "STEP_NOT_FOUND");
        }

        stepPin = stepRow.pinnedFormTemplateVersionId ?? null;
      }

      let resolvedForNew: string;
      if (stepPin) {
        const [pinVer] = await db
          .select()
          .from(formTemplateVersion)
          .where(
            and(
              eq(formTemplateVersion.id, stepPin),
              eq(formTemplateVersion.tenantId, tenantId),
              isNull(formTemplateVersion.deletedAt)
            )
          )
          .limit(1);

        if (!pinVer) {
          throw Errors.badRequest(
            "Step pinned form template version is missing or inaccessible",
            "PINNED_VERSION_INVALID"
          );
        }

        if (pinVer.formTemplateId !== formTemplateId) {
          throw Errors.badRequest(
            "Form template does not match the step pinned version's template",
            "FORM_TEMPLATE_PIN_MISMATCH"
          );
        }

        resolvedForNew = stepPin;
      } else {
        resolvedForNew = await resolveFormTemplateVersionIdForStructure(db, {
          formTemplateId,
          tenantId,
        });
      }

      const [existingDraft] = await db
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

      let versionForFields: string;

      if (existingDraft) {
        if (!existingDraft.formTemplateVersionId) {
          requestLogger.warn(
            {
              submissionId: existingDraft.id,
              stepInstanceId: stepInstanceId ?? null,
            },
            "form_submission.form_template_version_id is null on draft; using resolved version for validation (temporary fallback)"
          );
          versionForFields = resolvedForNew;
        } else {
          versionForFields = existingDraft.formTemplateVersionId;
        }

        if (stepPin && versionForFields !== stepPin) {
          throw Errors.badRequest(
            "Draft submission structure version does not match this step's pinned form version",
            "STEP_PIN_VERSION_MISMATCH"
          );
        }
      } else {
        versionForFields = resolvedForNew;
      }

      // SUP-38: prefer publish-time compiled_json when validating answer formats.
      // Pass `pinVer.compiledJson` directly when we already loaded the version row
      // for stepPin to avoid an extra round-trip. Fallbacks log the reason.
      const compiledOverride =
        stepPin && versionForFields === stepPin
          ? await db
              .select({ compiledJson: formTemplateVersion.compiledJson })
              .from(formTemplateVersion)
              .where(
                and(
                  eq(formTemplateVersion.id, versionForFields),
                  eq(formTemplateVersion.tenantId, tenantId),
                  isNull(formTemplateVersion.deletedAt)
                )
              )
              .limit(1)
              .then((rows) => rows[0]?.compiledJson ?? null)
          : undefined;

      const structureLoad = await loadFormStructureForVersion(db, {
        formTemplateId,
        formTemplateVersionId: versionForFields,
        tenantId,
        compiledJsonOverride: compiledOverride,
      });

      if (
        structureLoad.source === "relational" &&
        structureLoad.fallbackReason !== null
      ) {
        requestLogger.warn(
          {
            event: "form_submission_create_draft_compiled_json_fallback",
            formTemplateId,
            formTemplateVersionId: versionForFields,
            reason: structureLoad.fallbackReason,
          },
          "compiled_json fast path unavailable; falling back to relational fields"
        );
      }

      const fieldMap = new Map(
        structureLoad.fields.map((field) => [field.id, field])
      );

      for (const answer of answers) {
        const field = fieldMap.get(answer.formFieldId);

        if (!field) {
          throw Errors.badRequest(
            `Field ${answer.formFieldId} does not belong to this form template`,
            "INVALID_FIELD_ID"
          );
        }

        const validationError = validateAnswerFormat(answer.answerValue, field);
        if (validationError) {
          throw Errors.badRequest(
            `${field.label}: ${validationError}`,
            "INVALID_ANSWER_FORMAT"
          );
        }
      }

      let submission: typeof formSubmission.$inferSelect | undefined;

      if (existingDraft) {
        // Update existing draft - update timestamp
        const [updatedSubmission] = await db
          .update(formSubmission)
          .set({
            updatedAt: new Date(),
          })
          .where(eq(formSubmission.id, existingDraft.id))
          .returning();

        if (!updatedSubmission)
          throw Errors.internal("Failed to update draft submission");
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
            formTemplateVersionId: resolvedForNew,
            processInstanceId: processInstanceId || null,
            stepInstanceId: stepInstanceId || null,
            submittedBy: userId,
            status: "draft",
            submittedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        if (!newSubmission)
          throw Errors.internal("Failed to create draft submission");
        submission = newSubmission;

        // Insert answers
        if (answers.length > 0) {
          await db.insert(formAnswer).values(
            answers.map((answer) => ({
              formSubmissionId: newSubmission.id,
              formFieldId: answer.formFieldId,
              tenantId,
              answerValue: answer.answerValue,
              createdAt: new Date(),
              updatedAt: new Date(),
            }))
          );
        }
      }

      if (!submission)
        throw Errors.internal("Failed to create or update submission");

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
    } catch (error: unknown) {
      if (error instanceof ApiError) throw error;
      requestLogger.error({ err: error }, "Draft submission save failed");
      throw Errors.internal("Failed to create/update draft submission");
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
