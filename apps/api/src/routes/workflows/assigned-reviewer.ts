/**
 * GET /api/workflows/:id/assigned-reviewer
 * Get the assigned reviewer for a workflow submission
 * Used by frontend to preview who will be assigned before actual submission
 */

import { Elysia, t } from "elysia";
import { authenticate } from "~/middleware/authenticate";
import { db } from "@supplex/db";
import { qualificationWorkflows, tenants, users } from "@supplex/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * Get Stage 1 reviewer based on tenant settings or fallback
 * (Shared logic with submit.ts)
 */
async function getStage1Reviewer(tenantId: string) {
  // Try tenant settings first
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
  });

  if (tenant?.settings?.workflowReviewers?.stage1) {
    const reviewer = await db.query.users.findFirst({
      where: and(
        eq(users.id, tenant.settings.workflowReviewers.stage1),
        eq(users.tenantId, tenantId),
        eq(users.isActive, true)
      ),
    });
    if (reviewer) return reviewer;
  }

  // Fallback 1: First procurement manager
  const procurementManager = await db.query.users.findFirst({
    where: and(
      eq(users.tenantId, tenantId),
      eq(users.role, "procurement_manager"),
      eq(users.isActive, true)
    ),
  });
  if (procurementManager) return procurementManager;

  // Fallback 2: First admin
  const admin = await db.query.users.findFirst({
    where: and(
      eq(users.tenantId, tenantId),
      eq(users.role, "admin"),
      eq(users.isActive, true)
    ),
  });
  return admin;
}

export const assignedReviewerRoute = new Elysia().use(authenticate).get(
  "/:id/assigned-reviewer",
  async ({ params, user, set }) => {
    try {
      const tenantId = user.tenantId;

      // Verify workflow exists and belongs to tenant
      const workflow = await db.query.qualificationWorkflows.findFirst({
        where: and(
          eq(qualificationWorkflows.id, params.id),
          eq(qualificationWorkflows.tenantId, tenantId)
        ),
      });

      if (!workflow) {
        set.status = 404;
        return {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Workflow not found",
          },
        };
      }

      // Get assigned reviewer
      const reviewer = await getStage1Reviewer(tenantId);

      if (!reviewer) {
        set.status = 500;
        return {
          success: false,
          error: {
            code: "NO_REVIEWER",
            message: "No reviewer available for Stage 1",
          },
        };
      }

      return {
        success: true,
        data: {
          reviewer: {
            id: reviewer.id,
            fullName: reviewer.fullName,
            email: reviewer.email,
          },
        },
      };
    } catch (error: unknown) {
      console.error("Error fetching assigned reviewer:", error);
      set.status = 500;
      return {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch assigned reviewer",
        },
      };
    }
  },
  {
    params: t.Object({
      id: t.String({ format: "uuid" }),
    }),
  }
);
