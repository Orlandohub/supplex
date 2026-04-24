import { Elysia } from "elysia";
import { db } from "../../lib/db";
import { formTemplate } from "@supplex/db";
import { eq, and, isNull, asc } from "drizzle-orm";
import { authenticate } from "../../lib/rbac/middleware";
import { ApiError, Errors } from "../../lib/errors";

/**
 * GET /api/form-templates/published
 * Get all published form templates for authenticated user's tenant
 *
 * Used by: Workflow builder dropdown for form template selection
 *
 * Auth: Requires authenticated user
 * Returns: List of published form templates formatted for dropdowns
 *   Format: { id: templateId, label: "Template Name" }
 *
 * Story: 2.2.7.2 - Add Tenant-Scoped Dropdowns for Form and Document Templates
 */
export const getPublishedFormTemplatesRoute = new Elysia()
  .use(authenticate)
  .get(
    "/published",
    async ({ user, requestLogger }: any) => {
      try {
        const tenantId = user.tenantId as string;

        const publishedTemplates = await db.query.formTemplate.findMany({
          where: and(
            eq(formTemplate.tenantId, tenantId),
            eq(formTemplate.status, "published"),
            isNull(formTemplate.deletedAt)
          ),
          orderBy: [asc(formTemplate.name)],
        });

        const formattedOptions = publishedTemplates.map((template) => ({
          id: template.id,
          label: template.name,
        }));

        return {
          success: true,
          data: {
            templates: formattedOptions,
          },
        };
      } catch (error: any) {
        if (error instanceof ApiError) throw error;
        requestLogger.error(
          { err: error },
          "Error fetching published form templates"
        );
        throw Errors.internal("Failed to fetch published form templates");
      }
    },
    {
      detail: {
        summary: "Get published form templates for dropdown",
        description:
          "Returns published form templates for the authenticated user's tenant, formatted for dropdown selection in workflow builder",
        tags: ["Form Templates"],
      },
    }
  );
