import { pgTable, uuid, varchar, timestamp, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { qualificationWorkflows } from "./qualification-workflows";
import { documents } from "./documents";

/**
 * Checklist Item Status Enum Values
 * Represents the status of a document within a workflow checklist
 */
export const ChecklistItemStatus = {
  PENDING: "Pending",
  UPLOADED: "Uploaded",
  APPROVED: "Approved",
  REJECTED: "Rejected",
} as const;

export type ChecklistItemStatusType =
  (typeof ChecklistItemStatus)[keyof typeof ChecklistItemStatus];

/**
 * Workflow Documents Table
 * Links documents to qualification workflows and tracks checklist completion
 *
 * Status Flow:
 * - Pending: Document not yet uploaded
 * - Uploaded: Document uploaded, awaiting review
 * - Approved: Document approved by reviewer
 * - Rejected: Document rejected, needs replacement
 *
 * Indexes:
 * - (workflow_id, status) - for checklist progress tracking
 */
export const workflowDocuments = pgTable(
  "workflow_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workflowId: uuid("workflow_id")
      .notNull()
      .references(() => qualificationWorkflows.id, { onDelete: "cascade" }),
    checklistItemId: uuid("checklist_item_id"), // Reference to item in checklist template
    documentId: uuid("document_id").references(() => documents.id, {
      onDelete: "restrict",
    }),
    status: varchar("status", { length: 50 })
      .notNull()
      .default(ChecklistItemStatus.PENDING),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (table) => ({
    // Composite index on (workflow_id, status) for checklist progress tracking
    workflowStatusIdx: index("idx_workflow_documents_workflow_status").on(
      table.workflowId,
      table.status
    ),
  })
);

// Type for inserting/selecting workflow documents
export type InsertWorkflowDocument = typeof workflowDocuments.$inferInsert;
export type SelectWorkflowDocument = typeof workflowDocuments.$inferSelect;

// Relations
export const workflowDocumentsRelations = relations(
  workflowDocuments,
  ({ one }) => ({
    workflow: one(qualificationWorkflows, {
      fields: [workflowDocuments.workflowId],
      references: [qualificationWorkflows.id],
    }),
    document: one(documents, {
      fields: [workflowDocuments.documentId],
      references: [documents.id],
    }),
  })
);
