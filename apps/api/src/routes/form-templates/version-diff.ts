import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import {
  formTemplate,
  formTemplateVersion,
  loadFormTemplateStructureSnapshot,
  diffFormTemplateStructureSnapshots,
  summarizeFormTemplateStructureDiffAccurate,
  structureChangedFromDiff,
} from "@supplex/db";
import type { FormTemplateVersionDiffData } from "@supplex/types";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { requireAdmin } from "../../lib/rbac/middleware";
import { authenticatedRoute } from "../../lib/route-plugins";
import { ApiError, Errors } from "../../lib/errors";

/**
 * GET /api/form-templates/:id/version-diff?fromVersionId=&toVersionId=
 * SUP-32: structural diff between two arbitrary versions of a template.
 *
 * Reuses the publish-preview snapshot + diff helpers so summaries here
 * match what the publish dialog renders end-to-end. Both version ids
 * MUST belong to the same template and tenant; mismatches return 404
 * (no existence leakage) rather than 400.
 *
 * Auth: Admin only. Tenant: enforced by joining versions to the
 * caller's tenantId.
 */
export const versionDiffRoute = new Elysia()
  .use(authenticatedRoute)
  .use(requireAdmin)
  .get(
    "/:id/version-diff",
    async ({ params, query, user, requestLogger }) => {
      try {
        const tenantId = user.tenantId;
        const templateId = params.id;
        const { fromVersionId, toVersionId } = query;

        const [template] = await db
          .select({ id: formTemplate.id })
          .from(formTemplate)
          .where(
            and(
              eq(formTemplate.id, templateId),
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

        const versionRows = await db
          .select({
            id: formTemplateVersion.id,
            status: formTemplateVersion.status,
            versionNumber: formTemplateVersion.versionNumber,
          })
          .from(formTemplateVersion)
          .where(
            and(
              eq(formTemplateVersion.formTemplateId, templateId),
              eq(formTemplateVersion.tenantId, tenantId),
              isNull(formTemplateVersion.deletedAt),
              inArray(formTemplateVersion.id, [fromVersionId, toVersionId])
            )
          );

        const fromVersion = versionRows.find((v) => v.id === fromVersionId);
        const toVersion = versionRows.find((v) => v.id === toVersionId);

        if (!fromVersion || !toVersion) {
          throw Errors.notFound(
            "One or both versions not found for this template",
            "VERSION_NOT_FOUND"
          );
        }

        const [baselineSnap, draftSnap] = await Promise.all([
          loadFormTemplateStructureSnapshot(db, {
            formTemplateId: templateId,
            tenantId,
            versionId: fromVersion.id,
          }),
          loadFormTemplateStructureSnapshot(db, {
            formTemplateId: templateId,
            tenantId,
            versionId: toVersion.id,
          }),
        ]);

        const diff = diffFormTemplateStructureSnapshots(
          baselineSnap,
          draftSnap
        );
        const structureDiffSummary = summarizeFormTemplateStructureDiffAccurate(
          diff,
          baselineSnap
        );
        const structureChanged = structureChangedFromDiff(diff);

        const data: FormTemplateVersionDiffData = {
          fromVersion: {
            id: fromVersion.id,
            status: fromVersion.status,
            versionNumber: fromVersion.versionNumber,
          },
          toVersion: {
            id: toVersion.id,
            status: toVersion.status,
            versionNumber: toVersion.versionNumber,
          },
          diff,
          structureDiffSummary,
          structureChanged,
        };

        return {
          success: true,
          data,
        };
      } catch (error: unknown) {
        if (error instanceof ApiError) throw error;
        requestLogger.error(
          { err: error },
          "Error computing form template version diff"
        );
        throw Errors.internal("Failed to compute form template version diff");
      }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      query: t.Object({
        fromVersionId: t.String({ format: "uuid" }),
        toVersionId: t.String({ format: "uuid" }),
      }),
      detail: {
        summary: "Diff two form template versions",
        description:
          "Structural diff between two form_template_version rows of the same template. Admin only.",
        tags: ["Form Templates"],
      },
    }
  );
