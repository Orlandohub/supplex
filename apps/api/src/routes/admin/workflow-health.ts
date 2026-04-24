/**
 * Workflow Health-Check Endpoint
 * Story: 2.2.21 - Workflow Engine Observability
 *
 * GET /api/admin/workflow-health
 * Read-only diagnostic report of inconsistent workflow states.
 * No mutations, no repairs, no side effects.
 */

import { Elysia } from "elysia";
import { db } from "../../lib/db";
import { processInstance, stepInstance, taskInstance } from "@supplex/db";
import { eq, and, isNull, sql } from "drizzle-orm";
import logger from "../../lib/logger";

const healthLog = logger.child({ module: "workflow-health" });

export const workflowHealthRoute = new Elysia().get(
  "/workflow-health",
  async ({ user, requestLogger }: any) => {
    const log = requestLogger || healthLog;
    const start = Date.now();
    const tenantId = user.tenantId as string;

    // Query 1: Stuck processes — in_progress but no current step pointer
    const stuckProcesses = await db
      .select({
        id: processInstance.id,
        workflowName: processInstance.workflowName,
        status: processInstance.status,
        updatedAt: processInstance.updatedAt,
      })
      .from(processInstance)
      .where(
        and(
          eq(processInstance.tenantId, tenantId),
          eq(processInstance.status, "in_progress"),
          isNull(processInstance.currentStepInstanceId),
          isNull(processInstance.deletedAt)
        )
      )
      .limit(10);

    const stuckCount = stuckProcesses.length;

    // Query 2: Orphaned tasks — pending but step is not active/awaiting_validation
    const orphanedTasks = await db
      .select({
        id: taskInstance.id,
        stepInstanceId: taskInstance.stepInstanceId,
        title: taskInstance.title,
        stepStatus: stepInstance.status,
      })
      .from(taskInstance)
      .innerJoin(stepInstance, eq(taskInstance.stepInstanceId, stepInstance.id))
      .where(
        and(
          eq(taskInstance.tenantId, tenantId),
          eq(taskInstance.status, "pending"),
          isNull(taskInstance.deletedAt),
          sql`${stepInstance.status} NOT IN ('active', 'awaiting_validation')`
        )
      )
      .limit(10);

    const orphanedCount = orphanedTasks.length;

    // Query 3: State mismatches — process in_progress but no active/blocked/pending steps remain
    const stateMismatches = await db
      .select({
        id: processInstance.id,
        workflowName: processInstance.workflowName,
        status: processInstance.status,
      })
      .from(processInstance)
      .where(
        and(
          eq(processInstance.tenantId, tenantId),
          eq(processInstance.status, "in_progress"),
          isNull(processInstance.deletedAt),
          sql`NOT EXISTS (
              SELECT 1 FROM step_instance s2
              WHERE s2.process_instance_id = ${processInstance.id}
                AND s2.status IN ('active', 'blocked', 'pending')
            )`
        )
      )
      .limit(10);

    const mismatchCount = stateMismatches.length;

    const durationMs = Date.now() - start;
    const result = {
      stuckProcesses: {
        count: stuckCount,
        sampleIds: stuckProcesses.map((p) => p.id),
      },
      orphanedTasks: {
        count: orphanedCount,
        sampleIds: orphanedTasks.map((t) => t.id),
      },
      stateMismatches: {
        count: mismatchCount,
        sampleIds: stateMismatches.map((p) => p.id),
      },
    };

    log.info(
      { stuckCount, orphanedCount, mismatchCount, durationMs },
      "workflow health check completed"
    );

    return {
      success: true,
      data: result,
    };
  }
);
