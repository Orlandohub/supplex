/**
 * Step Transition Helper: Transition to Next Step
 * Story: 2.2.8 - Workflow Execution Engine
 * 
 * Handles transitioning from current step to next step in workflow
 */

import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { db as defaultDb } from "../db";
import {
  stepInstance,
  processInstance,
  workflowStepTemplate,
  workflowTemplate,
  workflowType,
  suppliers,
  supplierStatus,
} from "@supplex/db";
import { eq, and } from "drizzle-orm";
import { WorkflowProcessStatus } from "@supplex/types";
import { createTasksForStep } from "./create-tasks-for-step";
import { seedStepDocuments } from "./seed-step-documents";

/**
 * Transition workflow to the next step
 * 
 * Logic:
 * - Marks current step as completed
 * - Finds next step by step_order
 * - Activates next step and creates tasks
 * - If no next step, marks process as completed
 * 
 * @param currentStepInstanceId - UUID of current step
 * @param processId - UUID of process instance  
 * @param tenantId - Tenant ID for isolation
 * @param db - Optional database instance (defaults to defaultDb)
 * @returns Updated state with next step info
 */
export async function transitionToNextStep(
  currentStepInstanceId: string,
  processId: string,
  tenantId: string,
  db: NodePgDatabase<any> = defaultDb
): Promise<{
  currentStepCompleted: boolean;
  nextStepActivated: boolean;
  nextStepId?: string;
  processCompleted: boolean;
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

  // Get all step instances for this process (ordered by step_order)
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

  // Find next step
  const nextStep = allSteps.find(
    (s) => s.stepOrder === currentStep.stepOrder + 1
  );

  if (nextStep) {
    // Activate next step
    await db
      .update(stepInstance)
      .set({ status: "active" })
      .where(eq(stepInstance.id, nextStep.id));

    await db
      .update(processInstance)
      .set({
        status: WorkflowProcessStatus.IN_PROGRESS,
        currentStepInstanceId: nextStep.id,
        updatedAt: new Date(),
      })
      .where(eq(processInstance.id, processId));

    // Get workflow step template for next step to create tasks
    const [process] = await db
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

    const stepTemplates = await db
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
        nextStep.id,
        nextStepTemplate.id,
        processId,
        tenantId
      );

      // Seed document rows if this is a document step
      if (nextStepTemplate.stepType === "document" && nextStepTemplate.documentTemplateId) {
        await seedStepDocuments(
          nextStep.id,
          processId,
          nextStepTemplate.id,
          tenantId,
          db
        );
      }
    } else {
      console.warn(
        `No workflow step template found for step order ${nextStep.stepOrder} in workflow template ${workflowTemplateId}`
      );
    }

    return {
      currentStepCompleted: true,
      nextStepActivated: true,
      nextStepId: nextStep.id,
      processCompleted: false,
    };
  } else {
    await db
      .update(processInstance)
      .set({
        status: WorkflowProcessStatus.COMPLETE,
        currentStepInstanceId: null,
        completedDate: new Date(),
      })
      .where(eq(processInstance.id, processId));

    // Auto-update supplier status based on workflow type configuration
    const [process] = await db
      .select()
      .from(processInstance)
      .where(eq(processInstance.id, processId));

    if (process?.entityType === "supplier" && process.entityId) {
      const wfTemplateId = process.workflowTemplateId;
      if (wfTemplateId) {
        const [wfTemplate] = await db
          .select({ workflowTypeId: workflowTemplate.workflowTypeId })
          .from(workflowTemplate)
          .where(eq(workflowTemplate.id, wfTemplateId));

        if (wfTemplate?.workflowTypeId) {
          const [wfType] = await db
            .select({
              supplierStatusId: workflowType.supplierStatusId,
            })
            .from(workflowType)
            .where(eq(workflowType.id, wfTemplate.workflowTypeId));

          if (wfType?.supplierStatusId) {
            const [targetStatus] = await db
              .select({ name: supplierStatus.name })
              .from(supplierStatus)
              .where(eq(supplierStatus.id, wfType.supplierStatusId));

            if (targetStatus) {
              await db
                .update(suppliers)
                .set({
                  status: targetStatus.name,
                  supplierStatusId: wfType.supplierStatusId,
                  updatedAt: new Date(),
                })
                .where(
                  and(
                    eq(suppliers.id, process.entityId),
                    eq(suppliers.tenantId, tenantId)
                  )
                );
            }
          }
        }
      }
    }

    return {
      currentStepCompleted: true,
      nextStepActivated: false,
      processCompleted: true,
    };
  }
}

