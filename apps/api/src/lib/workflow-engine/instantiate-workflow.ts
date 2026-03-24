/**
 * Workflow Instantiation Helper
 * Story: 2.2.8 - Workflow Execution Engine
 * Updated: 2.2.14 - Remove Template Versioning
 * 
 * Creates a new workflow process instance from a published workflow template
 */

import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  workflowTemplate,
  workflowStepTemplate,
  processInstance,
  stepInstance,
} from "@supplex/db";
import { eq, and, asc, isNull } from "drizzle-orm";
import { createTasksForStep } from "./create-tasks-for-step";

interface InstantiateWorkflowParams {
  tenantId: string;
  workflowTemplateId: string;
  entityType: string;
  entityId: string;
  initiatedBy: string;
  metadata?: Record<string, any>;
}

interface InstantiateWorkflowResult {
  success: boolean;
  data?: {
    processInstance: typeof processInstance.$inferSelect;
    steps: typeof stepInstance.$inferSelect[];
  };
  error?: string;
}

export async function instantiateWorkflow(
  db: NodePgDatabase<any>,
  params: InstantiateWorkflowParams
): Promise<InstantiateWorkflowResult> {
  const {
    tenantId,
    workflowTemplateId,
    entityType,
    entityId,
    initiatedBy,
    metadata = {},
  } = params;

  try {
    // Query workflow template (with tenant filter)
    const [template] = await db
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

    // Verify status = 'published' and active
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

    // Create process_instance
    const [process] = await db
      .insert(processInstance)
      .values({
        tenantId,
        processType: metadata?.processType || "workflow_execution",
        entityType,
        entityId,
        status: "active",
        initiatedBy,
        initiatedDate: new Date(),
        metadata: {
          ...metadata,
          workflowName: template.name,
          workflowTemplateId,
        },
      })
      .returning();

    // Query all workflow step templates (ordered by step_order)
    const stepTemplates = await db
      .select()
      .from(workflowStepTemplate)
      .where(
        and(
          eq(
            workflowStepTemplate.workflowTemplateId,
            workflowTemplateId
          ),
          eq(workflowStepTemplate.tenantId, tenantId),
          isNull(workflowStepTemplate.deletedAt)
        )
      )
      .orderBy(asc(workflowStepTemplate.stepOrder));

    if (stepTemplates.length === 0) {
      // Rollback: delete process if no steps exist
      await db
        .delete(processInstance)
        .where(eq(processInstance.id, process.id));

      return {
        success: false,
        error: "Workflow template has no steps",
      };
    }

    // Create step_instance records for ALL steps
    const createdSteps: typeof stepInstance.$inferSelect[] = [];

    for (const stepTemplate of stepTemplates) {
      const isFirstStep = stepTemplate.stepOrder === 1;

      const [step] = await db
        .insert(stepInstance)
        .values({
          tenantId,
          processInstanceId: process.id,
          stepOrder: stepTemplate.stepOrder,
          stepName: stepTemplate.name,
          stepType: stepTemplate.stepType,
          status: isFirstStep ? "active" : "blocked",
          metadata: {},
        })
        .returning();

      createdSteps.push(step);

      // For the first step, create tasks immediately
      if (isFirstStep) {
        await createTasksForStep(step.id, stepTemplate.id, process.id, tenantId);
      }
    }

    return {
      success: true,
      data: {
        processInstance: process,
        steps: createdSteps,
      },
    };
  } catch (error) {
    console.error("Error instantiating workflow:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to instantiate workflow",
    };
  }
}

