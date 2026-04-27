/**
 * Workflow Event Logger Service
 * Story: 2.2.12 - Immutable Audit Event Log
 *
 * Append-only event logging for workflow actions and template changes.
 * Uses its own DB reference (not injected) so it never extends a caller's transaction.
 * Fire-and-forget: errors are logged but never thrown to the caller.
 */

import {
  db,
  workflowEvent,
  type InsertWorkflowEvent,
  type DbOrTx,
} from "@supplex/db";
import { WorkflowEventType } from "@supplex/types";
import logger from "../lib/logger";

export { WorkflowEventType };

export interface WorkflowActor {
  userId: string;
  name: string;
  role: string;
}

export interface LogEventParams {
  tenantId: string;
  processInstanceId?: string | null;
  stepInstanceId?: string | null;
  taskInstanceId?: string | null;
  eventType: WorkflowEventType;
  eventDescription: string;
  actorUserId: string;
  actorName: string;
  actorRole: string;
  entityType?: string | null;
  entityId?: string | null;
  comment?: string | null;
  metadata?: Record<string, unknown>;
  correlationId?: string;
}

function buildEventRow(params: LogEventParams): InsertWorkflowEvent {
  return {
    tenantId: params.tenantId,
    processInstanceId: params.processInstanceId ?? null,
    stepInstanceId: params.stepInstanceId ?? null,
    taskInstanceId: params.taskInstanceId ?? null,
    eventType: params.eventType,
    eventDescription: params.eventDescription,
    actorUserId: params.actorUserId,
    actorName: params.actorName,
    actorRole: params.actorRole,
    entityType: params.entityType ?? null,
    entityId: params.entityId ?? null,
    comment: params.comment ?? null,
    metadata: {
      ...(params.metadata ?? {}),
      ...(params.correlationId ? { correlationId: params.correlationId } : {}),
    },
  };
}

/**
 * Insert a workflow event inside a caller-provided transaction.
 * Errors propagate so the wrapping transaction rolls back on failure.
 */
export async function logWorkflowEventTx(
  tx: DbOrTx,
  params: LogEventParams
): Promise<void> {
  await tx.insert(workflowEvent).values(buildEventRow(params));
}

/**
 * Fire-and-forget event logging on a standalone connection.
 * Use only for non-transactional contexts (template changes, admin actions).
 */
export async function logWorkflowEvent(params: LogEventParams): Promise<void> {
  try {
    await db.insert(workflowEvent).values(buildEventRow(params));
  } catch (error) {
    logger.error(
      { err: error, eventType: params.eventType },
      "failed to log workflow event"
    );
  }
}
