/**
 * Email Notification Service
 *
 * Handles queuing email notifications for workflow events
 * - Checks notification preferences (tenant + user)
 * - Enforces rate limiting
 * - Creates email_notifications records
 * - Queues jobs to BullMQ for async processing
 */

import { db } from "../lib/db";
import {
  emailNotifications,
  userNotificationPreferences,
  tenants,
  users,
  EmailNotificationStatus,
} from "@supplex/db";
import { EmailEventType } from "@supplex/types";
import { eq, and } from "drizzle-orm";
import { queueEmailJob } from "../queue/email-queue";
import { checkEmailRateLimit } from "../utils/email-rate-limiter";
import * as jwt from "jsonwebtoken";
import { logger } from "../lib/logger";

const emailLogger = logger.child({ module: "email-notification" });

/**
 * Helper function to check if email should be sent
 * Checks tenant settings and user preferences
 */
async function shouldSendEmail(
  userId: string,
  tenantId: string,
  eventType: EmailEventType
): Promise<boolean> {
  try {
    // 1. Check tenant setting
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
    });

    if (!tenant) {
      emailLogger.warn(
        { tenantId },
        "Tenant not found when checking notification preferences"
      );
      return false;
    }

    // Map event type to tenant setting key
    const eventKeyMap: Record<EmailEventType, string> = {
      [EmailEventType.WORKFLOW_SUBMITTED]: "workflowSubmitted",
      [EmailEventType.STAGE_APPROVED]: "stageApproved",
      [EmailEventType.STAGE_REJECTED]: "stageRejected",
      [EmailEventType.STAGE_ADVANCED]: "stageAdvanced",
      [EmailEventType.WORKFLOW_APPROVED]: "workflowApproved",
    };

    const settingKey = eventKeyMap[eventType];
    const tenantSettings = tenant.settings as Record<string, unknown> | null;
    const emailSettings = tenantSettings?.emailNotifications as
      | Record<string, boolean>
      | undefined;
    const tenantEnabled = emailSettings?.[settingKey] ?? true; // Default to enabled

    if (!tenantEnabled) {
      emailLogger.debug(
        { tenantId, eventType },
        "Notification disabled by tenant settings"
      );
      return false;
    }

    // 2. Check user preference
    const userPref = await db.query.userNotificationPreferences.findFirst({
      where: and(
        eq(userNotificationPreferences.userId, userId),
        eq(userNotificationPreferences.eventType, eventType)
      ),
    });

    const userEnabled = userPref?.emailEnabled ?? true; // Default to enabled

    if (!userEnabled) {
      emailLogger.debug(
        { userId, eventType },
        "Notification disabled by user preference"
      );
      return false;
    }

    return true;
  } catch (error) {
    emailLogger.error(
      { err: error, userId, tenantId, eventType },
      "Error checking notification preferences"
    );
    // Default to allowing email on error
    return true;
  }
}

/**
 * Generate unsubscribe token for email
 */
function generateUnsubscribeToken(
  userId: string,
  eventType: EmailEventType
): string {
  const secret =
    process.env.UNSUBSCRIBE_JWT_SECRET ||
    process.env.JWT_SECRET ||
    "dev-secret";
  const token = jwt.sign(
    { userId, eventType },
    secret,
    { expiresIn: "90d" } // Token valid for 90 days
  );
  return token;
}

export interface WorkflowSubmittedEmailData {
  workflowId: string;
  reviewerId: string;
  reviewerEmail: string;
  reviewerName?: string;
  initiatorName: string;
  supplierName: string;
  riskScore: string;
  workflowLink: string;
  tenantId: string;
}

/**
 * Send workflow submitted email notification
 * @param data - Email notification data
 * @returns Promise<void>
 */
