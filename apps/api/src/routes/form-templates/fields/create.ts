import { Elysia, t } from "elysia";
import { db } from "../../../lib/db";
import { formField, formSection, formTemplate } from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import { authenticate } from "../../../lib/rbac/middleware";
import { UserRole } from "@supplex/types";

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
  .use(authenticate)
  .post(
    "/sections/:sectionId/fields",
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

        // Validate options for dropdown and multi_select fields
        if (fieldType === "dropdown" || fieldType === "multi_select") {
          // Check if options object exists
          if (!options || typeof options !== "object") {
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
          if (!Array.isArray(options.choices)) {
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
          if (options.choices.length === 0) {
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
          if (options.choices.length > 100) {
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
          for (let i = 0; i < options.choices.length; i++) {
            const choice = options.choices[i];

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

        // Fetch section with template to check status and tenant
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
          set.status = 404;
          return {
            success: false,
            error: {
              code: "SECTION_NOT_FOUND",
              message: "Section not found or you don't have access to it",
              timestamp: new Date().toISOString(),
            },
          };
        }

        // Check if parent template is draft
        if (section.templateStatus !== "draft") {
          set.status = 400;
          return {
            success: false,
            error: {
              code: "TEMPLATE_PUBLISHED",
              message:
                "Cannot add field to published template. Please copy the template to make changes.",
              timestamp: new Date().toISOString(),
            },
          };
        }

        // Create field
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
        console.error("Error creating field:", error);

        set.status = 500;
        return {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to create field",
            timestamp: new Date().toISOString(),
          },
        };
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

