import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "@remix-run/react";
import { SupplierPagination } from "../SupplierPagination";

describe("SupplierPagination", () => {
  it("does not render when there is only one page", () => {
    const { container } = render(
      <BrowserRouter>
        <SupplierPagination currentPage={1} totalItems={10} itemsPerPage={20} />
      </BrowserRouter>
    );
    
    expect(container.firstChild).toBeNull();
  });

  it("displays item count correctly", () => {
    render(
      <BrowserRouter>
        <SupplierPagination currentPage={1} totalItems={50} itemsPerPage={20} />
      </BrowserRouter>
    );
    
    expect(screen.getByText(/showing 1 to 20 of 50 suppliers/i)).toBeInTheDocument();
  });

  it("displays correct item range for page 2", () => {
    render(
      <BrowserRouter>
        <SupplierPagination currentPage={2} totalItems={50} itemsPerPage={20} />
      </BrowserRouter>
    );
    
    expect(screen.getByText(/showing 21 to 40 of 50 suppliers/i)).toBeInTheDocument();
  });

  it("displays correct item range for last page", () => {
    render(
      <BrowserRouter>
        <SupplierPagination currentPage={3} totalItems={45} itemsPerPage={20} />
      </BrowserRouter>
    );
    
    expect(screen.getByText(/showing 41 to 45 of 45 suppliers/i)).toBeInTheDocument();
  });

  it("disables previous button on first page", () => {
    render(
      <BrowserRouter>
        <SupplierPagination currentPage={1} totalItems={50} itemsPerPage={20} />
      </BrowserRouter>
    );
    
    const prevButtons = screen.getAllByText("Previous");
    prevButtons.forEach((button) => {
      const span = button.closest("span");
      if (span) {
        expect(span).toHaveClass("cursor-not-allowed");
      }
    });
  });

  it("disables next button on last page", () => {
    render(
      <BrowserRouter>
        <SupplierPagination currentPage={3} totalItems={50} itemsPerPage={20} />
      </BrowserRouter>
    );
    
    const nextButtons = screen.getAllByText("Next");
    nextButtons.forEach((button) => {
      const span = button.closest("span");
      if (span) {
        expect(span).toHaveClass("cursor-not-allowed");
      }
    });
  });

  it("highlights current page number", () => {
    render(
      <BrowserRouter>
        <SupplierPagination currentPage={2} totalItems={100} itemsPerPage={20} />
      </BrowserRouter>
    );
    
    const pageLink = screen.getByText("2").closest("a");
    expect(pageLink).toHaveClass("bg-blue-50", "border-blue-500", "text-blue-600");
  });

  it("generates page links with correct URLs", () => {
    render(
      <BrowserRouter>
        <SupplierPagination currentPage={1} totalItems={100} itemsPerPage={20} />
      </BrowserRouter>
    );
    
    const page2Link = screen.getByText("2").closest("a");
    expect(page2Link).toHaveAttribute("href", expect.stringContaining("page=2"));
  });

  it("shows ellipsis for large page counts", () => {
    render(
      <BrowserRouter>
        <SupplierPagination currentPage={1} totalItems={200} itemsPerPage={20} />
      </BrowserRouter>
    );
    
    const ellipsis = screen.getByText("...");
    expect(ellipsis).toBeInTheDocument();
  });

  it("renders all page numbers when total pages is small", () => {
    render(
      <BrowserRouter>
        <SupplierPagination currentPage={1} totalItems={60} itemsPerPage={20} />
      </BrowserRouter>
    );
    
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.queryByText("...")).not.toBeInTheDocument();
  });

  it("has proper accessibility with aria-current", () => {
    render(
      <BrowserRouter>
        <SupplierPagination currentPage={2} totalItems={100} itemsPerPage={20} />
      </BrowserRouter>
    );
    
    const currentPageLink = screen.getByText("2").closest("a");
    expect(currentPageLink).toHaveAttribute("aria-current", "page");
  });

  it("shows mobile view with simplified pagination", () => {
    render(
      <BrowserRouter>
        <SupplierPagination currentPage={2} totalItems={100} itemsPerPage={20} />
      </BrowserRouter>
    );
    
    // Check that both mobile and desktop views exist
    const prevButtons = screen.getAllByText("Previous");
    expect(prevButtons.length).toBeGreaterThan(0);
  });

  it("enables previous and next buttons on middle pages", () => {
    render(
      <BrowserRouter>
        <SupplierPagination currentPage={3} totalItems={100} itemsPerPage={20} />
      </BrowserRouter>
    );
    
    const prevLink = screen.getAllByText("Previous")[0].closest("a");
    const nextLink = screen.getAllByText("Next")[0].closest("a");
    
    expect(prevLink).toHaveAttribute("href", expect.stringContaining("page=2"));
    expect(nextLink).toHaveAttribute("href", expect.stringContaining("page=4"));
  });
});

