import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { qualificationWorkflows, suppliers } from "@supplex/db";
import { eq, and, isNull, desc } from "drizzle-orm";
import { authenticate } from "../../lib/rbac/middleware";

/**
 * GET /api/workflows/supplier/:supplierId
 * Get all qualification workflows for a specific supplier
 *
 * Auth: Requires authenticated user
 * Tenant Scoping: Automatically filters by tenant_id from authenticated user's JWT
 */
export const supplierWorkflowsRoute = new Elysia({ prefix: "/workflows" })
  .use(authenticate)
  .get(
    "/supplier/:supplierId",
    async ({ params, user, set }) => {
      try {
        const tenantId = user.tenantId as string;
        const { supplierId } = params;

        // Verify supplier exists and belongs to tenant
        const supplier = await db.query.suppliers.findFirst({
          where: and(
            eq(suppliers.id, supplierId),
            eq(suppliers.tenantId, tenantId),
            isNull(suppliers.deletedAt)
          ),
        });

        if (!supplier) {
          set.status = 404;
          return {
            success: false,
            error: {
              code: "NOT_FOUND",
              message: "Supplier not found",
              timestamp: new Date().toISOString(),
            },
          };
        }

        // Get all workflows for this supplier, ordered by most recent first
        const workflows = await db.query.qualificationWorkflows.findMany({
          where: and(
            eq(qualificationWorkflows.supplierId, supplierId),
            eq(qualificationWorkflows.tenantId, tenantId),
            isNull(qualificationWorkflows.deletedAt)
          ),
          orderBy: [desc(qualificationWorkflows.initiatedDate)],
        });

        return {
          success: true,
          data: {
            workflows,
          },
        };
      } catch (error: unknown) {
        console.error("Error fetching supplier workflows:", error);
        set.status = 500;
        return {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to fetch supplier workflows",
            timestamp: new Date().toISOString(),
          },
        };
      }
    },
    {
      params: t.Object({
        supplierId: t.String({ format: "uuid" }),
      }),
      detail: {
        summary: "Get supplier workflows",
        description: "Fetches all qualification workflows for a supplier",
        tags: ["Workflows"],
      },
    }
  );
