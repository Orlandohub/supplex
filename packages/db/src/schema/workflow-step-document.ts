import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { tenants } from "./tenants";
import { processInstance } from "./process-instance";
import { stepInstance } from "./step-instance";
import { documents } from "./documents";
import { users } from "./users";

/**
 * Workflow Step Document Table
 * Links uploaded files to workflow step instances with per-document review status.
 *
 * One row is seeded per required document when a document step activates.
 * Status lifecycle: pending → uploaded → approved | declined → (if declined) pending → ...
 */
export const workflowStepDocument = pgTable(
  "workflow_step_document",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    processInstanceId: uuid("process_instance_id")
      .notNull()
      .references(() => processInstance.id, { onDelete: "cascade" }),
    stepInstanceId: uuid("step_instance_id")
      .notNull()
      .references(() => stepInstance.id, { onDelete: "cascade" }),
    requiredDocumentName: varchar("required_document_name", {
      length: 255,
    }).notNull(),
    documentId: uuid("document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    status: varchar("status", { length: 50 }).notNull().default("pending"),
    declineComment: text("decline_comment"),
    reviewedBy: uuid("reviewed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    expiryDate: timestamp("expiry_date", { withTimezone: true, mode: "date" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (table) => ({
    stepInstanceIdx: index("idx_wsd_step_instance").on(table.stepInstanceId),
    tenantProcessIdx: index("idx_wsd_tenant_process").on(
      table.tenantId,
      table.processInstanceId
    ),
    stepDocNameIdx: uniqueIndex("idx_wsd_step_doc_name")
      .on(table.stepInstanceId, table.requiredDocumentName)
      .where(sql`${table.deletedAt} IS NULL`),
  })
);

export const workflowStepDocumentRelations = relations(
  workflowStepDocument,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [workflowStepDocument.tenantId],
      references: [tenants.id],
    }),
    processInstance: one(processInstance, {
      fields: [workflowStepDocument.processInstanceId],
      references: [processInstance.id],
    }),
    stepInstance: one(stepInstance, {
      fields: [workflowStepDocument.stepInstanceId],
      references: [stepInstance.id],
    }),
    document: one(documents, {
      fields: [workflowStepDocument.documentId],
      references: [documents.id],
    }),
    reviewer: one(users, {
      fields: [workflowStepDocument.reviewedBy],
      references: [users.id],
    }),
  })
);

export type InsertWorkflowStepDocument =
  typeof workflowStepDocument.$inferInsert;
export type SelectWorkflowStepDocument =
  typeof workflowStepDocument.$inferSelect;
