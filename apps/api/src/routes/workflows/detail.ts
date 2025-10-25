import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { qualificationWorkflows } from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import { authenticate } from "../../lib/rbac/middleware";
import type { RequiredDocumentItem } from "@supplex/types";

/**
 * GET /api/workflows/:id
 * Get workflow details with supplier info and snapshotted checklist
 *
 * Auth: Requires authenticated user
 * Tenant Scoping: Returns only workflows belonging to user's tenant
 *
 * AC 1: Returns workflow with supplier data and parsed checklist items
 */
export const workflowDetailRoute = new Elysia().use(authenticate).get(
  "/:workflowId",
  async ({ params, user, set }) => {
    try {
      const tenantId = user!.tenantId as string;

      // Fetch workflow with supplier join (tenant-scoped)
      const workflow = await db.query.qualificationWorkflows.findFirst({
        where: and(
          eq(qualificationWorkflows.id, params.workflowId),
          eq(qualificationWorkflows.tenantId, tenantId),
          isNull(qualificationWorkflows.deletedAt)
        ),
        with: {
          supplier: true,
          initiator: true,
        },
      });

      if (!workflow) {
        set.status = 404;
        return {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Workflow not found",
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Parse snapshotted checklist JSONB field
      let checklistItems: RequiredDocumentItem[] = [];
      if (workflow.snapshotedChecklist) {
        try {
          checklistItems = Array.isArray(workflow.snapshotedChecklist)
            ? (workflow.snapshotedChecklist as RequiredDocumentItem[])
            : [];
        } catch (error) {
          console.error("Failed to parse snapshotedChecklist:", error);
          checklistItems = [];
        }
      }

      // Return workflow with supplier info and checklist items
      return {
        success: true,
        data: {
          workflow: {
            ...workflow,
            checklistItems,
          },
        },
      };
    } catch (error: unknown) {
      console.error("Error fetching workflow details:", error);
      set.status = 500;
      return {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch workflow details",
          timestamp: new Date().toISOString(),
        },
      };
    }
  },
  {
    params: t.Object({
      workflowId: t.String({ format: "uuid" }),
    }),
    detail: {
      summary: "Get workflow details",
      description:
        "Fetches workflow details with supplier info and snapshotted checklist",
      tags: ["Workflows"],
    },
  }
);
