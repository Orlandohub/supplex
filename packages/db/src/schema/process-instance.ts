import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  timestamp,
  jsonb,
  index,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { tenants } from "./tenants";
import { users } from "./users";
import { stepInstance } from "./step-instance";
import { workflowTemplate } from "./workflow-template";

/**
 * Process Type Enum Values
 * Defines the type of process being executed
 */
export const ProcessType = {
  SUPPLIER_QUALIFICATION: "supplier_qualification",
  SOURCING: "sourcing",
  PRODUCT_LIFECYCLE_MANAGEMENT: "product_lifecycle_management",
} as const;

export type ProcessTypeType = (typeof ProcessType)[keyof typeof ProcessType];

/**
 * Workflow Process Status — PostgreSQL ENUM (migration 0027)
 */
export const workflowProcessStatusEnum = pgEnum("workflow_process_status", [
  "in_progress",
  "pending_validation",
  "declined_resubmit",
  "complete",
  "cancelled",
]);

export const ProcessStatus = {
  IN_PROGRESS: "in_progress",
  PENDING_VALIDATION: "pending_validation",
  DECLINED_RESUBMIT: "declined_resubmit",
  COMPLETE: "complete",
  CANCELLED: "cancelled",
} as const;

export type ProcessStatusType =
  (typeof ProcessStatus)[keyof typeof ProcessStatus];

/**
 * Process Instance Table
 * Domain-agnostic workflow execution engine
 * Tracks any type of multi-step process (qualification, sourcing, etc.)
 *
 * Tenant Isolation:
 * - All queries must filter by tenant_id
 * - CASCADE delete when tenant is removed
 *
 * Indexes:
 * - (tenant_id, process_type, status) - for filtering processes by type/status
 * - (tenant_id, entity_type, entity_id) - for entity-specific process lookups
 */
export const processInstance = pgTable(
  "process_instance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    processType: varchar("process_type", { length: 100 }).notNull(),
    entityType: varchar("entity_type", { length: 100 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    status: workflowProcessStatusEnum("status")
      .notNull()
      .default("in_progress"),
    currentStepInstanceId: uuid("current_step_instance_id").references(
      (): AnyPgColumn => stepInstance.id,
      { onDelete: "set null" }
    ),
    workflowTemplateId: uuid("workflow_template_id").references(
      () => workflowTemplate.id,
      { onDelete: "set null" }
    ),
    workflowName: varchar("workflow_name", { length: 255 }),
    initiatedBy: uuid("initiated_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    initiatedDate: timestamp("initiated_date", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .defaultNow(),
    completedDate: timestamp("completed_date", {
      withTimezone: true,
      mode: "date",
    }),
    totalSteps: integer("total_steps").notNull().default(0),
    completedSteps: integer("completed_steps").notNull().default(0),
    hasOverdueTasks: boolean("has_overdue_tasks").notNull().default(false),
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
    // Composite index on (tenant_id, process_type, status) for filtering processes
    tenantTypeStatusIdx: index("idx_process_instance_tenant_type_status")
      .on(table.tenantId, table.processType, table.status)
      .where(sql`${table.deletedAt} IS NULL`),
    // Composite index on (tenant_id, entity_type, entity_id) for entity lookups
    tenantEntityIdx: index("idx_process_instance_tenant_entity")
      .on(table.tenantId, table.entityType, table.entityId)
      .where(sql`${table.deletedAt} IS NULL`),
    // Default sort path: tenant + updated_at DESC
    tenantUpdatedIdx: index("idx_process_instance_tenant_updated")
      .on(table.tenantId, table.updatedAt)
      .where(sql`${table.deletedAt} IS NULL`),
    // Status-filtered sort path: tenant + status + updated_at DESC
    tenantStatusUpdatedIdx: index("idx_process_instance_tenant_status_updated")
      .on(table.tenantId, table.status, table.updatedAt)
      .where(sql`${table.deletedAt} IS NULL`),
  })
);

/**
 * Process Instance Relations
 * Defines relationships with other tables for type-safe joins
 */
export const processInstanceRelations = relations(
  processInstance,
  ({ one, many }) => ({
    tenant: one(tenants, {
      fields: [processInstance.tenantId],
      references: [tenants.id],
    }),
    initiator: one(users, {
      fields: [processInstance.initiatedBy],
      references: [users.id],
    }),
    currentStep: one(stepInstance, {
      fields: [processInstance.currentStepInstanceId],
      references: [stepInstance.id],
      relationName: "currentStep",
    }),
    template: one(workflowTemplate, {
      fields: [processInstance.workflowTemplateId],
      references: [workflowTemplate.id],
    }),
    steps: many(stepInstance),
  })
);

// Type for inserting/selecting process instances
export type InsertProcessInstance = typeof processInstance.$inferInsert;
export type SelectProcessInstance = typeof processInstance.$inferSelect;
