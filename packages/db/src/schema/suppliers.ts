import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  numeric,
  jsonb,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tenants } from "./tenants";
import { users } from "./users";

/**
 * Suppliers Table
 * Core supplier/vendor master data entity
 * 
 * Indexes:
 * - (tenant_id, status) WHERE deleted_at IS NULL - for status filtering
 * - (tenant_id, name) WHERE deleted_at IS NULL - for name search
 */
export const suppliers = pgTable(
  "suppliers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 200 }).notNull(),
    taxId: varchar("tax_id", { length: 50 }).notNull(),
    category: varchar("category", { length: 50 }).notNull(),
    status: varchar("status", { length: 50 }).notNull().default("prospect"),
    performanceScore: numeric("performance_score", { precision: 3, scale: 2 }),
    contactName: varchar("contact_name", { length: 200 }).notNull(),
    contactEmail: varchar("contact_email", { length: 255 }).notNull(),
    contactPhone: varchar("contact_phone", { length: 50 }),
    address: jsonb("address").notNull(),
    certifications: jsonb("certifications").notNull().default([]),
    metadata: jsonb("metadata").notNull().default({}),
    riskScore: numeric("risk_score", { precision: 4, scale: 2 }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (table) => ({
    // Composite index on (tenant_id, status) for active suppliers
    tenantStatusIdx: index("idx_suppliers_tenant_status").on(
      table.tenantId,
      table.status
    ).where(sql`${table.deletedAt} IS NULL`),
    // Composite index on (tenant_id, name) for search queries
    tenantNameIdx: index("idx_suppliers_tenant_name").on(
      table.tenantId,
      table.name
    ).where(sql`${table.deletedAt} IS NULL`),
    // Unique constraint on (tenant_id, tax_id)
    tenantTaxIdUnique: unique("suppliers_tenant_tax_id_unique").on(
      table.tenantId,
      table.taxId
    ),
  })
);

// Type for inserting/selecting suppliers
export type InsertSupplier = typeof suppliers.$inferInsert;
export type SelectSupplier = typeof suppliers.$inferSelect;

