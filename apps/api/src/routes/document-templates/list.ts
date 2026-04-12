import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { documentTemplate } from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import { requireAdmin } from "../../lib/rbac/middleware";
import { ApiError, Errors } from "../../lib/errors";

/**
 * GET /api/document-templates?status={filter}
 * List all document templates for authenticated user's tenant
 *
 * Auth: Admin only
 * Query: status (optional) - Filter by status: draft, published, archived
 * Returns: List of document templates
 */
export const listDocumentTemplatesRoute = new Elysia()
  .use(requireAdmin)
  .get(
    "/",
    async ({ query, user, set, requestLogger }: any) => {
      try {
        const tenantId = user.tenantId as string;
        const statusFilter = query.status;

        // Build query conditions
        const conditions = [
          eq(documentTemplate.tenantId, tenantId),
          isNull(documentTemplate.deletedAt),
        ];

        // Add status filter if provided
        if (statusFilter) {
          conditions.push(eq(documentTemplate.status, statusFilter));
        }

        // Fetch templates
        const templates = await db
          .select({
            id: documentTemplate.id,
            templateName: documentTemplate.templateName,
            requiredDocuments: documentTemplate.requiredDocuments,
            isDefault: documentTemplate.isDefault,
            status: documentTemplate.status,
            createdAt: documentTemplate.createdAt,
            updatedAt: documentTemplate.updatedAt,
          })
          .from(documentTemplate)
          .where(and(...conditions))
          .orderBy(documentTemplate.templateName);

        return {
          success: true,
          data: {
            templates,
          },
        };
      } catch (error: any) {
        if (error instanceof ApiError) throw error;
        requestLogger.error({ err: error }, "Document template list failed");
        throw Errors.internal("Failed to fetch document templates");
      }
    },
    {
      query: t.Object({
        status: t.Optional(
          t.Union([
            t.Literal("draft"),
            t.Literal("published"),
            t.Literal("archived"),
          ])
        ),
      }),
      detail: {
        summary: "List document templates",
        description: "Get all document templates for authenticated user's tenant (admin only)",
        tags: ["Document Templates"],
      },
    }
  );

