import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { BrowserRouter } from "@remix-run/react";
import { SupplierSearchBar } from "../SupplierSearchBar";

// Mock useSearchParams
const mockSetSearchParams = vi.fn();
vi.mock("@remix-run/react", async () => {
  const actual = await vi.importActual("@remix-run/react");
  return {
    ...actual,
    useSearchParams: () => [new URLSearchParams(), mockSetSearchParams],
  };
});

describe("SupplierSearchBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders search input with placeholder", () => {
    render(
      <BrowserRouter>
        <SupplierSearchBar />
      </BrowserRouter>
    );
    const input = screen.getByPlaceholderText(/search by name, company id, or location/i);
    expect(input).toBeInTheDocument();
  });

  it("displays initial search value", () => {
    render(
      <BrowserRouter>
        <SupplierSearchBar initialSearch="Acme Corp" />
      </BrowserRouter>
    );
    const input = screen.getByDisplayValue("Acme Corp");
    expect(input).toBeInTheDocument();
  });

  it("debounces search input", async () => {
    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <SupplierSearchBar />
      </BrowserRouter>
    );
    
    const input = screen.getByRole("textbox");
    await user.type(input, "Test");
    
    // Should not call immediately
    expect(mockSetSearchParams).not.toHaveBeenCalled();
    
    // Should call after debounce delay (300ms)
    await waitFor(
      () => {
        expect(mockSetSearchParams).toHaveBeenCalled();
      },
      { timeout: 400 }
    );
  });

  it("shows clear button when search term is present", async () => {
    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <SupplierSearchBar />
      </BrowserRouter>
    );
    
    const input = screen.getByRole("textbox");
    await user.type(input, "Test");
    
    const clearButton = screen.getByLabelText(/clear search/i);
    expect(clearButton).toBeInTheDocument();
  });

  it("clears search when clear button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <SupplierSearchBar initialSearch="Test" />
      </BrowserRouter>
    );
    
    const clearButton = screen.getByLabelText(/clear search/i);
    await user.click(clearButton);
    
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("");
  });

  it("updates URL params with search term", async () => {
    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <SupplierSearchBar />
      </BrowserRouter>
    );
    
    const input = screen.getByRole("textbox");
    await user.type(input, "Acme");
    
    await waitFor(
      () => {
        expect(mockSetSearchParams).toHaveBeenCalledWith(
          expect.any(URLSearchParams),
          { replace: true }
        );
      },
      { timeout: 400 }
    );
  });

  it("has proper accessibility attributes", () => {
    render(
      <BrowserRouter>
        <SupplierSearchBar />
      </BrowserRouter>
    );
    
    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("aria-label", "Search suppliers");
  });
});

