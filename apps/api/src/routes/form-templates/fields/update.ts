import { Elysia, t } from "elysia";
import { db } from "../../../lib/db";
import { formField, formSection, formTemplate } from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import { requireAdmin } from "../../../lib/rbac/middleware";
import { authenticatedRoute } from "../../../lib/route-plugins";
import { ApiError, Errors } from "../../../lib/errors";

/**
 * PATCH /api/form-templates/fields/:fieldId
 * Update a field (Admin only)
 *
 * Auth: Requires Admin role
 * Tenant: Enforces tenant isolation
 * Validation: Parent template must be in 'draft' status
 * Returns: Updated field
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

        const [field] = await db
          .select({
            field: formField,
            templateStatus: formTemplate.status,
          })
          .from(formField)
          .innerJoin(formSection, eq(formField.formSectionId, formSection.id))
          .innerJoin(
            formTemplate,
            eq(formSection.formTemplateId, formTemplate.id)
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

        if (field.templateStatus !== "draft") {
          throw Errors.badRequest(
            "Cannot modify field in published template. Please copy the template to make changes.",
            "TEMPLATE_PUBLISHED"
          );
        }

        const effectiveFieldType = body.fieldType || field.field.fieldType;

        if (
          effectiveFieldType === "dropdown" ||
          effectiveFieldType === "multi_select"
        ) {
          const optionsToValidate =
            body.options !== undefined
              ? body.options
              : (field.field.options as any);

          if (!optionsToValidate || typeof optionsToValidate !== "object") {
            throw Errors.badRequest(
              "Dropdown and multi-select fields must have an options object with a choices array",
              "INVALID_OPTIONS"
            );
          }

          if (!Array.isArray(optionsToValidate.choices)) {
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

        const updateData: any = {
          updatedAt: new Date(),
        };

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

        const [updatedField] = await db
          .update(formField)
          .set(updateData)
          .where(eq(formField.id, fieldId))
          .returning();

        return {
          success: true,
          data: {
            field: updatedField,
          },
        };
      } catch (error: unknown) {
        if (error instanceof ApiError) throw error;
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
      }),
      detail: {
        summary: "Update field",
        description:
          "Updates a field in a draft form template version (Admin only)",
        tags: ["Form Templates - Fields"],
      },
    }
  );
