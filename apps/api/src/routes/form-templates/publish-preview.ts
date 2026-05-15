import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import {
  formTemplate,
  FormTemplateStatus,
  getDraftFormTemplateVersionForTemplate,
  getPublishedHeadFormTemplateVersion,
  loadFormTemplateStructureSnapshot,
  diffFormTemplateStructureSnapshots,
  summarizeFormTemplateStructureDiffAccurate,
  structureChangedFromDiff,
  computeFormTemplatePublishImpact,
} from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import { requireAdmin } from "../../lib/rbac/middleware";
import { authenticatedRoute } from "../../lib/route-plugins";
import { ApiError, Errors } from "../../lib/errors";

/**
 * GET /api/form-templates/:id/publish-preview
 * SUP-29: Preview structure diff (draft vs published head) and publish impact before shipping.
 */
export const publishPreviewRoute = new Elysia()
  .use(authenticatedRoute)
  .use(requireAdmin)
  .get(
    "/:id/publish-preview",
    async ({ params, user, requestLogger }) => {
      try {
        const tenantId = user.tenantId;
        const formTemplateId = params.id;

        const [template] = await db
          .select()
          .from(formTemplate)
          .where(
            and(
              eq(formTemplate.id, formTemplateId),
              eq(formTemplate.tenantId, tenantId),
              isNull(formTemplate.deletedAt)
            )
          )
          .limit(1);

        if (!template) {
          throw Errors.notFound(
            "Form template not found or you don't have access to it",
            "TEMPLATE_NOT_FOUND"
          );
        }

        if (template.status === FormTemplateStatus.ARCHIVED) {
          throw Errors.badRequest(
            "Cannot preview publish for an archived template.",
            "TEMPLATE_ARCHIVED"
          );
        }

        const draft = await getDraftFormTemplateVersionForTemplate(db, {
          formTemplateId,
          tenantId,
        });

        if (!draft) {
          throw Errors.badRequest(
            "No draft structure available to preview",
            "NO_DRAFT_STRUCTURE"
          );
        }

        const publishedHead = await getPublishedHeadFormTemplateVersion(db, {
          formTemplateId,
          tenantId,
        });

        const baselineSnap = publishedHead
          ? await loadFormTemplateStructureSnapshot(db, {
              formTemplateId,
              tenantId,
              versionId: publishedHead.id,
            })
          : [];

        const draftSnap = await loadFormTemplateStructureSnapshot(db, {
          formTemplateId,
          tenantId,
          versionId: draft.id,
        });

        const diff = diffFormTemplateStructureSnapshots(
          baselineSnap,
          draftSnap
        );
        const structureDiffSummary = summarizeFormTemplateStructureDiffAccurate(
          diff,
          baselineSnap
        );

        const publishImpact = await computeFormTemplatePublishImpact(db, {
          formTemplateId,
          tenantId,
          supersededPublishedVersionId: publishedHead?.id ?? null,
        });

        const structureChanged = structureChangedFromDiff(diff);

        return {
          success: true,
          data: {
            diff,
            publishImpact,
            structureChanged,
            structureDiffSummary,
          },
        };
      } catch (error: unknown) {
        if (error instanceof ApiError) throw error;
        requestLogger.error({ err: error }, "Error building publish preview");
        throw Errors.internal("Failed to build publish preview");
      }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      detail: {
        summary: "Publish preview (diff + impact)",
        description:
          "Returns draft vs published-head structure diff and workflow/process impact (SUP-29). Admin only.",
        tags: ["Form Templates"],
      },
    }
  );
