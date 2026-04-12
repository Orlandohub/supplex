/**
 * Step Completion Helper
 * Story: 2.2.8 - Workflow Execution Engine
 * Updated: Story 2.2.19 - Transaction threading, atomic CAS transitions
 * Updated: WFH-002 - Transaction integrity fix (throw post-CAS, remove outer try-catch)
 *
 * Error contract:
 *   CAS miss (step not active)         → return { success: false, ... }
 *   Post-CAS unexpected errors          → throw (caller's transaction rolls back)
 */

import type { DbOrTx } from "@supplex/db";
import {
  stepInstance,
  StepStatus,
  processInstance,
  taskInstance,
  commentThread,
  workflowStepTemplate,
  workflowStepDocument,
  documentTemplate,
} from "@supplex/db";
import { eq, and, isNull, sql } from "drizzle-orm";
import { WorkflowProcessStatus, type RequiredDocumentItem } from "@supplex/types";
import { transitionToNextStep } from "./transition-to-next-step";
import { createValidationTasks } from "./create-validation-tasks";
import type { Logger } from "pino";
import defaultLogger from "../logger";

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
    wasResubmission?: boolean;
  };
  error?: string;
}

export async function completeStep(
  tx: DbOrTx,
  params: CompleteStepParams,
  log?: Logger
): Promise<CompleteStepResult> {
  const { tenantId, stepInstanceId, completedBy, outcome, comments } = params;
  const stepLog = (log || defaultLogger).child({ action: "completeStep", tenantId, stepId: stepInstanceId });

  // Pre-mutation snapshot: capture completedDate before CAS to detect resubmission
  const [preStep] = await tx
    .select({ completedDate: stepInstance.completedDate, status: stepInstance.status })
    .from(stepInstance)
    .where(and(eq(stepInstance.id, stepInstanceId), eq(stepInstance.tenantId, tenantId)));
  const wasResubmission = preStep?.completedDate !== null;

  stepLog.info({
    preStepStatus: preStep?.status,
    wasResubmission,
  }, "completeStep pre-CAS snapshot");

  // Gate CAS: only succeed if step is currently 'active'
  const [step] = await tx
    .update(stepInstance)
    .set({
      status: "completed",
      completedBy,
      completedDate: new Date(),
    })
    .where(
      and(
        eq(stepInstance.id, stepInstanceId),
        eq(stepInstance.tenantId, tenantId),
        eq(stepInstance.status, "active")
      )
    )
    .returning();

  if (!step) {
    stepLog.warn("CAS failed — step not in active state");
    return {
      success: false,
      error: "Step already processed or not in active state",
    };
  }

  // ═══ POINT OF NO RETURN — errors throw from here ═══

  stepLog.info({
    stepType: step.stepType,
    processInstanceId: step.processInstanceId,
  }, "CAS succeeded — step set to completed");

  // For document steps, verify all required documents are uploaded
  if (step.stepType === "document" || step.stepType === "document_upload") {
    const docs = await tx
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
      const [proc] = await tx
        .select({ workflowTemplateId: processInstance.workflowTemplateId })
        .from(processInstance)
        .where(eq(processInstance.id, step.processInstanceId));
      const wfTemplateId = proc?.workflowTemplateId;

      if (wfTemplateId) {
        const [stepTmpl] = await tx
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
          const [docTmpl] = await tx
            .select({ requiredDocuments: documentTemplate.requiredDocuments })
            .from(documentTemplate)
            .where(eq(documentTemplate.id, stepTmpl.documentTemplateId));

          if (docTmpl?.requiredDocuments) {
            const reqDocs = docTmpl.requiredDocuments as RequiredDocumentItem[];
            reqDocs
              .filter((d) => d.required !== false)
              .forEach((d) => requiredDocNames.add(d.name));
          }
        }
      }

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
        throw new Error(`${notReady.length} required document(s) still need to be uploaded`);
      }
    }
  }

  const [process] = await tx
    .select()
    .from(processInstance)
    .where(eq(processInstance.id, step.processInstanceId));

  if (!process) {
    throw new Error(`Process instance not found for step ${stepInstanceId}`);
  }

  if (outcome === "declined") {
    if (comments) {
      await tx.insert(commentThread).values({
        tenantId,
        processInstanceId: process.id,
        stepInstanceId: step.id,
        entityType: "step_instance",
        commentText: comments,
        commentedBy: completedBy,
      });
    }

    await tx
      .update(stepInstance)
      .set({
        status: StepStatus.DECLINED,
        completedBy,
        completedDate: new Date(),
      })
      .where(eq(stepInstance.id, stepInstanceId));

    await tx
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
        wasResubmission,
      },
    };
  }

  if (comments) {
    await tx.insert(commentThread).values({
      tenantId,
      processInstanceId: process.id,
      stepInstanceId: step.id,
      entityType: "step_instance",
      commentText: comments,
      commentedBy: completedBy,
    });
  }

  // Mark all tasks for this step as completed
  await tx
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

  stepLog.info({ workflowTemplateId, stepOrder: step.stepOrder }, "step completion started");

  const stepTemplate = workflowTemplateId
    ? (await tx
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

  stepLog.info({ stepTemplateFound: !!stepTemplate, requiresValidation: stepTemplate?.requiresValidation }, "step template lookup");

  if (stepTemplate?.requiresValidation) {
    const [updatedStep] = await tx
      .update(stepInstance)
      .set({
        status: StepStatus.AWAITING_VALIDATION,
        validationRound: sql`${stepInstance.validationRound} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(stepInstance.id, stepInstanceId))
      .returning({ validationRound: stepInstance.validationRound });

    const newRound = updatedStep?.validationRound ?? 1;

    await createValidationTasks(tx, {
      tenantId,
      stepInstanceId,
      processInstanceId: process.id,
      stepTemplate,
      validationRound: newRound,
    });

    await tx
      .update(processInstance)
      .set({
        status: WorkflowProcessStatus.PENDING_VALIDATION,
        updatedAt: new Date(),
      })
      .where(eq(processInstance.id, process.id));

    stepLog.info({ validationRound: newRound, processId: process.id }, "step requires validation, tasks created — status: awaiting_validation");

    return {
      success: true as const,
      data: {
        stepCompleted: true,
        nextStepActivated: false,
        awaitingValidation: true,
        wasResubmission,
      },
    };
  }

  const transitionResult = await transitionToNextStep(
    tx,
    stepInstanceId,
    process.id,
    tenantId
  );

  return {
    success: true as const,
    data: {
      stepCompleted: true,
      nextStepActivated: transitionResult.nextStepActivated,
      processCompleted: transitionResult.processCompleted,
      nextStepId: transitionResult.nextStepId,
      wasResubmission,
    },
  };
}
