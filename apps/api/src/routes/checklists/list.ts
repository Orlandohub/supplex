import { Elysia } from "elysia";
import { db } from "../../lib/db";
import { documentChecklists } from "@supplex/db";
import { eq, and, isNull, desc } from "drizzle-orm";
import { authenticate } from "../../lib/rbac/middleware";

/**
 * GET /api/checklists
 * Returns all document checklist templates for tenant
 *
 * Auth: Requires valid JWT (any authenticated user can list templates)
 * Tenant Scoping: Filters by authenticated user's tenant_id
 */
export const listChecklistsRoute = new Elysia({ prefix: "/checklists" })
  .use(authenticate)
  .get("/", async ({ user, set }: any) => {
    try {
      const tenantId = user.tenantId as string;

      // Fetch all non-deleted checklist templates for this tenant
      const checklists = await db
        .select()
        .from(documentChecklists)
        .where(
          and(
            eq(documentChecklists.tenantId, tenantId),
            isNull(documentChecklists.deletedAt)
          )
        )
        .orderBy(desc(documentChecklists.createdAt));

      return {
        success: true,
        data: {
          checklists,
        },
      };
    } catch (error: any) {
      console.error("Error fetching checklists:", error);
      set.status = 500;
      return {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch checklists",
          timestamp: new Date().toISOString(),
        },
      };
    }
  });
