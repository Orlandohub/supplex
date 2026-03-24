import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { formTemplate } from "@supplex/db";
import { eq, and, isNull, desc } from "drizzle-orm";
import { authenticate } from "../../lib/rbac/middleware";

/**
 * GET /api/form-templates?status={filter}
 * List all form templates for authenticated user's tenant
 *
 * Auth: Requires authenticated user
 * Query: status (optional) - Filter by status: all, draft, published, archived
 * Returns: List of templates with status and isActive flags
 */
export const listFormTemplatesRoute = new Elysia()
  .use(authenticate)
  .get(
    "/",
    async ({ query, user, set }: any) => {
      try {
        const tenantId = user.tenantId as string;
        const statusFilter = query.status || "all";

        // Build query conditions
        const conditions = [
          eq(formTemplate.tenantId, tenantId),
          isNull(formTemplate.deletedAt),
        ];

        // Add status filter if not 'all'
        if (statusFilter !== "all") {
          conditions.push(eq(formTemplate.status, statusFilter));
        }

        // Fetch templates
        const templates = await db
          .select()
          .from(formTemplate)
          .where(and(...conditions))
          .orderBy(desc(formTemplate.updatedAt));

        return {
          success: true,
          data: {
            templates,
          },
        };
      } catch (error: any) {
        console.error("Error fetching form templates:", error);

        set.status = 500;
        return {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to fetch form templates",
            timestamp: new Date().toISOString(),
          },
        };
      }
    },
    {
      query: t.Object({
        status: t.Optional(
          t.Union([
            t.Literal("all"),
            t.Literal("draft"),
            t.Literal("published"),
            t.Literal("archived"),
          ])
        ),
      }),
      detail: {
        summary: "List form templates",
        description: "Get all form templates for authenticated user's tenant",
        tags: ["Form Templates"],
      },
    }
  );

