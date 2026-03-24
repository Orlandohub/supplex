import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { users } from "./users";

/**
 * User Invitations Table
 * Secure invitation tokens for user onboarding with 48-hour validity
 * Single-use tokens for password setup
 */
export const userInvitations = pgTable(
  "user_invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    token: varchar("token", { length: 255 }).notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" })
      .notNull(),
    usedAt: timestamp("used_at", { withTimezone: true, mode: "date" }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    // Index for token lookups (primary access pattern)
    tokenIdx: index("idx_user_invitations_token").on(table.token),
    // Index for user lookups (finding invitations for a user)
    userIdIdx: index("idx_user_invitations_user_id").on(table.userId),
  })
);

// Type for inserting/selecting user invitations
export type InsertUserInvitation = typeof userInvitations.$inferInsert;
export type SelectUserInvitation = typeof userInvitations.$inferSelect;

