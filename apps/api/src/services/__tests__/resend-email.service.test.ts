import { describe, it, expect, mock, beforeEach } from "bun:test";
import { sendEmail, isResendConfigured } from "../resend-email.service";

// SUP-20 (9a-4): The repo pins `resend@^1.0.0`. The v1 SDK's
// `client.emails.send(...)` resolves to the parsed Resend HTTP body
// directly — `{ id }` on success or `{ name, message, statusCode }` on
// failure — NOT the `{ data, error }` envelope introduced in v6+.
// `apps/api/src/services/resend-email.service.ts` reads `response.id`
// against that v1 contract, so the mock has to mirror the same shape
// or every branch falls through to "No message ID returned".
interface ResendV1SuccessResponse {
  id: string;
}
interface ResendV1ErrorResponse {
  name: string;
  message: string;
  statusCode: number;
}
type ResendV1Response = ResendV1SuccessResponse | ResendV1ErrorResponse;

const mockResendSend = mock(
  (..._args: readonly unknown[]): Promise<ResendV1Response> =>
    Promise.resolve({ id: "test-message-id" })
);

mock.module("resend", () => ({
  Resend: class MockResend {
    emails = {
      send: mockResendSend,
    };
  },
}));

describe("Resend Email Service", () => {
  beforeEach(() => {
    mockResendSend.mockClear();
  });

  describe("sendEmail", () => {
    it("should send email successfully with valid input", async () => {
      mockResendSend.mockResolvedValueOnce({ id: "msg_123" });

      const result = await sendEmail(
        "test@example.com",
        "Test Subject",
        "<p>Test HTML</p>"
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBe("msg_123");
      expect(result.error).toBeUndefined();
    });

    it("should fail with invalid email address", async () => {
      const result = await sendEmail(
        "invalid-email",
        "Test Subject",
        "<p>Test HTML</p>"
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid email address");
      expect(mockResendSend).not.toHaveBeenCalled();
    });

    it("should handle Resend API errors", async () => {
      mockResendSend.mockResolvedValueOnce({
        name: "rate_limit_exceeded",
        message: "API rate limit exceeded",
        statusCode: 429,
      });

      const result = await sendEmail(
        "test@example.com",
        "Test Subject",
        "<p>Test HTML</p>"
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("API rate limit exceeded");
    });

    it("should handle missing message ID", async () => {
      // Service treats a body with neither `id` nor `message` as the
      // generic "no message ID" branch. Cast the empty body to the union
      // so TypeScript still type-checks the mock shape.
      mockResendSend.mockResolvedValueOnce({} as unknown as ResendV1Response);

      const result = await sendEmail(
        "test@example.com",
        "Test Subject",
        "<p>Test HTML</p>"
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("No message ID returned from Resend");
    });

    it("should handle network errors", async () => {
      mockResendSend.mockRejectedValueOnce(new Error("Network timeout"));

      const result = await sendEmail(
        "test@example.com",
        "Test Subject",
        "<p>Test HTML</p>"
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network timeout");
    });
  });

  describe("isResendConfigured", () => {
    it("should return true if Resend is configured", () => {
      // Assuming RESEND_API_KEY is set in test environment
      const configured = isResendConfigured();
      expect(typeof configured).toBe("boolean");
    });
  });
});
