import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { Breadcrumb } from "../Breadcrumb";

describe("Breadcrumb", () => {
  it("renders all breadcrumb items", () => {
    const items = [
      { label: "Home", href: "/" },
      { label: "Suppliers", href: "/suppliers" },
      { label: "Acme Corp", href: "", isCurrentPage: true },
    ];

    render(
      <MemoryRouter>
        <Breadcrumb items={items} />
      </MemoryRouter>
    );

    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Suppliers")).toBeInTheDocument();
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
  });

  it("renders separators between items", () => {
    const items = [
      { label: "Home", href: "/" },
      { label: "Suppliers", href: "/suppliers" },
      { label: "Acme Corp", href: "", isCurrentPage: true },
    ];

    const { container } = render(
      <MemoryRouter>
        <Breadcrumb items={items} />
      </MemoryRouter>
    );

    // Should have 2 separators (chevron icons) for 3 items
    const separators = container.querySelectorAll("svg");
    expect(separators.length).toBeGreaterThanOrEqual(2);
  });

  it("makes non-current items clickable links", () => {
    const items = [
      { label: "Home", href: "/" },
      { label: "Suppliers", href: "/suppliers" },
      { label: "Acme Corp", href: "", isCurrentPage: true },
    ];

    render(
      <MemoryRouter>
        <Breadcrumb items={items} />
      </MemoryRouter>
    );

    const homeLink = screen.getByText("Home").closest("a");
    expect(homeLink).toHaveAttribute("href", "/");

    const suppliersLink = screen.getByText("Suppliers").closest("a");
    expect(suppliersLink).toHaveAttribute("href", "/suppliers");
  });

  it("makes current page item non-clickable", () => {
    const items = [
      { label: "Home", href: "/" },
      { label: "Suppliers", href: "/suppliers" },
      { label: "Acme Corp", href: "", isCurrentPage: true },
    ];

    render(
      <MemoryRouter>
        <Breadcrumb items={items} />
      </MemoryRouter>
    );

    const currentItem = screen.getByText("Acme Corp");
    expect(currentItem.tagName).toBe("SPAN");
    expect(currentItem).toHaveAttribute("aria-current", "page");
  });

  it("has proper aria-label for accessibility", () => {
    const items = [
      { label: "Home", href: "/" },
      { label: "Suppliers", href: "/suppliers" },
    ];

    const { container } = render(
      <MemoryRouter>
        <Breadcrumb items={items} />
      </MemoryRouter>
    );

    const nav = container.querySelector("nav");
    expect(nav).toHaveAttribute("aria-label", "Breadcrumb");
  });

  it("truncates long supplier names on mobile", () => {
    const items = [
      { label: "Home", href: "/" },
      { label: "Suppliers", href: "/suppliers" },
      {
        label: "Very Long Supplier Name That Should Be Truncated",
        href: "",
        isCurrentPage: true,
      },
    ];

    render(
      <MemoryRouter>
        <Breadcrumb items={items} />
      </MemoryRouter>
    );

    const longName = screen.getByText(
      "Very Long Supplier Name That Should Be Truncated"
    );
    expect(longName).toBeInTheDocument();
    // Check for truncate class (implementation specific)
    expect(longName.className).toContain("truncate");
  });

  it("handles single item breadcrumb", () => {
    const items = [{ label: "Home", href: "/", isCurrentPage: true }];

    render(
      <MemoryRouter>
        <Breadcrumb items={items} />
      </MemoryRouter>
    );

    expect(screen.getByText("Home")).toBeInTheDocument();

    const { container } = render(
      <MemoryRouter>
        <Breadcrumb items={items} />
      </MemoryRouter>
    );

    // Should have no separators for single item
    const separators = container.querySelectorAll("svg");
    expect(separators.length).toBe(0);
  });

  it("handles two items breadcrumb", () => {
    const items = [
      { label: "Home", href: "/" },
      { label: "Suppliers", href: "/suppliers", isCurrentPage: true },
    ];

    const { container } = render(
      <MemoryRouter>
        <Breadcrumb items={items} />
      </MemoryRouter>
    );

    // Should have 1 separator for 2 items
    const separators = container.querySelectorAll("svg");
    expect(separators.length).toBeGreaterThanOrEqual(1);
  });

  it("applies correct styling to links", () => {
    const items = [
      { label: "Home", href: "/" },
      { label: "Suppliers", href: "/suppliers" },
    ];

    render(
      <MemoryRouter>
        <Breadcrumb items={items} />
      </MemoryRouter>
    );

    const homeLink = screen.getByText("Home").closest("a");
    expect(homeLink?.className).toContain("text-gray-500");
    expect(homeLink?.className).toContain("hover:text-gray-700");
  });

  it("applies correct styling to current page", () => {
    const items = [
      { label: "Home", href: "/" },
      { label: "Current", href: "", isCurrentPage: true },
    ];

    render(
      <MemoryRouter>
        <Breadcrumb items={items} />
      </MemoryRouter>
    );

    const currentItem = screen.getByText("Current");
    expect(currentItem.className).toContain("text-gray-700");
    expect(currentItem.className).toContain("font-medium");
  });

  it("renders with empty href for current page", () => {
    const items = [
      { label: "Home", href: "/" },
      { label: "Current", href: "" },
    ];

    render(
      <MemoryRouter>
        <Breadcrumb items={items} />
      </MemoryRouter>
    );

    // Last item should not be a link
    const currentItem = screen.getByText("Current");
    expect(currentItem.tagName).toBe("SPAN");
  });

  it("has responsive text truncation classes", () => {
    const items = [
      { label: "Home", href: "/" },
      { label: "Very Long Text", href: "", isCurrentPage: true },
    ];

    render(
      <MemoryRouter>
        <Breadcrumb items={items} />
      </MemoryRouter>
    );

    const longText = screen.getByText("Very Long Text");
    // Should have mobile truncation
    expect(longText.className).toContain("max-w-[200px]");
    expect(longText.className).toContain("sm:max-w-none");
  });

  it("maintains semantic HTML structure", () => {
    const items = [
      { label: "Home", href: "/" },
      { label: "Suppliers", href: "/suppliers" },
    ];

    const { container } = render(
      <MemoryRouter>
        <Breadcrumb items={items} />
      </MemoryRouter>
    );

    // Should have nav > ol structure
    const nav = container.querySelector("nav");
    expect(nav).toBeInTheDocument();

    const ol = container.querySelector("ol");
    expect(ol).toBeInTheDocument();

    const listItems = container.querySelectorAll("li");
    expect(listItems.length).toBe(2);
  });
});
