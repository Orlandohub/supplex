/**
 * Workflow Instantiation Helper
 * Story: 2.2.8 - Workflow Execution Engine
 * Updated: 2.2.14 - Remove Template Versioning
 * Updated: 2.2.19 - Transaction wrapping, batch inserts
 *
 * Creates a new workflow process instance from a published workflow template
 */

import type { DbOrTx } from "@supplex/db";
import {
  db,
  workflowTemplate,
  workflowStepTemplate,
  processInstance,
  stepInstance,
} from "@supplex/db";
import { eq, and, asc, isNull } from "drizzle-orm";
import { WorkflowProcessStatus } from "@supplex/types";
import { createTasksForStep } from "./create-tasks-for-step";
import { seedStepDocuments } from "./seed-step-documents";
import type { Logger } from "pino";
import defaultLogger from "../logger";

interface InstantiateWorkflowParams {
  tenantId: string;
  workflowTemplateId: string;
  entityType: string;
  entityId: string;
  initiatedBy: string;
  workflowName?: string;
  metadata?: Record<string, unknown>;
}

type InstantiateWorkflowResult =
  | {
      success: true;
      data: {
        processInstance: typeof processInstance.$inferSelect;
        steps: (typeof stepInstance.$inferSelect)[];
      };
    }
  | {
      success: false;
      error: string;
    };

export async function instantiateWorkflow(
  outerDb: DbOrTx,
  params: InstantiateWorkflowParams,
  log?: Logger
): Promise<InstantiateWorkflowResult> {
  const {
    tenantId,
    workflowTemplateId,
    entityType,
    entityId,
    initiatedBy,
    workflowName,
    metadata = {},
  } = params;

  try {
    return await db.transaction(async (tx) => {
      const [template] = await tx
        .select()
        .from(workflowTemplate)
        .where(
          and(
            eq(workflowTemplate.id, workflowTemplateId),
            eq(workflowTemplate.tenantId, tenantId),
            isNull(workflowTemplate.deletedAt)
          )
        );

      if (!template) {
        return {
          success: false,
          error: "Workflow template not found",
        };
      }

      if (template.status !== "published") {
        return {
          success: false,
          error: "Workflow template is not published",
        };
      }

      if (!template.active) {
        return {
          success: false,
          error: "Workflow template is not active",
        };
      }

      const processType =
        typeof metadata?.processType === "string"
          ? metadata.processType
          : "workflow_execution";

      const [process] = await tx
        .insert(processInstance)
        .values({
          tenantId,
          processType,
          entityType,
          entityId,
          status: "in_progress",
          workflowTemplateId,
          workflowName: workflowName || template.name,
          initiatedBy,
          initiatedDate: new Date(),
          metadata: metadata || {},
          totalSteps: 0,
          completedSteps: 0,
        })
        .returning();

      if (!process) throw new Error("Failed to create process instance");

      const stepTemplates = await tx
        .select()
        .from(workflowStepTemplate)
        .where(
          and(
            eq(workflowStepTemplate.workflowTemplateId, workflowTemplateId),
            eq(workflowStepTemplate.tenantId, tenantId),
            isNull(workflowStepTemplate.deletedAt)
          )
        )
        .orderBy(asc(workflowStepTemplate.stepOrder));

      if (stepTemplates.length === 0) {
        throw new Error("Workflow template has no steps");
      }

      // Batch insert all step instances at once
      const createdSteps = await tx
        .insert(stepInstance)
        .values(
          stepTemplates.map((st) => ({
            tenantId,
            processInstanceId: process.id,
            stepOrder: st.stepOrder,
            stepName: st.name,
            stepType: st.stepType,
            workflowStepTemplateId: st.id,
            status:
              st.stepOrder === 1 ? ("active" as const) : ("blocked" as const),
            metadata: {},
          }))
        )
        .returning();

      const firstStep = createdSteps.find((s) => s.stepOrder === 1);
      const firstStepTemplate = stepTemplates.find((st) => st.stepOrder === 1);

      if (firstStep && firstStepTemplate) {
        await createTasksForStep(
          tx,
          firstStep.id,
          firstStepTemplate.id,
          process.id,
          tenantId
        );

        if (
          firstStepTemplate.stepType === "document" &&
          firstStepTemplate.documentTemplateId
        ) {
          await seedStepDocuments(
            tx,
            firstStep.id,
            process.id,
            firstStepTemplate.id,
            tenantId
          );
        }
      }

      const [updatedProcess] = await tx
        .update(processInstance)
        .set({
          status: WorkflowProcessStatus.IN_PROGRESS,
          currentStepInstanceId: firstStep?.id ?? null,
          totalSteps: stepTemplates.length,
          updatedAt: new Date(),
        })
        .where(eq(processInstance.id, process.id))
        .returning();

      if (!updatedProcess) throw new Error("Failed to update process instance");

      return {
        success: true,
        data: {
          processInstance: updatedProcess,
          steps: createdSteps,
        },
      };
    });
  } catch (error) {
    const instLog = (log || defaultLogger).child({
      action: "instantiateWorkflow",
      tenantId: params.tenantId,
    });
    instLog.error({ err: error }, "error instantiating workflow");
    const message =
      error instanceof Error ? error.message : "Failed to instantiate workflow";
    return {
      success: false,
      error: message,
    };
  }
}
