/**
 * @deprecated This file is deprecated as of Story 2.2.5.1 (January 24, 2026)
 * 
 * DEPRECATION NOTICE:
 * The task_template table has been removed from the system.
 * Tasks are now created at runtime only when a step_instance becomes active.
 * Task configuration is now part of workflow_step_template (Story 2.2.6).
 * 
 * This file is kept for reference only and should NOT be used in any new code.
 * The table will be dropped via database migration.
 * 
 * See Story 2.2.5.1 for details on the course correction.
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  jsonb,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { tenants } from "./tenants";
import { users } from "./users";

/**
 * Task Template Status Enum Values
 * Defines the lifecycle status of a task template
 * @deprecated See file header - task_template has been removed
 */
export const TaskTemplateStatus = {
  ACTIVE: "active",
  ARCHIVED: "archived",
} as const;

export type TaskTemplateStatusType =
  (typeof TaskTemplateStatus)[keyof typeof TaskTemplateStatus];

/**
 * Task Template Table
 * Reusable task definitions per tenant
 * Used to create consistent task instances across workflows
 *
 * Tenant Isolation:
 * - All queries must filter by tenant_id
 * - CASCADE delete when tenant is removed
 *
 * Indexes:
 * - (tenant_id, status) - for filtering templates by status
 * - (tenant_id, name) UNIQUE - unique name per tenant for template lookup
 *
 * Foreign Key Cascade Rules:
 * - tenant_id: CASCADE - when tenant deleted, all templates deleted
 * - created_by: RESTRICT - cannot delete user who created templates (audit trail)
 */
export const taskTemplate = pgTable(
  "task_template",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 200 }).notNull(),
    title: varchar("title", { length: 300 }).notNull(),
    description: text("description"),
    defaultDueDays: integer("default_due_days").notNull().default(7),
    assigneeRole: varchar("assignee_role", { length: 50 }),
    status: varchar("status", { length: 50 })
      .notNull()
      .default(TaskTemplateStatus.ACTIVE),
    metadata: jsonb("metadata").notNull().default({}),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (table) => ({
    // Unique name per tenant (for template lookup by name)
    tenantNameUniqueIdx: unique("idx_task_template_tenant_name_unique").on(
      table.tenantId,
      table.name
    ),
    // Composite index on (tenant_id, name) for lookups
    tenantNameIdx: index("idx_task_template_tenant_name")
      .on(table.tenantId, table.name)
      .where(sql`${table.deletedAt} IS NULL`),
    // Composite index on (tenant_id, status) for filtering templates
    tenantStatusIdx: index("idx_task_template_tenant_status")
      .on(table.tenantId, table.status)
      .where(sql`${table.deletedAt} IS NULL`),
  })
);

/**
 * Task Template Relations
 * Defines relationships with other tables for type-safe joins
 *
 * Note: taskInstance import is handled via forward reference to avoid circular dependency
 * The actual taskInstance import will be in task-instance.ts
 */
export const taskTemplateRelations = relations(
  taskTemplate,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [taskTemplate.tenantId],
      references: [tenants.id],
    }),
    creator: one(users, {
      fields: [taskTemplate.createdBy],
      references: [users.id],
    }),
    // Forward reference to taskInstance (many relationship)
    // The relation is completed in task-instance.ts
  })
);

// Type for inserting/selecting task templates
export type InsertTaskTemplate = typeof taskTemplate.$inferInsert;
export type SelectTaskTemplate = typeof taskTemplate.$inferSelect;

