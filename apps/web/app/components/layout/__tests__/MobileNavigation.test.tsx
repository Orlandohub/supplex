/**
 * MobileNavigation Component Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BrowserRouter } from "react-router";
import { MobileNavigation } from "../MobileNavigation";

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

describe("MobileNavigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.style.overflow = "";
  });

  const renderMobileNav = () => {
    return render(
      <BrowserRouter>
        <MobileNavigation />
      </BrowserRouter>
    );
  };

  it("renders bottom tab bar", () => {
    renderMobileNav();

    expect(
      screen.getByRole("navigation", { name: /mobile navigation/i })
    ).toBeInTheDocument();
  });

  it("renders primary navigation items", () => {
    renderMobileNav();

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Suppliers")).toBeInTheDocument();
    expect(screen.getByText("More")).toBeInTheDocument();
  });

  it("opens more drawer when More button is clicked", () => {
    renderMobileNav();

    const moreButton = screen.getByRole("button", { name: /more menu/i });
    fireEvent.click(moreButton);

    // Check for drawer header
    expect(
      screen.getByRole("dialog", { name: /more menu/i })
    ).toBeInTheDocument();
    expect(screen.getAllByText("More")[0]).toBeInTheDocument(); // Header text
  });

  it("shows additional menu items in more drawer", () => {
    renderMobileNav();

    const moreButton = screen.getByRole("button", { name: /more menu/i });
    fireEvent.click(moreButton);

    // Should show items not in bottom tab bar
    expect(screen.getByText("Qualifications")).toBeInTheDocument();
    expect(screen.getByText("Evaluations")).toBeInTheDocument();
    expect(screen.getByText("Complaints")).toBeInTheDocument();
    expect(screen.getByText("Analytics")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("API")).toBeInTheDocument();
  });

  it("closes drawer when close button is clicked", () => {
    renderMobileNav();

    const moreButton = screen.getByRole("button", { name: /more menu/i });
    fireEvent.click(moreButton);

    const closeButton = screen.getByRole("button", { name: /close menu/i });
    fireEvent.click(closeButton);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes drawer when backdrop is clicked", () => {
    renderMobileNav();

    const moreButton = screen.getByRole("button", { name: /more menu/i });
    fireEvent.click(moreButton);

    const backdrop = document.querySelector(".bg-black\\/50");
    expect(backdrop).toBeInTheDocument();

    fireEvent.click(backdrop!);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("prevents body scroll when drawer is open", () => {
    renderMobileNav();

    expect(document.body.style.overflow).toBe("");

    const moreButton = screen.getByRole("button", { name: /more menu/i });
    fireEvent.click(moreButton);

    expect(document.body.style.overflow).toBe("hidden");
  });

  it("restores body scroll when drawer is closed", () => {
    renderMobileNav();

    const moreButton = screen.getByRole("button", { name: /more menu/i });
    fireEvent.click(moreButton);

    expect(document.body.style.overflow).toBe("hidden");

    const closeButton = screen.getByRole("button", { name: /close menu/i });
    fireEvent.click(closeButton);

    expect(document.body.style.overflow).toBe("");
  });

  it("has touch-optimized button sizes (min 44px)", () => {
    renderMobileNav();

    const dashboardLink = screen.getByRole("link", { name: /dashboard/i });
    expect(dashboardLink).toHaveClass("min-h-[44px]");
  });

  it("highlights active tab", () => {
    renderMobileNav();

    // Dashboard should be active on "/" path
    const dashboardLink = screen.getByRole("link", { name: /dashboard/i });
    expect(dashboardLink).toHaveAttribute("aria-current", "page");
  });

  it("has proper ARIA attributes for more button", () => {
    renderMobileNav();

    const moreButton = screen.getByRole("button", { name: /more menu/i });
    expect(moreButton).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(moreButton);
    expect(moreButton).toHaveAttribute("aria-expanded", "true");
  });
});
