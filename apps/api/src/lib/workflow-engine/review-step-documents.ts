/**
 * Document Review Engine Function
 * Story: WFH-001 - Document Review Transaction Safety & Engine Unification
 * Revised: WFH-002 - Transaction integrity fix (gate CAS first, throw post-mutation)
 *
 * Handles batch document review (approve/decline) with CAS guards,
 * per-reviewer decision tracking, strong aggregate approval, and full
 * transaction safety.
 *
 * Error contract:
 *   Pre-mutation / no-op conflicts  → return { success: false, ... }
 *   Post-mutation unexpected errors  → throw (caller's transaction rolls back)
 */

import type { DbOrTx } from "@supplex/db";
import {
  workflowStepDocument,
  stepInstance,
  StepStatus,
  processInstance,
  taskInstance,
  workflowStepTemplate,
  documentReviewDecision,
} from "@supplex/db";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { WorkflowProcessStatus } from "@supplex/types";
import { transitionToNextStep } from "./transition-to-next-step";
import { createTasksForStep } from "./create-tasks-for-step";
import type { Logger } from "pino";
import defaultLogger from "../logger";

export interface ReviewDocumentDecision {
  requiredDocumentName: string;
  action: "approve" | "decline";
  comment?: string;
}

export interface ReviewStepDocumentsParams {
  tenantId: string;
  stepInstanceId: string;
  reviewedBy: string;
  taskId: string;
  decisions: ReviewDocumentDecision[];
}

export interface ReviewStepDocumentsResult {
  success: boolean;
  conflict?: boolean;
  outcome?: "all_approved" | "declined";
  approvedCount?: number;
  declinedCount?: number;
  declinedDocumentNames?: string[];
  allValidationsComplete?: boolean;
  remainingApprovals?: number;
  stepCompleted?: boolean;
  nextStepActivated?: boolean;
  nextStepId?: string;
  nextStepName?: string;
  processCompleted?: boolean;
  processInstanceId?: string;
  stepName?: string;
  error?: string;
}

