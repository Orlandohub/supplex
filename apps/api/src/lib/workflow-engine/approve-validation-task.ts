/**
 * Approve Validation Task Helper
 * Story: 2.2.15 - Auto-Validation Task Creation
 * 
 * Handles approval of validation tasks and activates next step when all validations complete
 */

import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { taskInstance, stepInstance, processInstance } from "@supplex/db";
import { eq, and } from "drizzle-orm";
import { transitionToNextStep } from "./transition-to-next-step";

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
  db: NodePgDatabase<any>,
  params: ApproveValidationTaskParams
): Promise<ApproveValidationTaskResult> {
  const { tenantId, taskInstanceId, userId } = params;

  try {
    // Get the validation task
    const [task] = await db
      .select()
      .from(taskInstance)
      .where(
        and(
          eq(taskInstance.id, taskInstanceId),
          eq(taskInstance.tenantId, tenantId)
        )
      );

    if (!task) {
      return {
        success: false,
        allValidationsComplete: false,
        nextStepActivated: false,
        error: "Task not found",
      };
    }

    if (task.taskType !== "validation") {
      return {
        success: false,
        allValidationsComplete: false,
        nextStepActivated: false,
        error: "This is not a validation task",
      };
    }

    // Mark validation task as completed
    await db
      .update(taskInstance)
      .set({
        status: "completed",
        completedBy: userId,
        completedAt: new Date(),
      })
      .where(eq(taskInstance.id, taskInstanceId));

    console.log(`[Validation] Task ${taskInstanceId} approved by user ${userId}`);

    // Get all validation tasks for this step
    const allValidationTasks = await db
      .select()
      .from(taskInstance)
      .where(
        and(
          eq(taskInstance.stepInstanceId, task.stepInstanceId),
          eq(taskInstance.tenantId, tenantId)
        )
      );

    const validationTasks = allValidationTasks.filter(
      (t) => t.taskType === "validation"
    );

    const allComplete = validationTasks.every((t) => t.status === "completed");

    if (allComplete) {
      console.log(`[Validation] All validation tasks complete for step ${task.stepInstanceId}`);

      // Get step instance
      const [step] = await db
        .select()
        .from(stepInstance)
        .where(eq(stepInstance.id, task.stepInstanceId));

      if (!step) {
        return {
          success: false,
          allValidationsComplete: true,
          nextStepActivated: false,
          error: "Step instance not found",
        };
      }

      // Get process instance
      const [process] = await db
        .select()
        .from(processInstance)
        .where(eq(processInstance.id, step.processInstanceId));

      if (!process) {
        return {
          success: false,
          allValidationsComplete: true,
          nextStepActivated: false,
          error: "Process instance not found",
        };
      }

      // Update step status to validated
      await db
        .update(stepInstance)
        .set({
          status: "validated",
          updatedAt: new Date(),
        })
        .where(eq(stepInstance.id, task.stepInstanceId));

      // Transition handles setting process status to "{NextStep} - In Progress" or "Complete"
      const transitionResult = await transitionToNextStep(
        task.stepInstanceId,
        process.id,
        tenantId,
        db
      );

      console.log(`[Validation] Next step activated: ${transitionResult.nextStepActivated}`);

      return {
        success: true,
        allValidationsComplete: true,
        nextStepActivated: transitionResult.nextStepActivated,
        processCompleted: transitionResult.processCompleted,
        nextStepId: transitionResult.nextStepId,
      };
    } else {
      console.log(`[Validation] Waiting for more approvals. ${validationTasks.filter(t => t.status === "completed").length}/${validationTasks.length} complete`);

      const remaining = validationTasks.filter(t => t.status === "pending").length;
      return {
        success: true,
        allValidationsComplete: false,
        remainingApprovals: remaining,
        nextStepActivated: false,
      };
    }
  } catch (error) {
    console.error("Error approving validation task:", error);
    return {
      success: false,
      allValidationsComplete: false,
      nextStepActivated: false,
      error: error instanceof Error ? error.message : "Failed to approve validation task",
    };
  }
}
