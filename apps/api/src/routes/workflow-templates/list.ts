import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { workflowTemplate } from "@supplex/db";
import { authenticatedRoute } from "../../lib/route-plugins";
import { UserRole } from "@supplex/types";
import { eq, and, isNull, desc } from "drizzle-orm";

/**
 * GET /api/workflow-templates
 * List all workflow templates for the authenticated user's tenant
 *
 * Auth: Requires authenticated user (any role can view published templates)
 * Tenant: Automatically filters by tenant_id from authenticated user's JWT
 * Behavior:
 *   - Admin: sees all non-deleted templates
 *   - Other roles: sees only published & active templates (for workflow initiation)
 * Pagination: Supports limit/offset query params
 * Returns: Array of workflow templates
 */
export const listWorkflowTemplatesRoute = new Elysia()
  .use(authenticatedRoute)
  .get(
    "/",
    async ({ query, user, set, requestLogger }) => {
      try {
        const tenantId = user.tenantId;
        const limit = query.limit || 50;
        const offset = query.offset || 0;
        const { active, status } = query;
        const isAdmin = user.role === UserRole.ADMIN;

        // Build filter conditions
        const filters = [
          eq(workflowTemplate.tenantId, tenantId),
          isNull(workflowTemplate.deletedAt),
        ];

        // Non-admin users can only see published & active templates
        if (!isAdmin) {
          filters.push(eq(workflowTemplate.status, "published"));
          filters.push(eq(workflowTemplate.active, true));
        }

        // Add active filter if provided (admin only, non-admin already forced)
        if (active !== undefined && isAdmin) {
          filters.push(eq(workflowTemplate.active, active));
        }

        // Add status filter if provided (admin only, non-admin already forced)
        if (status && isAdmin) {
          filters.push(eq(workflowTemplate.status, status));
        }

        // Fetch templates with pagination
        const templates = await db.query.workflowTemplate.findMany({
          where: and(...filters),
          orderBy: [desc(workflowTemplate.updatedAt)],
          limit,
          offset,
        });

        return {
          success: true,
          data: templates,
        };
      } catch (error: any) {
        requestLogger.error({ err: error }, "Workflow template list failed");
        set.status = 500;
        return {
          success: false,
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to list workflow templates",
            timestamp: new Date().toISOString(),
          },
        };
      }
    },
    {
      query: t.Object({
        limit: t.Optional(t.Number()),
        offset: t.Optional(t.Number()),
        active: t.Optional(t.Boolean()),
        status: t.Optional(
          t.Union([
            t.Literal("draft"),
            t.Literal("published"),
            t.Literal("archived"),
          ])
        ),
      }),
    }
  );
