import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import NotificationPreferencesPage, {
  loader,
  action,
} from "../_app.settings.notifications";
import { createActionArgs, createLoaderArgs } from "~/lib/test-utils";
import { createEdenTreatyClient } from "~/lib/api-client";

// Stable per-method mocks let individual tests change behaviour without
// re-declaring `vi.mock` (which Vitest hoists to the top of the file and
// causes cross-test pollution when redeclared inside `it`).
const mockGetPreferences = vi.fn();
const mockPutPreferences = vi.fn();

vi.mock("~/lib/api-client", () => ({
  createEdenTreatyClient: vi.fn(() => ({
    api: {
      users: {
        me: {
          "notification-preferences": {
            get: mockGetPreferences,
            put: mockPutPreferences,
          },
        },
      },
    },
  })),
}));

vi.mock("~/lib/auth/require-auth", () => ({
  requireAuth: vi.fn(() =>
    Promise.resolve({
      user: { id: "user-123" },
      session: { access_token: "test-token" },
      userRecord: { role: "admin" },
    })
  ),
}));

vi.mock("~/hooks/use-toast", () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

const successPreferencesResponse = {
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
};

describe("Notification Preferences Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPreferences.mockResolvedValue(successPreferencesResponse);
    mockPutPreferences.mockResolvedValue({
      data: { success: true },
      error: null,
    });
    // `createEdenTreatyClient` is recreated per call site; reattach the
    // stable inner mocks each time so resets don't leave it returning
    // an empty client.
    vi.mocked(createEdenTreatyClient).mockImplementation(
      () =>
        ({
          api: {
            users: {
              me: {
                "notification-preferences": {
                  get: mockGetPreferences,
                  put: mockPutPreferences,
                },
              },
            },
          },
        }) as unknown as ReturnType<typeof createEdenTreatyClient>
    );
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

    // Production renders both a "Back to Settings" link at the top and a
    // standalone "Back" button at the bottom. Match the bottom-of-page
    // exact-name button so the assertion stays unambiguous even after
    // both affordances ship.
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /^back$/i })
      ).toBeInTheDocument();
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
      // Override the per-test `get` resolver instead of redeclaring
      // `vi.mock` (which Vitest hoists and would clobber other tests).
      mockGetPreferences.mockRejectedValueOnce(new Error("API error"));

      const request = new Request("http://localhost/settings/notifications");
      const result = await loader(createLoaderArgs(request));

      const data = (
        result as unknown as { data: { error?: string; preferences: unknown } }
      ).data;
      expect(data.error).toBeDefined();
      expect(data.preferences).toBeDefined();
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
