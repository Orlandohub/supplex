import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  boolean,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

/**
 * Users Table
 * Authenticated users within a tenant with RBAC
 * id matches Supabase auth.users.id
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey(), // Matches Supabase auth.users.id
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 255 }).notNull(),
    fullName: varchar("full_name", { length: 200 }).notNull(),
    role: varchar("role", { length: 50 }).notNull(),
    avatarUrl: varchar("avatar_url", { length: 500 }),
    isActive: boolean("is_active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at", {
      withTimezone: true,
      mode: "date",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    // Index for tenant-based user lookups
    tenantIdIdx: index("idx_users_tenant_id").on(table.tenantId),
    // Unique constraint on (tenant_id, email)
    tenantEmailUnique: unique("users_tenant_email_unique").on(
      table.tenantId,
      table.email
    ),
  })
);

// Type for inserting/selecting users
export type InsertUser = typeof users.$inferInsert;
export type SelectUser = typeof users.$inferSelect;

