import {
  pgTable,
  uuid,
  timestamp,
  index,
  unique,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { tenants } from "./tenants";
import { formTemplate } from "./form-template";
import { users } from "./users";
import { processInstance } from "./process-instance";
import { stepInstance } from "./step-instance";

/**
 * Submission Status Enum
 * PostgreSQL ENUM type for database-level validation
 * Defines form submission lifecycle states
 */
export const submissionStatusEnum = pgEnum("submission_status", [
  "draft",
  "submitted",
  "archived",
]);

/**
 * Submission Status Constants
 * TypeScript constants for compile-time safety
 */
export const SubmissionStatus = {
  DRAFT: "draft",
  SUBMITTED: "submitted",
  ARCHIVED: "archived",
} as const;

export type SubmissionStatusType =
  (typeof SubmissionStatus)[keyof typeof SubmissionStatus];

/**
 * Form Submission Table
 * Runtime execution of a form template
 * Tracks submission status and links to workflow processes
 *
 * Tenant Isolation:
 * - All queries must filter by tenant_id
 * - CASCADE delete when tenant is removed
 *
 * Business Rules:
 * - Draft submissions are editable (AC: 2, 3)
 * - Submitted submissions are immutable (AC: 5)
 * - UNIQUE constraint on (form_template_id, step_instance_id) when step_instance_id IS NOT NULL
 *   Prevents duplicate submissions for same workflow step
 *   Allows multiple form steps per process (even using the same template)
 *
 * Indexes:
 * - (tenant_id, status, deleted_at) - for filtering user's submissions by status
 * - (process_instance_id, deleted_at) - for workflow integration
 * - (submitted_by, tenant_id, deleted_at) - for user's submission history
 * - (tenant_id, created_at, deleted_at) - for recent submissions list
 * - (tenant_id, form_template_id) - for template usage tracking
 */
export const formSubmission = pgTable(
  "form_submission",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    formTemplateId: uuid("form_template_id")
      .notNull()
      .references(() => formTemplate.id, { onDelete: "restrict" }),
    processInstanceId: uuid("process_instance_id"), // Nullable: for workflow integration (Story 2.2.9)
    stepInstanceId: uuid("step_instance_id").references(() => stepInstance.id, {
      onDelete: "cascade",
    }), // Nullable: links to specific workflow step, NULL for standalone forms
    submittedBy: uuid("submitted_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: submissionStatusEnum("status").notNull().default("draft"),
    submittedAt: timestamp("submitted_at", {
      withTimezone: true,
      mode: "date",
    }), // NULL for drafts, set on submit
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (table) => ({
    // UNIQUE constraint: Prevent duplicate submissions for same workflow step
    // NULLS NOT DISTINCT ensures standalone forms (NULL step_instance_id) can have multiple instances
    formSubmissionTemplateStepUnique: unique(
      "uq_form_submission_template_step"
    ).on(table.formTemplateId, table.stepInstanceId).nullsNotDistinct(),
    // Composite index on (tenant_id, status, deleted_at) for filtering by status
    tenantStatusIdx: index("idx_form_submission_tenant_status")
      .on(table.tenantId, table.status, table.deletedAt)
      .where(sql`${table.deletedAt} IS NULL`),
    // Index on (process_instance_id, deleted_at) for workflow integration
    processInstanceIdx: index("idx_form_submission_process_instance")
      .on(table.processInstanceId, table.deletedAt)
      .where(
        sql`${table.deletedAt} IS NULL AND ${table.processInstanceId} IS NOT NULL`
      ),
    // Index on (step_instance_id, deleted_at) for step-specific form lookups
    stepInstanceIdx: index("idx_form_submission_step_instance")
      .on(table.stepInstanceId, table.deletedAt)
      .where(
        sql`${table.deletedAt} IS NULL AND ${table.stepInstanceId} IS NOT NULL`
      ),
    // Index on (submitted_by, tenant_id, deleted_at) for user submission history
    submittedByIdx: index("idx_form_submission_submitted_by")
      .on(table.submittedBy, table.tenantId, table.deletedAt)
      .where(sql`${table.deletedAt} IS NULL`),
    // Index on (tenant_id, created_at, deleted_at) for recent submissions
    tenantCreatedIdx: index("idx_form_submission_tenant_created")
      .on(table.tenantId, table.createdAt, table.deletedAt)
      .where(sql`${table.deletedAt} IS NULL`),
    // Index on (tenant_id, form_template_id) for template usage tracking
    tenantTemplateIdx: index("idx_form_submission_tenant_template")
      .on(table.tenantId, table.formTemplateId)
      .where(sql`${table.deletedAt} IS NULL`),
  })
);

/**
 * Form Submission Relations
 * Defines relationships with other tables for type-safe joins
 */
export const formSubmissionRelations = relations(
  formSubmission,
  ({ one, many }) => ({
    tenant: one(tenants, {
      fields: [formSubmission.tenantId],
      references: [tenants.id],
    }),
    formTemplate: one(formTemplate, {
      fields: [formSubmission.formTemplateId],
      references: [formTemplate.id],
    }),
    submittedByUser: one(users, {
      fields: [formSubmission.submittedBy],
      references: [users.id],
    }),
    processInstance: one(processInstance, {
      fields: [formSubmission.processInstanceId],
      references: [processInstance.id],
    }),
    stepInstance: one(stepInstance, {
      fields: [formSubmission.stepInstanceId],
      references: [stepInstance.id],
    }),
    // answers relationship will be imported from form-answer.ts
  })
);

// Type for inserting/selecting form submissions
export type InsertFormSubmission = typeof formSubmission.$inferInsert;
export type SelectFormSubmission = typeof formSubmission.$inferSelect;

