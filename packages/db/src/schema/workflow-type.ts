import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { tenants } from "./tenants";
import { supplierStatus } from "./supplier-status";

/**
 * Workflow Type Lookup Table
 * Tenant-scoped definitions of workflow categories/types.
 * Links to an optional supplier_status to auto-update the supplier when
 * a workflow of this type completes.
 *
 * Examples: "Qualification", "Audit", "Onboarding", "Compliance Check"
 *
 * Tenant Isolation:
 * - All queries must filter by tenant_id
 * - CASCADE delete when tenant is removed
 */
export const workflowType = pgTable(
  "workflow_type",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 200 }).notNull(),
    supplierStatusId: uuid("supplier_status_id").references(
      () => supplierStatus.id,
      { onDelete: "set null" }
    ),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tenantIdx: index("idx_workflow_type_tenant").on(table.tenantId),
    tenantNameUnique: uniqueIndex("workflow_type_tenant_id_name_key").on(
      table.tenantId,
      table.name
    ),
  })
);

export const workflowTypeRelations = relations(workflowType, ({ one }) => ({
  tenant: one(tenants, {
    fields: [workflowType.tenantId],
    references: [tenants.id],
  }),
  supplierStatus: one(supplierStatus, {
    fields: [workflowType.supplierStatusId],
    references: [supplierStatus.id],
  }),
}));

export type InsertWorkflowType = typeof workflowType.$inferInsert;
export type SelectWorkflowType = typeof workflowType.$inferSelect;
