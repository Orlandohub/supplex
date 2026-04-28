import { describe, it, expect, mock, beforeEach } from "bun:test";
import {
  sendWorkflowSubmittedEmail,
  sendStageApprovedEmail,
  sendStageRejectedEmail,
  sendSupplierApprovalCongratulations,
} from "../email-notification.service";
import { mockDbChain, type MockDb } from "../../lib/test-utils";

// ─────────────────────────────────────────────────────────────────────────────
// Module mocks. NOTE: mock.module() paths are relative to *this* file
// (`apps/api/src/services/__tests__/`), so each path needs `../../` to climb
// out of `__tests__` and `services` to reach `apps/api/src/`. Earlier
// revisions used `../queue/...` / `../lib/...` which silently no-op'd because
// those paths don't resolve to real modules; the production code then
// imported the *real* `db` and crashed against a Postgres uuid validation.
// See SUP-9d.
// ─────────────────────────────────────────────────────────────────────────────

const mockQueueEmailJob = mock((..._args: readonly unknown[]) =>
  Promise.resolve()
);
const mockCheckEmailRateLimit = mock(
  (_userId: string): Promise<boolean> => Promise.resolve(true)
);

interface TenantSettingsFixture {
  id: string;
  settings: {
    emailNotifications: Partial<{
      workflowSubmitted: boolean;
      stageApproved: boolean;
      stageRejected: boolean;
      workflowApproved: boolean;
    }>;
  };
}

const mockDbQuery = mock(
  (..._args: readonly unknown[]): Promise<TenantSettingsFixture | null> =>
    Promise.resolve(null)
);

// Build a complete db mock; pre-register the query namespaces this service
// reads. The chained `insert(...).values(...).returning()` path returns a
// fixture that mimics a freshly-inserted notification row.
const mockInsert = mock(() =>
  mockDbChain<{ id: string }>([{ id: "notif-123" }])
);

const mockDb: MockDb = {
  select: mock(() => mockDbChain<unknown>([])),
  selectDistinct: mock(() => mockDbChain<unknown>([])),
  insert: mockInsert as unknown as MockDb["insert"],
  update: mock(() => mockDbChain<unknown>([])),
  delete: mock(() => mockDbChain<unknown>([])),
  execute: mock(() => Promise.resolve(undefined)),
  transaction: mock(
    async (callback: (tx: MockDb) => unknown | Promise<unknown>) => {
      return await callback(mockDb);
    }
  ),
  query: {
    tenants: {
      findFirst: mockDbQuery as MockDb["query"][string]["findFirst"],
      findMany: mock(() =>
        Promise.resolve([])
      ) as MockDb["query"][string]["findMany"],
    },
    users: {
      findFirst: mockDbQuery as MockDb["query"][string]["findFirst"],
      findMany: mock(() =>
        Promise.resolve([])
      ) as MockDb["query"][string]["findMany"],
    },
    userNotificationPreferences: {
      findFirst: mockDbQuery as MockDb["query"][string]["findFirst"],
      findMany: mock(() =>
        Promise.resolve([])
      ) as MockDb["query"][string]["findMany"],
    },
  },
};

mock.module("../../queue/email-queue", () => ({
  queueEmailJob: mockQueueEmailJob,
}));

mock.module("../../utils/email-rate-limiter", () => ({
  checkEmailRateLimit: mockCheckEmailRateLimit,
}));

mock.module("../../lib/db", () => ({
  db: mockDb,
}));

// ─── Tests ──────────────────────────────────────────────────────────────────

interface QueuedEmailJob {
  templateName: string;
  templateData: Record<string, unknown>;
  recipientEmail: string;
  notificationId: string;
  recipientName?: string;
  subject: string;
}

describe("Email Notification Service", () => {
  beforeEach(() => {
    mockQueueEmailJob.mockClear();
    mockCheckEmailRateLimit.mockClear();
    mockDbQuery.mockClear();

    // Default: allow emails (tenant + user preferences enabled)
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
      const callArgs = mockQueueEmailJob.mock.calls[0]?.[0] as
        | QueuedEmailJob
        | undefined;
      expect(callArgs?.templateName).toBe("stage-approved");
      expect(callArgs?.templateData["stageNumber"]).toBe("1");
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
      const callArgs = mockQueueEmailJob.mock.calls[0]?.[0] as
        | QueuedEmailJob
        | undefined;
      expect(callArgs?.templateName).toBe("stage-rejected");
      expect(callArgs?.templateData["comments"]).toBe(
        "Missing required documents"
      );
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
      const callArgs = mockQueueEmailJob.mock.calls[0]?.[0] as
        | QueuedEmailJob
        | undefined;
      expect(callArgs?.recipientEmail).toBe("supplier@acme.com");
      expect(callArgs?.templateName).toBe("workflow-approved");
    });
  });
});
