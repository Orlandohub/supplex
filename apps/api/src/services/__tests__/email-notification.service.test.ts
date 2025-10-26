import { describe, it, expect, mock, beforeEach } from "bun:test";
import {
  sendWorkflowSubmittedEmail,
  sendStageApprovedEmail,
  sendStageRejectedEmail,
  sendSupplierApprovalCongratulations,
} from "../email-notification.service";

// Mock dependencies
const mockQueueEmailJob = mock(() => Promise.resolve());
const mockCheckEmailRateLimit = mock(() => Promise.resolve(true));
const mockDbQuery = mock(() => Promise.resolve(null));

mock.module("../queue/email-queue", () => ({
  queueEmailJob: mockQueueEmailJob,
}));

mock.module("../utils/email-rate-limiter", () => ({
  checkEmailRateLimit: mockCheckEmailRateLimit,
}));

mock.module("../lib/db", () => ({
  db: {
    query: {
      tenants: {
        findFirst: mockDbQuery,
      },
      users: {
        findFirst: mockDbQuery,
      },
      userNotificationPreferences: {
        findFirst: mockDbQuery,
      },
    },
    insert: mock(() => ({
      values: mock(() => ({
        returning: mock(() => Promise.resolve([{ id: "notif-123" }])),
      })),
    })),
  },
}));

describe("Email Notification Service", () => {
  beforeEach(() => {
    mockQueueEmailJob.mockClear();
    mockCheckEmailRateLimit.mockClear();
    mockDbQuery.mockClear();

    // Default: Allow emails (tenant and user preferences enabled)
    mockCheckEmailRateLimit.mockResolvedValue(true);
    mockDbQuery.mockResolvedValue({
      id: "test-tenant",
      settings: {
        emailNotifications: {
          workflowSubmitted: true,
          stageApproved: true,
          stageRejected: true,
          workflowApproved: true,
        },
      },
    });
  });

  describe("sendWorkflowSubmittedEmail", () => {
    it("should queue email when preferences allow", async () => {
      await sendWorkflowSubmittedEmail({
        workflowId: "wf-123",
        reviewerId: "user-123",
        reviewerEmail: "reviewer@example.com",
        reviewerName: "John Reviewer",
        initiatorName: "Jane Initiator",
        supplierName: "ACME Corp",
        riskScore: "5.5",
        workflowLink: "http://localhost:3000/workflows/wf-123",
        tenantId: "tenant-123",
      });

      expect(mockCheckEmailRateLimit).toHaveBeenCalledWith("user-123");
      expect(mockQueueEmailJob).toHaveBeenCalled();
    });

    it("should skip email when rate limit exceeded", async () => {
      mockCheckEmailRateLimit.mockResolvedValueOnce(false);

      await sendWorkflowSubmittedEmail({
        workflowId: "wf-123",
        reviewerId: "user-123",
        reviewerEmail: "reviewer@example.com",
        initiatorName: "Jane Initiator",
        supplierName: "ACME Corp",
        riskScore: "5.5",
        workflowLink: "http://localhost:3000/workflows/wf-123",
        tenantId: "tenant-123",
      });

      expect(mockQueueEmailJob).not.toHaveBeenCalled();
    });

    it("should skip email when tenant setting disabled", async () => {
      mockDbQuery.mockResolvedValueOnce({
        id: "test-tenant",
        settings: {
          emailNotifications: {
            workflowSubmitted: false,
          },
        },
      });

      await sendWorkflowSubmittedEmail({
        workflowId: "wf-123",
        reviewerId: "user-123",
        reviewerEmail: "reviewer@example.com",
        initiatorName: "Jane Initiator",
        supplierName: "ACME Corp",
        riskScore: "5.5",
        workflowLink: "http://localhost:3000/workflows/wf-123",
        tenantId: "tenant-123",
      });

      expect(mockQueueEmailJob).not.toHaveBeenCalled();
    });
  });

  describe("sendStageApprovedEmail", () => {
    it("should queue email with correct template data", async () => {
      await sendStageApprovedEmail({
        workflowId: "wf-123",
        initiatorId: "user-123",
        initiatorEmail: "initiator@example.com",
        initiatorName: "Jane Initiator",
        supplierName: "ACME Corp",
        reviewerName: "John Reviewer",
        stageNumber: 1,
        nextStage: "Quality Review",
        workflowLink: "http://localhost:3000/workflows/wf-123",
        tenantId: "tenant-123",
      });

      expect(mockQueueEmailJob).toHaveBeenCalled();
      const callArgs = mockQueueEmailJob.mock.calls[0][0];
      expect(callArgs.templateName).toBe("stage-approved");
      expect(callArgs.templateData.stageNumber).toBe("1");
    });
  });

  describe("sendStageRejectedEmail", () => {
    it("should include rejection comments in template data", async () => {
      await sendStageRejectedEmail({
        workflowId: "wf-123",
        initiatorId: "user-123",
        initiatorEmail: "initiator@example.com",
        initiatorName: "Jane Initiator",
        supplierName: "ACME Corp",
        reviewerName: "John Reviewer",
        stageNumber: 1,
        rejectionComments: "Missing required documents",
        workflowLink: "http://localhost:3000/workflows/wf-123",
        tenantId: "tenant-123",
      });

      expect(mockQueueEmailJob).toHaveBeenCalled();
      const callArgs = mockQueueEmailJob.mock.calls[0][0];
      expect(callArgs.templateName).toBe("stage-rejected");
      expect(callArgs.templateData.comments).toBe("Missing required documents");
    });
  });

  describe("sendSupplierApprovalCongratulations", () => {
    it("should send to supplier email without user preferences check", async () => {
      await sendSupplierApprovalCongratulations({
        supplierName: "ACME Corp",
        supplierContactName: "Bob Supplier",
        supplierEmail: "supplier@acme.com",
        supplierId: "supplier-123",
        workflowId: "wf-123",
        approverName: "John Approver",
        tenantId: "tenant-123",
      });

      expect(mockQueueEmailJob).toHaveBeenCalled();
      const callArgs = mockQueueEmailJob.mock.calls[0][0];
      expect(callArgs.recipientEmail).toBe("supplier@acme.com");
      expect(callArgs.templateName).toBe("workflow-approved");
      // No rate limit check for supplier emails (external contact)
    });
  });
});
