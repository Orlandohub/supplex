/**
 * Workflow Event Logger Service
 * Story: 2.2.12 - Immutable Audit Event Log
 *
 * Append-only event logging for workflow actions and template changes.
 * Uses its own DB reference (not injected) so it never extends a caller's transaction.
 * Fire-and-forget: errors are logged but never thrown to the caller.
 */

import { db, workflowEvent, type InsertWorkflowEvent } from "@supplex/db";
import { WorkflowEventType } from "@supplex/types";

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
  metadata?: Record<string, any>;
}

export async function logWorkflowEvent(params: LogEventParams): Promise<void> {
  try {
    const row: InsertWorkflowEvent = {
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
      metadata: params.metadata ?? {},
    };

    await db.insert(workflowEvent).values(row);
  } catch (error) {
    console.error(
      "[workflow-event-logger] Failed to log event:",
      params.eventType,
      error instanceof Error ? error.message : error
    );
  }
}
