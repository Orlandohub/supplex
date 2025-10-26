import { Resend } from "resend";

/**
 * Resend Email Service
 *
 * Handles email sending via Resend.com API
 * - Error handling with specific error codes
 * - Returns send status for tracking
 * - Validates API key configuration
 */

// Initialize Resend client
const resendApiKey = process.env.RESEND_API_KEY;
const emailFrom = process.env.EMAIL_FROM || "noreply@supplex.io";

if (!resendApiKey) {
  console.warn(
    "[RESEND EMAIL] RESEND_API_KEY not configured. Email sending will be disabled."
  );
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
    console.error("[RESEND EMAIL] Resend client not initialized");
    return {
      success: false,
      error: "Email service not configured",
    };
  }

  // Validate email address
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(to)) {
    console.error(`[RESEND EMAIL] Invalid email address: ${to}`);
    return {
      success: false,
      error: "Invalid email address",
    };
  }

  try {
    console.log(`[RESEND EMAIL] Sending email to ${to}`);
    console.log(`[RESEND EMAIL] Subject: ${subject}`);

    const { data, error } = await resend.emails.send({
      from: emailFrom,
      to,
      subject,
      html,
    });

    if (error) {
      console.error(`[RESEND EMAIL] API error:`, error);
      return {
        success: false,
        error: error.message || "Unknown Resend API error",
      };
    }

    if (!data?.id) {
      console.error(`[RESEND EMAIL] No message ID returned`);
      return {
        success: false,
        error: "No message ID returned from Resend",
      };
    }

    console.log(
      `[RESEND EMAIL] Email sent successfully. Message ID: ${data.id}`
    );
    return {
      success: true,
      messageId: data.id,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[RESEND EMAIL] Unexpected error:`, errorMessage);

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
