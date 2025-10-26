import { Queue } from "bullmq";
import { redisConnection, isRedisEnabled } from "./redis-connection";

/**
 * Email Queue Configuration
 *
 * Uses BullMQ with Redis for reliable email sending
 * - Retry logic: 3 attempts with exponential backoff
 * - Backoff: 1 min, 5 min, 15 min
 * - Completed jobs kept for 24 hours (last 1000)
 * - Failed jobs kept for 7 days
 */

// Email notification queue (only create if Redis is enabled)
export const emailQueue =
  isRedisEnabled && redisConnection
    ? new Queue("email-notifications", {
        connection: redisConnection,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 60000, // 1 minute, then 5 min, then 15 min
          },
          removeOnComplete: {
            age: 86400, // 24 hours
            count: 1000, // Keep last 1000
          },
          removeOnFail: {
            age: 604800, // 7 days
          },
        },
      })
    : null;

// Job data interface
export interface EmailJobData {
  notificationId: string; // email_notifications record ID
  recipientEmail: string;
  recipientName: string;
  subject: string;
  templateName: string; // workflow-submitted, stage-approved, etc.
  templateData: Record<string, unknown>; // Dynamic data for template
}

// Helper function to add email job to queue
export async function queueEmailJob(data: EmailJobData): Promise<void> {
  if (!emailQueue) {
    console.warn(
      `[EMAIL QUEUE] Redis not configured. Email will not be sent: ${data.notificationId}`
    );
    return;
  }

  try {
    await emailQueue.add("send-email", data, {
      jobId: data.notificationId, // Use notification ID as job ID to prevent duplicates
    });
    console.log(`[EMAIL QUEUE] Queued email job: ${data.notificationId}`);
  } catch (error) {
    console.error(`[EMAIL QUEUE] Failed to queue email job:`, error);
    throw error;
  }
}

// Graceful shutdown
export async function closeEmailQueue(): Promise<void> {
  if (emailQueue) {
    await emailQueue.close();
  }
}
