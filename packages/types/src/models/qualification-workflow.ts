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
 * Risk Level Enum
 * Represents risk assessment levels for workflow initiation
 */
export enum RiskLevel {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
}

/**
 * Risk Assessment Interface
 * Individual risk factors assessed during workflow initiation
 */
export interface RiskAssessment {
  geographic: RiskLevel;
  financial: RiskLevel;
  quality: RiskLevel;
  delivery: RiskLevel;
}

/**
 * Required Document Item
 * Structure for checklist items that will be snapshotted to workflow
 */
export interface RequiredDocumentItem {
  id?: string;
  name: string;
  description?: string;
  required: boolean;
  type?: string;
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
  checklistId: string;
  riskAssessment: RiskAssessment;
  notes?: string;
  snapshotedChecklist?: RequiredDocumentItem[];
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
