import {
  pgTable,
  uuid,
  varchar,
  boolean,
  integer,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { tenants } from "./tenants";

/**
 * Supplier Status Lookup Table
 * Tenant-scoped definitions of supplier lifecycle statuses.
 * Replaces the hardcoded SupplierStatus enum with tenant-configurable values.
 *
 * Default seeded values: prospect, qualified, approved, conditional, blocked
 * Tenants can add custom statuses (e.g., "Under Audit", "Suspended").
 *
 * Tenant Isolation:
 * - All queries must filter by tenant_id
 * - CASCADE delete when tenant is removed
 */
export const supplierStatus = pgTable(
  "supplier_status",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    displayOrder: integer("display_order").notNull().default(0),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tenantIdx: index("idx_supplier_status_tenant").on(table.tenantId),
    tenantNameUnique: uniqueIndex("supplier_status_tenant_id_name_key").on(
      table.tenantId,
      table.name
    ),
  })
);

export const supplierStatusRelations = relations(supplierStatus, ({ one }) => ({
  tenant: one(tenants, {
    fields: [supplierStatus.tenantId],
    references: [tenants.id],
  }),
}));

export type InsertSupplierStatus = typeof supplierStatus.$inferInsert;
export type SelectSupplierStatus = typeof supplierStatus.$inferSelect;
