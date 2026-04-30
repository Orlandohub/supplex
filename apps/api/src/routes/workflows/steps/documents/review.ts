import { Elysia, t } from "elysia";
import { db } from "../../../../lib/db";
import { authenticatedRoute } from "../../../../lib/route-plugins";
import { verifyTaskAssignment } from "../../../../lib/rbac/entity-authorization";
import { ApiError, Errors } from "../../../../lib/errors";
import { reviewStepDocuments } from "../../../../lib/workflow-engine/review-step-documents";
import type { ReviewStepDocumentsResult } from "../../../../lib/workflow-engine/review-step-documents";
import {
  logWorkflowEventTx,
  WorkflowEventType,
} from "../../../../services/workflow-event-logger";

/**
 * POST /api/workflows/steps/:stepId/documents/review
 * Batch review: approve/decline individual documents.
 *
 * Bug-fix (WFH-002): task verification, engine mutations, and event
 * logging all run inside the same transaction so a post-mutation error
 * rolls back atomically instead of committing partial state.
 */
export const reviewStepDocumentsRoute = new Elysia()
  .use(authenticatedRoute)
  .post(
    "/steps/:stepInstanceId/documents/review",
    async ({ params, body, user, correlationId: corrId, requestLogger }) => {
      if (!user?.id || !user?.tenantId) {
        throw Errors.unauthorized("Unauthorized");
      }

      const stepId = params.stepInstanceId;
      const { decisions } = body;

      try {
        const txResult = await db.transaction(async (tx) => {
          // Task verification INSIDE the transaction (eliminates TOCTOU gap)
          const taskCheck = await verifyTaskAssignment(
            user,
            stepId,
            ["validation"],
            tx
          );
          if (!taskCheck.allowed) {
            return { authorized: false as const };
          }

          const engineResult: ReviewStepDocumentsResult =
            await reviewStepDocuments(tx, {
              tenantId: user.tenantId,
              stepInstanceId: stepId,
              reviewedBy: user.id,
              taskId: taskCheck.taskId,
              decisions,
            });

          // Pre-mutation structured failure — no events to log
          if (!engineResult.success) {
            return { authorized: true as const, engineResult };
          }

          // ── Atomic event logging (same tx) ──────────────────────

          if (engineResult.outcome === "all_approved") {
            if (engineResult.allValidationsComplete) {
              await logWorkflowEventTx(tx, {
                tenantId: user.tenantId,
                processInstanceId: engineResult.processInstanceId,
                stepInstanceId: stepId,
                eventType: WorkflowEventType.DOCUMENT_APPROVED,
                eventDescription: `Validation approved - Step ${engineResult.stepName} Approved (${engineResult.approvedCount} document${engineResult.approvedCount > 1 ? "s" : ""})`,
                actorUserId: user.id,
                actorName: user.fullName,
                actorRole: user.role,
                correlationId: corrId,
              });

              if (engineResult.processCompleted) {
                await logWorkflowEventTx(tx, {
                  tenantId: user.tenantId,
                  processInstanceId: engineResult.processInstanceId,
                  eventType: WorkflowEventType.PROCESS_COMPLETED,
                  eventDescription: "Workflow completed",
                  actorUserId: user.id,
                  actorName: user.fullName,
                  actorRole: user.role,
                  correlationId: corrId,
                });
              } else if (
                engineResult.nextStepActivated &&
                engineResult.nextStepId
              ) {
                await logWorkflowEventTx(tx, {
                  tenantId: user.tenantId,
                  processInstanceId: engineResult.processInstanceId,
                  stepInstanceId: engineResult.nextStepId,
                  eventType: WorkflowEventType.STEP_ACTIVATED,
                  eventDescription: `Step - ${engineResult.nextStepName ?? "Unknown"} Active`,
                  actorUserId: user.id,
                  actorName: "Supplex",
                  actorRole: "system",
                  correlationId: corrId,
                });
              }
            } else {
              await logWorkflowEventTx(tx, {
                tenantId: user.tenantId,
                processInstanceId: engineResult.processInstanceId,
                stepInstanceId: stepId,
                eventType: WorkflowEventType.VALIDATION_APPROVED,
                eventDescription: `Validation approved - ${engineResult.remainingApprovals} more approval${engineResult.remainingApprovals > 1 ? "s" : ""} required for this step`,
                actorUserId: user.id,
                actorName: user.fullName,
                actorRole: user.role,
                correlationId: corrId,
              });
            }
          } else if (engineResult.outcome === "declined") {
            await logWorkflowEventTx(tx, {
              tenantId: user.tenantId,
              processInstanceId: engineResult.processInstanceId,
              stepInstanceId: stepId,
              eventType: WorkflowEventType.DOCUMENT_DECLINED,
              eventDescription: `Validation declined - Step ${engineResult.stepName} returned for revision (${engineResult.declinedCount} document${engineResult.declinedCount > 1 ? "s" : ""} declined)`,
              actorUserId: user.id,
              actorName: user.fullName,
              actorRole: user.role,
              metadata: {
                declinedDocuments: engineResult.declinedDocumentNames,
              },
              correlationId: corrId,
            });
          }

          return { authorized: true as const, engineResult };
        });

        // ── Map structured results to HTTP responses ───────────────

        if (!txResult.authorized) {
          throw Errors.forbidden("Not authorized to review this step");
        }

        const { engineResult } = txResult;

        if (!engineResult.success) {
          if (engineResult.conflict) {
            throw Errors.conflict(
              engineResult.error || "Step already processed"
            );
          }
          throw Errors.badRequest(
            engineResult.error || "Failed to review documents"
          );
        }

        if (engineResult.outcome === "all_approved") {
          return {
            success: true,
            data: {
              action: "all_approved",
              approvedCount: engineResult.approvedCount,
              stepCompleted: engineResult.allValidationsComplete,
              nextStepActivated: engineResult.allValidationsComplete
                ? engineResult.nextStepActivated
                : false,
              processCompleted: engineResult.allValidationsComplete
                ? engineResult.processCompleted
                : false,
              ...(engineResult.allValidationsComplete
                ? {}
                : { remainingApprovals: engineResult.remainingApprovals }),
            },
          };
        }

        return {
          success: true,
          data: {
            action: "declined",
            declinedCount: engineResult.declinedCount,
            approvedCount: engineResult.approvedCount,
          },
        };
      } catch (error) {
        if (error instanceof ApiError) throw error;
        // Post-mutation engine errors propagate here — tx already rolled back
        requestLogger?.error?.({ err: error }, "document review failed");
        throw Errors.internal("Failed to review documents");
      }
    },
    {
      params: t.Object({
        stepInstanceId: t.String({ format: "uuid" }),
      }),
      body: t.Object({
        decisions: t.Array(
          t.Object({
            requiredDocumentName: t.String(),
            action: t.Union([t.Literal("approve"), t.Literal("decline")]),
            comment: t.Optional(t.String()),
          })
        ),
      }),
    }
  );
