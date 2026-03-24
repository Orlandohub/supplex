import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { tenants } from "./tenants";
import { users } from "./users";
import { formTemplateStatusEnum } from "./form-template";
import { workflowType } from "./workflow-type";

/**
 * Workflow Template Table
 * Tenant-isolated workflow template definitions
 * Each template defines a reusable workflow structure (e.g., "Supplier Qualification v2")
 *
 * Tenant Isolation:
 * - All queries must filter by tenant_id
 * - CASCADE delete when tenant is removed
 * - RESTRICT delete when created_by user is removed (audit trail)
 *
 * Template Management:
 * - status: 'draft' = editable, 'published' = immutable (copy to edit), 'archived' = hidden
 * - active: Whether template is available for process instantiation
 * - Templates can be copied to create new drafts for editing
 *
 * Indexes:
 * - (tenant_id, status, active) - primary filter for templates by status and active flag
 */
export const workflowTemplate = pgTable(
  "workflow_template",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    active: boolean("active").notNull().default(true),
    status: formTemplateStatusEnum("status").notNull().default("draft"),
    workflowTypeId: uuid("workflow_type_id").references(() => workflowType.id, {
      onDelete: "set null",
    }),
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
    // Composite index on (tenant_id, status, active) for filtering templates by status and active flag
    tenantStatusActiveIdx: index("idx_workflow_template_tenant_status_active")
      .on(table.tenantId, table.status, table.active)
      .where(sql`${table.deletedAt} IS NULL`),
  })
);

/**
 * Workflow Template Relations
 * Note: Relations are defined in workflow-step-template.ts to access both table definitions
 * and avoid circular dependency issues
 */

// Type for inserting/selecting workflow templates
export type InsertWorkflowTemplate = typeof workflowTemplate.$inferInsert;
export type SelectWorkflowTemplate = typeof workflowTemplate.$inferSelect;

