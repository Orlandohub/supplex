/**
 * Workflow Engine Types
 * Domain-agnostic workflow execution engine types
 * Used by process_instance and step_instance tables
 */

/**
 * Process Type Enum
 * Defines the type of process being executed
 */
export enum ProcessType {
  SUPPLIER_QUALIFICATION = "supplier_qualification",
  SOURCING = "sourcing",
  PRODUCT_LIFECYCLE_MANAGEMENT = "product_lifecycle_management",
}

/**
 * Workflow Process Status — maps to the `workflow_process_status` PostgreSQL ENUM.
 * Only these values can appear in process_instance.status.
 */
export enum WorkflowProcessStatus {
  IN_PROGRESS = "in_progress",
  PENDING_VALIDATION = "pending_validation",
  DECLINED_RESUBMIT = "declined_resubmit",
  COMPLETE = "complete",
  CANCELLED = "cancelled",
}

/** Human-readable display labels for each status */
export const WORKFLOW_STATUS_DISPLAY: Record<string, string> = {
  [WorkflowProcessStatus.IN_PROGRESS]: "In Progress",
  [WorkflowProcessStatus.PENDING_VALIDATION]: "Pending Validation",
  [WorkflowProcessStatus.DECLINED_RESUBMIT]: "Declined - Re-Submit",
  [WorkflowProcessStatus.COMPLETE]: "Complete",
  [WorkflowProcessStatus.CANCELLED]: "Cancelled",
};

/**
 * Build a display string for a workflow status.
 * For non-terminal statuses, prepends the current step name.
 */
export function formatWorkflowStatus(
  status: string,
  stepName?: string | null
): string {
  const label = WORKFLOW_STATUS_DISPLAY[status] || status;
  if (status === WorkflowProcessStatus.COMPLETE || status === WorkflowProcessStatus.CANCELLED) {
    return label;
  }
  return stepName ? `${stepName} - ${label}` : label;
}

/**
 * Step Type Enum
 * Defines the type of step in a workflow
 */
export enum StepType {
  FORM = "form",
  APPROVAL = "approval",
  TASK = "task",
  DOCUMENT_UPLOAD = "document_upload",
}

/**
 * Step Status Enum
 * Represents the current state of a step instance
 */
export enum StepStatus {
  PENDING = "pending",
  ACTIVE = "active",
  COMPLETED = "completed",
  BLOCKED = "blocked",
  SKIPPED = "skipped",
}

/**
 * Process Instance Interface
 * Represents a single workflow execution instance
 */
export interface ProcessInstance {
  id: string;
  tenantId: string;
  processType: ProcessType;
  entityType: string;
  entityId: string;
  status: WorkflowProcessStatus;
  currentStepInstanceId: string | null;
  workflowTemplateId: string | null;
  initiatedBy: string;
  initiatedDate: Date;
  completedDate: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/**
 * Step Instance Interface
 * Represents a single step within a process execution
 */
export interface StepInstance {
  id: string;
  tenantId: string;
  processInstanceId: string;
  stepOrder: number;
  stepName: string;
  stepType: StepType;
  status: StepStatus;
  assignedTo: string | null;
  completedBy: string | null;
  completedDate: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

