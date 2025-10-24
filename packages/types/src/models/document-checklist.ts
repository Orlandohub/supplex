/**
 * Document Checklist Types
 * Shared types for qualification document checklist templates
 */

/**
 * Required Document Type Enum
 * Categories of documents required for qualification
 */
export enum RequiredDocumentType {
  CERTIFICATION = "certification",
  TAX = "tax",
  INSURANCE = "insurance",
  FINANCIAL = "financial",
  QUALITY = "quality",
  LEGAL = "legal",
  REFERENCE = "reference",
  OTHER = "other",
}

/**
 * Required Document Item Interface
 * Individual document requirement within a checklist template
 */
export interface RequiredDocumentItem {
  name: string;
  description: string;
  required: boolean;
  type: RequiredDocumentType | string; // Allow string for flexibility
}

/**
 * Document Checklist Interface
 * Template defining required documents for supplier qualification
 */
export interface DocumentChecklist {
  id: string;
  tenantId: string;
  templateName: string;
  requiredDocuments: RequiredDocumentItem[];
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/**
 * Create Document Checklist DTO
 * Data required to create a new checklist template
 */
export interface CreateDocumentChecklistDto {
  templateName: string;
  requiredDocuments: RequiredDocumentItem[];
  isDefault?: boolean;
}

/**
 * Update Document Checklist DTO
 * Data for updating an existing checklist template
 */
export interface UpdateDocumentChecklistDto {
  templateName?: string;
  requiredDocuments?: RequiredDocumentItem[];
  isDefault?: boolean;
}
