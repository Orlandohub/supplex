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
