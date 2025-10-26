import { describe, it, expect, mock, beforeEach } from "bun:test";
import type { EmailJobData } from "../email-queue";

// Mock dependencies
const mockSendEmail = mock(() =>
  Promise.resolve({ success: true, messageId: "msg-123" })
);
const mockRenderEmailTemplate = mock(() => "<html>Test Email</html>");
const mockDbQuery = mock(() =>
  Promise.resolve({
    id: "notif-123",
    status: "pending",
    attemptCount: 0,
  })
);
const mockDbUpdate = mock(() => ({
  set: mock(() => ({
    where: mock(() => Promise.resolve()),
  })),
}));

mock.module("../services/resend-email.service", () => ({
  sendEmail: mockSendEmail,
}));

mock.module("../templates/emails/template-renderer", () => ({
  renderEmailTemplate: mockRenderEmailTemplate,
}));

mock.module("../lib/db", () => ({
  db: {
    query: {
      emailNotifications: {
        findFirst: mockDbQuery,
      },
    },
    update: mockDbUpdate,
  },
}));

// Import processEmailJob after mocking
import { processEmailJob } from "../../services/email-job-processor.service";

describe("Email Worker", () => {
  beforeEach(() => {
    mockSendEmail.mockClear();
    mockRenderEmailTemplate.mockClear();
    mockDbQuery.mockClear();
    mockDbUpdate.mockClear();

    // Default successful responses
    mockSendEmail.mockResolvedValue({ success: true, messageId: "msg-123" });
    mockRenderEmailTemplate.mockReturnValue("<html>Test Email</html>");
    mockDbQuery.mockResolvedValue({
      id: "notif-123",
      status: "pending",
      attemptCount: 0,
    });
  });

  describe("processEmailJob", () => {
    const mockJobData: EmailJobData = {
      notificationId: "notif-123",
      recipientEmail: "test@example.com",
      recipientName: "Test User",
      subject: "Test Email",
      templateName: "workflow-submitted",
      templateData: {
        recipientName: "Test User",
        supplierName: "ACME Corp",
        workflowLink: "http://localhost:3000/workflows/wf-123",
      },
    };

    it("should process email job successfully", async () => {
      await processEmailJob(mockJobData);

      expect(mockDbQuery).toHaveBeenCalled();
      expect(mockRenderEmailTemplate).toHaveBeenCalledWith(
        "workflow-submitted",
        expect.any(Object)
      );
      expect(mockSendEmail).toHaveBeenCalledWith(
        "test@example.com",
        "Test Email",
        "<html>Test Email</html>"
      );
      expect(mockDbUpdate).toHaveBeenCalled();
    });

    it("should handle email send failure and update status", async () => {
      mockSendEmail.mockResolvedValueOnce({
        success: false,
        error: "API error",
      });

      await expect(processEmailJob(mockJobData)).rejects.toThrow();

      expect(mockDbUpdate).toHaveBeenCalled();
    });

    it("should skip if email already sent", async () => {
      mockDbQuery.mockResolvedValueOnce({
        id: "notif-123",
        status: "sent",
        attemptCount: 1,
      });

      await processEmailJob(mockJobData);

      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("should throw error if notification not found", async () => {
      mockDbQuery.mockResolvedValueOnce(null);

      await expect(processEmailJob(mockJobData)).rejects.toThrow(
        "Email notification not found in database"
      );
    });

    it("should handle template rendering errors", async () => {
      mockRenderEmailTemplate.mockImplementationOnce(() => {
        throw new Error("Template not found");
      });

      await expect(processEmailJob(mockJobData)).rejects.toThrow();
    });

    it("should increment attempt count on failure", async () => {
      mockDbQuery.mockResolvedValueOnce({
        id: "notif-123",
        status: "pending",
        attemptCount: 1,
      });

      mockSendEmail.mockResolvedValueOnce({
        success: false,
        error: "Temporary error",
      });

      await expect(processEmailJob(mockJobData)).rejects.toThrow();

      // Verify attempt count would be incremented to 2
      expect(mockDbUpdate).toHaveBeenCalled();
    });
  });
});
