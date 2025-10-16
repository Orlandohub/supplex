import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { users } from "./users";

/**
 * Audit Logs Table
 * Tracks all user management and sensitive actions
 */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }), // Who performed the action
    targetUserId: uuid("target_user_id").references(() => users.id, {
      onDelete: "set null",
    }), // Who was affected (nullable for non-user actions)
    action: varchar("action", { length: 100 }).notNull(), // e.g., USER_INVITED, ROLE_CHANGED
    details: jsonb("details").notNull(), // Action-specific context
    ipAddress: varchar("ip_address", { length: 50 }),
    userAgent: varchar("user_agent", { length: 500 }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    // Index for tenant-based queries
    tenantIdIdx: index("idx_audit_logs_tenant_id").on(table.tenantId),
    // Index for target user queries
    targetUserIdIdx: index("idx_audit_logs_target_user_id").on(
      table.targetUserId
    ),
    // Index for chronological queries
    createdAtIdx: index("idx_audit_logs_created_at").on(table.createdAt),
    // Index for action-based queries
    actionIdx: index("idx_audit_logs_action").on(table.action),
  })
);

// Type for inserting/selecting audit logs
export type InsertAuditLog = typeof auditLogs.$inferInsert;
export type SelectAuditLog = typeof auditLogs.$inferSelect;
