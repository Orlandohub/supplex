import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import AdminEmailLogsPage, { loader } from "../_app.admin.email-logs";
import { createLoaderArgs } from "~/lib/test-utils";
import { requireAuth } from "~/lib/auth/require-auth";
import { createEdenTreatyClient } from "~/lib/api-client";

// Mock API client
// Subjects intentionally do not duplicate the human-readable Event Type
// label so `getByText("Workflow Submitted")` resolves to a single element
// (the Event Type cell). The previous fixture set both columns to the
// same string, which made `getByText` fail with "found multiple elements".
const mockEmailLogs = [
  {
    id: "log-1",
    eventType: "workflow_submitted",
    recipientEmail: "test@example.com",
    subject: "Welcome to your supplier review",
    status: "sent",
    attemptCount: 1,
    sentAt: "2025-10-25T10:00:00Z",
    failedReason: null,
    createdAt: "2025-10-25T09:00:00Z",
  },
  {
    id: "log-2",
    eventType: "stage_approved",
    recipientEmail: "test2@example.com",
    subject: "Stage approval notification",
    status: "failed",
    attemptCount: 3,
    sentAt: null,
    failedReason: "Invalid email address",
    createdAt: "2025-10-25T08:00:00Z",
  },
];

// `vi.mock` calls are hoisted to the top of the file. Earlier revisions of
// this suite called `vi.mock("~/lib/auth/require-auth", …)` again *inside*
// the "should redirect non-admin users" test with `role: "viewer"`; the
// hoist made that override win for every test in the file, so the loader
// always saw a non-admin user, redirected to "/", and every render-based
// test saw a 404. Mock once at module scope and re-configure return values
// per test with `mockResolvedValue` / `mockResolvedValueOnce`.
vi.mock("~/lib/auth/require-auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("~/lib/api-client", () => ({
  createEdenTreatyClient: vi.fn(),
}));

const mockGetEmailLogs = vi.fn();

function setRequireAuth(role: "admin" | "viewer" = "admin") {
  vi.mocked(requireAuth).mockResolvedValue({
    user: { id: "user-123" },
    session: { access_token: "test-token" },
    userRecord: { role },
    // Casting to the broad return type is the trust boundary for the
    // mocked auth response — production callers only read `session` and
    // `userRecord` from this shape.
  } as unknown as Awaited<ReturnType<typeof requireAuth>>);
}

interface MockEmailLogsResponse {
  logs: typeof mockEmailLogs;
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasMore: boolean;
  };
}

function setEmailLogsResponse(response: MockEmailLogsResponse) {
  mockGetEmailLogs.mockResolvedValue({
    data: { success: true, data: response },
    error: null,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setRequireAuth("admin");
  setEmailLogsResponse({
    logs: mockEmailLogs,
    pagination: {
      page: 1,
      limit: 50,
      totalCount: 2,
      totalPages: 1,
      hasMore: false,
    },
  });
  vi.mocked(createEdenTreatyClient).mockReturnValue({
    api: {
      admin: {
        "email-logs": { get: mockGetEmailLogs },
      },
    },
    // The full Eden Treaty client surface is wide; tests only exercise
    // the `admin/email-logs` path so we cast at this single boundary.
  } as unknown as ReturnType<typeof createEdenTreatyClient>);
});

const RemixStub = createRoutesStub([
  {
    path: "/admin/email-logs",
    Component: AdminEmailLogsPage,
    loader,
  },
]);

function renderPage() {
  return render(<RemixStub initialEntries={["/admin/email-logs"]} />);
}

describe("Admin Email Logs Page", () => {
  it("should render email logs page", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Email Logs")).toBeInTheDocument();
    });
  });

  it("should display filter controls", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/status/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/start date/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/end date/i)).toBeInTheDocument();
    });
  });

  it("should have clear filters button", async () => {
    renderPage();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /clear filters/i })
      ).toBeInTheDocument();
    });
  });

  it("should display email logs in table", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Workflow Submitted")).toBeInTheDocument();
      expect(screen.getByText("test@example.com")).toBeInTheDocument();
      expect(screen.getByText("sent")).toBeInTheDocument();
    });
  });

  it("should display failed email with error message", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("failed")).toBeInTheDocument();
      expect(screen.getByText("Invalid email address")).toBeInTheDocument();
    });
  });

  it("should display empty state when no logs", async () => {
    setEmailLogsResponse({
      logs: [],
      pagination: {
        page: 1,
        limit: 50,
        totalCount: 0,
        totalPages: 0,
        hasMore: false,
      },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/no email logs found/i)).toBeInTheDocument();
    });
  });

  it("should display pagination when multiple pages", async () => {
    setEmailLogsResponse({
      logs: mockEmailLogs,
      pagination: {
        page: 1,
        limit: 50,
        totalCount: 100,
        totalPages: 2,
        hasMore: true,
      },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/showing page 1 of 2/i)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /previous/i })
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /next/i })).toBeInTheDocument();
    });
  });

  describe("Loader", () => {
    it("should fetch email logs with default parameters", async () => {
      const request = new Request("http://localhost/admin/email-logs");
      const result = await loader(createLoaderArgs(request));

      const data = (
        result as unknown as {
          data: { logs: unknown; pagination: unknown };
        }
      ).data;
      expect(data.logs).toBeDefined();
      expect(data.pagination).toBeDefined();
    });

    it("should handle filters in query parameters", async () => {
      const request = new Request(
        "http://localhost/admin/email-logs?status=failed&startDate=2025-10-01"
      );
      const result = await loader(createLoaderArgs(request));

      const data = (
        result as unknown as {
          data: { filters: { status: string; startDate: string } };
        }
      ).data;
      expect(data.filters.status).toBe("failed");
      expect(data.filters.startDate).toBe("2025-10-01");
    });

    it("should redirect non-admin users", async () => {
      setRequireAuth("viewer");

      const request = new Request("http://localhost/admin/email-logs");

      // Should redirect (throw redirect response)
      await expect(loader(createLoaderArgs(request))).rejects.toThrow();
    });
  });
});
