/**
 * Document Template Types
 * Reusable document checklist templates for workflow steps
 */

/**
 * Document Template Status Enum
 * Defines the lifecycle status of a document template
 */
export enum DocumentTemplateStatus {
  DRAFT = "draft",
  PUBLISHED = "published",
  ARCHIVED = "archived",
}

/**
 * Required Document Type Enum
 * Categorizes required document types for organization
 */
export enum RequiredDocumentType {
  CERTIFICATION = "certification",
  TAX = "tax",
  FINANCIAL = "financial",
  LEGAL = "legal",
  OTHER = "other",
}

/**
 * Required Document Item Interface
 * Individual document requirement within a template
 */
export interface RequiredDocumentItem {
  name: string;
  description: string;
  required: boolean;
  type: RequiredDocumentType | string;
}

/**
 * Document Template Interface
 * Reusable document checklist template
 */
export interface DocumentTemplate {
  id: string;
  tenantId: string;
  templateName: string;
  requiredDocuments: RequiredDocumentItem[];
  isDefault: boolean;
  status: DocumentTemplateStatus | string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/**
 * Document Template Create Input
 * Data required to create a new document template
 */
export interface DocumentTemplateCreateInput {
  templateName: string;
  requiredDocuments: RequiredDocumentItem[];
  isDefault: boolean;
  status?: DocumentTemplateStatus | string;
}

/**
 * Document Template Update Input
 * Data allowed for updating an existing document template
 */
export interface DocumentTemplateUpdateInput {
  templateName?: string;
  requiredDocuments?: RequiredDocumentItem[];
  isDefault?: boolean;
  status?: DocumentTemplateStatus | string;
}

/**
 * Document Template List Item
 * Simplified view for dropdown lists
 */
export interface DocumentTemplateListItem {
  id: string;
  label: string;
}

