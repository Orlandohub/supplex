import { z } from "zod";

// Enums
export enum EmailNotificationStatus {
  PENDING = "pending",
  SENT = "sent",
  FAILED = "failed",
  BOUNCED = "bounced",
}

export enum EmailEventType {
  WORKFLOW_SUBMITTED = "workflow_submitted",
  STAGE_APPROVED = "stage_approved",
  STAGE_REJECTED = "stage_rejected",
  STAGE_ADVANCED = "stage_advanced",
  WORKFLOW_APPROVED = "workflow_approved",
}

// Main Interface
export interface EmailNotification {
  id: string; // UUID
  tenantId: string;
  userId: string; // Recipient user ID
  eventType: EmailEventType;
  recipientEmail: string;
  subject: string;
  status: EmailNotificationStatus;
  attemptCount: number;
  sentAt: Date | null;
  failedReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Zod Schemas
export const EmailNotificationStatusSchema = z.nativeEnum(
  EmailNotificationStatus
);

export const EmailEventTypeSchema = z.nativeEnum(EmailEventType);

export const EmailNotificationSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  eventType: EmailEventTypeSchema,
  recipientEmail: z.string().email().max(255),
  subject: z.string().min(1).max(500),
  status: EmailNotificationStatusSchema,
  attemptCount: z.number().int().min(0),
  sentAt: z.date().nullable(),
  failedReason: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Insert Schema (without auto-generated fields)
export const InsertEmailNotificationSchema = EmailNotificationSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  status: EmailNotificationStatusSchema.default(
    EmailNotificationStatus.PENDING
  ),
  attemptCount: z.number().int().min(0).default(0),
  sentAt: z.date().nullable().optional(),
  failedReason: z.string().nullable().optional(),
});

// Update Schema
export const UpdateEmailNotificationSchema =
  InsertEmailNotificationSchema.partial();

// Type inference from Zod schemas
export type InsertEmailNotification = z.infer<
  typeof InsertEmailNotificationSchema
>;
export type UpdateEmailNotification = z.infer<
  typeof UpdateEmailNotificationSchema
>;

// Serialized type for frontend (Remix loaders serialize Dates to strings)
export interface SerializedEmailNotification {
  id: string;
  tenantId: string;
  userId: string;
  eventType: EmailEventType;
  recipientEmail: string;
  subject: string;
  status: EmailNotificationStatus;
  attemptCount: number;
  sentAt: string | null;
  failedReason: string | null;
  createdAt: string;
  updatedAt: string;
}
