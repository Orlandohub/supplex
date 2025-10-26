import { z } from "zod";
import type { EmailEventType } from "./email-notification";
import { EmailEventTypeSchema } from "./email-notification";

// Main Interface
export interface UserNotificationPreferences {
  id: string; // UUID
  userId: string;
  tenantId: string;
  eventType: EmailEventType;
  emailEnabled: boolean;
  unsubscribedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// Zod Schemas
export const UserNotificationPreferencesSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  tenantId: z.string().uuid(),
  eventType: EmailEventTypeSchema,
  emailEnabled: z.boolean(),
  unsubscribedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Insert Schema (without auto-generated fields)
export const InsertUserNotificationPreferencesSchema =
  UserNotificationPreferencesSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  }).extend({
    emailEnabled: z.boolean().default(true),
    unsubscribedAt: z.date().nullable().optional(),
  });

// Update Schema
export const UpdateUserNotificationPreferencesSchema =
  InsertUserNotificationPreferencesSchema.partial();

// Type inference from Zod schemas
export type InsertUserNotificationPreferences = z.infer<
  typeof InsertUserNotificationPreferencesSchema
>;
export type UpdateUserNotificationPreferences = z.infer<
  typeof UpdateUserNotificationPreferencesSchema
>;

// Serialized type for frontend (Remix loaders serialize Dates to strings)
export interface SerializedUserNotificationPreferences {
  id: string;
  userId: string;
  tenantId: string;
  eventType: EmailEventType;
  emailEnabled: boolean;
  unsubscribedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Helper type for user preferences grouped by event type
export interface NotificationPreferencesMap {
  workflowSubmitted: boolean;
  stageApproved: boolean;
  stageRejected: boolean;
  stageAdvanced: boolean;
  workflowApproved: boolean;
}

// Tenant email settings (stored in tenants.settings.emailNotifications)
export interface TenantEmailSettings {
  workflowSubmitted: boolean;
  stageApproved: boolean;
  stageRejected: boolean;
  stageAdvanced: boolean;
  workflowApproved: boolean;
}
