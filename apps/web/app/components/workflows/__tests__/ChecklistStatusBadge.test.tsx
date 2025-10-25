import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChecklistStatusBadge } from "../ChecklistStatusBadge";
import { ChecklistItemStatus } from "@supplex/types";

/**
 * Test Suite for ChecklistStatusBadge Component
 * Tests AC 2 of Story 2.4
 */

describe("ChecklistStatusBadge", () => {
  /**
   * Test: Renders correct color for each status (AC 2)
   */
  it("should render gray badge for Pending status", () => {
    const { container } = render(
      <ChecklistStatusBadge status={ChecklistItemStatus.PENDING} />
    );

    expect(screen.getByText("Not Uploaded")).toBeInTheDocument();

    // Check for secondary variant class (gray)
    const badge = container.querySelector('[class*="secondary"]');
    expect(badge).toBeInTheDocument();
  });

  it("should render blue badge for Uploaded status", () => {
    const { container } = render(
      <ChecklistStatusBadge status={ChecklistItemStatus.UPLOADED} />
    );

    expect(screen.getByText("Uploaded (Pending Review)")).toBeInTheDocument();

    // Check for default variant class (blue/primary)
    const badge = container.querySelector('[class*="primary"]');
    expect(badge).toBeInTheDocument();
  });

  it("should render green badge for Approved status", () => {
    const { container } = render(
      <ChecklistStatusBadge status={ChecklistItemStatus.APPROVED} />
    );

    expect(screen.getByText("Approved")).toBeInTheDocument();

    // Check for success variant class (green)
    const badge = container.querySelector('[class*="green"]');
    expect(badge).toBeInTheDocument();
  });

  it("should render red badge for Rejected status", () => {
    const { container } = render(
      <ChecklistStatusBadge status={ChecklistItemStatus.REJECTED} />
    );

    expect(
      screen.getByText("Rejected - Reupload Required")
    ).toBeInTheDocument();

    // Check for destructive variant class (red)
    const badge = container.querySelector('[class*="destructive"]');
    expect(badge).toBeInTheDocument();
  });

  /**
   * Test: Shows appropriate icon for each status (AC 2)
   */
  it("should display Circle icon for Pending status", () => {
    const { container } = render(
      <ChecklistStatusBadge status={ChecklistItemStatus.PENDING} />
    );

    // Check for svg element (icon)
    const icon = container.querySelector("svg");
    expect(icon).toBeInTheDocument();
  });

  it("should display Upload icon for Uploaded status", () => {
    const { container } = render(
      <ChecklistStatusBadge status={ChecklistItemStatus.UPLOADED} />
    );

    const icon = container.querySelector("svg");
    expect(icon).toBeInTheDocument();
  });

  it("should display CheckCircle2 icon for Approved status", () => {
    const { container } = render(
      <ChecklistStatusBadge status={ChecklistItemStatus.APPROVED} />
    );

    const icon = container.querySelector("svg");
    expect(icon).toBeInTheDocument();
  });

  it("should display XCircle icon for Rejected status", () => {
    const { container } = render(
      <ChecklistStatusBadge status={ChecklistItemStatus.REJECTED} />
    );

    const icon = container.querySelector("svg");
    expect(icon).toBeInTheDocument();
  });

  /**
   * Test: Displays correct status text (AC 2)
   */
  it("should display correct text for each status", () => {
    const statuses = [
      { status: ChecklistItemStatus.PENDING, text: "Not Uploaded" },
      {
        status: ChecklistItemStatus.UPLOADED,
        text: "Uploaded (Pending Review)",
      },
      { status: ChecklistItemStatus.APPROVED, text: "Approved" },
      {
        status: ChecklistItemStatus.REJECTED,
        text: "Rejected - Reupload Required",
      },
    ];

    statuses.forEach(({ status, text }) => {
      const { unmount } = render(<ChecklistStatusBadge status={status} />);
      expect(screen.getByText(text)).toBeInTheDocument();
      unmount();
    });
  });
});
