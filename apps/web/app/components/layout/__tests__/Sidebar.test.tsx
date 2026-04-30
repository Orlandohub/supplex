/**
 * Sidebar Component Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { Sidebar } from "../Sidebar";
import { useNavigationStore } from "~/stores/navigationStore";
import { renderWithRouter } from "~/lib/render-with-router";

const APP_LOADER_DATA = {
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
};

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

describe("Sidebar", () => {
  const mockToggleSidebar = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useNavigationStore).mockReturnValue({
      isSidebarCollapsed: false,
      toggleSidebar: mockToggleSidebar,
    });
  });

  const renderSidebar = () => {
    return renderWithRouter(<Sidebar />, { appLoaderData: APP_LOADER_DATA });
  };

  it("renders sidebar with navigation items", () => {
    renderSidebar();

    expect(
      screen.getByRole("navigation", { name: /main navigation/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Suppliers")).toBeInTheDocument();
    expect(screen.getByText("My Tasks")).toBeInTheDocument();
    expect(screen.getByText("Workflows")).toBeInTheDocument();
    expect(screen.getByText("Evaluations")).toBeInTheDocument();
    expect(screen.getByText("Complaints")).toBeInTheDocument();
    expect(screen.getByText("Analytics")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("API")).toBeInTheDocument();
  });

  it("displays Supplex logo when expanded", () => {
    renderSidebar();

    expect(screen.getByText("Supplex")).toBeInTheDocument();
  });

  it("hides logo text when collapsed", () => {
    vi.mocked(useNavigationStore).mockReturnValue({
      isSidebarCollapsed: true,
      toggleSidebar: mockToggleSidebar,
    });

    renderSidebar();

    expect(screen.queryByText("Supplex")).not.toBeInTheDocument();
  });

  it("toggles sidebar when collapse button is clicked", () => {
    renderSidebar();

    const toggleButton = screen.getByRole("button", {
      name: /collapse sidebar/i,
    });
    fireEvent.click(toggleButton);

    expect(mockToggleSidebar).toHaveBeenCalledTimes(1);
  });

  it("displays expand button when sidebar is collapsed", () => {
    vi.mocked(useNavigationStore).mockReturnValue({
      isSidebarCollapsed: true,
      toggleSidebar: mockToggleSidebar,
    });

    renderSidebar();

    const expandButton = screen.getByRole("button", {
      name: /expand sidebar/i,
    });
    expect(expandButton).toBeInTheDocument();
  });

  it("has proper ARIA attributes", () => {
    renderSidebar();

    const nav = screen.getByRole("navigation", { name: /main navigation/i });
    expect(nav).toHaveAttribute("aria-label", "Main navigation");

    const toggleButton = screen.getByRole("button", {
      name: /collapse sidebar/i,
    });
    expect(toggleButton).toHaveAttribute("aria-expanded", "true");
  });

  it('sets aria-current="page" on active menu item', () => {
    renderSidebar();

    const dashboardLink = screen.getByRole("link", { name: /dashboard/i });
    // Since we're on "/" in the test, Dashboard should be active
    expect(dashboardLink).toHaveAttribute("aria-current", "page");
  });

  it("shows tooltips when sidebar is collapsed", () => {
    vi.mocked(useNavigationStore).mockReturnValue({
      isSidebarCollapsed: true,
      toggleSidebar: mockToggleSidebar,
    });

    renderSidebar();

    const dashboardLink = screen.getByRole("link", { name: /dashboard/i });
    expect(dashboardLink).toHaveAttribute("title", "Dashboard");
  });

  it("applies correct CSS classes for collapsed state", () => {
    vi.mocked(useNavigationStore).mockReturnValue({
      isSidebarCollapsed: true,
      toggleSidebar: mockToggleSidebar,
    });

    const { container } = renderSidebar();

    const sidebar = container.querySelector("aside");
    expect(sidebar).toHaveClass("w-16");
  });

  it("applies correct CSS classes for expanded state", () => {
    const { container } = renderSidebar();

    const sidebar = container.querySelector("aside");
    expect(sidebar).toHaveClass("w-64");
  });
});
