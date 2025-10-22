import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "../StatusBadge";
import { SupplierStatus } from "@supplex/types";

describe("StatusBadge", () => {
  it("renders approved status with green colors", () => {
    render(<StatusBadge status={SupplierStatus.APPROVED} />);
    const badge = screen.getByRole("status");
    expect(badge).toHaveTextContent("Approved");
    expect(badge).toHaveClass("bg-green-100", "text-green-800", "border-green-200");
  });

  it("renders conditional status with yellow colors", () => {
    render(<StatusBadge status={SupplierStatus.CONDITIONAL} />);
    const badge = screen.getByRole("status");
    expect(badge).toHaveTextContent("Conditional");
    expect(badge).toHaveClass("bg-yellow-100", "text-yellow-800", "border-yellow-200");
  });

  it("renders blocked status with red colors", () => {
    render(<StatusBadge status={SupplierStatus.BLOCKED} />);
    const badge = screen.getByRole("status");
    expect(badge).toHaveTextContent("Blocked");
    expect(badge).toHaveClass("bg-red-100", "text-red-800", "border-red-200");
  });

  it("renders prospect status with gray colors", () => {
    render(<StatusBadge status={SupplierStatus.PROSPECT} />);
    const badge = screen.getByRole("status");
    expect(badge).toHaveTextContent("Prospect");
    expect(badge).toHaveClass("bg-gray-100", "text-gray-800", "border-gray-200");
  });

  it("renders qualified status with blue colors", () => {
    render(<StatusBadge status={SupplierStatus.QUALIFIED} />);
    const badge = screen.getByRole("status");
    expect(badge).toHaveTextContent("Qualified");
    expect(badge).toHaveClass("bg-blue-100", "text-blue-800", "border-blue-200");
  });

  it("has correct aria-label", () => {
    render(<StatusBadge status={SupplierStatus.APPROVED} />);
    const badge = screen.getByRole("status");
    expect(badge).toHaveAttribute("aria-label", "Status: Approved");
  });
});

