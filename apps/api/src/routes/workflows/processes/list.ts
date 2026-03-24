import { Elysia } from "elysia";
import { db } from "../../../lib/db";
import { processInstance, suppliers, users, stepInstance } from "@supplex/db";
import { eq, and, isNull, desc } from "drizzle-orm";
import { authenticate } from "../../../lib/rbac/middleware";
import { UserRole } from "@supplex/types";

/**
 * GET /api/workflows/processes
 * Get all workflow process instances for the tenant (NEW WORKFLOW ENGINE)
 * 
 * Returns all processes across all suppliers (tenant-filtered)
 * For supplier_user: Only returns processes for their own supplier
 * For other roles: Returns all processes in the tenant
 * Used by the main workflows page
 *
 * Auth: Requires authenticated user
 * Tenant Scoping: Returns only processes for user's tenant
 * Supplier Scoping: For supplier_user, returns only their supplier's processes
 */
export const listProcessesRoute = new Elysia()
  .use(authenticate)
  .get(
    "/processes",
    async ({ user, set }) => {
      const tenantId = user!.tenantId as string;
      const userRole = user!.role as string;
      const userId = user!.id as string;

      try {
        // If user is a supplier_user, find their supplier ID
        let supplierUserId: string | null = null;
        if (userRole === UserRole.SUPPLIER_USER) {
          // Find the supplier that this user is associated with
          const supplier = await db.query.suppliers.findFirst({
            where: and(
              eq(suppliers.supplierUserId, userId),
              eq(suppliers.tenantId, tenantId),
              isNull(suppliers.deletedAt)
            ),
            columns: { id: true },
          });

          if (!supplier) {
            set.status = 403;
            return {
              success: false,
              error: {
                code: "FORBIDDEN",
                message: "Supplier user is not associated with a supplier",
                timestamp: new Date().toISOString(),
              },
            };
          }

          supplierUserId = supplier.id;
        }

        // Build where conditions
        const whereConditions = [
          eq(processInstance.tenantId, tenantId),
          isNull(processInstance.deletedAt),
        ];

        // If supplier_user, only show their supplier's processes
        if (supplierUserId) {
          whereConditions.push(
            eq(processInstance.entityType, "supplier"),
            eq(processInstance.entityId, supplierUserId)
          );
        }

        // Query all process instances for this tenant with supplier and user names
        const processes = await db
          .select({
            id: processInstance.id,
            processType: processInstance.processType,
            entityType: processInstance.entityType,
            entityId: processInstance.entityId,
            status: processInstance.status,
            initiatedBy: processInstance.initiatedBy,
            initiatedDate: processInstance.initiatedDate,
            completedDate: processInstance.completedDate,
            metadata: processInstance.metadata,
            // Join with suppliers to get supplier name if entityType is 'supplier'
            supplierName: suppliers.name,
            // Join with users to get initiator name
            initiatorName: users.fullName,
            // Get current active step name
            currentStepName: stepInstance.stepName,
            currentStepOrder: stepInstance.stepOrder,
          })
          .from(processInstance)
          .leftJoin(
            suppliers,
            and(
              eq(processInstance.entityType, "supplier"),
              eq(processInstance.entityId, suppliers.id)
            )
          )
          .leftJoin(users, eq(processInstance.initiatedBy, users.id))
          // Join with step_instance to get current active step
          .leftJoin(
            stepInstance,
            and(
              eq(stepInstance.processInstanceId, processInstance.id),
              eq(stepInstance.status, "active"),
              isNull(stepInstance.deletedAt)
            )
          )
          .where(and(...whereConditions))
          .orderBy(desc(processInstance.initiatedDate)); // Newest first

        // Extract workflow name from metadata if available
        const processesWithWorkflowName = processes.map((p) => ({
          ...p,
          workflowName: (p.metadata as any)?.workflowName || null,
        }));

        return {
          success: true,
          data: {
            processes: processesWithWorkflowName,
          },
        };
      } catch (error) {
        console.error("Error fetching workflow processes:", error);
        set.status = 500;
        return {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to fetch workflow processes",
            timestamp: new Date().toISOString(),
          },
        };
      }
    },
    {
      detail: {
        summary: "List all workflow processes",
        description: "Fetches all workflow process instances for the tenant",
        tags: ["Workflows", "Processes"],
      },
    }
  );

