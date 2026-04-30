/**
 * AppShell Component Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { AppShell } from "../AppShell";
import { useNavigationStore } from "~/stores/navigationStore";
import { renderWithRouter } from "~/lib/render-with-router";

// Mock the navigation store
vi.mock("~/stores/navigationStore", () => ({
  useNavigationStore: vi.fn(),
}));

// Mock the permissions hook
vi.mock("~/hooks/usePermissions", () => ({
  usePermissions: vi.fn(() => ({
    isAdmin: true,
    canViewAnalytics: true,
    canManageSuppliers: true,
    canManageQualifications: true,
    canManageEvaluations: true,
    canManageComplaints: true,
  })),
}));

// Mock the keyboard shortcuts hook
vi.mock("~/hooks/useKeyboardShortcuts", () => ({
  useKeyboardShortcuts: vi.fn(),
}));

// Mock AuthProvider context
vi.mock("~/providers/AuthProvider", () => ({
  useAuthContext: vi.fn(() => ({
    user: { id: "123", email: "test@example.com" },
    userRecord: { role: "admin", fullName: "Test User" },
    session: null,
    isLoading: false,
    isAuthenticated: true,
  })),
}));

describe("AppShell", () => {
  const mockToggleSidebar = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useNavigationStore).mockReturnValue({
      isSidebarCollapsed: false,
      toggleSidebar: mockToggleSidebar,
    });
  });

  const renderAppShell = (
    children: React.ReactNode = <div>Test Content</div>
  ) => {
    return renderWithRouter(<AppShell>{children}</AppShell>, {
      appLoaderData: {
        user: { id: "123", email: "test@example.com" },
        userRecord: { role: "admin", fullName: "Test User" },
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
      },
    });
  };

  it("renders children content", () => {
    renderAppShell(<div>Test Content</div>);

    expect(screen.getByText("Test Content")).toBeInTheDocument();
  });

  it("renders skip to main content link", () => {
    renderAppShell();

    const skipLink = screen.getByText(/skip to main content/i);
    expect(skipLink).toBeInTheDocument();
    expect(skipLink).toHaveAttribute("href", "#main-content");
  });

  it("skip link has proper accessibility classes", () => {
    renderAppShell();

    const skipLink = screen.getByText(/skip to main content/i);
    expect(skipLink).toHaveClass("sr-only");
    expect(skipLink).toHaveClass("focus:not-sr-only");
  });

  it("renders sidebar", () => {
    renderAppShell();

    expect(
      screen.getByRole("navigation", { name: /main navigation/i })
    ).toBeInTheDocument();
  });

  it("renders main content area with proper ID", () => {
    const { container } = renderAppShell();

    const mainContent = container.querySelector("#main-content");
    expect(mainContent).toBeInTheDocument();
    expect(mainContent).toHaveAttribute("role", "main");
  });

  it("applies correct padding when sidebar is expanded", () => {
    const { container } = renderAppShell();

    const mainWrapper = container.querySelector(".lg\\:pl-64");
    expect(mainWrapper).toBeInTheDocument();
  });

  it("applies correct padding when sidebar is collapsed", () => {
    vi.mocked(useNavigationStore).mockReturnValue({
      isSidebarCollapsed: true,
      toggleSidebar: mockToggleSidebar,
    });

    const { container } = renderAppShell();

    const mainWrapper = container.querySelector(".lg\\:pl-16");
    expect(mainWrapper).toBeInTheDocument();
  });

  it("has proper background color", () => {
    const { container } = renderAppShell();

    const shell = container.firstChild;
    expect(shell).toHaveClass("bg-neutral-50");
  });

  it("has min-height for full screen", () => {
    const { container } = renderAppShell();

    const shell = container.firstChild;
    expect(shell).toHaveClass("min-h-screen");
  });

  it("includes extra padding for mobile navigation", () => {
    const { container } = renderAppShell();

    const mainContent = container.querySelector("main");
    expect(mainContent).toHaveClass("pb-20"); // Mobile padding
    expect(mainContent).toHaveClass("lg:pb-6"); // Desktop padding
  });
});
