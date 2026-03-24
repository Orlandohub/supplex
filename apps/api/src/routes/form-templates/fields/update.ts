import { Elysia, t } from "elysia";
import { db } from "../../../lib/db";
import { formField, formSection, formTemplate } from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import { authenticate } from "../../../lib/rbac/middleware";
import { UserRole } from "@supplex/types";

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
  .use(authenticate)
  .patch(
    "/fields/:fieldId",
    async ({ params, body, user, set }: any) => {
      // Check role permission - Admin only
      if (!user?.role || user.role !== UserRole.ADMIN) {
        set.status = 403;
        return {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Access denied. Required role: Admin",
            timestamp: new Date().toISOString(),
          },
        };
      }

      try {
        const tenantId = user.tenantId as string;
        const { fieldId } = params;

        // Fetch field with section and template to check status
        const [field] = await db
          .select({
            field: formField,
            templateStatus: formTemplate.status,
          })
          .from(formField)
          .innerJoin(
            formSection,
            eq(formField.formSectionId, formSection.id)
          )
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
          set.status = 404;
          return {
            success: false,
            error: {
              code: "FIELD_NOT_FOUND",
              message: "Field not found or you don't have access to it",
              timestamp: new Date().toISOString(),
            },
          };
        }

        // Check if parent template is draft
        if (field.templateStatus !== "draft") {
          set.status = 400;
          return {
            success: false,
            error: {
              code: "TEMPLATE_PUBLISHED",
              message:
                "Cannot modify field in published template. Please copy the template to make changes.",
              timestamp: new Date().toISOString(),
            },
          };
        }

        // Determine the effective field type (use new if provided, otherwise current)
        const effectiveFieldType = body.fieldType || field.field.fieldType;

        // Validate options for dropdown and multi_select fields
        if (effectiveFieldType === "dropdown" || effectiveFieldType === "multi_select") {
          // If options are being updated OR fieldType is being changed TO dropdown/multi_select
          const optionsToValidate = body.options !== undefined ? body.options : (field.field.options as any);

          // Check if options object exists
          if (!optionsToValidate || typeof optionsToValidate !== "object") {
            set.status = 400;
            return {
              success: false,
              error: {
                code: "INVALID_OPTIONS",
                message:
                  "Dropdown and multi-select fields must have an options object with a choices array",
                timestamp: new Date().toISOString(),
              },
            };
          }

          // Check if choices array exists
          if (!Array.isArray(optionsToValidate.choices)) {
            set.status = 400;
            return {
              success: false,
              error: {
                code: "INVALID_OPTIONS",
                message:
                  "Dropdown and multi-select fields must have an options object with a choices array",
                timestamp: new Date().toISOString(),
              },
            };
          }

          // Check minimum count
          if (optionsToValidate.choices.length === 0) {
            set.status = 400;
            return {
              success: false,
              error: {
                code: "EMPTY_OPTIONS",
                message:
                  "Dropdown and multi-select fields must have at least one option",
                timestamp: new Date().toISOString(),
              },
            };
          }

          // Check maximum count
          if (optionsToValidate.choices.length > 100) {
            set.status = 400;
            return {
              success: false,
              error: {
                code: "TOO_MANY_OPTIONS",
                message: "Fields can have a maximum of 100 options",
                timestamp: new Date().toISOString(),
              },
            };
          }

          // Validate each choice
          for (let i = 0; i < optionsToValidate.choices.length; i++) {
            const choice = optionsToValidate.choices[i];

            // Check if choice is an object
            if (!choice || typeof choice !== "object") {
              set.status = 400;
              return {
                success: false,
                error: {
                  code: "INVALID_OPTION_FORMAT",
                  message: `Option at index ${i} must be an object with value and label`,
                  timestamp: new Date().toISOString(),
                },
              };
            }

            // Validate value
            if (typeof choice.value !== "string" || choice.value.trim() === "") {
              set.status = 400;
              return {
                success: false,
                error: {
                  code: "INVALID_OPTION_VALUE",
                  message: `Option at index ${i} must have a non-empty value`,
                  timestamp: new Date().toISOString(),
                },
              };
            }

            if (choice.value.length > 255) {
              set.status = 400;
              return {
                success: false,
                error: {
                  code: "OPTION_VALUE_TOO_LONG",
                  message: `Option at index ${i}: value must be 255 characters or less`,
                  timestamp: new Date().toISOString(),
                },
              };
            }

            // Validate label
            if (typeof choice.label !== "string" || choice.label.trim() === "") {
              set.status = 400;
              return {
                success: false,
                error: {
                  code: "INVALID_OPTION_LABEL",
                  message: `Option at index ${i} must have a non-empty label`,
                  timestamp: new Date().toISOString(),
                },
              };
            }

            if (choice.label.length > 255) {
              set.status = 400;
              return {
                success: false,
                error: {
                  code: "OPTION_LABEL_TOO_LONG",
                  message: `Option at index ${i}: label must be 255 characters or less`,
                  timestamp: new Date().toISOString(),
                },
              };
            }
          }
        }

        // Build update object dynamically
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

        // Update field
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
      } catch (error: any) {
        console.error("Error updating field:", error);

        set.status = 500;
        return {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to update field",
            timestamp: new Date().toISOString(),
          },
        };
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
        description: "Updates a field in a draft form template version (Admin only)",
        tags: ["Form Templates - Fields"],
      },
    }
  );

