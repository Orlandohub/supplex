import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  boolean,
  unique,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { users } from "./users";

/**
 * User Notification Preferences Table
 * Stores individual user preferences for email notifications
 *
 * Unique constraint: (user_id, event_type) - one preference per user per event type
 */
export const userNotificationPreferences = pgTable(
  "user_notification_preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    eventType: varchar("event_type", { length: 50 }).notNull(),
    emailEnabled: boolean("email_enabled").notNull().default(true),
    unsubscribedAt: timestamp("unsubscribed_at", {
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
    // Unique constraint - one preference per user per event type
    userEventTypeUnique: unique(
      "user_notification_preferences_user_event_unique"
    ).on(table.userId, table.eventType),
  })
);

// Type for inserting/selecting user notification preferences
export type InsertUserNotificationPreference =
  typeof userNotificationPreferences.$inferInsert;
export type SelectUserNotificationPreference =
  typeof userNotificationPreferences.$inferSelect;
