/**
 * Copy Form Template Endpoint
 * Story: 2.2.14 - Remove Template Versioning, Add Copy Functionality
 *
 * POST /api/form-templates/:id/copy
 * Creates a deep copy of a form template with all sections and fields
 */

import { Elysia, t } from "elysia";
import { db } from "@supplex/db";
import {
  formTemplate,
  formSection,
  formField,
  FormTemplateStatus,
} from "@supplex/db";
import { eq, and, isNull, asc } from "drizzle-orm";
import { requireAdmin } from "../../lib/rbac/middleware";
import { ApiError, Errors } from "../../lib/errors";

export const copyFormTemplate = new Elysia().use(requireAdmin).post(
  "/form-templates/:id/copy",
  async ({ params, body, user, requestLogger }: any) => {
    try {
      const { id } = params;

      const [originalTemplate] = await db
        .select()
        .from(formTemplate)
        .where(
          and(
            eq(formTemplate.id, id),
            eq(formTemplate.tenantId, user.tenantId),
            isNull(formTemplate.deletedAt)
          )
        );

      if (!originalTemplate) {
        throw Errors.notFound("Form template not found", "TEMPLATE_NOT_FOUND");
      }

      const copyName = body.name || `Copy of ${originalTemplate.name}`;

      const result = await db.transaction(async (tx) => {
        const [newTemplate] = await tx
          .insert(formTemplate)
          .values({
            tenantId: user.tenantId,
            name: copyName,
            status: FormTemplateStatus.DRAFT,
            isActive: true,
          })
          .returning();

        if (!newTemplate)
          throw new Error("Failed to create form template copy");

        const sections = await tx
          .select()
          .from(formSection)
          .where(
            and(
              eq(formSection.formTemplateId, originalTemplate.id),
              eq(formSection.tenantId, user.tenantId),
              isNull(formSection.deletedAt)
            )
          )
          .orderBy(asc(formSection.sectionOrder));

        for (const section of sections) {
          const [newSection] = await tx
            .insert(formSection)
            .values({
              formTemplateId: newTemplate.id,
              tenantId: user.tenantId,
              sectionOrder: section.sectionOrder,
              title: section.title,
              description: section.description,
              metadata: section.metadata,
            })
            .returning();

          if (!newSection)
            throw new Error("Failed to create form section copy");

          const fields = await tx
            .select()
            .from(formField)
            .where(
              and(
                eq(formField.formSectionId, section.id),
                eq(formField.tenantId, user.tenantId),
                isNull(formField.deletedAt)
              )
            )
            .orderBy(asc(formField.fieldOrder));

          if (fields.length > 0) {
            await tx.insert(formField).values(
              fields.map((field) => ({
                formSectionId: newSection.id,
                tenantId: user.tenantId,
                fieldOrder: field.fieldOrder,
                fieldType: field.fieldType,
                label: field.label,
                placeholder: field.placeholder,
                required: field.required,
                validationRules: field.validationRules,
                options: field.options,
              }))
            );
          }
        }

        return newTemplate;
      });

      return {
        success: true,
        data: result,
        message: `Form template "${copyName}" created successfully`,
      };
    } catch (error: any) {
      if (error instanceof ApiError) throw error;
      requestLogger.error({ err: error }, "Error copying form template");
      throw Errors.internal("Failed to copy form template");
    }
  },
  {
    params: t.Object({
      id: t.String(),
    }),
    body: t.Object({
      name: t.Optional(t.String()),
    }),
    detail: {
      summary: "Copy form template",
      description:
        "Creates a deep copy of a form template with all sections and fields. Copy is created as draft.",
      tags: ["Form Templates"],
    },
  }
);
