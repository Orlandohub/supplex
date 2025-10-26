import type { Job } from "bullmq";
import { Worker } from "bullmq";
import { redisConnection, isRedisEnabled } from "./redis-connection";
import type { EmailJobData } from "./email-queue";
import { processEmailJob } from "../services/email-job-processor.service";

/**
 * Email Worker
 *
 * Processes email sending jobs from the queue
 * - Concurrency: 5 emails in parallel
 * - Retries: 3 attempts with exponential backoff
 * - Updates email_notifications table with status
 */

// Email worker instance (only create if Redis is enabled)
export const emailWorker =
  isRedisEnabled && redisConnection
    ? new Worker<EmailJobData>(
        "email-notifications",
        async (job: Job<EmailJobData>) => {
          const { notificationId, recipientEmail, templateName } = job.data;

          console.log(
            `[EMAIL WORKER] Processing job ${job.id} (attempt ${job.attemptsMade + 1}/${job.opts.attempts || 3})`
          );
          console.log(
            `[EMAIL WORKER] Notification: ${notificationId}, Recipient: ${recipientEmail}, Template: ${templateName}`
          );

          try {
            // Process the email job (loads template, sends via Resend, updates DB)
            await processEmailJob(job.data);

            console.log(`[EMAIL WORKER] Successfully processed job ${job.id}`);
            return { success: true, notificationId };
          } catch (error) {
            console.error(
              `[EMAIL WORKER] Failed to process job ${job.id}:`,
              error
            );

            // If max attempts reached, mark as permanently failed
            if (job.attemptsMade + 1 >= (job.opts.attempts || 3)) {
              console.error(
                `[EMAIL WORKER] Max attempts reached for job ${job.id}. Marking as permanently failed.`
              );
            }

            throw error; // Re-throw to trigger retry
          }
        },
        {
          connection: redisConnection,
          concurrency: 5, // Process 5 emails in parallel
        }
      )
    : null;

// Worker event listeners (only if worker exists)
if (emailWorker) {
  emailWorker.on("completed", (job) => {
    console.log(`[EMAIL WORKER] Job ${job.id} completed successfully`);
  });

  emailWorker.on("failed", (job, err) => {
    if (job) {
      console.error(
        `[EMAIL WORKER] Job ${job.id} failed after ${job.attemptsMade} attempts:`,
        err.message
      );
    } else {
      console.error(`[EMAIL WORKER] Job failed:`, err.message);
    }
  });

  emailWorker.on("error", (err) => {
    console.error(`[EMAIL WORKER] Worker error:`, err);
  });
}

// Graceful shutdown
export async function closeEmailWorker(): Promise<void> {
  if (emailWorker) {
    await emailWorker.close();
  }
}
