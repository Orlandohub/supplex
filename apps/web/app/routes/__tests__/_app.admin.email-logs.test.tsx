import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import AdminEmailLogsPage, { loader } from "../_app.admin.email-logs";
import { createLoaderArgs } from "~/lib/test-utils";

// Mock API client
const mockEmailLogs = [
  {
    id: "log-1",
    eventType: "workflow_submitted",
    recipientEmail: "test@example.com",
    subject: "Workflow Submitted",
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
    subject: "Stage Approved",
    status: "failed",
    attemptCount: 3,
    sentAt: null,
    failedReason: "Invalid email address",
    createdAt: "2025-10-25T08:00:00Z",
  },
];

vi.mock("~/lib/api-client", () => ({
  createEdenTreatyClient: vi.fn(() => ({
    api: {
      admin: {
        "email-logs": {
          get: vi.fn(() =>
            Promise.resolve({
              data: {
                success: true,
                data: {
                  logs: mockEmailLogs,
                  pagination: {
                    page: 1,
                    limit: 50,
                    totalCount: 2,
                    totalPages: 1,
                    hasMore: false,
                  },
                },
              },
              error: null,
            })
          ),
        },
      },
    },
  })),
}));

// Mock auth
vi.mock("~/lib/auth/require-auth", () => ({
  requireAuth: vi.fn(() =>
    Promise.resolve({
      user: { id: "user-123" },
      session: { access_token: "test-token" },
      userRecord: { role: "admin" },
    })
  ),
}));

describe("Admin Email Logs Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render email logs page", async () => {
    const RemixStub = createRoutesStub([
      {
        path: "/admin/email-logs",
        Component: AdminEmailLogsPage,
        loader,
      },
    ]);

    render(<RemixStub initialEntries={["/admin/email-logs"]} />);

    await waitFor(() => {
      expect(screen.getByText("Email Logs")).toBeInTheDocument();
    });
  });

  it("should display filter controls", async () => {
    const RemixStub = createRoutesStub([
      {
        path: "/admin/email-logs",
        Component: AdminEmailLogsPage,
        loader,
      },
    ]);

    render(<RemixStub initialEntries={["/admin/email-logs"]} />);

    await waitFor(() => {
      expect(screen.getByLabelText(/status/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/start date/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/end date/i)).toBeInTheDocument();
    });
  });

  it("should have clear filters button", async () => {
    const RemixStub = createRoutesStub([
      {
        path: "/admin/email-logs",
        Component: AdminEmailLogsPage,
        loader,
      },
    ]);

    render(<RemixStub initialEntries={["/admin/email-logs"]} />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /clear filters/i })
      ).toBeInTheDocument();
    });
  });

  it("should display email logs in table", async () => {
    const RemixStub = createRoutesStub([
      {
        path: "/admin/email-logs",
        Component: AdminEmailLogsPage,
        loader,
      },
    ]);

    render(<RemixStub initialEntries={["/admin/email-logs"]} />);

    await waitFor(() => {
      expect(screen.getByText("Workflow Submitted")).toBeInTheDocument();
      expect(screen.getByText("test@example.com")).toBeInTheDocument();
      expect(screen.getByText("sent")).toBeInTheDocument();
    });
  });

  it("should display failed email with error message", async () => {
    const RemixStub = createRoutesStub([
      {
        path: "/admin/email-logs",
        Component: AdminEmailLogsPage,
        loader,
      },
    ]);

    render(<RemixStub initialEntries={["/admin/email-logs"]} />);

    await waitFor(() => {
      expect(screen.getByText("failed")).toBeInTheDocument();
      expect(screen.getByText("Invalid email address")).toBeInTheDocument();
    });
  });

  it("should display empty state when no logs", async () => {
    vi.mock("~/lib/api-client", () => ({
      createEdenTreatyClient: vi.fn(() => ({
        api: {
          admin: {
            "email-logs": {
              get: vi.fn(() =>
                Promise.resolve({
                  data: {
                    success: true,
                    data: {
                      logs: [],
                      pagination: {
                        page: 1,
                        limit: 50,
                        totalCount: 0,
                        totalPages: 0,
                        hasMore: false,
                      },
                    },
                  },
                  error: null,
                })
              ),
            },
          },
        },
      })),
    }));

    const RemixStub = createRoutesStub([
      {
        path: "/admin/email-logs",
        Component: AdminEmailLogsPage,
        loader,
      },
    ]);

    render(<RemixStub initialEntries={["/admin/email-logs"]} />);

    await waitFor(() => {
      expect(screen.getByText(/no email logs found/i)).toBeInTheDocument();
    });
  });

  it("should display pagination when multiple pages", async () => {
    vi.mock("~/lib/api-client", () => ({
      createEdenTreatyClient: vi.fn(() => ({
        api: {
          admin: {
            "email-logs": {
              get: vi.fn(() =>
                Promise.resolve({
                  data: {
                    success: true,
                    data: {
                      logs: mockEmailLogs,
                      pagination: {
                        page: 1,
                        limit: 50,
                        totalCount: 100,
                        totalPages: 2,
                        hasMore: true,
                      },
                    },
                  },
                  error: null,
                })
              ),
            },
          },
        },
      })),
    }));

    const RemixStub = createRoutesStub([
      {
        path: "/admin/email-logs",
        Component: AdminEmailLogsPage,
        loader,
      },
    ]);

    render(<RemixStub initialEntries={["/admin/email-logs"]} />);

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
      vi.mock("~/lib/auth/require-auth", () => ({
        requireAuth: vi.fn(() =>
          Promise.resolve({
            user: { id: "user-123" },
            session: { access_token: "test-token" },
            userRecord: { role: "viewer" },
          })
        ),
      }));

      const request = new Request("http://localhost/admin/email-logs");

      // Should redirect (throw redirect response)
      await expect(loader(createLoaderArgs(request))).rejects.toThrow();
    });
  });
});
