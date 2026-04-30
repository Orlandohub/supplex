/**
 * Integration Tests for App Shell and Navigation
 * Tests the complete navigation system across different routes and responsive behavior
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor, within } from "@testing-library/react";
import { AppShell } from "../AppShell";
import { useNavigationStore } from "~/stores/navigationStore";
import { renderWithRouter } from "~/lib/render-with-router";

const APP_LOADER_DATA = {
  user: { id: "123", email: "test@example.com" },
  userRecord: {
    role: "admin",
    fullName: "Test User",
    tenant: { name: "Test Company" },
  },
  supplierInfo: null,
  permissions: {
    isAdmin: true,
    isSupplierUser: false,
    isViewer: false,
    isProcurementManager: false,
    isQualityManager: false,
    canManageUsers: true,
    canCreateSuppliers: true,
    canEditSuppliers: true,
    canDeleteSuppliers: true,
    canViewAnalytics: true,
    canAccessSettings: true,
    canCreateQualifications: true,
    canUploadDocuments: true,
    canDeleteDocuments: true,
  },
};

// Mock dependencies
vi.mock("~/stores/navigationStore", () => ({
  useNavigationStore: vi.fn(),
}));

vi.mock("~/hooks/usePermissions", () => ({
  usePermissions: vi.fn(() => ({
    isAdmin: true,
    canViewAnalytics: true,
    canManageSuppliers: true,
  })),
}));

vi.mock("~/hooks/useKeyboardShortcuts", () => ({
  useKeyboardShortcuts: vi.fn(),
}));

vi.mock("~/providers/AuthProvider", () => ({
  useAuthContext: vi.fn(() => ({
    user: { id: "123", email: "test@example.com" },
    userRecord: {
      role: "admin",
      fullName: "Test User",
      tenant: { name: "Test Company" },
    },
    session: null,
    isLoading: false,
    isAuthenticated: true,
  })),
}));

describe("App Shell Integration Tests", () => {
  const mockToggleSidebar = vi.fn();
  const mockSetSidebarCollapsed = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useNavigationStore).mockReturnValue({
      isSidebarCollapsed: false,
      toggleSidebar: mockToggleSidebar,
      setSidebarCollapsed: mockSetSidebarCollapsed,
    });
  });

  const DashboardPage = () => <div>Dashboard Content</div>;
  const SuppliersPage = () => <div>Suppliers Content</div>;

  const renderWithRoutes = (initialRoute = "/") => {
    return renderWithRouter(
      <AppShell>
        <DashboardPage />
      </AppShell>,
      {
        initialEntries: [initialRoute],
        appLoaderData: APP_LOADER_DATA,
        // Mount dashboard at index ("/") and suppliers as a sibling under
        // the same `routes/_app` parent so navigation between them keeps
        // the shared layout data.
        path: "",
        extraRoutes: [
          {
            id: "suppliers-test-route",
            path: "suppliers",
            element: (
              <AppShell>
                <SuppliersPage />
              </AppShell>
            ),
          },
        ],
      }
    );
  };

  describe("Layout Persistence", () => {
    it("maintains app shell across route changes", async () => {
      renderWithRoutes("/");

      // Verify app shell is present
      const sidebarNav = screen.getByRole("navigation", {
        name: /main navigation/i,
      });
      expect(sidebarNav).toBeInTheDocument();
      expect(screen.getByText("Dashboard Content")).toBeInTheDocument();

      // Sidebar and mobile nav both render a "Suppliers" link, so scope
      // the click to the desktop sidebar.
      const suppliersLink = within(sidebarNav).getByRole("link", {
        name: /suppliers/i,
      });
      fireEvent.click(suppliersLink);

      await waitFor(() => {
        expect(screen.getByText("Suppliers Content")).toBeInTheDocument();
      });

      // App shell should still be present
      expect(
        screen.getByRole("navigation", { name: /main navigation/i })
      ).toBeInTheDocument();
    });

    it("does not remount sidebar when navigating between routes", async () => {
      renderWithRoutes("/");

      const sidebarBefore = screen.getByRole("navigation", {
        name: /main navigation/i,
      });

      // Navigating via the data router keeps the layout route mounted, so
      // the sidebar's DOM node should be the same element before and after.
      const suppliersLink = within(sidebarBefore).getByRole("link", {
        name: /suppliers/i,
      });
      fireEvent.click(suppliersLink);

      await waitFor(() => {
        expect(screen.getByText("Suppliers Content")).toBeInTheDocument();
      });

      const sidebarAfter = screen.getByRole("navigation", {
        name: /main navigation/i,
      });
      expect(sidebarAfter).toBe(sidebarBefore);
    });
  });

  describe("Sidebar State Persistence", () => {
    it("persists sidebar collapsed state", () => {
      vi.mocked(useNavigationStore).mockReturnValue({
        isSidebarCollapsed: true,
        toggleSidebar: mockToggleSidebar,
        setSidebarCollapsed: mockSetSidebarCollapsed,
      });

      const { container } = renderWithRoutes("/");

      const sidebar = container.querySelector("aside");
      expect(sidebar).toHaveClass("w-16");
    });

    it("renders expanded layout padding when sidebar is open", () => {
      const { container } = renderWithRoutes("/");

      const mainWrapper = container.querySelector(".lg\\:pl-64");
      expect(mainWrapper).toBeInTheDocument();
    });

    it("renders collapsed layout padding when sidebar is closed", () => {
      vi.mocked(useNavigationStore).mockReturnValue({
        isSidebarCollapsed: true,
        toggleSidebar: mockToggleSidebar,
        setSidebarCollapsed: mockSetSidebarCollapsed,
      });

      const { container } = renderWithRoutes("/");

      const mainWrapper = container.querySelector(".lg\\:pl-16");
      expect(mainWrapper).toBeInTheDocument();
    });
  });

  describe("Responsive Behavior", () => {
    it("hides sidebar on mobile (< 768px)", () => {
      const { container } = renderWithRoutes("/");

      const sidebar = container.querySelector("aside");
      expect(sidebar).toHaveClass("hidden");
      expect(sidebar).toHaveClass("lg:flex");
    });

    it("shows mobile navigation on mobile", () => {
      renderWithRoutes("/");

      // Mobile navigation should be in the DOM
      const mobileNav = screen.getByRole("navigation", {
        name: /mobile navigation/i,
      });
      expect(mobileNav).toBeInTheDocument();
      expect(mobileNav).toHaveClass("lg:hidden");
    });

    it("applies mobile padding to main content", () => {
      const { container } = renderWithRoutes("/");

      const mainContent = container.querySelector("main");
      expect(mainContent).toHaveClass("pb-20"); // Mobile padding for bottom nav
      expect(mainContent).toHaveClass("lg:pb-6"); // Desktop padding
    });
  });

  describe("Active State Management", () => {
    it("highlights active route in sidebar", () => {
      renderWithRoutes("/");

      const sidebarNav = screen.getByRole("navigation", {
        name: /main navigation/i,
      });
      const dashboardLink = within(sidebarNav).getByRole("link", {
        name: /dashboard/i,
      });
      expect(dashboardLink).toHaveAttribute("aria-current", "page");
    });

    it("updates active state when route changes", async () => {
      renderWithRoutes("/");

      const sidebarNav = screen.getByRole("navigation", {
        name: /main navigation/i,
      });
      const suppliersLink = within(sidebarNav).getByRole("link", {
        name: /suppliers/i,
      });
      expect(suppliersLink).not.toHaveAttribute("aria-current");

      fireEvent.click(suppliersLink);

      await waitFor(() => {
        expect(suppliersLink).toHaveAttribute("aria-current", "page");
      });
    });

    it("highlights active route in mobile navigation", () => {
      renderWithRoutes("/");

      const mobileNav = screen.getByRole("navigation", {
        name: /mobile navigation/i,
      });
      const dashboardButton = mobileNav.querySelector('[aria-current="page"]');
      expect(dashboardButton).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("allows keyboard navigation through all interactive elements", () => {
      renderWithRoutes("/");

      // Skip link should be first
      const skipLink = screen.getByText(/skip to main content/i);
      skipLink.focus();
      expect(document.activeElement).toBe(skipLink);

      // Tab to next element (should be in sidebar)
      // Note: Full tab order testing requires actual browser interaction
      expect(skipLink).toHaveAttribute("href", "#main-content");
    });

    it("has proper landmark roles", () => {
      const { container } = renderWithRoutes("/");

      expect(
        screen.getByRole("navigation", { name: /main navigation/i })
      ).toBeInTheDocument();
      expect(screen.getByRole("main")).toBeInTheDocument();

      const header = container.querySelector("header");
      expect(header).toBeInTheDocument();
    });

    it("has skip link that leads to main content", () => {
      const { container } = renderWithRoutes("/");

      const skipLink = screen.getByText(/skip to main content/i);
      const mainContent = container.querySelector("#main-content");

      expect(skipLink).toHaveAttribute("href", "#main-content");
      expect(mainContent).toBeInTheDocument();
    });
  });

  describe("Component Integration", () => {
    it("renders all app shell components together", () => {
      renderWithRoutes("/");

      // Sidebar
      expect(
        screen.getByRole("navigation", { name: /main navigation/i })
      ).toBeInTheDocument();

      // Top navigation with user menu
      expect(
        screen.getByRole("button", { name: /notifications/i })
      ).toBeInTheDocument();

      // Mobile navigation
      expect(
        screen.getByRole("navigation", { name: /mobile navigation/i })
      ).toBeInTheDocument();

      // Main content
      expect(screen.getByRole("main")).toBeInTheDocument();
    });

    it("search and notification components work within app shell", () => {
      renderWithRoutes("/");

      // Search input
      const searchInput = screen.getByRole("textbox", { name: /search/i });
      expect(searchInput).toBeInTheDocument();

      // Notification bell
      const notificationButton = screen.getByRole("button", {
        name: /notifications/i,
      });
      expect(notificationButton).toBeInTheDocument();

      fireEvent.click(notificationButton);
      expect(screen.getByText("Notifications")).toBeInTheDocument();
    });
  });
});
