/**
 * Copy Form Template Endpoint
 * Story: 2.2.14 - Remove Template Versioning, Add Copy Functionality
 *
 * POST /api/form-templates/:templateId/copy
 * Creates a deep copy of a form template with all sections and fields.
 *
 * Uses the `:templateId` param name (not `:id`) to colocate with
 * sections/fields/copy on the existing `:templateId` branch of the
 * memoirist route trie. Mixing `:id` and `:templateId` as children of the
 * same trie node throws "different parameter name in the same location"
 * at server compile.
 */

import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import {
  formTemplate,
  formSection,
  formField,
  FormTemplateStatus,
  insertDraftFormTemplateVersion,
  resolveSourceFormTemplateVersionIdForCopy,
} from "@supplex/db";
import { eq, and, isNull, asc, inArray } from "drizzle-orm";
import { requireAdmin } from "../../lib/rbac/middleware";
import { authenticatedRoute } from "../../lib/route-plugins";
import { ApiError, Errors } from "../../lib/errors";

export const copyFormTemplate = new Elysia()
  .use(authenticatedRoute)
  .use(requireAdmin)
  .post(
    "/:templateId/copy",
    async ({ params, body, user, requestLogger }) => {
      try {
        const { templateId: id } = params;

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
          throw Errors.notFound(
            "Form template not found",
            "TEMPLATE_NOT_FOUND"
          );
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

          const draftVersion = await insertDraftFormTemplateVersion(tx, {
            formTemplateId: newTemplate.id,
            tenantId: user.tenantId,
          });

          const sourceVersionId =
            await resolveSourceFormTemplateVersionIdForCopy(tx, {
              formTemplateId: originalTemplate.id,
              tenantId: user.tenantId,
              templateStatus: originalTemplate.status,
            });

          const sections = await tx
            .select()
            .from(formSection)
            .where(
              and(
                eq(formSection.formTemplateId, originalTemplate.id),
                eq(formSection.formTemplateVersionId, sourceVersionId),
                eq(formSection.tenantId, user.tenantId),
                isNull(formSection.deletedAt)
              )
            )
            .orderBy(asc(formSection.sectionOrder));

          const sectionIds = sections.map((s) => s.id);
          const allFields =
            sectionIds.length > 0
              ? await tx
                  .select()
                  .from(formField)
                  .where(
                    and(
                      eq(formField.formTemplateVersionId, sourceVersionId),
                      eq(formField.tenantId, user.tenantId),
                      inArray(formField.formSectionId, sectionIds),
                      isNull(formField.deletedAt)
                    )
                  )
              : [];

          const fieldsBySection = new Map<string, typeof allFields>();
          for (const sid of sectionIds) {
            fieldsBySection.set(sid, []);
          }
          for (const f of allFields) {
            const list = fieldsBySection.get(f.formSectionId);
            if (list) list.push(f);
          }
          for (const sid of sectionIds) {
            fieldsBySection
              .get(sid)
              ?.sort((a, b) => a.fieldOrder - b.fieldOrder);
          }

          for (const section of sections) {
            const [newSection] = await tx
              .insert(formSection)
              .values({
                formTemplateId: newTemplate.id,
                formTemplateVersionId: draftVersion.id,
                tenantId: user.tenantId,
                sectionOrder: section.sectionOrder,
                title: section.title,
                description: section.description,
                metadata: section.metadata,
              })
              .returning();

            if (!newSection)
              throw new Error("Failed to create form section copy");

            const fields = fieldsBySection.get(section.id) ?? [];

            if (fields.length > 0) {
              await tx.insert(formField).values(
                fields.map((field) => ({
                  formSectionId: newSection.id,
                  formTemplateVersionId: draftVersion.id,
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
      } catch (error: unknown) {
        if (error instanceof ApiError) throw error;
        requestLogger.error({ err: error }, "Error copying form template");
        throw Errors.internal("Failed to copy form template");
      }
    },
    {
      params: t.Object({
        templateId: t.String(),
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
