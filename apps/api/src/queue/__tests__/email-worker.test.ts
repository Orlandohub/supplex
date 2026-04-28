import { describe, it, expect, mock, beforeEach } from "bun:test";
import type { EmailJobData } from "../email-queue";
import { createMockDb, mockDbChain, type MockDb } from "../../lib/test-utils";

// ─────────────────────────────────────────────────────────────────────────────
// Module mocks. The `db` mock uses {@link createMockDb} so every chain method
// (`select` / `insert` / `update` / `delete` / `transaction`) is present —
// this prevents partial-shape pollution from leaking into other test files
// in the suite. See SUP-9d.
// ─────────────────────────────────────────────────────────────────────────────

interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

const mockSendEmail = mock(
  (): Promise<SendEmailResult> =>
    Promise.resolve({ success: true, messageId: "msg-123" })
);

const mockRenderEmailTemplate = mock((): string => "<html>Test Email</html>");

interface EmailNotificationFixture {
  id: string;
  status: "pending" | "sent" | "failed" | "bounced";
  attemptCount: number;
}

const mockDbQuery = mock(
  (): Promise<EmailNotificationFixture | null> =>
    Promise.resolve({
      id: "notif-123",
      status: "pending",
      attemptCount: 0,
    })
);

const mockDb: MockDb = createMockDb({
  queryTables: ["emailNotifications"],
});

// Replace the lazily-created `query.emailNotifications.findFirst` stub with
// the typed fixture used across this suite, so production code that calls
// `db.query.emailNotifications.findFirst(...)` exercises our fixture.
mockDb.query.emailNotifications = {
  findFirst: mockDbQuery as MockDb["query"][string]["findFirst"],
  findMany: mock(() =>
    Promise.resolve([])
  ) as MockDb["query"][string]["findMany"],
};

mock.module("../../services/resend-email.service", () => ({
  sendEmail: mockSendEmail,
}));

mock.module("../../templates/emails/template-renderer", () => ({
  renderEmailTemplate: mockRenderEmailTemplate,
}));

mock.module("../../lib/db", () => ({
  db: mockDb,
}));

// Import processEmailJob after mocking so it picks up the typed mocks.
import { processEmailJob } from "../../services/email-job-processor.service";

describe("Email Worker", () => {
  beforeEach(() => {
    mockSendEmail.mockClear();
    mockRenderEmailTemplate.mockClear();
    mockDbQuery.mockClear();
    mockDb.update.mockClear();

    // Default successful responses
    mockSendEmail.mockResolvedValue({ success: true, messageId: "msg-123" });
    mockRenderEmailTemplate.mockReturnValue("<html>Test Email</html>");
    mockDbQuery.mockResolvedValue({
      id: "notif-123",
      status: "pending",
      attemptCount: 0,
    });
    mockDb.update.mockImplementation(() => mockDbChain<unknown>([]));
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
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("should handle email send failure and update status", async () => {
      mockSendEmail.mockResolvedValueOnce({
        success: false,
        error: "API error",
      });

      await expect(processEmailJob(mockJobData)).rejects.toThrow();

      expect(mockDb.update).toHaveBeenCalled();
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

      expect(mockDb.update).toHaveBeenCalled();
    });
  });
});
