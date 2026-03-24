/**
 * Supplex Database Schema and Migrations
 * Using Drizzle ORM with PostgreSQL (Supabase)
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Database Connection
 * Uses connection pooling via Supabase
 * Requires DATABASE_URL environment variable
 */
const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://placeholder:placeholder@localhost:5432/placeholder";

// Only validate in production
if (process.env.NODE_ENV === "production" && !process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL environment variable is not set. Please configure it in apps/api/.env"
  );
}

// Create postgres connection client
const client = postgres(connectionString, {
  max: 20, // Maximum connections in pool
  idle_timeout: 60, // Close idle connections after 60 seconds
  connect_timeout: 10, // Connection timeout in seconds
});

// Create Drizzle instance with schema
export const db = drizzle(client, { schema });

/**
 * Export all schemas for use in queries
 */
export { schema };

/**
 * Export individual tables for convenience
 */
export { tenants } from "./schema/tenants";
export { users } from "./schema/users";
export { suppliers } from "./schema/suppliers";
export { contacts } from "./schema/contacts";
export { documents } from "./schema/documents";
export { auditLogs } from "./schema/audit-logs";
// Legacy qualification system removed - Migration 0017
// export { qualificationTemplates } from "./schema/qualification-templates";
// export { qualificationProcess, WorkflowStatus } from "./schema/qualification-process";
// export { qualificationStages, StageStatus } from "./schema/qualification-stages";
// export { workflowDocuments, ChecklistItemStatus } from "./schema/workflow-documents";
export {
  emailNotifications,
  EmailNotificationStatus,
} from "./schema/email-notifications";
export { userNotificationPreferences } from "./schema/user-notification-preferences";
// export { workflowEvents, WorkflowEventType } from "./schema/workflow-events"; // Legacy - removed
export { userInvitations } from "./schema/user-invitations";
export {
  processInstance,
  ProcessType,
  ProcessStatus,
} from "./schema/process-instance";
export { stepInstance, StepType, StepStatus } from "./schema/step-instance";
export {
  formTemplate,
  formTemplateStatusEnum,
  FormTemplateStatus,
} from "./schema/form-template";
// export { formTemplateVersion } from "./schema/form-template-version"; // REMOVED - Story 2.2.14
export { formSection } from "./schema/form-section";
export { formField, fieldTypeEnum, FieldType } from "./schema/form-field";
export {
  formSubmission,
  submissionStatusEnum,
  SubmissionStatus,
} from "./schema/form-submission";
export { formAnswer } from "./schema/form-answer";
// export { taskTemplate, TaskTemplateStatus } from "./schema/task-template"; // DEPRECATED - Story 2.2.5.1
export {
  taskInstance,
  TaskInstanceStatus,
  TaskAssigneeType,
} from "./schema/task-instance";
export {
  workflowTemplate,
} from "./schema/workflow-template";
// export { workflowTemplateVersion } from "./schema/workflow-template-version"; // REMOVED - Story 2.2.14
export {
  workflowStepTemplate,
  stepTypeEnum,
  formActionModeEnum,
  documentActionModeEnum,
  assigneeTypeEnum,
} from "./schema/workflow-step-template";
export {
  stepApprover,
  approverTypeEnum,
} from "./schema/step-approver";
export { documentTemplate } from "./schema/document-template";
export { commentThread } from "./schema/comment-thread";
export { workflowStepDocument } from "./schema/workflow-step-document";
export { supplierStatus } from "./schema/supplier-status";
export { workflowStatus } from "./schema/workflow-status";
export { workflowType } from "./schema/workflow-type";
export { workflowEvent } from "./schema/workflow-event";

/**
 * Export types for TypeScript
 */
export type { InsertTenant, SelectTenant } from "./schema/tenants";
export type { InsertUser, SelectUser } from "./schema/users";
export type { InsertSupplier, SelectSupplier } from "./schema/suppliers";
export type { InsertContact, SelectContact } from "./schema/contacts";
export type { InsertDocument, SelectDocument } from "./schema/documents";
export type { InsertAuditLog, SelectAuditLog } from "./schema/audit-logs";
// Legacy qualification system type exports removed - Migration 0017
// export type { InsertQualificationTemplate, SelectQualificationTemplate } from "./schema/qualification-templates";
// export type { InsertQualificationProcess, SelectQualificationProcess } from "./schema/qualification-process";
// export type { InsertQualificationStage, SelectQualificationStage } from "./schema/qualification-stages";
// export type { InsertWorkflowDocument, SelectWorkflowDocument } from "./schema/workflow-documents";
export type {
  InsertEmailNotification,
  SelectEmailNotification,
} from "./schema/email-notifications";
export type {
  InsertUserNotificationPreference,
  SelectUserNotificationPreference,
} from "./schema/user-notification-preferences";
export type {
  InsertWorkflowEvent,
  SelectWorkflowEvent,
} from "./schema/workflow-event";
export type {
  InsertUserInvitation,
  SelectUserInvitation,
} from "./schema/user-invitations";
export type {
  InsertProcessInstance,
  SelectProcessInstance,
} from "./schema/process-instance";
export type {
  InsertStepInstance,
  SelectStepInstance,
} from "./schema/step-instance";
export type {
  InsertFormTemplate,
  SelectFormTemplate,
} from "./schema/form-template";
// export type {
//   InsertFormTemplateVersion,
//   SelectFormTemplateVersion,
// } from "./schema/form-template-version"; // REMOVED - Story 2.2.14
export type {
  InsertFormSection,
  SelectFormSection,
} from "./schema/form-section";
export type {
  InsertFormField,
  SelectFormField,
} from "./schema/form-field";
export type {
  InsertFormSubmission,
  SelectFormSubmission,
} from "./schema/form-submission";
export type {
  InsertFormAnswer,
  SelectFormAnswer,
} from "./schema/form-answer";
// export type { InsertTaskTemplate, SelectTaskTemplate } from "./schema/task-template"; // DEPRECATED - Story 2.2.5.1
export type {
  InsertTaskInstance,
  SelectTaskInstance,
} from "./schema/task-instance";
export type {
  InsertWorkflowTemplate,
  SelectWorkflowTemplate,
} from "./schema/workflow-template";
// export type {
//   InsertWorkflowTemplateVersion,
//   SelectWorkflowTemplateVersion,
// } from "./schema/workflow-template-version"; // REMOVED - Story 2.2.14
export type {
  InsertWorkflowStepTemplate,
  SelectWorkflowStepTemplate,
} from "./schema/workflow-step-template";
export type {
  InsertStepApprover,
  SelectStepApprover,
} from "./schema/step-approver";
export type {
  InsertDocumentTemplate,
  SelectDocumentTemplate,
} from "./schema/document-template";
export type {
  InsertCommentThread,
  SelectCommentThread,
} from "./schema/comment-thread";
export type {
  InsertWorkflowStepDocument,
  SelectWorkflowStepDocument,
} from "./schema/workflow-step-document";

/**
 * Export tenant context helpers
 */
export * from "./helpers/tenant-context";
