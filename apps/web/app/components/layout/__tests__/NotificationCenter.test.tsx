/**
 * NotificationCenter Component Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NotificationCenter } from "../NotificationCenter";

describe("NotificationCenter", () => {
  beforeEach(() => {
    // Clean up any open dropdowns
    document.body.innerHTML = "";
  });

  it("renders notification bell button", () => {
    render(<NotificationCenter />);

    const button = screen.getByRole("button", { name: /notifications/i });
    expect(button).toBeInTheDocument();
  });

  it("opens dropdown when bell button is clicked", () => {
    render(<NotificationCenter />);

    const button = screen.getByRole("button", { name: /notifications/i });
    fireEvent.click(button);

    expect(screen.getByText("Notifications")).toBeInTheDocument();
    expect(screen.getByText("No notifications yet")).toBeInTheDocument();
  });

  it("closes dropdown when clicking outside", () => {
    render(<NotificationCenter />);

    const button = screen.getByRole("button", { name: /notifications/i });
    fireEvent.click(button);

    expect(screen.getByText("Notifications")).toBeInTheDocument();

    // Click outside (on document body)
    fireEvent.mouseDown(document.body);

    expect(screen.queryByText("Notifications")).not.toBeInTheDocument();
  });

  it("closes dropdown when Escape key is pressed", () => {
    render(<NotificationCenter />);

    const button = screen.getByRole("button", { name: /notifications/i });
    fireEvent.click(button);

    expect(screen.getByText("Notifications")).toBeInTheDocument();

    // Press Escape
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByText("Notifications")).not.toBeInTheDocument();
  });

  it("has proper ARIA attributes", () => {
    render(<NotificationCenter />);

    const button = screen.getByRole("button", { name: /notifications/i });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveAttribute("aria-haspopup", "true");
  });

  it("updates ARIA expanded when dropdown is open", () => {
    render(<NotificationCenter />);

    const button = screen.getByRole("button", { name: /notifications/i });
    fireEvent.click(button);

    expect(button).toHaveAttribute("aria-expanded", "true");
  });

  it("displays Phase 2 feature message", () => {
    render(<NotificationCenter />);

    const button = screen.getByRole("button", { name: /notifications/i });
    fireEvent.click(button);

    expect(screen.getByText("Phase 2 feature")).toBeInTheDocument();
    expect(
      screen.getByText(/Notification system coming in Phase 2/i)
    ).toBeInTheDocument();
  });

  it("does not show notification badge when count is 0", () => {
    const { container } = render(<NotificationCenter />);

    // Badge should not be visible
    const badge = container.querySelector(".bg-blue-600");
    expect(badge).not.toBeInTheDocument();
  });

  it('has disabled "View all" button in footer', () => {
    render(<NotificationCenter />);

    const button = screen.getByRole("button", { name: /notifications/i });
    fireEvent.click(button);

    const viewAllButton = screen.getByRole("button", {
      name: /view all notifications/i,
    });
    expect(viewAllButton).toBeDisabled();
  });
});
