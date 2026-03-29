import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  integer,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { processInstance } from "./process-instance";
import { tenants } from "./tenants";
import { users } from "./users";
import { workflowStepTemplate } from "./workflow-step-template";

/**
 * Step Type Enum Values
 * Defines the type of step in a workflow
 */
export const StepType = {
  FORM: "form",
  APPROVAL: "approval",
  TASK: "task",
  DOCUMENT_UPLOAD: "document_upload",
} as const;

export type StepTypeType = (typeof StepType)[keyof typeof StepType];

/**
 * Step Status Enum Values
 * Represents the current state of a step instance
 */
export const StepStatus = {
  PENDING: "pending",
  ACTIVE: "active",
  COMPLETED: "completed",
  BLOCKED: "blocked",
  SKIPPED: "skipped",
} as const;

export type StepStatusType = (typeof StepStatus)[keyof typeof StepStatus];

/**
 * Step Instance Table
 * Individual steps within a process instance
 * Each step represents a discrete action or approval in the workflow
 *
 * Tenant Isolation:
 * - All queries must filter by tenant_id
 * - Inherits tenant_id from parent process_instance
 * - CASCADE delete when process_instance or tenant is removed
 *
 * Indexes:
 * - (process_instance_id, step_order) - for sequential step retrieval
 * - (tenant_id, assigned_to, status) WHERE status IN ('pending', 'active') - for user task lists
 */
export const stepInstance = pgTable(
  "step_instance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    processInstanceId: uuid("process_instance_id")
      .notNull()
      .references(() => processInstance.id, { onDelete: "cascade" }),
    stepOrder: integer("step_order").notNull(),
    stepName: varchar("step_name", { length: 200 }).notNull(),
    stepType: varchar("step_type", { length: 50 }).notNull(),
    workflowStepTemplateId: uuid("workflow_step_template_id")
      .references(() => workflowStepTemplate.id, { onDelete: "set null" }),
    status: varchar("status", { length: 50 })
      .notNull()
      .default(StepStatus.PENDING),
    assignedTo: uuid("assigned_to").references(() => users.id, {
      onDelete: "restrict",
    }),
    completedBy: uuid("completed_by").references(() => users.id, {
      onDelete: "restrict",
    }),
    completedDate: timestamp("completed_date", {
      withTimezone: true,
      mode: "date",
    }),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (table) => ({
    // Composite index on (process_instance_id, step_order) for sequential step retrieval
    processStepOrderIdx: index("idx_step_instance_process_order")
      .on(table.processInstanceId, table.stepOrder)
      .where(sql`${table.deletedAt} IS NULL`),
    // Partial index on (tenant_id, assigned_to, status) for user task lists
    tenantAssignedStatusIdx: index("idx_step_instance_tenant_assigned_status")
      .on(table.tenantId, table.assignedTo, table.status)
      .where(
        sql`${table.status} IN ('pending', 'active') AND ${table.deletedAt} IS NULL`
      ),
  })
);

/**
 * Step Instance Relations
 * Defines relationships with other tables for type-safe joins
 */
export const stepInstanceRelations = relations(stepInstance, ({ one }) => ({
  tenant: one(tenants, {
    fields: [stepInstance.tenantId],
    references: [tenants.id],
  }),
  processInstance: one(processInstance, {
    fields: [stepInstance.processInstanceId],
    references: [processInstance.id],
  }),
  stepTemplate: one(workflowStepTemplate, {
    fields: [stepInstance.workflowStepTemplateId],
    references: [workflowStepTemplate.id],
  }),
  assignedUser: one(users, {
    fields: [stepInstance.assignedTo],
    references: [users.id],
  }),
  completedByUser: one(users, {
    fields: [stepInstance.completedBy],
    references: [users.id],
  }),
}));

// Type for inserting/selecting step instances
export type InsertStepInstance = typeof stepInstance.$inferInsert;
export type SelectStepInstance = typeof stepInstance.$inferSelect;

