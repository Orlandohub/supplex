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
import { authenticate } from "../../lib/rbac/middleware";

export const copyFormTemplate = new Elysia()
  .use(authenticate)
  .post(
    "/form-templates/:id/copy",
    async ({ params, body, user }) => {
      const { id } = params;

      if (!user) {
        throw new Error("Unauthorized");
      }

      // Fetch original template with tenant isolation
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
        throw new Error("Form template not found");
      }

      // Generate copy name
      const copyName = body.name || `Copy of ${originalTemplate.name}`;

      // Start transaction for deep copy
      const result = await db.transaction(async (tx) => {
        // 1. Create new form template
        const [newTemplate] = await tx
          .insert(formTemplate)
          .values({
            tenantId: user.tenantId,
            name: copyName,
            status: FormTemplateStatus.DRAFT,
            isActive: true,
          })
          .returning();

        // 2. Fetch all sections from original template
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

        // 3. Copy sections and their fields
        for (const section of sections) {
          // Create new section
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

          // Fetch all fields for this section
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

          // Copy fields
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
