import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { tenants } from "./tenants";
import { formSubmission } from "./form-submission";
import { formField } from "./form-field";

/**
 * Form Answer Table
 * Individual field answers for a form submission
 * All answers stored as TEXT, parsed based on field_type at runtime
 *
 * Tenant Isolation:
 * - All queries must filter by tenant_id
 * - CASCADE delete when tenant or form_submission is removed
 *
 * Answer Format by field_type:
 * - text/textarea: plain text
 * - number: numeric string (e.g., "42.5")
 * - date: ISO date string (e.g., "2026-01-22")
 * - dropdown: selected value string (e.g., "iso9001")
 * - checkbox: "true" or "false"
 * - multi_select: comma-separated values (e.g., "rohs,reach,ce")
 *
 * Business Rules:
 * - UNIQUE constraint on (form_submission_id, form_field_id) - one answer per field per submission
 * - Answers are upserted when saving drafts (insert if new, update if exists)
 * - Tenant isolation: answer.tenant_id MUST match submission.tenant_id and field.tenant_id
 *
 * Indexes:
 * - (tenant_id, form_submission_id, form_field_id) - for fast retrieval of submission answers
 */
export const formAnswer = pgTable(
  "form_answer",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    formSubmissionId: uuid("form_submission_id")
      .notNull()
      .references(() => formSubmission.id, { onDelete: "cascade" }),
    formFieldId: uuid("form_field_id")
      .notNull()
      .references(() => formField.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    answerValue: text("answer_value"), // Stored as text, interpretation based on field_type
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    // UNIQUE constraint: One answer per field per submission (enables upsert pattern)
    formAnswerSubmissionFieldUnique: unique(
      "uq_form_answer_submission_field"
    ).on(table.formSubmissionId, table.formFieldId),
    // Composite index on (tenant_id, form_submission_id, form_field_id) for fast retrieval
    tenantSubmissionFieldIdx: index(
      "idx_form_answer_tenant_submission_field"
    ).on(table.tenantId, table.formSubmissionId, table.formFieldId),
  })
);

/**
 * Form Answer Relations
 * Defines relationships with other tables for type-safe joins
 */
export const formAnswerRelations = relations(formAnswer, ({ one }) => ({
  formSubmission: one(formSubmission, {
    fields: [formAnswer.formSubmissionId],
    references: [formSubmission.id],
  }),
  formField: one(formField, {
    fields: [formAnswer.formFieldId],
    references: [formField.id],
  }),
  tenant: one(tenants, {
    fields: [formAnswer.tenantId],
    references: [tenants.id],
  }),
}));

// Add answers relationship to formSubmissionRelations
// This is done by importing and extending the relations
export const formSubmissionRelationsUpdate = relations(
  formSubmission,
  ({ one, many }) => ({
    answers: many(formAnswer),
  })
);

// Type for inserting/selecting form answers
export type InsertFormAnswer = typeof formAnswer.$inferInsert;
export type SelectFormAnswer = typeof formAnswer.$inferSelect;

