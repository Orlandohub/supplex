/**
 * Qualification Workflow Types
 * Shared types for supplier qualification workflow entities
 */

/**
 * Workflow Status Enum
 * Represents the current state of a supplier qualification workflow
 */
export enum WorkflowStatus {
  DRAFT = "Draft",
  STAGE1 = "Stage1",
  STAGE2 = "Stage2",
  STAGE3 = "Stage3",
  APPROVED = "Approved",
  REJECTED = "Rejected",
}

/**
 * Qualification Workflow Interface
 * Core data structure for tracking supplier qualification processes
 */
export interface QualificationWorkflow {
  id: string;
  tenantId: string;
  supplierId: string;
  status: WorkflowStatus;
  initiatedBy: string;
  initiatedDate: Date;
  currentStage: number | null;
  riskScore: string | null; // numeric stored as string
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/**
 * Create Qualification Workflow DTO
 * Data required to initiate a new qualification workflow
 */
export interface CreateQualificationWorkflowDto {
  supplierId: string;
  status?: WorkflowStatus;
  currentStage?: number;
  riskScore?: number;
}

/**
 * Update Qualification Workflow DTO
 * Data for updating an existing qualification workflow
 */
export interface UpdateQualificationWorkflowDto {
  status?: WorkflowStatus;
  currentStage?: number;
  riskScore?: number;
}