export async function sendWorkflowSubmittedEmail(
  data: WorkflowSubmittedEmailData
): Promise<void> {
  const eventType = EmailEventType.WORKFLOW_SUBMITTED;

  try {
    // 1. Check if email should be sent (tenant + user preferences)
    const shouldSend = await shouldSendEmail(
      data.reviewerId,
      data.tenantId,
      eventType
    );

    if (!shouldSend) {
      emailLogger.debug(
        { eventType, workflowId: data.workflowId },
        "Skipping workflow submitted email — disabled by preferences"
      );
      return;
    }

    // 2. Check rate limiting
    const withinLimit = await checkEmailRateLimit(data.reviewerId);

    if (!withinLimit) {
      emailLogger.warn(
        { userId: data.reviewerId, eventType },
        "Rate limit exceeded — skipping email"
      );
      return;
    }

    // 3. Get reviewer name
    const reviewer = await db.query.users.findFirst({
      where: eq(users.id, data.reviewerId),
    });
    const recipientName = reviewer?.fullName || data.reviewerName || "there";

    // 4. Create email_notifications record
    const subject = `Action Required: ${data.supplierName} Qualification`;
    const [notification] = await db
      .insert(emailNotifications)
      .values({
        tenantId: data.tenantId,
        userId: data.reviewerId,
        eventType,
        recipientEmail: data.reviewerEmail,
        subject,
        status: EmailNotificationStatus.PENDING,
        attemptCount: 0,
      })
      .returning();

    if (!notification)
      throw new Error("Failed to create email notification record");

    // 5. Generate unsubscribe token
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const unsubscribeToken = generateUnsubscribeToken(
      data.reviewerId,
      eventType
    );
    const unsubscribeLink = `${frontendUrl}/unsubscribe/${unsubscribeToken}`;

    // 6. Queue email job
    await queueEmailJob({
      notificationId: notification.id,
      recipientEmail: data.reviewerEmail,
      recipientName,
      subject,
      templateName: "workflow-submitted",
      templateData: {
        recipientName,
        supplierName: data.supplierName,
        initiatorName: data.initiatorName,
        riskScore: data.riskScore,
        submittedDate: new Date().toLocaleDateString(),
        workflowLink: data.workflowLink,
        unsubscribeLink,
      },
    });

    emailLogger.info(
      { notificationId: notification.id, eventType },
      "Queued workflow submitted email"
    );
  } catch (error) {
    emailLogger.error(
      { err: error, eventType, workflowId: data.workflowId },
      "Error queuing workflow submitted email"
    );
    throw error;
  }
}

export interface StageApprovedEmailData {
  workflowId: string;
  initiatorId: string;
  initiatorEmail: string;
  initiatorName: string;
  supplierName: string;
  reviewerName: string;
  stageNumber: number;
  nextStage: string;
  workflowLink: string;
  tenantId: string;
}

/**
 * Send stage approved email notification
 * Notifies workflow initiator that a stage has been approved
 * @param data - Email notification data
 * @returns Promise<void>
 */
export async function sendStageApprovedEmail(
  data: StageApprovedEmailData
): Promise<void> {
  const eventType = EmailEventType.STAGE_APPROVED;

  try {
    // 1. Check if email should be sent
    const shouldSend = await shouldSendEmail(
      data.initiatorId,
      data.tenantId,
      eventType
    );

    if (!shouldSend) {
      emailLogger.debug(
        { eventType, workflowId: data.workflowId },
        "Skipping stage approved email — disabled by preferences"
      );
      return;
    }

    // 2. Check rate limiting
    const withinLimit = await checkEmailRateLimit(data.initiatorId);

    if (!withinLimit) {
      emailLogger.warn(
        { userId: data.initiatorId, eventType },
        "Rate limit exceeded — skipping email"
      );
      return;
    }

    // 3. Create email_notifications record
    const subject = `${data.supplierName} Qualification - Stage ${data.stageNumber} Approved`;
    const [notification] = await db
      .insert(emailNotifications)
      .values({
        tenantId: data.tenantId,
        userId: data.initiatorId,
        eventType,
        recipientEmail: data.initiatorEmail,
        subject,
        status: EmailNotificationStatus.PENDING,
        attemptCount: 0,
      })
      .returning();

    if (!notification)
      throw new Error("Failed to create email notification record");

    // 4. Generate unsubscribe token and link
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const unsubscribeToken = generateUnsubscribeToken(
      data.initiatorId,
      eventType
    );
    const unsubscribeLink = `${frontendUrl}/unsubscribe/${unsubscribeToken}`;

    // 5. Queue email job
    await queueEmailJob({
      notificationId: notification.id,
      recipientEmail: data.initiatorEmail,
      recipientName: data.initiatorName,
      subject,
      templateName: "stage-approved",
      templateData: {
        recipientName: data.initiatorName,
        supplierName: data.supplierName,
        stageNumber: data.stageNumber.toString(),
        reviewerName: data.reviewerName,
        reviewedDate: new Date().toLocaleDateString(),
        nextStageMessage: data.nextStage || "",
        workflowLink: data.workflowLink,
        unsubscribeLink,
      },
    });

    emailLogger.info(
      { notificationId: notification.id, eventType },
      "Queued stage approved email"
    );
  } catch (error) {
    emailLogger.error(
      { err: error, eventType, workflowId: data.workflowId },
      "Error queuing stage approved email"
    );
    throw error;
  }
}

export interface StageRejectedEmailData {
  workflowId: string;
  initiatorId: string;
  initiatorEmail: string;
  initiatorName: string;
  supplierName: string;
  reviewerName: string;
  stageNumber: number;
  rejectionComments: string;
  workflowLink: string;
  tenantId: string;
}

/**
 * Send stage rejected email notification
 * Notifies workflow initiator that a stage has been rejected with feedback
 * @param data - Email notification data
 * @returns Promise<void>
 */
