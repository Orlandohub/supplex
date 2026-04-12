import type { Job } from "bullmq";
import { Worker } from "bullmq";
import { redisConnection, isRedisEnabled } from "./redis-connection";
import type { EmailJobData } from "./email-queue";
import { processEmailJob } from "../services/email-job-processor.service";
import { logger } from "../lib/logger";

const workerLogger = logger.child({ module: "email-worker" });

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

          workerLogger.info({
            jobId: job.id,
            attempt: job.attemptsMade + 1,
            maxAttempts: job.opts.attempts || 3,
            notificationId,
            recipientEmail,
            templateName,
          }, "Processing email job");

          try {
            await processEmailJob(job.data);

            workerLogger.info({ jobId: job.id, notificationId }, "Successfully processed email job");
            return { success: true, notificationId };
          } catch (error) {
            workerLogger.error({ err: error, jobId: job.id, notificationId }, "Failed to process email job");

            if (job.attemptsMade + 1 >= (job.opts.attempts || 3)) {
              workerLogger.error({ jobId: job.id, notificationId }, "Max attempts reached — marking as permanently failed");
            }

            throw error;
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
    workerLogger.info({ jobId: job.id }, "Job completed successfully");
  });

  emailWorker.on("failed", (job, err) => {
    if (job) {
      workerLogger.error({ jobId: job.id, attempts: job.attemptsMade, err }, "Job failed");
    } else {
      workerLogger.error({ err }, "Job failed (no job reference)");
    }
  });

  emailWorker.on("error", (err) => {
    workerLogger.error({ err }, "Worker error");
  });
}

// Graceful shutdown
export async function closeEmailWorker(): Promise<void> {
  if (emailWorker) {
    await emailWorker.close();
  }
}
