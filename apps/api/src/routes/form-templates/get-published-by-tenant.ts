import { Elysia } from "elysia";
import { db } from "../../lib/db";
import { formTemplate } from "@supplex/db";
import { eq, and, isNull, asc } from "drizzle-orm";
import { authenticate } from "../../lib/rbac/middleware";

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
    async ({ user, set }: any) => {
      try {
        const tenantId = user.tenantId as string;

        // Query: Get published form templates
        // Filter: tenant_id + status='published' + not deleted
        // Sort: Alphabetically by template name
        const publishedTemplates = await db.query.formTemplate.findMany({
          where: and(
            eq(formTemplate.tenantId, tenantId),
            eq(formTemplate.status, "published"),
            isNull(formTemplate.deletedAt)
          ),
          orderBy: [asc(formTemplate.name)],
        });

        // Format for dropdown: { id: templateId, label: "Name" }
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
        console.error("Error fetching published form templates:", error);

        set.status = 500;
        return {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to fetch published form templates",
            timestamp: new Date().toISOString(),
          },
        };
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

