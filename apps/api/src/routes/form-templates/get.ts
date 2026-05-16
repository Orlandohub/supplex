import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import {
  formTemplate,
  getDraftFormTemplateVersionForTemplate,
  getPublishedHeadFormTemplateVersion,
  getLatestImmutableFormTemplateVersion,
  loadFormTemplateStructureSnapshot,
  formTemplateStructureSignatureFromSlices,
  loadFormStructureForVersion,
  type SelectFormField,
  type SelectFormSection,
  type SelectFormTemplateVersion,
} from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import { authenticatedRoute } from "../../lib/route-plugins";
import { UserRole } from "@supplex/types";
import { ApiError, Errors } from "../../lib/errors";

/**
 * GET /api/form-templates/:id
 * Get a single form template with all sections and fields
 *
 * Auth: Requires authenticated user
 * Tenant: Enforces tenant isolation - returns 403 for cross-tenant access
 * Returns: Complete template structure with nested sections and fields
 *
 * SUP-38: Immutable (published / superseded) versions are served from the publish-time
 * `compiled_json` cache when it carries a supported schemaVersion. Drafts always go
 * through the relational subtree because compiled_json is not emitted for drafts
 * (see SUP-33). Cache misses / malformed payloads / unsupported schema versions
 * transparently fall back to the relational subtree and emit a structured warn log.
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
      let resolvedImmutableVersionRow: SelectFormTemplateVersion | null = null;

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
          resolvedImmutableVersionRow = fallback ?? null;
        }
      } else {
        const head = await getPublishedHeadFormTemplateVersion(db, {
          formTemplateId: templateId,
          tenantId,
        });
        if (head) {
          structureVersionId = head.id;
          resolvedImmutableVersionRow = head;
        } else {
          const latest = await getLatestImmutableFormTemplateVersion(db, {
            formTemplateId: templateId,
            tenantId,
          });
          structureVersionId = latest?.id;
          resolvedImmutableVersionRow = latest ?? null;
        }
      }

      if (!structureVersionId) {
        throw Errors.internal(
          "Form template exists but has no addressable structure version"
        );
      }

      const structureLoad = await loadFormStructureForVersion(db, {
        formTemplateId: templateId,
        formTemplateVersionId: structureVersionId,
        tenantId,
        preferCompiled: resolvedImmutableVersionRow !== null,
        compiledJsonOverride: resolvedImmutableVersionRow?.compiledJson,
      });

      if (
        structureLoad.source === "relational" &&
        resolvedImmutableVersionRow !== null &&
        structureLoad.fallbackReason !== null
      ) {
        requestLogger.warn(
          {
            event: "form_template_get_compiled_json_fallback",
            formTemplateId: templateId,
            formTemplateVersionId: structureVersionId,
            reason: structureLoad.fallbackReason,
          },
          "compiled_json fast path unavailable; falling back to relational structure"
        );
      }

      const fieldsBySection = new Map<string, SelectFormField[]>();
      for (const f of structureLoad.fields) {
        const list = fieldsBySection.get(f.formSectionId);
        if (list) {
          list.push(f);
        } else {
          fieldsBySection.set(f.formSectionId, [f]);
        }
      }
      for (const [, list] of fieldsBySection) {
        list.sort((a, b) => a.fieldOrder - b.fieldOrder);
      }

      type SectionWithFields = SelectFormSection & {
        fields: SelectFormField[];
      };
      const sectionsWithFields: SectionWithFields[] =
        structureLoad.sections.map((section) => ({
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
          const [draftSnap, publishedSnap] = await Promise.all([
            loadFormTemplateStructureSnapshot(db, {
              formTemplateId: templateId,
              tenantId,
              versionId: adminDraftVersion.id,
            }),
            loadFormTemplateStructureSnapshot(db, {
              formTemplateId: templateId,
              tenantId,
              versionId: publishedForCompare.id,
            }),
          ]);
          hasUnpublishedDraftChanges =
            formTemplateStructureSignatureFromSlices(draftSnap) !==
            formTemplateStructureSignatureFromSlices(publishedSnap);
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
