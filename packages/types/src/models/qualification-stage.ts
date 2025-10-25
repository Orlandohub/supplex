/**
 * Qualification Stage Types
 * Shared types for individual workflow approval stages
 */

/**
 * Stage Status Enum
 * Represents the approval status of a single qualification stage
 */
export enum StageStatus {
  PENDING = "Pending",
  APPROVED = "Approved",
  REJECTED = "Rejected",
}

/**
 * Stage Attachment Interface
 * Structure for file attachments within a stage
 */
export interface StageAttachment {
  id: string;
  filename: string;
  url: string;
  uploadedAt: Date;
  uploadedBy: string;
}

/**
 * Qualification Stage Interface
 * Individual approval stage within a qualification workflow
 */
export interface QualificationStage {
  id: string;
  workflowId: string;
  stageNumber: number;
  stageName: string;
  assignedTo: string;
  status: StageStatus;
  reviewedBy: string | null;
  reviewedDate: Date | null;
  comments: string | null;
  attachments: StageAttachment[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/**
 * Create Qualification Stage DTO
 * Data required to create a new workflow stage
 */
export interface CreateQualificationStageDto {
  workflowId: string;
  stageNumber: number;
  stageName: string;
  assignedTo: string;
}

/**
 * Update Qualification Stage DTO
 * Data for updating stage status and review information
 */
export interface UpdateQualificationStageDto {
  status?: StageStatus;
  reviewedBy?: string;
  reviewedDate?: Date;
  comments?: string;
  attachments?: StageAttachment[];
}

/**
 * Review Decision DTO
 * Data required to approve or reject a workflow stage
 */
export interface ReviewDecisionDto {
  workflowId: string;
  stageId: string;
  decision: "Approved" | "Rejected";
  comments: string; // Required if Rejected
}

/**
 * Stage With Reviewer Interface
 * Extends QualificationStage to include reviewer user details
 */
export interface StageWithReviewer extends QualificationStage {
  reviewer?: {
    id: string;
    fullName: string;
    email: string;
    role: string;
  } | null;
}

/**
 * Quality Checklist Item Interface
 * Quality-specific checklist for Stage 2 review
 * Stored in qualification_stages.attachments JSONB field
 */
export interface QualityChecklistItem {
  qualityManualReviewed: boolean;
  qualityCertificationsVerified: boolean;
  qualityAuditFindings: string;
}

/**
 * Stage History Summary Interface
 * Summary of a single stage's completion for history view
 */
export interface StageHistorySummary {
  stageNumber: number;
  stageName: string;
  reviewerName: string | null;
  reviewedDate: Date | null;
  decision: string;
  comments: string | null;
}

/**
 * Workflow History DTO
 * Complete workflow history with all stages and metadata
 */
export interface WorkflowHistoryDto {
  workflowId: string;
  supplierId: string;
  supplierName: string;
  status: string;
  riskScore: number | null;
  documentCompletionPercent: number;
  stages: StageHistorySummary[];
  createdAt: Date;
  updatedAt: Date;
}
