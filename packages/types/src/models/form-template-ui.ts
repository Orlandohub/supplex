/**
 * Form Template UI Types
 *
 * TypeScript types for form template management UI
 * These types extend the core form template types with UI-specific fields
 *
 * Updated: Story 2.2.23 — Removed legacy "version" naming
 */

import { FormTemplateStatus, FieldType } from "./form-template";

/**
 * Form Template List Item
 * Type for displaying templates in list/table view
 */
export interface FormTemplateListItem {
  id: string;
  name: string;
  status: FormTemplateStatus;
  templateCount: number;
  latestTemplate: {
    id: string;
    version: number;
    status: string;
    isPublished: boolean;
  } | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * Form Field with Details
 * Extended field interface with all details for UI
 */
export interface FormFieldWithDetails {
  id: string;
  formSectionId: string;
  label: string;
  fieldType: FieldType;
  required: boolean;
  validationRules: Record<string, any>;
  options: Record<string, any>;
  fieldOrder: number;
  placeholder: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * Form Section with Fields
 * Extended section interface with nested fields
 */
export interface FormSectionWithFields {
  id: string;
  formTemplateId: string;
  title: string;
  description: string | null;
  sectionOrder: number;
  metadata: Record<string, any>;
  createdAt: Date | string;
  updatedAt: Date | string;
  fields: FormFieldWithDetails[];
}

/**
 * Form Template with Structure
 * Extended template interface with nested sections and fields
 */
export interface FormTemplateWithStructure {
  id: string;
  formTemplateId: string;
  version: number;
  status: string;
  isPublished: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  sections: FormSectionWithFields[];
}

/**
 * Form Template with Details
 * Complete template structure for edit page
 */
export interface FormTemplateWithDetails {
  id: string;
  tenantId: string;
  name: string;
  status: FormTemplateStatus;
  createdAt: Date | string;
  updatedAt: Date | string;
  templates: FormTemplateWithStructure[];
}

/**
 * Create Template Request
 * Request body for creating a new template
 */
export interface CreateTemplateRequest {
  name: string;
}

/**
 * Update Template Request
 * Request body for updating a template
 */
export interface UpdateTemplateRequest {
  name?: string;
  status?: FormTemplateStatus;
}

/**
 * Create Section Request
 * Request body for creating a new section
 */
export interface CreateSectionRequest {
  title: string;
  description?: string;
  sectionOrder: number;
}

/**
 * Update Section Request
 * Request body for updating a section
 */
export interface UpdateSectionRequest {
  title?: string;
  description?: string;
  sectionOrder?: number;
}

/**
 * Create Field Request
 * Request body for creating a new field
 */
export interface CreateFieldRequest {
  label: string;
  fieldType: FieldType;
  required?: boolean;
  validationRules?: Record<string, any>;
  options?: Record<string, any>;
  fieldOrder: number;
  placeholder?: string;
}

/**
 * Update Field Request
 * Request body for updating a field
 */
export interface UpdateFieldRequest {
  label?: string;
  fieldType?: FieldType;
  required?: boolean;
  validationRules?: Record<string, any>;
  options?: Record<string, any>;
  fieldOrder?: number;
  placeholder?: string;
}

/**
 * Reorder Request
 * Request body for reordering sections or fields
 */
export interface ReorderRequest {
  sectionIds?: string[];
  fieldIds?: string[];
}

/* ---------- Deprecated aliases (Story 2.2.23) ---------- */

/** @deprecated Use FormTemplateWithStructure */
export type FormTemplateVersionWithStructure = FormTemplateWithStructure;
