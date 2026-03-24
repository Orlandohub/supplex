import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { processInstance, stepInstance } from "@supplex/db";
import { eq, and, isNull, desc, inArray } from "drizzle-orm";
import { authenticate } from "../../lib/rbac/middleware";

/**
 * GET /api/workflows/supplier/:supplierId/processes
 * Get all workflow process instances for a supplier (NEW WORKFLOW ENGINE)
 * 
 * Returns all processes where entity_type='supplier' AND entity_id=supplierId
 * This replaces the legacy supplier workflows endpoint
 *
 * Auth: Requires authenticated user
 * Tenant Scoping: Returns only processes for user's tenant
 */
export const supplierProcessesRoute = new Elysia()
  .use(authenticate)
  .get(
    "/supplier/:supplierId/processes",
    async ({ params, user, set }) => {
      const { supplierId } = params;
      const tenantId = user!.tenantId as string;

      try {
        // Query all process instances for this supplier (both active and completed)
        const processes = await db
          .select()
          .from(processInstance)
          .where(
            and(
              eq(processInstance.tenantId, tenantId),
              eq(processInstance.entityType, "supplier"),
              eq(processInstance.entityId, supplierId),
              isNull(processInstance.deletedAt)
            )
          )
          .orderBy(desc(processInstance.initiatedDate));

        // Batch-fetch all steps for these processes to avoid N+1 queries
        const processIds = processes.map((p) => p.id);
        const allSteps = processIds.length > 0
          ? await db
              .select({
                id: stepInstance.id,
                processInstanceId: stepInstance.processInstanceId,
                stepName: stepInstance.stepName,
                stepOrder: stepInstance.stepOrder,
                status: stepInstance.status,
                completedDate: stepInstance.completedDate,
                assignedTo: stepInstance.assignedTo,
              })
              .from(stepInstance)
              .where(inArray(stepInstance.processInstanceId, processIds))
              .orderBy(desc(stepInstance.completedDate))
          : [];

        const stepsByProcess = new Map<string, typeof allSteps>();
        for (const step of allSteps) {
          const list = stepsByProcess.get(step.processInstanceId) || [];
          list.push(step);
          stepsByProcess.set(step.processInstanceId, list);
        }

        const processesWithStepInfo = processes.map((process) => {
          const steps = stepsByProcess.get(process.id) || [];
          const activeStep = steps.find((s) => s.status === "active") || null;
          const lastCompletedStep = steps.find(
            (s) => s.status === "completed" || s.status === "validated"
          ) || null;

          return {
            ...process,
            activeStep,
            lastCompletedStep: lastCompletedStep
              ? {
                  stepName: lastCompletedStep.stepName,
                  status: lastCompletedStep.status,
                  completedDate: lastCompletedStep.completedDate,
                }
              : null,
          };
        });

        return {
          success: true,
          data: {
            processes: processesWithStepInfo,
          },
        };
      } catch (error) {
        console.error("Error fetching supplier processes:", error);
        set.status = 500;
        return {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to fetch supplier workflow processes",
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
        summary: "Get supplier workflow processes",
        description: "Fetches all workflow process instances for a specific supplier",
        tags: ["Workflows", "Suppliers"],
      },
    }
  );

