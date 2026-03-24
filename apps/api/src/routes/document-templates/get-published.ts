import { Elysia } from "elysia";
import { db } from "../../lib/db";
import { documentTemplate } from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import { authenticate } from "../../lib/rbac/middleware";

/**
 * GET /api/document-templates/published
 * Get published document templates for dropdown in workflow builder
 *
 * Auth: Requires authenticated user (any role)
 * Returns: List of published templates in { id, label } format
 */
export const getPublishedDocumentTemplatesRoute = new Elysia()
  .use(authenticate)
  .get(
    "/published",
    async ({ user, set }: any) => {
      try {
        const tenantId = user.tenantId as string;

        // Fetch published templates only
        const templates = await db
          .select({
            id: documentTemplate.id,
            templateName: documentTemplate.templateName,
          })
          .from(documentTemplate)
          .where(
            and(
              eq(documentTemplate.tenantId, tenantId),
              eq(documentTemplate.status, "published"),
              isNull(documentTemplate.deletedAt)
            )
          )
          .orderBy(documentTemplate.templateName);

        // Format for dropdown: { id, label }
        const formattedTemplates = templates.map((template) => ({
          id: template.id,
          label: template.templateName,
        }));

        return {
          success: true,
          data: {
            templates: formattedTemplates,
          },
        };
      } catch (error: any) {
        console.error("Error fetching published document templates:", error);

        set.status = 500;
        return {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to fetch published document templates",
            timestamp: new Date().toISOString(),
          },
        };
      }
    },
    {
      detail: {
        summary: "Get published document templates",
        description: "Get published document templates for workflow builder dropdown",
        tags: ["Document Templates"],
      },
    }
  );

