import { Resend } from "resend";
import { logger } from "../lib/logger";

const emailLogger = logger.child({ module: "resend-email" });

const resendApiKey = process.env.RESEND_API_KEY;
const emailFrom = process.env.EMAIL_FROM || "noreply@supplex.io";

if (!resendApiKey) {
  emailLogger.warn("RESEND_API_KEY not configured — email delivery disabled");
}

// SUP-21 (9a-4): Lazy-instantiate the Resend client on first call
// instead of at module-load time. Bun's `mock.module("resend", ...)`
// hoisting (`apps/api/src/services/__tests__/resend-email.service.test.ts`)
// runs after the service file is parsed but before any function inside
// it executes, so deferring `new Resend(resendApiKey)` until the first
// `sendEmail()` call lets the test substitute its `MockResend` class
// without touching production behaviour. Production semantics are
// preserved because the cached singleton still ensures one Resend
// client is reused across all calls.
let resendClient: Resend | null | undefined;

function getResendClient(): Resend | null {
  if (resendClient !== undefined) {
    return resendClient;
  }
  resendClient = resendApiKey ? new Resend(resendApiKey) : null;
  return resendClient;
}

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
  const resend = getResendClient();
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

    // Resend's underlying `fetchRequest` does NOT throw on non-2xx responses;
    // it returns the parsed JSON body, which for errors looks like
    // `{ name, message, statusCode }` and for success looks like `{ id }`.
    // Treat the response as `unknown` and narrow at runtime.
    const response: unknown = await resend.emails.send({
      from: emailFrom,
      to,
      subject,
      html,
    });

    if (
      response &&
      typeof response === "object" &&
      "id" in response &&
      typeof (response as { id: unknown }).id === "string"
    ) {
      const messageId = (response as { id: string }).id;
      emailLogger.info({ messageId, recipient: to }, "Email sent successfully");
      return {
        success: true,
        messageId,
      };
    }

    // Resend returned an error body instead of `{ id }`.
    const errorMessage =
      response &&
      typeof response === "object" &&
      "message" in response &&
      typeof (response as { message: unknown }).message === "string"
        ? (response as { message: string }).message
        : "No message ID returned from Resend";

    emailLogger.error(
      { recipient: to, response },
      "Resend API returned no message ID"
    );
    return {
      success: false,
      error: errorMessage,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    emailLogger.error(
      { err: error, recipient: to },
      "Unexpected error sending email"
    );

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
  return getResendClient() !== null;
}
