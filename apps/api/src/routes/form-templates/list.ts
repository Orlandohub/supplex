import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { formTemplate } from "@supplex/db";
import { eq, and, isNull, desc } from "drizzle-orm";
import { authenticatedRoute } from "../../lib/route-plugins";
import { UserRole } from "@supplex/types";
import { ApiError, Errors } from "../../lib/errors";

/**
 * GET /api/form-templates?status={filter}
 * List all form templates for authenticated user's tenant
 *
 * Auth: Requires authenticated user
 * Query: status (optional) - Filter by status: all, draft, published, archived
 * Returns: List of templates with status and isActive flags
 */
export const listFormTemplatesRoute = new Elysia().use(authenticatedRoute).get(
  "/",
  async ({ query, user, requestLogger }) => {
    try {
      const tenantId = user.tenantId;
      const statusFilter = query.status || "all";
      const isAdmin = user.role === UserRole.ADMIN;

      const conditions = [
        eq(formTemplate.tenantId, tenantId),
        isNull(formTemplate.deletedAt),
      ];

      if (!isAdmin) {
        conditions.push(eq(formTemplate.status, "published"));
        conditions.push(eq(formTemplate.isActive, true));
      } else if (statusFilter !== "all") {
        conditions.push(eq(formTemplate.status, statusFilter));
      }

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
    } catch (error: unknown) {
      if (error instanceof ApiError) throw error;
      requestLogger.error({ err: error }, "Error fetching form templates");
      throw Errors.internal("Failed to fetch form templates");
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
