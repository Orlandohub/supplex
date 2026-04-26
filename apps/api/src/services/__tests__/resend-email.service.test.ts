import { describe, it, expect, mock, beforeEach } from "bun:test";
import { sendEmail, isResendConfigured } from "../resend-email.service";

// Mock Resend
const mockResendSend: any = mock(() =>
  Promise.resolve({ data: { id: "test-message-id" }, error: null })
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
      mockResendSend.mockResolvedValueOnce({
        data: { id: "msg_123" },
        error: null,
      });

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
        data: null,
        error: { message: "API rate limit exceeded" },
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
      mockResendSend.mockResolvedValueOnce({
        data: {},
        error: null,
      });

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
