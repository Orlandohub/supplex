import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import {
  formTemplate,
  formSection,
  formField,
  getDraftFormTemplateVersionForTemplate,
  getPublishedHeadFormTemplateVersion,
  getLatestImmutableFormTemplateVersion,
} from "@supplex/db";
import { eq, and, isNull, asc, inArray } from "drizzle-orm";
import { authenticatedRoute } from "../../lib/route-plugins";
import { UserRole } from "@supplex/types";
import { ApiError, Errors } from "../../lib/errors";

/**
 * Canonical snapshot of section/field structure for comparing draft vs published head.
 * Used only for admin UI ("unpublished changes"); not a public contract for submissions.
 */
async function formTemplateStructureSignature(
  templateId: string,
  tenantId: string,
  versionId: string
): Promise<string> {
  const sections = await db
    .select({
      id: formSection.id,
      title: formSection.title,
      sectionOrder: formSection.sectionOrder,
    })
    .from(formSection)
    .where(
      and(
        eq(formSection.formTemplateId, templateId),
        eq(formSection.formTemplateVersionId, versionId),
        eq(formSection.tenantId, tenantId),
        isNull(formSection.deletedAt)
      )
    )
    .orderBy(asc(formSection.sectionOrder));

  const sectionIds = sections.map((s) => s.id);
  const fields =
    sectionIds.length === 0
      ? []
      : await db
          .select({
            formSectionId: formField.formSectionId,
            fieldOrder: formField.fieldOrder,
            label: formField.label,
            placeholder: formField.placeholder,
            fieldType: formField.fieldType,
            required: formField.required,
            validationRules: formField.validationRules,
            options: formField.options,
          })
          .from(formField)
          .where(
            and(
              eq(formField.formTemplateVersionId, versionId),
              eq(formField.tenantId, tenantId),
              inArray(formField.formSectionId, sectionIds),
              isNull(formField.deletedAt)
            )
          );

  const fieldsBySection = new Map<string, typeof fields>();
  for (const sid of sectionIds) {
    fieldsBySection.set(sid, []);
  }
  for (const f of fields) {
    fieldsBySection.get(f.formSectionId)?.push(f);
  }

  const payload = sections.map((sec) => ({
    t: sec.title,
    fields: (fieldsBySection.get(sec.id) ?? [])
      .sort((a, b) => a.fieldOrder - b.fieldOrder)
      .map((f) => ({
        l: f.label,
        p: f.placeholder,
        ty: f.fieldType,
        r: f.required,
        v: f.validationRules,
        o: f.options,
      })),
  }));

  return JSON.stringify(payload);
}

/**
 * GET /api/form-templates/:id
 * Get a single form template with all sections and fields
 *
 * Auth: Requires authenticated user
 * Tenant: Enforces tenant isolation - returns 403 for cross-tenant access
 * Returns: Complete template structure with nested sections and fields
 */
export const getFormTemplateRoute = new Elysia().use(authenticatedRoute).get(
  "/:id",
  async ({ params, user, requestLogger }) => {
    try {
      const tenantId = user.tenantId;
      const templateId = params.id;

      const [templateRecord] = await db
        .select()
        .from(formTemplate)
        .where(
          and(
            eq(formTemplate.id, templateId),
            eq(formTemplate.tenantId, tenantId),
            isNull(formTemplate.deletedAt)
          )
        )
        .limit(1);

      if (!templateRecord) {
        throw Errors.notFound(
          "Form template not found or you don't have access to it",
          "TEMPLATE_NOT_FOUND"
        );
      }

      if (
        user.role !== UserRole.ADMIN &&
        templateRecord.status !== "published"
      ) {
        throw Errors.notFound(
          "Form template not found or you don't have access to it",
          "TEMPLATE_NOT_FOUND"
        );
      }

      let structureVersionId: string | undefined;
      let adminDraftVersion:
        | Awaited<ReturnType<typeof getDraftFormTemplateVersionForTemplate>>
        | undefined;

      if (user.role === UserRole.ADMIN) {
        const draft = await getDraftFormTemplateVersionForTemplate(db, {
          formTemplateId: templateId,
          tenantId,
        });
        adminDraftVersion = draft ?? undefined;
        if (draft) {
          structureVersionId = draft.id;
        } else {
          const fallback = await getLatestImmutableFormTemplateVersion(db, {
            formTemplateId: templateId,
            tenantId,
          });
          structureVersionId = fallback?.id;
        }
      } else {
        const head = await getPublishedHeadFormTemplateVersion(db, {
          formTemplateId: templateId,
          tenantId,
        });
        structureVersionId =
          head?.id ??
          (
            await getLatestImmutableFormTemplateVersion(db, {
              formTemplateId: templateId,
              tenantId,
            })
          )?.id;
      }

      if (!structureVersionId) {
        throw Errors.internal(
          "Form template exists but has no addressable structure version"
        );
      }

      const sections = await db
        .select()
        .from(formSection)
        .where(
          and(
            eq(formSection.formTemplateId, templateId),
            eq(formSection.formTemplateVersionId, structureVersionId),
            eq(formSection.tenantId, tenantId),
            isNull(formSection.deletedAt)
          )
        )
        .orderBy(asc(formSection.sectionOrder));

      const sectionIds = sections.map((s) => s.id);
      const fields =
        sectionIds.length > 0
          ? await db
              .select()
              .from(formField)
              .where(
                and(
                  eq(formField.formTemplateVersionId, structureVersionId),
                  eq(formField.tenantId, tenantId),
                  inArray(formField.formSectionId, sectionIds),
                  isNull(formField.deletedAt)
                )
              )
              .orderBy(asc(formField.fieldOrder))
          : [];

      const fieldsBySection = new Map<string, typeof fields>();
      for (const sid of sectionIds) {
        fieldsBySection.set(sid, []);
      }
      for (const f of fields) {
        const list = fieldsBySection.get(f.formSectionId);
        if (list) list.push(f);
      }
      for (const sid of sectionIds) {
        fieldsBySection.get(sid)?.sort((a, b) => a.fieldOrder - b.fieldOrder);
      }

      const sectionsWithFields = sections.map((section) => ({
        ...section,
        fields: fieldsBySection.get(section.id) ?? [],
      }));

      let hasUnpublishedDraftChanges = false;
      if (
        user.role === UserRole.ADMIN &&
        templateRecord.status === "published" &&
        adminDraftVersion
      ) {
        const publishedForCompare = await getPublishedHeadFormTemplateVersion(
          db,
          {
            formTemplateId: templateId,
            tenantId,
          }
        );
        if (
          publishedForCompare &&
          adminDraftVersion.id !== publishedForCompare.id
        ) {
          const [sigDraft, sigPublished] = await Promise.all([
            formTemplateStructureSignature(
              templateId,
              tenantId,
              adminDraftVersion.id
            ),
            formTemplateStructureSignature(
              templateId,
              tenantId,
              publishedForCompare.id
            ),
          ]);
          hasUnpublishedDraftChanges = sigDraft !== sigPublished;
        }
      }

      return {
        success: true,
        data: {
          ...templateRecord,
          sections: sectionsWithFields,
          hasUnpublishedDraftChanges,
        },
      };
    } catch (error: unknown) {
      if (error instanceof ApiError) throw error;
      requestLogger.error({ err: error }, "Error fetching form template");
      throw Errors.internal("Failed to fetch form template");
    }
  },
  {
    params: t.Object({
      id: t.String({ format: "uuid" }),
    }),
    detail: {
      summary: "Get form template by ID",
      description:
        "Get complete form template structure with nested sections and fields",
      tags: ["Form Templates"],
    },
  }
);
