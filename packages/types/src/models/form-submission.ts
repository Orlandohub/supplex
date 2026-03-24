/**
 * Form Submission Types
 * Runtime execution of form templates with progressive save draft capability
 * Story: 2.2.4 - Form Runtime Execution with Save Draft
 */

import type { FormField, FormTemplate } from "./form-template";

/**
 * Submission Status Enum
 * Defines the lifecycle status of a form submission
 */
export enum SubmissionStatus {
  DRAFT = "draft",
  SUBMITTED = "submitted",
  ARCHIVED = "archived",
}

/**
 * Form Submission Interface
 * Runtime execution of a form template
 * Tracks submission status and links to workflow processes
 */
export interface FormSubmission {
  id: string;
  tenantId: string;
  formTemplateId: string;
  processInstanceId: string | null; // For workflow integration (Story 2.2.9)
  stepInstanceId: string | null; // Links to specific workflow step
  submittedBy: string; // User ID
  status: SubmissionStatus;
  submittedAt: Date | null; // NULL for drafts, set on submit
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/**
 * Form Answer Interface
 * Individual field answer for a form submission
 * All answers stored as text, parsed based on field_type at runtime
 */
export interface FormAnswer {
  id: string;
  formSubmissionId: string;
  formFieldId: string;
  tenantId: string;
  answerValue: string | null; // Stored as text, interpretation based on field_type
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Form Submission with Answers
 * Extended interface with nested answers array
 * Used when retrieving a submission for viewing/editing
 */
export interface FormSubmissionWithAnswers extends FormSubmission {
  answers: FormAnswer[];
  formTemplate?: FormTemplate; // Optional: for display metadata
  submittedByUser?: {
    id: string;
    fullName: string;
    email: string;
  };
}

/**
 * Form Answer with Field Metadata
 * Extended interface with field definition for rendering
 * Used when displaying form with pre-populated answers
 */
export interface FormAnswerWithField extends FormAnswer {
  field: FormField;
}

/**
 * Form Submission with Full Context
 * Extended interface with answers and field metadata
 * Used for form rendering with all necessary data
 */
export interface FormSubmissionWithFullContext extends FormSubmission {
  answers: FormAnswerWithField[];
  formTemplate: FormTemplate;
  submittedByUser: {
    id: string;
    fullName: string;
    email: string;
  };
}

/**
 * Create Draft Submission Request
 * Type for API request body when creating/updating draft
 */
export interface CreateDraftSubmissionRequest {
  formTemplateId: string;
  processInstanceId?: string | null;
  stepInstanceId?: string | null;
  answers: Array<{
    formFieldId: string;
    answerValue: string;
  }>;
}

/**
 * Submit Form Request
 * Type for API request body when submitting a form
 */
export interface SubmitFormRequest {
  submissionId: string;
}

/**
 * List Submissions Query Parameters
 * Type for API query params when listing submissions
 */
export interface ListSubmissionsQuery {
  status?: SubmissionStatus;
  processInstanceId?: string;
}

