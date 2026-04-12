import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { tenants } from "./tenants";
import { workflowStepDocument } from "./workflow-step-document";
import { stepInstance } from "./step-instance";
import { taskInstance } from "./task-instance";
import { users } from "./users";

/**
 * Document Review Decision Table
 * Tracks individual reviewer decisions per document per validation task.
 * Supports multi-approver workflows where each reviewer independently
 * approves/declines each document.
 *
 * The aggregate document status lives on workflowStepDocument.status.
 * This table holds the per-reviewer detail.
 */
export const documentReviewDecision = pgTable(
  "document_review_decision",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    workflowStepDocumentId: uuid("workflow_step_document_id")
      .notNull()
      .references(() => workflowStepDocument.id, { onDelete: "cascade" }),
    stepInstanceId: uuid("step_instance_id")
      .notNull()
      .references(() => stepInstance.id, { onDelete: "cascade" }),
    taskInstanceId: uuid("task_instance_id")
      .notNull()
      .references(() => taskInstance.id, { onDelete: "cascade" }),
    reviewerUserId: uuid("reviewer_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    validationRound: integer("validation_round").notNull(),
    decision: varchar("decision", { length: 20 }).notNull(),
    comment: text("comment"),
    decidedAt: timestamp("decided_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    stepRoundIdx: index("idx_drd_step_round").on(
      table.stepInstanceId,
      table.validationRound
    ),
    taskIdx: index("idx_drd_task").on(table.taskInstanceId),
    docTaskUniqueIdx: uniqueIndex("idx_drd_doc_task_unique").on(
      table.workflowStepDocumentId,
      table.taskInstanceId
    ),
  })
);

export const documentReviewDecisionRelations = relations(
  documentReviewDecision,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [documentReviewDecision.tenantId],
      references: [tenants.id],
    }),
    workflowStepDocument: one(workflowStepDocument, {
      fields: [documentReviewDecision.workflowStepDocumentId],
      references: [workflowStepDocument.id],
    }),
    stepInstance: one(stepInstance, {
      fields: [documentReviewDecision.stepInstanceId],
      references: [stepInstance.id],
    }),
    taskInstance: one(taskInstance, {
      fields: [documentReviewDecision.taskInstanceId],
      references: [taskInstance.id],
    }),
    reviewer: one(users, {
      fields: [documentReviewDecision.reviewerUserId],
      references: [users.id],
    }),
  })
);

export type InsertDocumentReviewDecision =
  typeof documentReviewDecision.$inferInsert;
export type SelectDocumentReviewDecision =
  typeof documentReviewDecision.$inferSelect;
