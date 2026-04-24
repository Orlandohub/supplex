/**
 * Step Transition Helper: Return to Previous Step
 * Story: 2.2.8 - Workflow Execution Engine
 * Updated: Story 2.2.19 - Transaction threading (tx required)
 *
 * Handles returning to a previous step when current step is declined
 */

import type { DbOrTx } from "@supplex/db";
import {
  stepInstance,
  StepStatus,
  processInstance,
  workflowStepTemplate,
} from "@supplex/db";
import { eq, and } from "drizzle-orm";
import { createTasksForStep } from "./create-tasks-for-step";

export async function returnToPreviousStep(
  tx: DbOrTx,
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
  const [currentStep] = await tx
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

  const targetStepOrder = currentStep.stepOrder - declineOffset;

  if (targetStepOrder < 1) {
    return {
      currentStepDeclined: false,
      targetStepActivated: false,
      error: "Cannot return: offset goes beyond first step",
    };
  }

  await tx
    .update(stepInstance)
    .set({ status: StepStatus.DECLINED })
    .where(eq(stepInstance.id, currentStepInstanceId));

  const allSteps = await tx
    .select()
    .from(stepInstance)
    .where(
      and(
        eq(stepInstance.processInstanceId, processId),
        eq(stepInstance.tenantId, tenantId)
      )
    )
    .orderBy(stepInstance.stepOrder);

  const targetStep = allSteps.find((s) => s.stepOrder === targetStepOrder);

  if (!targetStep) {
    return {
      currentStepDeclined: true,
      targetStepActivated: false,
      error: `Target step at order ${targetStepOrder} not found`,
    };
  }

  await tx
    .update(stepInstance)
    .set({ status: "active" })
    .where(eq(stepInstance.id, targetStep.id));

  const [process] = await tx
    .select()
    .from(processInstance)
    .where(eq(processInstance.id, processId));

  const workflowTemplateId = process?.workflowTemplateId;

  const stepTemplates = await tx
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
    if (!targetStepTemplate)
      throw new Error("Failed to find target step template");

    await createTasksForStep(
      tx,
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
