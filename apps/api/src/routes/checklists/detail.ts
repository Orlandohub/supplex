import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { documentChecklists } from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import { authenticate } from "../../lib/rbac/middleware";

/**
 * GET /api/checklists/:id
 * Get a specific document checklist template by ID
 *
 * Auth: Requires valid JWT
 * Tenant Scoping: Ensures checklist belongs to user's tenant
 */
export const detailChecklistRoute = new Elysia({ prefix: "/checklists" })
  .use(authenticate)
  .get(
    "/:id",
    async ({ params, user, set }: any) => {
      try {
        const tenantId = user.tenantId as string;
        const { id } = params;

        // Fetch checklist with tenant isolation and soft delete filter
        const checklist = await db
          .select()
          .from(documentChecklists)
          .where(
            and(
              eq(documentChecklists.id, id),
              eq(documentChecklists.tenantId, tenantId),
              isNull(documentChecklists.deletedAt)
            )
          )
          .limit(1);

        if (checklist.length === 0) {
          set.status = 404;
          return {
            success: false,
            error: {
              code: "NOT_FOUND",
              message: "Checklist not found",
              timestamp: new Date().toISOString(),
            },
          };
        }

        return {
          success: true,
          data: {
            checklist: checklist[0],
          },
        };
      } catch (error: any) {
        console.error("Error fetching checklist:", error);
        set.status = 500;
        return {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to fetch checklist",
            timestamp: new Date().toISOString(),
          },
        };
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        summary: "Get checklist template by ID",
        description: "Returns a specific checklist template",
        tags: ["Checklists"],
      },
    }
  );
