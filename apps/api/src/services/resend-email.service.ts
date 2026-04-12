import { Resend } from "resend";
import { logger } from "../lib/logger";

const emailLogger = logger.child({ module: "resend-email" });

const resendApiKey = process.env.RESEND_API_KEY;
const emailFrom = process.env.EMAIL_FROM || "noreply@supplex.io";

if (!resendApiKey) {
  emailLogger.warn("RESEND_API_KEY not configured — email delivery disabled");
}

const resend = resendApiKey ? new Resend(resendApiKey) : null;

/**
 * Email send result interface
 */
export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send email via Resend.com
 *
 * @param to - Recipient email address
 * @param subject - Email subject line
 * @param html - HTML content of email
 * @returns Send result with success status and message ID or error
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<EmailSendResult> {
  // Check if Resend is configured
  if (!resend) {
    emailLogger.error("Resend client not initialized");
    return {
      success: false,
      error: "Email service not configured",
    };
  }

  // Validate email address
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(to)) {
    emailLogger.error({ recipient: to }, "Invalid email address");
    return {
      success: false,
      error: "Invalid email address",
    };
  }

  try {
    emailLogger.debug({ recipient: to, subject }, "Sending email via Resend");

    const { data, error } = await resend.emails.send({
      from: emailFrom,
      to,
      subject,
      html,
    });

    if (error) {
      emailLogger.error({ err: error, recipient: to }, "Resend API error");
      return {
        success: false,
        error: error.message || "Unknown Resend API error",
      };
    }

    if (!data?.id) {
      emailLogger.error({ recipient: to }, "No message ID returned from Resend");
      return {
        success: false,
        error: "No message ID returned from Resend",
      };
    }

    emailLogger.info({ messageId: data.id, recipient: to }, "Email sent successfully");
    return {
      success: true,
      messageId: data.id,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    emailLogger.error({ err: error, recipient: to }, "Unexpected error sending email");

    // Handle specific error types
    if (errorMessage.includes("rate limit")) {
      return {
        success: false,
        error: "Rate limit exceeded",
      };
    }

    if (errorMessage.includes("authentication")) {
      return {
        success: false,
        error: "Invalid API key",
      };
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Verify Resend API key is configured and valid
 *
 * @returns True if API key is configured
 */
export function isResendConfigured(): boolean {
  return resend !== null;
}
