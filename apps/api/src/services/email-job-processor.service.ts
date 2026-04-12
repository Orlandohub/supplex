import { db } from "../lib/db";
import { emailNotifications, EmailNotificationStatus } from "@supplex/db";
import { eq } from "drizzle-orm";
import { sendEmail } from "./resend-email.service";
import { renderEmailTemplate } from "../templates/emails/template-renderer";
import type { EmailJobData } from "../queue/email-queue";
import { logger } from "../lib/logger";

const emailLogger = logger.child({ module: "email-processor" });

/**
 * Email Job Processor
 *
 * Processes email sending jobs from BullMQ queue
 * - Fetches email_notifications record
 * - Renders email template with dynamic data
 * - Sends email via Resend
 * - Updates email_notifications status
 * - Handles retry logic
 */

/**
 * Process email job
 *
 * @param jobData - Email job data from queue
 */
export async function processEmailJob(jobData: EmailJobData): Promise<void> {
  const {
    notificationId,
    recipientEmail,
    subject,
    templateName,
    templateData,
  } = jobData;

  emailLogger.info({ notificationId }, "Processing email notification");

  try {
    // 1. Fetch email notification record from database
    const notification = await db.query.emailNotifications.findFirst({
      where: eq(emailNotifications.id, notificationId),
    });

    if (!notification) {
      throw new Error(
        `Email notification not found in database: ${notificationId}`
      );
    }

    // 2. Check if already sent
    if (notification.status === EmailNotificationStatus.SENT) {
      emailLogger.debug({ notificationId }, "Email already sent — skipping");
      return;
    }

    // 3. Render email template with dynamic data
    emailLogger.debug({ notificationId, templateName }, "Rendering email template");
    const htmlContent = renderEmailTemplate(templateName, templateData);

    // 4. Send email via Resend
    emailLogger.debug({ notificationId, recipientEmail }, "Sending email");
    const result = await sendEmail(recipientEmail, subject, htmlContent);

    // 5. Update email notification status based on result
    if (result.success) {
      emailLogger.info({ notificationId }, "Email sent successfully");

      await db
        .update(emailNotifications)
        .set({
          status: EmailNotificationStatus.SENT,
          sentAt: new Date(),
          attemptCount: notification.attemptCount + 1,
          updatedAt: new Date(),
        })
        .where(eq(emailNotifications.id, notificationId));
    } else {
      emailLogger.error({ notificationId, error: result.error }, "Email send failed");

      // Update failure status
      await db
        .update(emailNotifications)
        .set({
          status: EmailNotificationStatus.FAILED,
          attemptCount: notification.attemptCount + 1,
          failedReason: result.error || "Unknown error",
          updatedAt: new Date(),
        })
        .where(eq(emailNotifications.id, notificationId));

      // Throw error to trigger BullMQ retry
      throw new Error(`Email send failed: ${result.error}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    emailLogger.error({ err: error, notificationId }, "Error processing email job");

    // Update failure status in database (if not already updated)
    try {
      const notification = await db.query.emailNotifications.findFirst({
        where: eq(emailNotifications.id, notificationId),
      });

      if (
        notification &&
        notification.status !== EmailNotificationStatus.SENT
      ) {
        await db
          .update(emailNotifications)
          .set({
            status: EmailNotificationStatus.FAILED,
            attemptCount: notification.attemptCount + 1,
            failedReason: errorMessage,
            updatedAt: new Date(),
          })
          .where(eq(emailNotifications.id, notificationId));
      }
    } catch (dbError) {
      emailLogger.error({ err: dbError, notificationId }, "Failed to update database after email job failure");
    }

    // Re-throw error to trigger BullMQ retry
    throw error;
  }
}
