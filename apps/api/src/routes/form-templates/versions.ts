import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { formTemplate, formTemplateVersion } from "@supplex/db";
import type { FormTemplateVersionListItem } from "@supplex/types";
import { eq, and, isNull, asc, sql } from "drizzle-orm";
import { requireAdmin } from "../../lib/rbac/middleware";
import { authenticatedRoute } from "../../lib/route-plugins";
import { ApiError, Errors } from "../../lib/errors";

/**
 * GET /api/form-templates/:id/versions
 * SUP-32: list version rows (draft + immutable) for the admin Versions tab.
 *
 * Tenant: filters by `user.tenantId`. Returns 404 for cross-tenant ids so
 * we never leak existence.
 * Auth: Admin only — versions/changelog/usage are admin surfaces.
 *
 * Projection deliberately excludes `compiledJson`; that payload is large
 * and only ever loaded by the read path / publish helpers, never by the
 * Versions tab.
 *
 * Ordering: draft first (version_number NULL), then immutable rows by
 * ascending `version_number`. Stable tie-break by `createdAt` keeps the
 * timeline reproducible if two rows ever share a number (defensive only).
 */
export const versionsRoute = new Elysia()
  .use(authenticatedRoute)
  .use(requireAdmin)
  .get(
    "/:id/versions",
    async ({ params, user, requestLogger }) => {
      try {
        const tenantId = user.tenantId;
        const templateId = params.id;

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

        const rows = await db
          .select({
            id: formTemplateVersion.id,
            status: formTemplateVersion.status,
            versionNumber: formTemplateVersion.versionNumber,
            basedOnVersionId: formTemplateVersion.basedOnVersionId,
            createdAt: formTemplateVersion.createdAt,
            updatedAt: formTemplateVersion.updatedAt,
          })
          .from(formTemplateVersion)
          .where(
            and(
              eq(formTemplateVersion.formTemplateId, templateId),
              eq(formTemplateVersion.tenantId, tenantId),
              isNull(formTemplateVersion.deletedAt)
            )
          )
          .orderBy(
            sql`${formTemplateVersion.versionNumber} ASC NULLS FIRST`,
            asc(formTemplateVersion.createdAt)
          );

        const versions: FormTemplateVersionListItem[] = rows.map((r) => ({
          id: r.id,
          status: r.status,
          versionNumber: r.versionNumber,
          basedOnVersionId: r.basedOnVersionId,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        }));

        return {
          success: true,
          data: { versions },
        };
      } catch (error: unknown) {
        if (error instanceof ApiError) throw error;
        requestLogger.error(
          { err: error },
          "Error listing form template versions"
        );
        throw Errors.internal("Failed to list form template versions");
      }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      detail: {
        summary: "List form template versions",
        description:
          "List draft + immutable form_template_version rows for the admin Versions tab. Admin only.",
        tags: ["Form Templates"],
      },
    }
  );
