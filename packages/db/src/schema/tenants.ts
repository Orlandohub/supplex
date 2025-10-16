import { pgTable, uuid, varchar, timestamp, jsonb } from "drizzle-orm/pg-core";

/**
 * Tenants Table
 * Root entity for multi-tenant isolation
 */
export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 200 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  status: varchar("status", { length: 50 }).notNull().default("active"),
  plan: varchar("plan", { length: 50 }).notNull().default("starter"),
  settings: jsonb("settings").notNull().default({}),
  subscriptionEndsAt: timestamp("subscription_ends_at", {
    withTimezone: true,
    mode: "date",
  }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

// Type for inserting new tenants
export type InsertTenant = typeof tenants.$inferInsert;
export type SelectTenant = typeof tenants.$inferSelect;
