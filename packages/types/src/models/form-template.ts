/**
 * Form Template Types
 * Dynamic form template data model types for tenant-isolated forms
 * Templates can be copied to create new drafts for editing
 */

/**
 * Form Template Status Enum
 * Defines the lifecycle status of a form template
 */
export enum FormTemplateStatus {
  DRAFT = "draft",
  PUBLISHED = "published",
  ARCHIVED = "archived",
}

/**
 * Field Type Enum
 * Defines supported form field input types
 */
export enum FieldType {
  TEXT = "text",
  TEXTAREA = "textarea",
  NUMBER = "number",
  DATE = "date",
  DROPDOWN = "dropdown",
  CHECKBOX = "checkbox",
  MULTI_SELECT = "multi_select",
}

/**
 * Validation Rules Interface
 * Flexible validation patterns for form fields
 */
export interface ValidationRules {
  minLength?: number;
  maxLength?: number;
  pattern?: string; // Regex pattern
  min?: number; // For number fields
  max?: number; // For number fields
  customMessage?: string;
}

/**
 * Field Options Interface
 * Options for dropdown and multi_select fields
 */
export interface FieldOptions {
  choices: Array<{
    value: string;
    label: string;
  }>;
}

/**
 * Form Template Interface
 * Direct template definition without versioning
 */
export interface FormTemplate {
  id: string;
  tenantId: string;
  name: string;
  status: FormTemplateStatus;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/**
 * Form Section Interface
 * Sections within a form template
 */
export interface FormSection {
  id: string;
  formTemplateId: string;
  tenantId: string;
  sectionOrder: number;
  title: string;
  description: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/**
 * Form Field Interface
 * Individual fields within a form section
 */
export interface FormField {
  id: string;
  formSectionId: string;
  tenantId: string;
  fieldOrder: number;
  fieldType: FieldType;
  label: string;
  placeholder: string | null;
  required: boolean;
  validationRules: ValidationRules;
  options: FieldOptions | Record<string, never>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/**
 * Form Template with Structure
 * Extended interface with full form structure
 */
export interface FormTemplateWithStructure extends FormTemplate {
  sections: FormSectionWithFields[];
}

/**
 * Form Section with Fields
 * Extended interface with nested fields
 */
export interface FormSectionWithFields extends FormSection {
  fields: FormField[];
}

