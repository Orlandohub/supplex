/**
 * Step Transition Helper: Transition to Next Step
 * Story: 2.2.8 - Workflow Execution Engine
 * Updated: Story 2.2.19 - Transaction threading (tx required)
 * 
 * Handles transitioning from current step to next step in workflow
 */

import type { DbOrTx } from "@supplex/db";
import {
  stepInstance,
  processInstance,
  workflowStepTemplate,
  workflowTemplate,
  workflowType,
  suppliers,
  supplierStatus,
} from "@supplex/db";
import { eq, and, sql } from "drizzle-orm";
import { WorkflowProcessStatus } from "@supplex/types";
import { createTasksForStep } from "./create-tasks-for-step";
import { seedStepDocuments } from "./seed-step-documents";
import type { Logger } from "pino";
import defaultLogger from "../logger";

export async function transitionToNextStep(
  tx: DbOrTx,
  currentStepInstanceId: string,
  processId: string,
  tenantId: string,
  log?: Logger
): Promise<{
  currentStepCompleted: boolean;
  nextStepActivated: boolean;
  nextStepId?: string;
  processCompleted: boolean;
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

  const nextStep = allSteps.find(
    (s) => s.stepOrder === currentStep.stepOrder + 1
  );

  if (nextStep) {
    await tx
      .update(stepInstance)
      .set({ status: "active" })
      .where(eq(stepInstance.id, nextStep.id));

    await tx
      .update(processInstance)
      .set({
        status: WorkflowProcessStatus.IN_PROGRESS,
        currentStepInstanceId: nextStep.id,
        completedSteps: sql`${processInstance.completedSteps} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(processInstance.id, processId));

    const [process] = await tx
      .select()
      .from(processInstance)
      .where(eq(processInstance.id, processId));

    if (!process) {
      throw new Error(`Process instance not found: ${processId}`);
    }

    const workflowTemplateId = process.workflowTemplateId;
    
    if (!workflowTemplateId) {
      throw new Error(
        `workflowTemplateId not found for process ${processId}`
      );
    }

    const stepTemplates = await tx
      .select()
      .from(workflowStepTemplate)
      .where(
        and(
          eq(workflowStepTemplate.workflowTemplateId, workflowTemplateId),
          eq(workflowStepTemplate.tenantId, tenantId),
          eq(workflowStepTemplate.stepOrder, nextStep.stepOrder)
        )
      );

    if (stepTemplates.length > 0) {
      const nextStepTemplate = stepTemplates[0];
      await createTasksForStep(
        tx,
        nextStep.id,
        nextStepTemplate.id,
        processId,
        tenantId
      );

      if (nextStepTemplate.stepType === "document" && nextStepTemplate.documentTemplateId) {
        await seedStepDocuments(
          tx,
          nextStep.id,
          processId,
          nextStepTemplate.id,
          tenantId
        );
      }
    } else {
      const transLog = (log || defaultLogger).child({ action: "transitionToNextStep", tenantId, processId });
      transLog.warn({ stepOrder: nextStep.stepOrder, workflowTemplateId }, "no workflow step template found for step order");
    }

    return {
      currentStepCompleted: true,
      nextStepActivated: true,
      nextStepId: nextStep.id,
      processCompleted: false,
    };
  } else {
    await tx
      .update(processInstance)
      .set({
        status: WorkflowProcessStatus.COMPLETE,
        currentStepInstanceId: null,
        completedSteps: sql`${processInstance.totalSteps}`,
        completedDate: new Date(),
      })
      .where(eq(processInstance.id, processId));

    const [statusMapping] = await tx
      .select({
        statusName: supplierStatus.name,
        statusId: supplierStatus.id,
        entityId: processInstance.entityId,
      })
      .from(processInstance)
      .innerJoin(workflowTemplate, eq(workflowTemplate.id, processInstance.workflowTemplateId))
      .innerJoin(workflowType, eq(workflowType.id, workflowTemplate.workflowTypeId))
      .innerJoin(supplierStatus, eq(supplierStatus.id, workflowType.supplierStatusId))
      .where(
        and(
          eq(processInstance.id, processId),
          eq(processInstance.entityType, "supplier")
        )
      );

    if (statusMapping) {
      await tx
        .update(suppliers)
        .set({
          status: statusMapping.statusName,
          supplierStatusId: statusMapping.statusId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(suppliers.id, statusMapping.entityId),
            eq(suppliers.tenantId, tenantId)
          )
        );
    }

    return {
      currentStepCompleted: true,
      nextStepActivated: false,
      processCompleted: true,
    };
  }
}
