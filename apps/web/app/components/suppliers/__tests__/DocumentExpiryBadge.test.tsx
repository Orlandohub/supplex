import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DocumentExpiryBadge } from "../DocumentExpiryBadge";

describe("DocumentExpiryBadge", () => {
  it("should display no badge if expiryDate is null", () => {
    const { container } = render(<DocumentExpiryBadge expiryDate={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("should display expired badge for past dates", () => {
    const pastDate = new Date("2020-01-01");
    render(<DocumentExpiryBadge expiryDate={pastDate} />);

    expect(screen.getByText("Expired")).toBeInTheDocument();
  });

  it("should display warning badge for expiry within 30 days", () => {
    // Date 20 days from now
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 20);

    render(<DocumentExpiryBadge expiryDate={futureDate} />);

    expect(screen.getByText(/Expires in \d+ days?/)).toBeInTheDocument();
  });

  it("should display 'Expires in 1 day' (singular)", () => {
    // Date 1 day from now
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    render(<DocumentExpiryBadge expiryDate={tomorrow} />);

    expect(screen.getByText("Expires in 1 day")).toBeInTheDocument();
  });

  it("should display 'Expires in X days' (plural)", () => {
    // Date 5 days from now
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5);

    render(<DocumentExpiryBadge expiryDate={futureDate} />);

    expect(screen.getByText("Expires in 5 days")).toBeInTheDocument();
  });

  it("should display no badge for expiry > 30 days", () => {
    // Date 60 days from now
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 60);

    const { container } = render(
      <DocumentExpiryBadge expiryDate={futureDate} />
    );

    expect(container.firstChild).toBeNull();
  });

  it("should accept string date format", () => {
    const pastDateString = "2020-01-01";
    render(<DocumentExpiryBadge expiryDate={pastDateString} />);

    expect(screen.getByText("Expired")).toBeInTheDocument();
  });

  it("should calculate days correctly at threshold (30 days)", () => {
    // Date exactly 30 days from now
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);

    render(<DocumentExpiryBadge expiryDate={futureDate} />);

    expect(screen.getByText("Expires in 30 days")).toBeInTheDocument();
  });

  it("should calculate days correctly at threshold (31 days - no badge)", () => {
    // Date 31 days from now (should not show badge)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 31);

    const { container } = render(
      <DocumentExpiryBadge expiryDate={futureDate} />
    );

    expect(container.firstChild).toBeNull();
  });
});
