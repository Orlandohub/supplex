import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import NotificationPreferencesPage, {
  loader,
  action,
} from "../_app.settings.notifications";
import { createActionArgs, createLoaderArgs } from "~/lib/test-utils";

// Mock API client
vi.mock("~/lib/api-client", () => ({
  createEdenTreatyClient: vi.fn(() => ({
    api: {
      users: {
        me: {
          "notification-preferences": {
            get: vi.fn(() =>
              Promise.resolve({
                data: {
                  success: true,
                  data: {
                    workflowSubmitted: true,
                    stageApproved: true,
                    stageRejected: false,
                    stageAdvanced: true,
                    workflowApproved: true,
                  },
                },
                error: null,
              })
            ),
            put: vi.fn(() =>
              Promise.resolve({
                data: { success: true },
                error: null,
              })
            ),
          },
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

// Mock hooks
vi.mock("~/hooks/use-toast", () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe("Notification Preferences Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render notification preferences", async () => {
    const RemixStub = createRoutesStub([
      {
        path: "/settings/notifications",
        Component: NotificationPreferencesPage,
        loader,
      },
    ]);

    render(<RemixStub initialEntries={["/settings/notifications"]} />);

    await waitFor(() => {
      expect(screen.getByText("Email Notifications")).toBeInTheDocument();
    });
  });

  it("should display all notification types", async () => {
    const RemixStub = createRoutesStub([
      {
        path: "/settings/notifications",
        Component: NotificationPreferencesPage,
        loader,
      },
    ]);

    render(<RemixStub initialEntries={["/settings/notifications"]} />);

    await waitFor(() => {
      expect(screen.getByText("Workflow Submitted")).toBeInTheDocument();
      expect(screen.getByText("Stage Approved")).toBeInTheDocument();
      expect(screen.getByText("Stage Rejected")).toBeInTheDocument();
      expect(screen.getByText("Stage Advanced")).toBeInTheDocument();
      expect(screen.getByText("Workflow Approved")).toBeInTheDocument();
    });
  });

  it("should show toggle switches for each notification type", async () => {
    const RemixStub = createRoutesStub([
      {
        path: "/settings/notifications",
        Component: NotificationPreferencesPage,
        loader,
      },
    ]);

    render(<RemixStub initialEntries={["/settings/notifications"]} />);

    await waitFor(() => {
      const switches = screen.getAllByRole("switch");
      expect(switches.length).toBe(5);
    });
  });

  it("should display tip about unsubscribe links", async () => {
    const RemixStub = createRoutesStub([
      {
        path: "/settings/notifications",
        Component: NotificationPreferencesPage,
        loader,
      },
    ]);

    render(<RemixStub initialEntries={["/settings/notifications"]} />);

    await waitFor(() => {
      expect(
        screen.getByText(
          /You can also unsubscribe from specific notification types/i
        )
      ).toBeInTheDocument();
    });
  });

  it("should have back button", async () => {
    const RemixStub = createRoutesStub([
      {
        path: "/settings/notifications",
        Component: NotificationPreferencesPage,
        loader,
      },
    ]);

    render(<RemixStub initialEntries={["/settings/notifications"]} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
    });
  });

  describe("Loader", () => {
    it("should fetch notification preferences", async () => {
      const request = new Request("http://localhost/settings/notifications");
      const result = await loader(createLoaderArgs(request));

      const data = (
        result as unknown as {
          data: { preferences: { workflowSubmitted: boolean } };
        }
      ).data;
      expect(data.preferences).toBeDefined();
      expect(data.preferences.workflowSubmitted).toBe(true);
    });

    it("should return defaults on error", async () => {
      vi.mock("~/lib/api-client", () => ({
        createEdenTreatyClient: vi.fn(() => ({
          api: {
            users: {
              me: {
                "notification-preferences": {
                  get: vi.fn(() => Promise.reject(new Error("API error"))),
                },
              },
            },
          },
        })),
      }));

      const request = new Request("http://localhost/settings/notifications");
      const result = await loader(createLoaderArgs(request));

      const data = (
        result as unknown as { data: { error?: string; preferences: unknown } }
      ).data;
      expect(data.error).toBeDefined();
      expect(data.preferences).toBeDefined(); // Should have defaults
    });
  });

  describe("Action", () => {
    it("should update notification preference", async () => {
      const formData = new FormData();
      formData.set("eventType", "workflow_submitted");
      formData.set("emailEnabled", "false");

      const request = new Request("http://localhost/settings/notifications", {
        method: "POST",
        body: formData,
      });

      const result = await action(createActionArgs(request));

      const data = (result as unknown as { data: { success: boolean } }).data;
      expect(data.success).toBe(true);
    });
  });
});