export async function sendStageRejectedEmail(
  data: StageRejectedEmailData
): Promise<void> {
  const eventType = EmailEventType.STAGE_REJECTED;

  try {
    // 1. Check if email should be sent
    const shouldSend = await shouldSendEmail(
      data.initiatorId,
      data.tenantId,
      eventType
    );

    if (!shouldSend) {
      emailLogger.debug(
        { eventType, workflowId: data.workflowId },
        "Skipping stage rejected email — disabled by preferences"
      );
      return;
    }

    // 2. Check rate limiting
    const withinLimit = await checkEmailRateLimit(data.initiatorId);

    if (!withinLimit) {
      emailLogger.warn(
        { userId: data.initiatorId, eventType },
        "Rate limit exceeded — skipping email"
      );
      return;
    }

    // 3. Create email_notifications record
    const subject = `${data.supplierName} Qualification - Changes Requested`;
    const [notification] = await db
      .insert(emailNotifications)
      .values({
        tenantId: data.tenantId,
        userId: data.initiatorId,
        eventType,
        recipientEmail: data.initiatorEmail,
        subject,
        status: EmailNotificationStatus.PENDING,
        attemptCount: 0,
      })
      .returning();

    if (!notification)
      throw new Error("Failed to create email notification record");

    // 4. Generate unsubscribe token and link
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const unsubscribeToken = generateUnsubscribeToken(
      data.initiatorId,
      eventType
    );
    const unsubscribeLink = `${frontendUrl}/unsubscribe/${unsubscribeToken}`;

    // 5. Queue email job
    await queueEmailJob({
      notificationId: notification.id,
      recipientEmail: data.initiatorEmail,
      recipientName: data.initiatorName,
      subject,
      templateName: "stage-rejected",
      templateData: {
        recipientName: data.initiatorName,
        supplierName: data.supplierName,
        stageNumber: data.stageNumber.toString(),
        reviewerName: data.reviewerName,
        reviewedDate: new Date().toLocaleDateString(),
        comments: data.rejectionComments,
        workflowLink: data.workflowLink,
        unsubscribeLink,
      },
    });

    emailLogger.info(
      { notificationId: notification.id, eventType },
      "Queued stage rejected email"
    );
  } catch (error) {
    emailLogger.error(
      { err: error, eventType, workflowId: data.workflowId },
      "Error queuing stage rejected email"
    );
    throw error;
  }
}

export interface SupplierApprovalCongratulationsData {
  supplierName: string;
  supplierContactName?: string;
  supplierEmail: string;
  supplierId: string;
  workflowId: string;
  approverName: string;
  tenantId: string;
}

/**
 * Send supplier approval congratulations email
 * Notifies supplier of final qualification approval (Stage 3 completion)
 * Uses supplier contact as recipient (no user preferences apply)
 * @param data - Email notification data
 * @returns Promise<void>
 */
export async function sendSupplierApprovalCongratulations(
  data: SupplierApprovalCongratulationsData
): Promise<void> {
  const eventType = EmailEventType.WORKFLOW_APPROVED;

  try {
    // Note: For supplier emails, we don't check user preferences
    // since the supplier contact is external and not a system user

    // 1. Check tenant setting
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, data.tenantId),
    });

    if (!tenant) {
      emailLogger.warn(
        { tenantId: data.tenantId },
        "Tenant not found for supplier approval email"
      );
      return;
    }

    const tenantSettings = tenant.settings as Record<string, unknown> | null;
    const emailSettings = tenantSettings?.emailNotifications as
      | Record<string, boolean>
      | undefined;
    const tenantEnabled = emailSettings?.workflowApproved ?? true;

    if (!tenantEnabled) {
      emailLogger.debug(
        { tenantId: data.tenantId, eventType },
        "Tenant has disabled workflow approved notifications"
      );
      return;
    }

    // 2. Create email_notifications record (using supplierId as userId)
    const subject = `Congratulations! Your Qualification Has Been Approved`;
    const [notification] = await db
      .insert(emailNotifications)
      .values({
        tenantId: data.tenantId,
        userId: data.supplierId, // Use supplier ID since contact is not a system user
        eventType,
        recipientEmail: data.supplierEmail,
        subject,
        status: EmailNotificationStatus.PENDING,
        attemptCount: 0,
      })
      .returning();

    if (!notification)
      throw new Error("Failed to create email notification record");

    // 3. No unsubscribe link for supplier emails (external contact)
    const recipientName = data.supplierContactName || data.supplierName;

    // 4. Queue email job
    await queueEmailJob({
      notificationId: notification.id,
      recipientEmail: data.supplierEmail,
      recipientName,
      subject,
      templateName: "workflow-approved",
      templateData: {
        recipientName,
        supplierName: data.supplierName,
        approverName: data.approverName,
        approvedDate: new Date().toLocaleDateString(),
        unsubscribeLink: "#", // No unsubscribe for supplier emails
      },
    });

    emailLogger.info(
      {
        notificationId: notification.id,
        eventType,
        supplierId: data.supplierId,
      },
      "Queued supplier approval congratulations email"
    );
  } catch (error) {
    emailLogger.error(
      { err: error, eventType, supplierId: data.supplierId },
      "Error queuing supplier approval congratulations email"
    );
    throw error;
  }
}
