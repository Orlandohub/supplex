/**
 * GlobalSearch Component Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GlobalSearch } from "../GlobalSearch";

describe("GlobalSearch", () => {
  beforeEach(() => {
    // Clean up
    document.body.innerHTML = "";
  });

  it("renders search input", () => {
    render(<GlobalSearch />);

    const searchInput = screen.getByRole("textbox", { name: /search/i });
    expect(searchInput).toBeInTheDocument();
  });

  it("displays placeholder text", () => {
    render(<GlobalSearch />);

    const searchInput = screen.getByPlaceholderText(
      /search suppliers, documents/i
    );
    expect(searchInput).toBeInTheDocument();
  });

  it("renders search input as disabled", () => {
    render(<GlobalSearch />);

    const searchInput = screen.getByRole("textbox", { name: /search/i });
    expect(searchInput).toBeDisabled();
  });

  it("displays keyboard shortcut badge on desktop", () => {
    render(<GlobalSearch />);

    // The badge should contain either Ctrl+K or ⌘K depending on OS
    const badge = screen.getByText(/Ctrl\+K|⌘K/);
    expect(badge).toBeInTheDocument();
  });

  it("has proper ARIA keyboard shortcut attribute", () => {
    render(<GlobalSearch />);

    const searchInput = screen.getByRole("textbox", { name: /search/i });
    const keyShortcut = searchInput.getAttribute("aria-keyshortcuts");

    // Should be either Control+K or Meta+K
    expect(keyShortcut).toMatch(/Control\+K|Meta\+K/);
  });

  it("shows tooltip when input is focused", () => {
    render(<GlobalSearch />);

    const searchInput = screen.getByRole("textbox", { name: /search/i });
    fireEvent.focus(searchInput);

    expect(screen.getByText(/Search coming in Phase 2/i)).toBeInTheDocument();
  });

  it("hides tooltip when input loses focus", () => {
    render(<GlobalSearch />);

    const searchInput = screen.getByRole("textbox", { name: /search/i });
    fireEvent.focus(searchInput);
    expect(screen.getByText(/Search coming in Phase 2/i)).toBeInTheDocument();

    fireEvent.blur(searchInput);
    expect(
      screen.queryByText(/Search coming in Phase 2/i)
    ).not.toBeInTheDocument();
  });

  it("displays Phase 2 message in tooltip", () => {
    render(<GlobalSearch />);

    const searchInput = screen.getByRole("textbox", { name: /search/i });
    fireEvent.focus(searchInput);

    expect(screen.getByText("🚧 Search coming in Phase 2")).toBeInTheDocument();
    expect(
      screen.getByText(
        /Full-text search across suppliers, documents, and more/i
      )
    ).toBeInTheDocument();
  });

  it("renders search icon", () => {
    const { container } = render(<GlobalSearch />);

    // lucide-react icons have a specific structure
    const icon = container.querySelector("svg");
    expect(icon).toBeInTheDocument();
  });

  it("has proper styling for disabled state", () => {
    render(<GlobalSearch />);

    const searchInput = screen.getByRole("textbox", { name: /search/i });
    expect(searchInput).toHaveClass(
      "disabled:opacity-50",
      "disabled:cursor-not-allowed"
    );
  });
});
