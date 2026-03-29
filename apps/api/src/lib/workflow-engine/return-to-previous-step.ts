/**
 * Step Transition Helper: Return to Previous Step
 * Story: 2.2.8 - Workflow Execution Engine
 * 
 * Handles returning to a previous step when current step is declined
 */

import { db } from "../db";
import { stepInstance, processInstance, workflowStepTemplate } from "@supplex/db";
import { eq, and } from "drizzle-orm";
import { createTasksForStep } from "./create-tasks-for-step";

/**
 * Return workflow to a previous step (decline loop)
 * 
 * Logic:
 * - Marks current step as 'returned' or 'declined'
 * - Calculates target step: current_step_order - declineOffset
 * - Activates target step and creates new tasks
 * - Maintains audit trail by keeping declined step record
 * 
 * @param currentStepInstanceId - UUID of current step being declined
 * @param declineOffset - How many steps back to return (from workflow config)
 * @param processId - UUID of process instance
 * @param tenantId - Tenant ID for isolation
 * @returns Updated state with target step info
 */
export async function returnToPreviousStep(
  currentStepInstanceId: string,
  declineOffset: number,
  processId: string,
  tenantId: string
): Promise<{
  currentStepDeclined: boolean;
  targetStepActivated: boolean;
  targetStepId?: string;
  error?: string;
}> {
  // Get current step instance
  const [currentStep] = await db
    .select()
    .from(stepInstance)
    .where(
      and(
        eq(stepInstance.id, currentStepInstanceId),
        eq(stepInstance.tenantId, tenantId)
      )
    );

  if (!currentStep) {
    throw new Error(`Step instance not found: ${currentStepInstanceId}`);
  }

  // Calculate target step order
  const targetStepOrder = currentStep.stepOrder - declineOffset;

  if (targetStepOrder < 1) {
    return {
      currentStepDeclined: false,
      targetStepActivated: false,
      error: "Cannot return: offset goes beyond first step",
    };
  }

  // Mark current step as declined (keeping audit trail)
  await db
    .update(stepInstance)
    .set({ status: "declined" })
    .where(eq(stepInstance.id, currentStepInstanceId));

  // Get all step instances for this process
  const allSteps = await db
    .select()
    .from(stepInstance)
    .where(
      and(
        eq(stepInstance.processInstanceId, processId),
        eq(stepInstance.tenantId, tenantId)
      )
    )
    .orderBy(stepInstance.stepOrder);

  // Find target step
  const targetStep = allSteps.find((s) => s.stepOrder === targetStepOrder);

  if (!targetStep) {
    return {
      currentStepDeclined: true,
      targetStepActivated: false,
      error: `Target step at order ${targetStepOrder} not found`,
    };
  }

  // Activate target step
  await db
    .update(stepInstance)
    .set({ status: "active" })
    .where(eq(stepInstance.id, targetStep.id));

  // Get workflowTemplateId from process for accurate template lookup
  const [process] = await db
    .select()
    .from(processInstance)
    .where(eq(processInstance.id, processId));

  const workflowTemplateId = process?.workflowTemplateId;

  const stepTemplates = await db
    .select()
    .from(workflowStepTemplate)
    .where(
      and(
        eq(workflowStepTemplate.tenantId, tenantId),
        ...(workflowTemplateId
          ? [eq(workflowStepTemplate.workflowTemplateId, workflowTemplateId)]
          : []),
        eq(workflowStepTemplate.stepOrder, targetStep.stepOrder)
      )
    );

  if (stepTemplates.length > 0) {
    const targetStepTemplate = stepTemplates[0];
    
    await createTasksForStep(
      targetStep.id,
      targetStepTemplate.id,
      processId,
      tenantId,
      { isResubmission: true }
    );
  }

  return {
    currentStepDeclined: true,
    targetStepActivated: true,
    targetStepId: targetStep.id,
  };
}

