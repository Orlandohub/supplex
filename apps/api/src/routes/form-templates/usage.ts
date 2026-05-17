import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import {
  formTemplate,
  computeFormTemplatePublishImpact,
  getPublishedHeadFormTemplateVersion,
} from "@supplex/db";
import type { FormTemplateUsageData } from "@supplex/types";
import { eq, and, isNull } from "drizzle-orm";
import { requireAdmin } from "../../lib/rbac/middleware";
import { authenticatedRoute } from "../../lib/route-plugins";
import { ApiError, Errors } from "../../lib/errors";

/**
 * GET /api/form-templates/:id/usage
 * SUP-32: steady-state usage view for the admin Usage tab.
 *
 * Unlike publish-preview, this endpoint works **without** a draft. It
 * reuses `computeFormTemplatePublishImpact` against the current
 * published head so the UI can surface the same workflow + process
 * buckets at any time.
 *
 * Auth: Admin only. Tenant: enforced by `user.tenantId`.
 *
 * Notes:
 * - When the template has never been published, `publishedHeadVersionId`
 *   is `null` and `activeProcessesWithSupersededPin` is empty by
 *   construction (no head to be superseded yet).
 * - Archived templates are intentionally still readable here — usage is
 *   a forensic / informational view; publish remains blocked separately.
 */
export const usageRoute = new Elysia()
  .use(authenticatedRoute)
  .use(requireAdmin)
  .get(
    "/:id/usage",
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

        const publishedHead = await getPublishedHeadFormTemplateVersion(db, {
          formTemplateId: templateId,
          tenantId,
        });

        const impact = await computeFormTemplatePublishImpact(db, {
          formTemplateId: templateId,
          tenantId,
          supersededPublishedVersionId: publishedHead?.id ?? null,
        });

        const data: FormTemplateUsageData = {
          publishedHeadVersionId: publishedHead?.id ?? null,
          publishedHeadVersionNumber: publishedHead?.versionNumber ?? null,
          impact,
        };

        return {
          success: true,
          data,
        };
      } catch (error: unknown) {
        if (error instanceof ApiError) throw error;
        requestLogger.error(
          { err: error },
          "Error computing form template usage"
        );
        throw Errors.internal("Failed to compute form template usage");
      }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      detail: {
        summary: "Form template usage",
        description:
          "Workflow templates and active pinned processes that reference this form template. Admin only.",
        tags: ["Form Templates"],
      },
    }
  );
