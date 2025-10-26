import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  integer,
  text,
  index,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { users } from "./users";

/**
 * Email Notification Status Enum Values
 * Represents the current state of an email notification
 */
export const EmailNotificationStatus = {
  PENDING: "pending",
  SENT: "sent",
  FAILED: "failed",
  BOUNCED: "bounced",
} as const;

export type EmailNotificationStatusType =
  (typeof EmailNotificationStatus)[keyof typeof EmailNotificationStatus];

/**
 * Email Event Type Enum Values
 * Types of workflow events that trigger email notifications
 */
export const EmailEventType = {
  WORKFLOW_SUBMITTED: "workflow_submitted",
  STAGE_APPROVED: "stage_approved",
  STAGE_REJECTED: "stage_rejected",
  STAGE_ADVANCED: "stage_advanced",
  WORKFLOW_APPROVED: "workflow_approved",
} as const;

export type EmailEventTypeType =
  (typeof EmailEventType)[keyof typeof EmailEventType];

/**
 * Email Notifications Table
 * Tracks all email notifications sent by the system
 *
 * Indexes:
 * - (tenant_id, status) - for filtering by status
 * - (created_at) - for chronological queries and date range filtering
 */
export const emailNotifications = pgTable(
  "email_notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventType: varchar("event_type", { length: 50 }).notNull(),
    recipientEmail: varchar("recipient_email", { length: 255 }).notNull(),
    subject: varchar("subject", { length: 500 }).notNull(),
    status: varchar("status", { length: 50 })
      .notNull()
      .default(EmailNotificationStatus.PENDING),
    attemptCount: integer("attempt_count").notNull().default(0),
    sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" }),
    failedReason: text("failed_reason"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    // Index for tenant-based status filtering
    tenantStatusIdx: index("idx_email_notifications_tenant_status").on(
      table.tenantId,
      table.status
    ),
    // Index for chronological queries
    createdAtIdx: index("idx_email_notifications_created_at").on(
      table.createdAt
    ),
  })
);

// Type for inserting/selecting email notifications
export type InsertEmailNotification = typeof emailNotifications.$inferInsert;
export type SelectEmailNotification = typeof emailNotifications.$inferSelect;
