import { Elysia, t } from "elysia";
import { db } from "../../../lib/db";
import { formField, formSection, formTemplate } from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import { requireAdmin } from "../../../lib/rbac/middleware";
import { authenticatedRoute } from "../../../lib/route-plugins";
import { ApiError, Errors } from "../../../lib/errors";

/**
 * POST /api/form-templates/sections/:sectionId/fields
 * Create a new field in a section (Admin only)
 *
 * Auth: Requires Admin role
 * Tenant: Enforces tenant isolation
 * Validation: Parent template must be in 'draft' status
 * Returns: Created field
 */
export const createFieldRoute = new Elysia()
  .use(authenticatedRoute)
  .use(requireAdmin)
  .post(
    "/sections/:sectionId/fields",
    async ({ params, body, user, set, requestLogger }) => {
      try {
        const tenantId = user.tenantId;
        const { sectionId } = params;
        const {
          label,
          fieldType,
          required,
          validationRules,
          options,
          fieldOrder,
          placeholder,
        } = body;

        if (fieldType === "dropdown" || fieldType === "multi_select") {
          if (!options || typeof options !== "object") {
            throw Errors.badRequest(
              "Dropdown and multi-select fields must have an options object with a choices array",
              "INVALID_OPTIONS"
            );
          }

          if (!Array.isArray(options.choices)) {
            throw Errors.badRequest(
              "Dropdown and multi-select fields must have an options object with a choices array",
              "INVALID_OPTIONS"
            );
          }

          if (options.choices.length === 0) {
            throw Errors.badRequest(
              "Dropdown and multi-select fields must have at least one option",
              "EMPTY_OPTIONS"
            );
          }

          if (options.choices.length > 100) {
            throw Errors.badRequest(
              "Fields can have a maximum of 100 options",
              "TOO_MANY_OPTIONS"
            );
          }

          for (let i = 0; i < options.choices.length; i++) {
            const choice = options.choices[i];

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

        const [section] = await db
          .select({
            section: formSection,
            templateStatus: formTemplate.status,
          })
          .from(formSection)
          .innerJoin(
            formTemplate,
            eq(formSection.formTemplateId, formTemplate.id)
          )
          .where(
            and(
              eq(formSection.id, sectionId),
              eq(formSection.tenantId, tenantId),
              isNull(formSection.deletedAt)
            )
          )
          .limit(1);

        if (!section) {
          throw Errors.notFound(
            "Section not found or you don't have access to it",
            "SECTION_NOT_FOUND"
          );
        }

        if (section.templateStatus !== "draft") {
          throw Errors.badRequest(
            "Cannot add field to published template. Please copy the template to make changes.",
            "TEMPLATE_PUBLISHED"
          );
        }

        const [newField] = await db
          .insert(formField)
          .values({
            formSectionId: sectionId,
            tenantId,
            label,
            fieldType,
            required: required || false,
            validationRules: validationRules || {},
            options: options || {},
            fieldOrder,
            placeholder: placeholder || null,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        set.status = 201;
        return {
          success: true,
          data: {
            field: newField,
          },
        };
      } catch (error: any) {
        if (error instanceof ApiError) throw error;
        requestLogger.error({ err: error }, "Error creating field");
        throw Errors.internal("Failed to create field");
      }
    },
    {
      params: t.Object({
        sectionId: t.String({ format: "uuid" }),
      }),
      body: t.Object({
        label: t.String({ minLength: 1, maxLength: 255 }),
        fieldType: t.Union([
          t.Literal("text"),
          t.Literal("textarea"),
          t.Literal("number"),
          t.Literal("date"),
          t.Literal("dropdown"),
          t.Literal("checkbox"),
          t.Literal("multi_select"),
        ]),
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
        fieldOrder: t.Integer({ minimum: 1 }),
        placeholder: t.Optional(t.String()),
      }),
      detail: {
        summary: "Create field in section",
        description: "Creates a new field in a section (Admin only)",
        tags: ["Form Templates - Fields"],
      },
    }
  );
