/**
 * Step Completion Helper
 * Story: 2.2.8 - Workflow Execution Engine
 * 
 * Completes a workflow step and transitions to the next step
 */

import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  stepInstance,
  processInstance,
  taskInstance,
  commentThread,
  workflowStepTemplate,
  workflowStepDocument,
  documentTemplate,
} from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import { WorkflowProcessStatus } from "@supplex/types";
import { transitionToNextStep } from "./transition-to-next-step";
import { createValidationTasks } from "./create-validation-tasks";

interface CompleteStepParams {
  tenantId: string;
  stepInstanceId: string;
  completedBy: string;
  outcome: "approved" | "declined" | "completed";
  comments?: string;
}

interface CompleteStepResult {
  success: boolean;
  data?: {
    stepCompleted: boolean;
    nextStepActivated: boolean;
    processCompleted?: boolean;
    nextStepId?: string;
    awaitingValidation?: boolean;
  };
  error?: string;
}

export async function completeStep(
  db: NodePgDatabase<any>,
  params: CompleteStepParams
): Promise<CompleteStepResult> {
  const { tenantId, stepInstanceId, completedBy, outcome, comments } = params;

  try {
    // Query step instance (with tenant filter)
    const [step] = await db
      .select()
      .from(stepInstance)
      .where(
        and(
          eq(stepInstance.id, stepInstanceId),
          eq(stepInstance.tenantId, tenantId)
        )
      );

    if (!step) {
      return {
        success: false,
        error: "Step instance not found",
      };
    }

    // Verify step is in active state
    if (step.status !== "active") {
      return {
        success: false,
        error: `Step is not in active state (current: ${step.status})`,
      };
    }

    // For document steps, verify all required documents are uploaded
    if (step.stepType === "document" || step.stepType === "document_upload") {
      const docs = await db
        .select()
        .from(workflowStepDocument)
        .where(
          and(
            eq(workflowStepDocument.stepInstanceId, stepInstanceId),
            eq(workflowStepDocument.tenantId, tenantId),
            isNull(workflowStepDocument.deletedAt)
          )
        );

      if (docs.length > 0) {
      let requiredDocNames = new Set<string>();
        const [proc] = await db
          .select({ workflowTemplateId: processInstance.workflowTemplateId })
          .from(processInstance)
          .where(eq(processInstance.id, step.processInstanceId));
        const wfTemplateId = proc?.workflowTemplateId;

        if (wfTemplateId) {
          const [stepTmpl] = await db
            .select()
            .from(workflowStepTemplate)
            .where(
              and(
                eq(workflowStepTemplate.workflowTemplateId, wfTemplateId),
                eq(workflowStepTemplate.tenantId, tenantId),
                eq(workflowStepTemplate.stepOrder, step.stepOrder),
                isNull(workflowStepTemplate.deletedAt)
              )
            );

          if (stepTmpl?.documentTemplateId) {
            const [docTmpl] = await db
              .select({ requiredDocuments: documentTemplate.requiredDocuments })
              .from(documentTemplate)
              .where(eq(documentTemplate.id, stepTmpl.documentTemplateId));

            if (docTmpl?.requiredDocuments) {
              const reqDocs = docTmpl.requiredDocuments as any[];
              reqDocs
                .filter((d: any) => d.required !== false)
                .forEach((d: any) => requiredDocNames.add(d.name));
            }
          }
        }

        // If no template info found, fall back to treating all as required
        if (requiredDocNames.size === 0) {
          docs.forEach((d) => requiredDocNames.add(d.requiredDocumentName));
        }

        const notReady = docs.filter(
          (d) =>
            requiredDocNames.has(d.requiredDocumentName) &&
            d.status !== "uploaded" &&
            d.status !== "approved"
        );
        if (notReady.length > 0) {
          return {
            success: false,
            error: `${notReady.length} required document(s) still need to be uploaded`,
          };
        }
      }
    }

    // Query process instance
    const [process] = await db
      .select()
      .from(processInstance)
      .where(eq(processInstance.id, step.processInstanceId));

    if (!process) {
      return {
        success: false,
        error: "Process instance not found",
      };
    }

    // Handle based on outcome
    if (outcome === "declined") {
      // Add comment if provided
      if (comments) {
        await db.insert(commentThread).values({
          tenantId,
          processInstanceId: process.id,
          stepInstanceId: step.id,
          entityType: "step_instance",
          commentText: comments,
          commentedBy: completedBy,
        });
      }

      // Mark step as declined
      await db
        .update(stepInstance)
        .set({
          status: "declined",
          completedBy,
          completedDate: new Date(),
        })
        .where(eq(stepInstance.id, stepInstanceId));

      // Mark all tasks for this step as completed
      await db
        .update(taskInstance)
        .set({
          status: "completed",
          completedBy,
          completedAt: new Date(),
        })
        .where(
          and(
            eq(taskInstance.stepInstanceId, stepInstanceId),
            eq(taskInstance.tenantId, tenantId)
          )
        );

      return {
        success: true,
        data: {
          stepCompleted: true,
          nextStepActivated: false,
        },
      };
    } else {
      // approved or completed outcome
      // Add comment if provided
      if (comments) {
        await db.insert(commentThread).values({
          tenantId,
          processInstanceId: process.id,
          stepInstanceId: step.id,
          entityType: "step_instance",
          commentText: comments,
          commentedBy: completedBy,
        });
      }

      // Mark step as completed
      await db
        .update(stepInstance)
        .set({
          status: "completed",
          completedBy,
          completedDate: new Date(),
        })
        .where(eq(stepInstance.id, stepInstanceId));

      // Mark all tasks for this step as completed
      await db
        .update(taskInstance)
        .set({
          status: "completed",
          completedBy,
          completedAt: new Date(),
        })
        .where(
          and(
            eq(taskInstance.stepInstanceId, stepInstanceId),
            eq(taskInstance.tenantId, tenantId)
          )
        );

      const workflowTemplateId = process.workflowTemplateId;

      console.log(`[completeStep] Step ${stepInstanceId}: workflowTemplateId=${workflowTemplateId}, stepOrder=${step.stepOrder}`);

      const stepTemplate = workflowTemplateId
        ? (await db
            .select()
            .from(workflowStepTemplate)
            .where(
              and(
                eq(workflowStepTemplate.workflowTemplateId, workflowTemplateId),
                eq(workflowStepTemplate.tenantId, tenantId),
                eq(workflowStepTemplate.stepOrder, step.stepOrder),
                isNull(workflowStepTemplate.deletedAt)
              )
            ))[0]
        : undefined;

      console.log(`[completeStep] Step template found: ${!!stepTemplate}, requiresValidation: ${stepTemplate?.requiresValidation}, validationConfig: ${JSON.stringify(stepTemplate?.validationConfig)}`);

      // Story 2.2.15: Check if validation is required
      if (stepTemplate?.requiresValidation) {
        // Create validation tasks
        await createValidationTasks(db, {
          tenantId,
          stepInstanceId,
          processInstanceId: process.id,
          stepTemplate,
        });

        // Set step status to awaiting_validation
        await db
          .update(stepInstance)
          .set({
            status: "awaiting_validation",
            updatedAt: new Date(),
          })
          .where(eq(stepInstance.id, stepInstanceId));

        await db
          .update(processInstance)
          .set({
            status: WorkflowProcessStatus.PENDING_VALIDATION,
            updatedAt: new Date(),
          })
          .where(eq(processInstance.id, process.id));

        console.log(`[Validation] Step requires validation, tasks created. Step status: awaiting_validation`);

        return {
          success: true,
          data: {
            stepCompleted: true,
            nextStepActivated: false,
            awaitingValidation: true,
          },
        };
      }

      const transitionResult = await transitionToNextStep(
        stepInstanceId,
        process.id,
        tenantId,
        db
      );

      return {
        success: true,
        data: {
          stepCompleted: true,
          nextStepActivated: transitionResult.nextStepActivated,
          processCompleted: transitionResult.processCompleted,
          nextStepId: transitionResult.nextStepId,
        },
      };
    }
  } catch (error) {
    console.error("Error completing step:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to complete step",
    };
  }
}

