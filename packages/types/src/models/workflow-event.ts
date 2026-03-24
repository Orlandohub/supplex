/**
 * Workflow Event Types
 * Story: 2.2.12 - Immutable Audit Event Log
 *
 * Types for the append-only workflow event log used for
 * workflow history display and tenant-wide audit trail.
 */

export enum WorkflowEventType {
  // Template lifecycle
  TEMPLATE_CREATED = "template_created",
  TEMPLATE_UPDATED = "template_updated",
  TEMPLATE_PUBLISHED = "template_published",
  TEMPLATE_COPIED = "template_copied",

  // Process lifecycle
  PROCESS_INSTANTIATED = "process_instantiated",
  PROCESS_COMPLETED = "process_completed",
  PROCESS_CANCELLED = "process_cancelled",

  // Step lifecycle
  STEP_ACTIVATED = "step_activated",
  STEP_COMPLETED = "step_completed",
  STEP_VALIDATED = "step_validated",
  STEP_DECLINED = "step_declined",
  STEP_RETURNED = "step_returned",

  // Task lifecycle
  TASK_CREATED = "task_created",
  TASK_COMPLETED = "task_completed",
  TASK_AUTO_CLOSED = "task_auto_closed",

  // Form events
  FORM_SUBMITTED = "form_submitted",
  FORM_RESUBMITTED = "form_resubmitted",

  // Document events
  DOCUMENT_UPLOADED = "document_uploaded",
  DOCUMENT_APPROVED = "document_approved",
  DOCUMENT_DECLINED = "document_declined",

  // Validation events
  VALIDATION_TASK_CREATED = "validation_task_created",
  VALIDATION_APPROVED = "validation_approved",
  VALIDATION_DECLINED = "validation_declined",

  // Supplier status
  SUPPLIER_STATUS_CHANGED = "supplier_status_changed",
}

export interface WorkflowEvent {
  id: string;
  tenantId: string;
  processInstanceId: string | null;
  stepInstanceId: string | null;
  taskInstanceId: string | null;
  eventType: string;
  eventDescription: string;
  actorUserId: string;
  actorName: string;
  actorRole: string;
  entityType: string | null;
  entityId: string | null;
  comment: string | null;
  metadata: Record<string, any>;
  createdAt: string;
}

export type WorkflowEventFilterType =
  | "all"
  | "process"
  | "steps"
  | "tasks"
  | "forms"
  | "documents"
  | "validation"
  | "templates";

export interface WorkflowEventsResponse {
  events: WorkflowEvent[];
  total: number;
}
