import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { SupplierPagination } from "../SupplierPagination";

// Mock Remix hooks since MemoryRouter doesn't provide them
vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  const ReactRouterDOM = await import("react-router");
  return {
    ...actual,
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
    Link: ReactRouterDOM.Link,
  };
});

describe("SupplierPagination", () => {
  it("does not render when there is only one page", () => {
    const { container } = render(
      <MemoryRouter>
        <SupplierPagination currentPage={1} totalItems={10} itemsPerPage={20} />
      </MemoryRouter>
    );

    expect(container.firstChild).toBeNull();
  });

  it("displays item count correctly", () => {
    const { container } = render(
      <MemoryRouter>
        <SupplierPagination currentPage={1} totalItems={50} itemsPerPage={20} />
      </MemoryRouter>
    );

    // Text is in a paragraph - query the content
    const paragraph = container.querySelector("p.text-sm.text-gray-700");
    expect(paragraph).toBeInTheDocument();
    expect(paragraph?.textContent).toMatch(
      /Showing\s+1\s+to\s+20\s+of\s+50\s+suppliers/i
    );
  });

  it("displays correct item range for page 2", () => {
    const { container } = render(
      <MemoryRouter>
        <SupplierPagination currentPage={2} totalItems={50} itemsPerPage={20} />
      </MemoryRouter>
    );

    // Check paragraph content
    const paragraph = container.querySelector("p.text-sm.text-gray-700");
    expect(paragraph?.textContent).toMatch(
      /Showing\s+21\s+to\s+40\s+of\s+50\s+suppliers/i
    );
  });

  it("displays correct item range for last page", () => {
    const { container } = render(
      <MemoryRouter>
        <SupplierPagination currentPage={3} totalItems={45} itemsPerPage={20} />
      </MemoryRouter>
    );

    // Check paragraph content
    const paragraph = container.querySelector("p.text-sm.text-gray-700");
    expect(paragraph?.textContent).toMatch(
      /Showing\s+41\s+to\s+45\s+of\s+45\s+suppliers/i
    );
  });

  it("disables previous button on first page", () => {
    const { container } = render(
      <MemoryRouter>
        <SupplierPagination currentPage={1} totalItems={50} itemsPerPage={20} />
      </MemoryRouter>
    );

    // Check for disabled Previous button (span with cursor-not-allowed class)
    const disabledPrevSpan = container.querySelector("span.cursor-not-allowed");
    expect(disabledPrevSpan).toBeInTheDocument();
    expect(disabledPrevSpan?.textContent).toContain("Previous");
  });

  it("disables next button on last page", () => {
    const { container } = render(
      <MemoryRouter>
        <SupplierPagination currentPage={3} totalItems={50} itemsPerPage={20} />
      </MemoryRouter>
    );

    // Check for disabled Next button (span with cursor-not-allowed class)
    const disabledSpans = container.querySelectorAll("span.cursor-not-allowed");
    const nextSpan = Array.from(disabledSpans).find((span) =>
      span.textContent?.includes("Next")
    );
    expect(nextSpan).toBeInTheDocument();
  });

  it("highlights current page number", () => {
    render(
      <MemoryRouter>
        <SupplierPagination
          currentPage={2}
          totalItems={100}
          itemsPerPage={20}
        />
      </MemoryRouter>
    );

    const pageLink = screen.getByText("2").closest("a");
    expect(pageLink).toHaveClass(
      "bg-blue-50",
      "border-blue-500",
      "text-blue-600"
    );
  });

  it("generates page links with correct URLs", () => {
    render(
      <MemoryRouter>
        <SupplierPagination
          currentPage={1}
          totalItems={100}
          itemsPerPage={20}
        />
      </MemoryRouter>
    );

    const page2Link = screen.getByText("2").closest("a");
    expect(page2Link).toHaveAttribute(
      "href",
      expect.stringContaining("page=2")
    );
  });

  it("shows ellipsis for large page counts", () => {
    render(
      <MemoryRouter>
        <SupplierPagination
          currentPage={1}
          totalItems={200}
          itemsPerPage={20}
        />
      </MemoryRouter>
    );

    const ellipsis = screen.getByText("...");
    expect(ellipsis).toBeInTheDocument();
  });

  it("renders all page numbers when total pages is small", () => {
    const { container } = render(
      <MemoryRouter>
        <SupplierPagination currentPage={1} totalItems={60} itemsPerPage={20} />
      </MemoryRouter>
    );

    // Check for page number links (not the count display)
    const pageLinks = container.querySelectorAll("nav a");
    const pageNumbers = Array.from(pageLinks)
      .map((link) => link.textContent)
      .filter((text) => /^\d+$/.test(text || ""));
    expect(pageNumbers).toContain("1");
    expect(pageNumbers).toContain("2");
    expect(pageNumbers).toContain("3");
    expect(screen.queryByText("...")).not.toBeInTheDocument();
  });

  it("has proper accessibility with aria-current", () => {
    render(
      <MemoryRouter>
        <SupplierPagination
          currentPage={2}
          totalItems={100}
          itemsPerPage={20}
        />
      </MemoryRouter>
    );

    const currentPageLink = screen.getByText("2").closest("a");
    expect(currentPageLink).toHaveAttribute("aria-current", "page");
  });

  it("shows mobile view with simplified pagination", () => {
    render(
      <MemoryRouter>
        <SupplierPagination
          currentPage={2}
          totalItems={100}
          itemsPerPage={20}
        />
      </MemoryRouter>
    );

    // Check that both mobile and desktop views exist
    const prevButtons = screen.getAllByText("Previous");
    expect(prevButtons.length).toBeGreaterThan(0);
  });

  it("enables previous and next buttons on middle pages", () => {
    render(
      <MemoryRouter>
        <SupplierPagination
          currentPage={3}
          totalItems={100}
          itemsPerPage={20}
        />
      </MemoryRouter>
    );

    const prevLink = screen.getAllByText("Previous")[0]?.closest("a");
    const nextLink = screen.getAllByText("Next")[0]?.closest("a");

    expect(prevLink).toHaveAttribute("href", expect.stringContaining("page=2"));
    expect(nextLink).toHaveAttribute("href", expect.stringContaining("page=4"));
  });
});