export async function reviewStepDocuments(
  tx: DbOrTx,
  params: ReviewStepDocumentsParams,
  log?: Logger
): Promise<ReviewStepDocumentsResult> {
  const { tenantId, stepInstanceId, reviewedBy, taskId, decisions } = params;
  const reviewLog = (log || defaultLogger).child({
    action: "reviewStepDocuments",
    tenantId,
    stepId: stepInstanceId,
  });

  // ── Pre-mutation validation (structured returns) ──────────────────

  const [step] = await tx
    .select()
    .from(stepInstance)
    .where(
      and(
        eq(stepInstance.id, stepInstanceId),
        eq(stepInstance.tenantId, tenantId)
      )
    );

  if (!step) {
    return { success: false, error: "Step not found" };
  }

  if (step.status !== "awaiting_validation") {
    return {
      success: false,
      error: "Step is not awaiting validation",
    };
  }

  const currentRound = step.validationRound;

  const existingDocs = await tx
    .select()
    .from(workflowStepDocument)
    .where(
      and(
        eq(workflowStepDocument.stepInstanceId, stepInstanceId),
        eq(workflowStepDocument.tenantId, tenantId),
        isNull(workflowStepDocument.deletedAt)
      )
    );

  if (existingDocs.length === 0) {
    return { success: false, error: "No documents found for this step" };
  }

  const docMap = new Map(existingDocs.map((d) => [d.requiredDocumentName, d]));

  for (const decision of decisions) {
    if (!docMap.has(decision.requiredDocumentName)) {
      return {
        success: false,
        error: `Document not found: ${decision.requiredDocumentName}`,
      };
    }
  }

  const hasDeclines = decisions.some((d) => d.action === "decline");
  const now = new Date();

  const approvedDecisions = decisions.filter((d) => d.action === "approve");
  const declinedDecisions = decisions.filter((d) => d.action === "decline");

  if (!hasDeclines) {
    // ── APPROVE PATH ──────────────────────────────────────────────

    // Gate CAS: claim the reviewer's validation task
    const [completedTask] = await tx
      .update(taskInstance)
      .set({
        status: "completed",
        outcome: "approved",
        completedBy: reviewedBy,
        completedAt: now,
      })
      .where(
        and(
          eq(taskInstance.id, taskId),
          eq(taskInstance.tenantId, tenantId),
          eq(taskInstance.status, "pending")
        )
      )
      .returning();

    if (!completedTask) {
      return {
        success: false,
        conflict: true,
        error: "Task already processed",
      };
    }

    // ═══ POINT OF NO RETURN — errors throw from here ═══

    // Record per-reviewer decisions (idempotent ON CONFLICT)
    const decisionRows = decisions.map((d) => ({
      tenantId,
      workflowStepDocumentId: docMap.get(d.requiredDocumentName)!.id,
      stepInstanceId,
      taskInstanceId: taskId,
      reviewerUserId: reviewedBy,
      validationRound: currentRound,
      decision: "approved" as const,
      comment: null,
      decidedAt: now,
      createdAt: now,
    }));

    if (decisionRows.length > 0) {
      await tx
        .insert(documentReviewDecision)
        .values(decisionRows)
        .onConflictDoNothing({
          target: [
            documentReviewDecision.workflowStepDocumentId,
            documentReviewDecision.taskInstanceId,
          ],
        });
    }

    // Check remaining pending validations for the current round
    const pendingValidations = await tx
      .select({ id: taskInstance.id })
      .from(taskInstance)
      .where(
        and(
          eq(taskInstance.stepInstanceId, stepInstanceId),
          eq(taskInstance.tenantId, tenantId),
          eq(taskInstance.taskType, "validation"),
          eq(taskInstance.status, "pending"),
          eq(taskInstance.validationRound, currentRound)
        )
      );

    if (pendingValidations.length > 0) {
      reviewLog.info(
        { outcome: "all_approved", remaining: pendingValidations.length },
        "documents approved by this reviewer, waiting for more approvals"
      );

      return {
        success: true,
        outcome: "all_approved",
        approvedCount: approvedDecisions.length,
        declinedCount: 0,
        allValidationsComplete: false,
        remainingApprovals: pendingValidations.length,
        stepCompleted: false,
        nextStepActivated: false,
        processCompleted: false,
        processInstanceId: step.processInstanceId,
        stepName: step.stepName,
      };
    }

    // All validation tasks complete — run strong aggregate approval check
    const currentRoundTasks = await tx
      .select({ id: taskInstance.id })
      .from(taskInstance)
      .where(
        and(
          eq(taskInstance.stepInstanceId, stepInstanceId),
          eq(taskInstance.tenantId, tenantId),
          eq(taskInstance.taskType, "validation"),
          eq(taskInstance.validationRound, currentRound)
        )
      );

    const currentRoundTaskIds = currentRoundTasks.map((t) => t.id);

    const allDecisions = await tx
      .select()
      .from(documentReviewDecision)
      .where(
        and(
          eq(documentReviewDecision.stepInstanceId, stepInstanceId),
          eq(documentReviewDecision.validationRound, currentRound)
        )
      );

    const docApprovalMap = new Map<string, Set<string>>();
    for (const d of allDecisions) {
      if (d.decision !== "approved") continue;
      if (!docApprovalMap.has(d.workflowStepDocumentId)) {
        docApprovalMap.set(d.workflowStepDocumentId, new Set());
      }
      docApprovalMap.get(d.workflowStepDocumentId)!.add(d.taskInstanceId);
    }

    const requiredDocs = existingDocs.filter(
      (d) => d.status === "uploaded" || d.status === "approved"
    );

    for (const doc of requiredDocs) {
      const approverTasks = docApprovalMap.get(doc.id);
      for (const tid of currentRoundTaskIds) {
        if (!approverTasks?.has(tid)) {
          reviewLog.warn(
            { docId: doc.id, missingTaskId: tid },
            "strong aggregate check failed: missing approval from a reviewer"
          );
          throw new Error(
            "Aggregate approval check failed: not all reviewers have approved all documents"
          );
        }
      }
    }

    // CAS step to validated — claims the transition
    const [transitioned] = await tx
      .update(stepInstance)
      .set({
        status: StepStatus.VALIDATED,
        completedBy: reviewedBy,
        completedDate: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(stepInstance.id, stepInstanceId),
          eq(stepInstance.status, StepStatus.AWAITING_VALIDATION)
        )
      )
      .returning();

    if (!transitioned) {
      // Concurrent request already transitioned — our task approval stands
      reviewLog.info("step CAS lost to concurrent request, task approval stands");
      return {
        success: true,
        outcome: "all_approved",
        approvedCount: approvedDecisions.length,
        declinedCount: 0,
        allValidationsComplete: true,
        stepCompleted: true,
        nextStepActivated: false,
        processCompleted: false,
        processInstanceId: step.processInstanceId,
        stepName: step.stepName,
      };
    }

    // Update aggregate document statuses (only after claiming step transition)
    const uploadedDocIds = existingDocs
      .filter((d) => d.status === "uploaded")
      .map((d) => d.id);
    if (uploadedDocIds.length > 0) {
      await tx
        .update(workflowStepDocument)
        .set({
          status: "approved",
          reviewedBy,
          reviewedAt: now,
          declineComment: null,
          updatedAt: now,
        })
        .where(inArray(workflowStepDocument.id, uploadedDocIds));
    }

    const transitionResult = await transitionToNextStep(
      tx,
      stepInstanceId,
      step.processInstanceId,
      tenantId
    );

    let nextStepName: string | undefined;
    if (transitionResult.nextStepActivated && transitionResult.nextStepId) {
      const [nextStep] = await tx
        .select({ stepName: stepInstance.stepName })
        .from(stepInstance)
        .where(eq(stepInstance.id, transitionResult.nextStepId));
      nextStepName = nextStep?.stepName ?? undefined;
    }

    reviewLog.info(
      { outcome: "all_approved", count: approvedDecisions.length },
      "all documents approved, all validations complete"
    );

    return {
      success: true,
      outcome: "all_approved",
      approvedCount: approvedDecisions.length,
      declinedCount: 0,
      allValidationsComplete: true,
      stepCompleted: true,
      nextStepActivated: transitionResult.nextStepActivated,
      nextStepId: transitionResult.nextStepId,
      nextStepName,
      processCompleted: transitionResult.processCompleted,
      processInstanceId: step.processInstanceId,
      stepName: step.stepName,
    };
  }

  // ── DECLINE PATH ──────────────────────────────────────────────────

  // Gate CAS: claim the step reset (awaiting_validation → active)
  const [resetStep] = await tx
    .update(stepInstance)
    .set({ status: "active", updatedAt: now })
    .where(
      and(
        eq(stepInstance.id, stepInstanceId),
        eq(stepInstance.status, "awaiting_validation")
      )
    )
    .returning();

  if (!resetStep) {
    return {
      success: false,
      conflict: true,
      error: "Step already processed or not in expected state",
    };
  }

  // ═══ POINT OF NO RETURN — errors throw from here ═══

  // Record per-reviewer decisions (audit trail, idempotent ON CONFLICT)
  const allDecisionRows = decisions.map((d) => ({
    tenantId,
    workflowStepDocumentId: docMap.get(d.requiredDocumentName)!.id,
    stepInstanceId,
    taskInstanceId: taskId,
    reviewerUserId: reviewedBy,
    validationRound: currentRound,
    decision: d.action === "approve" ? ("approved" as const) : ("declined" as const),
    comment: d.action === "decline" ? (d.comment || null) : null,
    decidedAt: now,
    createdAt: now,
  }));

  if (allDecisionRows.length > 0) {
    await tx
      .insert(documentReviewDecision)
      .values(allDecisionRows)
      .onConflictDoNothing({
        target: [
          documentReviewDecision.workflowStepDocumentId,
          documentReviewDecision.taskInstanceId,
        ],
      });
  }

  // Reset declined documents to pending
  const declinedDocIds = declinedDecisions
    .map((d) => docMap.get(d.requiredDocumentName)!.id)
    .filter(Boolean);

  if (declinedDocIds.length > 0) {
    const declineCommentMap = new Map(
      declinedDecisions.map((d) => [
        docMap.get(d.requiredDocumentName)!.id,
        d.comment || null,
      ])
    );

    const commentGroups = new Map<string | null, string[]>();
    for (const [docId, comment] of declineCommentMap) {
      const key = comment ?? null;
      if (!commentGroups.has(key)) {
        commentGroups.set(key, []);
      }
      commentGroups.get(key)!.push(docId);
    }

    for (const [comment, ids] of commentGroups) {
      await tx
        .update(workflowStepDocument)
        .set({
          status: "pending",
          documentId: null,
          declineComment: comment,
          reviewedBy,
          reviewedAt: now,
          updatedAt: now,
        })
        .where(inArray(workflowStepDocument.id, ids));
    }
  }

  // Close all pending tasks for this step
  await tx
    .update(taskInstance)
    .set({
      status: "completed",
      completedBy: reviewedBy,
      completedAt: now,
    })
    .where(
      and(
        eq(taskInstance.stepInstanceId, stepInstanceId),
        eq(taskInstance.tenantId, tenantId),
        eq(taskInstance.status, "pending")
      )
    );

  // Update process status
  await tx
    .update(processInstance)
    .set({
      status: WorkflowProcessStatus.DECLINED_RESUBMIT,
      updatedAt: now,
    })
    .where(eq(processInstance.id, step.processInstanceId));

  // Create re-upload tasks from step template
  const [proc] = await tx
    .select({ workflowTemplateId: processInstance.workflowTemplateId })
    .from(processInstance)
    .where(eq(processInstance.id, step.processInstanceId));

  if (proc?.workflowTemplateId) {
    const [stepTmpl] = await tx
      .select()
      .from(workflowStepTemplate)
      .where(
        and(
          eq(workflowStepTemplate.workflowTemplateId, proc.workflowTemplateId),
          eq(workflowStepTemplate.tenantId, tenantId),
          eq(workflowStepTemplate.stepOrder, step.stepOrder),
          isNull(workflowStepTemplate.deletedAt)
        )
      );

    if (stepTmpl) {
      await createTasksForStep(
        tx,
        stepInstanceId,
        stepTmpl.id,
        step.processInstanceId,
        tenantId
      );
    }
  }

  const declinedNames = declinedDecisions.map((d) => d.requiredDocumentName);

  reviewLog.info(
    {
      outcome: "declined",
      approvedCount: approvedDecisions.length,
      declinedCount: declinedDecisions.length,
    },
    "documents declined, step reset to active"
  );

  return {
    success: true,
    outcome: "declined",
    approvedCount: approvedDecisions.length,
    declinedCount: declinedDecisions.length,
    declinedDocumentNames: declinedNames,
    stepName: step.stepName,
    processInstanceId: step.processInstanceId,
  };
}
