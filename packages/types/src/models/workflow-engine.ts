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
 * Process Status Enum
 * Represents the current state of a process instance
 */
export enum ProcessStatus {
  ACTIVE = "active",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
  BLOCKED = "blocked",
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
  status: ProcessStatus;
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

