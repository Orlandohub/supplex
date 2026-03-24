import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { tenants } from "./tenants";

/**
 * Workflow Status Lookup Table
 * Tenant-scoped definitions of process-level workflow statuses.
 * Used by workflow_step_template.workflow_status_id to define what status the
 * process_instance gets when a step completes.
 *
 * Tenants create their own status values (e.g., "Under Review", "Pending Documents",
 * "Approved", "Rejected"). These are displayed on the workflows list page.
 *
 * Tenant Isolation:
 * - All queries must filter by tenant_id
 * - CASCADE delete when tenant is removed
 */
export const workflowStatus = pgTable(
  "workflow_status",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    displayOrder: integer("display_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tenantIdx: index("idx_workflow_status_tenant").on(table.tenantId),
    tenantNameUnique: uniqueIndex("workflow_status_tenant_id_name_key").on(
      table.tenantId,
      table.name
    ),
  })
);

export const workflowStatusRelations = relations(workflowStatus, ({ one }) => ({
  tenant: one(tenants, {
    fields: [workflowStatus.tenantId],
    references: [tenants.id],
  }),
}));

export type InsertWorkflowStatus = typeof workflowStatus.$inferInsert;
export type SelectWorkflowStatus = typeof workflowStatus.$inferSelect;
