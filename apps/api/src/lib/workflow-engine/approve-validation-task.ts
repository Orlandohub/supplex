/**
 * Approve Validation Task Helper
 * Story: 2.2.15 - Auto-Validation Task Creation
 * Updated: Story 2.2.19 - Transaction threading, atomic CAS transitions
 * Updated: WFH-002 - Transaction integrity fix (throw post-CAS, remove outer try-catch)
 *
 * Error contract:
 *   Task CAS miss (already processed)   → return { success: false, ... }
 *   Step CAS miss (concurrent claim)     → return { success: true, nextStepActivated: false }
 *   Post-CAS unexpected errors           → throw (caller's transaction rolls back)
 */

import type { DbOrTx } from "@supplex/db";
import { taskInstance, stepInstance, StepStatus, processInstance } from "@supplex/db";
import { eq, and } from "drizzle-orm";
import { transitionToNextStep } from "./transition-to-next-step";
import type { Logger } from "pino";
import defaultLogger from "../logger";

interface ApproveValidationTaskParams {
  tenantId: string;
  taskInstanceId: string;
  userId: string;
}

interface ApproveValidationTaskResult {
  success: boolean;
  allValidationsComplete: boolean;
  remainingApprovals?: number;
  nextStepActivated: boolean;
  processCompleted?: boolean;
  nextStepId?: string;
  error?: string;
}

export async function approveValidationTask(
  tx: DbOrTx,
  params: ApproveValidationTaskParams,
  log?: Logger
): Promise<ApproveValidationTaskResult> {
  const { tenantId, taskInstanceId, userId } = params;
  const valLog = (log || defaultLogger).child({ action: "approveValidationTask", tenantId, taskId: taskInstanceId });

  // Gate CAS: only succeed if task is currently 'pending'
  const [completedTask] = await tx
    .update(taskInstance)
    .set({
      status: "completed",
      outcome: "approved",
      completedBy: userId,
      completedAt: new Date(),
    })
    .where(
      and(
        eq(taskInstance.id, taskInstanceId),
        eq(taskInstance.tenantId, tenantId),
        eq(taskInstance.status, "pending")
      )
    )
    .returning();

  if (!completedTask) {
    return {
      success: false,
      allValidationsComplete: false,
      nextStepActivated: false,
      error: "Task already processed",
    };
  }

  // ═══ POINT OF NO RETURN — errors throw from here ═══

  if (completedTask.taskType !== "validation") {
    throw new Error("Approved task is not a validation task");
  }

  valLog.info({ userId }, "validation task approved");

  // Check remaining pending validation tasks for this step
  const pendingValidations = await tx
    .select({ id: taskInstance.id })
    .from(taskInstance)
    .where(
      and(
        eq(taskInstance.stepInstanceId, completedTask.stepInstanceId),
        eq(taskInstance.tenantId, tenantId),
        eq(taskInstance.taskType, "validation"),
        eq(taskInstance.status, "pending")
      )
    );

  if (pendingValidations.length > 0) {
    valLog.info({ remaining: pendingValidations.length }, "waiting for more approvals");
    return {
      success: true,
      allValidationsComplete: false,
      remainingApprovals: pendingValidations.length,
      nextStepActivated: false,
    };
  }

  // All validations complete — attempt atomic CAS to claim the transition
  const [transitioned] = await tx
    .update(stepInstance)
    .set({
      status: StepStatus.VALIDATED,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(stepInstance.id, completedTask.stepInstanceId),
        eq(stepInstance.status, StepStatus.AWAITING_VALIDATION)
      )
    )
    .returning();

  if (!transitioned) {
    // Concurrent request already claimed the transition — our task approval stands
    return {
      success: true,
      allValidationsComplete: true,
      nextStepActivated: false,
    };
  }

  valLog.info({ stepId: completedTask.stepInstanceId }, "all validation tasks complete for step");

  const [process] = await tx
    .select()
    .from(processInstance)
    .where(eq(processInstance.id, transitioned.processInstanceId));

  if (!process) {
    throw new Error(`Process instance not found: ${transitioned.processInstanceId}`);
  }

  const transitionResult = await transitionToNextStep(
    tx,
    completedTask.stepInstanceId,
    process.id,
    tenantId
  );

  valLog.info({ nextStepActivated: transitionResult.nextStepActivated }, "transition after validation");

  return {
    success: true,
    allValidationsComplete: true,
    nextStepActivated: transitionResult.nextStepActivated,
    processCompleted: transitionResult.processCompleted,
    nextStepId: transitionResult.nextStepId,
  };
}
