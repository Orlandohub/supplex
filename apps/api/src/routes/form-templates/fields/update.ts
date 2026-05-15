import { Elysia, t } from "elysia";
import { db } from "../../../lib/db";
import {
  formField,
  formSection,
  formTemplateVersion,
  insertFormTemplateAuditEvent,
  snapshotRow,
  snapshotsDifferOnTrackedKeys,
  FormTemplateAuditEventType,
  FormTemplateAuditSubject,
  allocateFieldKey,
  normalizeClientFormTemplateKeyOrThrow,
  assertFieldKeyAvailable,
  InvalidFormTemplateKeyError,
} from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import { requireAdmin } from "../../../lib/rbac/middleware";
import { authenticatedRoute } from "../../../lib/route-plugins";
import { ApiError, Errors } from "../../../lib/errors";
import { isPostgresUniqueViolation } from "../../../lib/pg-errors";
import type { FieldOptions } from "@supplex/types";

const FIELD_TRACKED_KEYS = [
  "label",
  "fieldType",
  "required",
  "validationRules",
  "options",
  "fieldOrder",
  "placeholder",
  "fieldKey",
  "slugManuallyEdited",
] as const;

function hasChoices(
  options: FieldOptions | Record<string, never> | undefined | null
): options is FieldOptions {
  return (
    !!options &&
    typeof options === "object" &&
    "choices" in options &&
    Array.isArray((options as FieldOptions).choices)
  );
}

/**
 * PATCH /api/form-templates/fields/:fieldId
 * Update a field (Admin only)
 */
