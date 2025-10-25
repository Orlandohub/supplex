/**
 * Workflow Document Types
 * Shared types for documents linked to qualification workflows
 */

/**
 * Checklist Item Status Enum
 * Represents the status of a document within a workflow checklist
 */
export enum ChecklistItemStatus {
  PENDING = "Pending",
  UPLOADED = "Uploaded",
  APPROVED = "Approved",
  REJECTED = "Rejected",
}

/**
 * Workflow Document Interface
 * Links documents to qualification workflows and tracks checklist completion
 */
export interface WorkflowDocument {
  id: string;
  workflowId: string;
  checklistItemId: string | null;
  documentId: string | null;
  status: ChecklistItemStatus;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/**
 * Create Workflow Document DTO
 * Data required to link a document to a workflow
 */
export interface CreateWorkflowDocumentDto {
  workflowId: string;
  checklistItemId?: string;
  documentId?: string;
  status?: ChecklistItemStatus;
}

/**
 * Update Workflow Document DTO
 * Data for updating workflow document status
 */
export interface UpdateWorkflowDocumentDto {
  documentId?: string;
  status?: ChecklistItemStatus;
}

/**
 * Workflow Document with Details
 * Extended workflow document with full document metadata and uploader info
 */
export interface WorkflowDocumentWithDetails extends WorkflowDocument {
  document?: {
    id: string;
    filename: string;
    documentType: string;
    storagePath: string;
    fileSize: number;
    mimeType: string;
    description: string | null;
    expiryDate: Date | null;
    uploadedBy: string;
    uploadedByName: string; // User full name
    createdAt: Date;
    updatedAt: Date;
  } | null;
}