export const updateFieldRoute = new Elysia()
  .use(authenticatedRoute)
  .use(requireAdmin)
  .patch(
    "/fields/:fieldId",
    async ({ params, body, user, requestLogger }) => {
      try {
        const tenantId = user.tenantId;
        const { fieldId } = params;

        const updatedField = await db.transaction(async (tx) => {
          const [field] = await tx
            .select({
              field: formField,
              versionNumber: formTemplateVersion.versionNumber,
              formTemplateId: formSection.formTemplateId,
            })
            .from(formField)
            .innerJoin(formSection, eq(formField.formSectionId, formSection.id))
            .innerJoin(
              formTemplateVersion,
              and(
                eq(formField.formTemplateVersionId, formTemplateVersion.id),
                eq(formTemplateVersion.tenantId, tenantId)
              )
            )
            .where(
              and(
                eq(formField.id, fieldId),
                eq(formField.tenantId, tenantId),
                isNull(formField.deletedAt)
              )
            )
            .limit(1);

          if (!field) {
            throw Errors.notFound(
              "Field not found or you don't have access to it",
              "FIELD_NOT_FOUND"
            );
          }

          if (field.versionNumber !== null) {
            throw Errors.conflict(
              "Cannot modify field in an immutable published version snapshot.",
              "IMMUTABLE_FORM_VERSION"
            );
          }

          const beforeRow = field.field;
          const effectiveFieldType = body.fieldType || beforeRow.fieldType;

          if (
            effectiveFieldType === "dropdown" ||
            effectiveFieldType === "multi_select"
          ) {
            const optionsToValidate: FieldOptions | undefined =
              body.options !== undefined
                ? body.options
                : hasChoices(beforeRow.options)
                  ? beforeRow.options
                  : undefined;

            if (!optionsToValidate) {
              throw Errors.badRequest(
                "Dropdown and multi-select fields must have an options object with a choices array",
                "INVALID_OPTIONS"
              );
            }

            if (optionsToValidate.choices.length === 0) {
              throw Errors.badRequest(
                "Dropdown and multi-select fields must have at least one option",
                "EMPTY_OPTIONS"
              );
            }

            if (optionsToValidate.choices.length > 100) {
              throw Errors.badRequest(
                "Fields can have a maximum of 100 options",
                "TOO_MANY_OPTIONS"
              );
            }

            for (let i = 0; i < optionsToValidate.choices.length; i++) {
              const choice = optionsToValidate.choices[i];

              if (!choice || typeof choice !== "object") {
                throw Errors.badRequest(
                  `Option at index ${i} must be an object with value and label`,
                  "INVALID_OPTION_FORMAT"
                );
              }

              if (
                typeof choice.value !== "string" ||
                choice.value.trim() === ""
              ) {
                throw Errors.badRequest(
                  `Option at index ${i} must have a non-empty value`,
                  "INVALID_OPTION_VALUE"
                );
              }

              if (choice.value.length > 255) {
                throw Errors.badRequest(
                  `Option at index ${i}: value must be 255 characters or less`,
                  "OPTION_VALUE_TOO_LONG"
                );
              }

              if (
                typeof choice.label !== "string" ||
                choice.label.trim() === ""
              ) {
                throw Errors.badRequest(
                  `Option at index ${i} must have a non-empty label`,
                  "INVALID_OPTION_LABEL"
                );
              }

              if (choice.label.length > 255) {
                throw Errors.badRequest(
                  `Option at index ${i}: label must be 255 characters or less`,
                  "OPTION_LABEL_TOO_LONG"
                );
              }
            }
          }

          const updateData: Partial<typeof formField.$inferInsert> = {
            updatedAt: new Date(),
          };

          let nextSlugManual = beforeRow.slugManuallyEdited;
          if (body.slugManuallyEdited !== undefined) {
            updateData.slugManuallyEdited = body.slugManuallyEdited;
            nextSlugManual = body.slugManuallyEdited;
          }

          if (body.label !== undefined) {
            updateData.label = body.label;
          }

          if (body.fieldType !== undefined) {
            updateData.fieldType = body.fieldType;
          }

          if (body.required !== undefined) {
            updateData.required = body.required;
          }

          if (body.validationRules !== undefined) {
            updateData.validationRules = body.validationRules;
          }

          if (body.options !== undefined) {
            updateData.options = body.options;
          }

          if (body.fieldOrder !== undefined) {
            updateData.fieldOrder = body.fieldOrder;
          }

          if (body.placeholder !== undefined) {
            updateData.placeholder = body.placeholder || null;
          }

          const effectiveLabel =
            body.label !== undefined ? body.label : beforeRow.label;

          if (body.fieldKey !== undefined && body.fieldKey.trim() !== "") {
            const k = normalizeClientFormTemplateKeyOrThrow(body.fieldKey);
            await assertFieldKeyAvailable(tx, {
              versionId: beforeRow.formTemplateVersionId,
              tenantId,
              key: k,
              excludeFieldId: fieldId,
            });
            updateData.fieldKey = k;
            updateData.slugManuallyEdited = true;
          } else if (
            body.label !== undefined &&
            body.label !== beforeRow.label &&
            !nextSlugManual
          ) {
            updateData.fieldKey = await allocateFieldKey(tx, {
              versionId: beforeRow.formTemplateVersionId,
              tenantId,
              desiredBase: effectiveLabel,
              excludeFieldId: fieldId,
            });
          }

          const [afterRow] = await tx
            .update(formField)
            .set(updateData)
            .where(eq(formField.id, fieldId))
            .returning();

          if (!afterRow) {
            throw Errors.internal("Failed to update field");
          }

          const beforeSnap = snapshotRow(beforeRow);
          const afterSnap = snapshotRow(afterRow);

          if (
            snapshotsDifferOnTrackedKeys(
              beforeSnap,
              afterSnap,
              FIELD_TRACKED_KEYS
            )
          ) {
            await insertFormTemplateAuditEvent(tx, {
              tenantId,
              formTemplateId: field.formTemplateId,
              formTemplateVersionId: beforeRow.formTemplateVersionId,
              actorUserId: user.id,
              eventType: FormTemplateAuditEventType.FIELD_UPDATED,
              subjectType: FormTemplateAuditSubject.FIELD,
              subjectId: beforeRow.id,
              before: beforeSnap,
              after: afterSnap,
              summary: `Field "${afterRow.label}" updated`,
            });
          }

          return afterRow;
        });

        return {
          success: true,
          data: {
            field: updatedField,
          },
        };
      } catch (error: unknown) {
        if (error instanceof ApiError) throw error;
        if (error instanceof InvalidFormTemplateKeyError) {
          throw Errors.badRequest(error.message, error.code);
        }
        if (
          error instanceof Error &&
          error.message === "FORM_TEMPLATE_FIELD_KEY_TAKEN"
        ) {
          throw Errors.conflict(
            "That field key is already used in this form version.",
            "DUPLICATE_FORM_KEY"
          );
        }
        if (isPostgresUniqueViolation(error)) {
          throw Errors.conflict(
            "That key is already used in this form version.",
            "DUPLICATE_FORM_KEY"
          );
        }
        requestLogger.error({ err: error }, "Error updating field");
        throw Errors.internal("Failed to update field");
      }
    },
    {
      params: t.Object({
        fieldId: t.String({ format: "uuid" }),
      }),
      body: t.Object({
        label: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
        fieldType: t.Optional(
          t.Union([
            t.Literal("text"),
            t.Literal("textarea"),
            t.Literal("number"),
            t.Literal("date"),
            t.Literal("dropdown"),
            t.Literal("checkbox"),
            t.Literal("multi_select"),
          ])
        ),
        required: t.Optional(t.Boolean()),
        validationRules: t.Optional(t.Any()),
        options: t.Optional(
          t.Object({
            choices: t.Array(
              t.Object({
                value: t.String({ minLength: 1, maxLength: 255 }),
                label: t.String({ minLength: 1, maxLength: 255 }),
              })
            ),
          })
        ),
        fieldOrder: t.Optional(t.Integer({ minimum: 1 })),
        placeholder: t.Optional(t.String()),
        fieldKey: t.Optional(t.String({ minLength: 1, maxLength: 64 })),
        slugManuallyEdited: t.Optional(t.Boolean()),
      }),
      detail: {
        summary: "Update field",
        description:
          "Updates a field in a draft form template version (Admin only)",
        tags: ["Form Templates - Fields"],
      },
    }
  );
