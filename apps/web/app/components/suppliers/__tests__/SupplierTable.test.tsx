import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "@remix-run/react";
import { SupplierTable } from "../SupplierTable";
import { SupplierStatus, SupplierCategory } from "@supplex/types";
import type { Supplier } from "@supplex/types";

const mockSuppliers: Supplier[] = [
  {
    id: "supplier-1",
    tenantId: "tenant-123",
    name: "Acme Corp",
    taxId: "TAX-001",
    category: SupplierCategory.RAW_MATERIALS,
    status: SupplierStatus.APPROVED,
    performanceScore: 4.5,
    contactName: "John Doe",
    contactEmail: "john@acme.com",
    contactPhone: "+1234567890",
    address: {
      street: "123 Main St",
      city: "New York",
      state: "NY",
      postalCode: "10001",
      country: "USA",
    },
    certifications: [],
    metadata: {},
    riskScore: 2.5,
    createdBy: "user-123",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-15"),
    deletedAt: null,
  },
  {
    id: "supplier-2",
    tenantId: "tenant-123",
    name: "Beta Supplies",
    taxId: "TAX-002",
    category: SupplierCategory.COMPONENTS,
    status: SupplierStatus.CONDITIONAL,
    performanceScore: 3.2,
    contactName: "Jane Smith",
    contactEmail: "jane@beta.com",
    contactPhone: "+1987654321",
    address: {
      street: "456 Oak Ave",
      city: "Los Angeles",
      state: "CA",
      postalCode: "90001",
      country: "USA",
    },
    certifications: [],
    metadata: {},
    riskScore: 5.0,
    createdBy: "user-123",
    createdAt: new Date("2024-01-02"),
    updatedAt: new Date("2024-01-16"),
    deletedAt: null,
  },
];

describe("SupplierTable", () => {
  it("renders table with correct columns", () => {
    render(
      <BrowserRouter>
        <SupplierTable suppliers={mockSuppliers} />
      </BrowserRouter>
    );
    
    expect(screen.getByText(/supplier name/i)).toBeInTheDocument();
    expect(screen.getByText(/status/i)).toBeInTheDocument();
    expect(screen.getByText(/category/i)).toBeInTheDocument();
    expect(screen.getByText(/location/i)).toBeInTheDocument();
    expect(screen.getByText(/contact/i)).toBeInTheDocument();
    expect(screen.getByText(/last updated/i)).toBeInTheDocument();
  });

  it("renders all supplier rows", () => {
    render(
      <BrowserRouter>
        <SupplierTable suppliers={mockSuppliers} />
      </BrowserRouter>
    );
    
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("Beta Supplies")).toBeInTheDocument();
  });

  it("displays supplier information correctly", () => {
    render(
      <BrowserRouter>
        <SupplierTable suppliers={mockSuppliers} />
      </BrowserRouter>
    );
    
    // Check name and tax ID
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("TAX-001")).toBeInTheDocument();
    
    // Check location
    expect(screen.getByText("New York, USA")).toBeInTheDocument();
    
    // Check contact
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("john@acme.com")).toBeInTheDocument();
  });

  it("displays status badges", () => {
    render(
      <BrowserRouter>
        <SupplierTable suppliers={mockSuppliers} />
      </BrowserRouter>
    );
    
    expect(screen.getByText("Approved")).toBeInTheDocument();
    expect(screen.getByText("Conditional")).toBeInTheDocument();
  });

  it("displays category labels correctly", () => {
    render(
      <BrowserRouter>
        <SupplierTable suppliers={mockSuppliers} />
      </BrowserRouter>
    );
    
    expect(screen.getByText("Raw Materials")).toBeInTheDocument();
    expect(screen.getByText("Components")).toBeInTheDocument();
  });

  it("shows sort icons on sortable columns", () => {
    render(
      <BrowserRouter>
        <SupplierTable suppliers={mockSuppliers} currentSort="name_asc" />
      </BrowserRouter>
    );
    
    // Check that column headers are links for sorting
    const nameHeader = screen.getByText(/supplier name/i).closest("a");
    expect(nameHeader).toBeInTheDocument();
    expect(nameHeader).toHaveAttribute("href", expect.stringContaining("sort="));
  });

  it("makes table rows clickable", () => {
    render(
      <BrowserRouter>
        <SupplierTable suppliers={mockSuppliers} />
      </BrowserRouter>
    );
    
    const rows = screen.getAllByRole("button");
    expect(rows.length).toBeGreaterThan(0);
  });

  it("has keyboard navigation support", () => {
    render(
      <BrowserRouter>
        <SupplierTable suppliers={mockSuppliers} />
      </BrowserRouter>
    );
    
    const rows = screen.getAllByRole("button");
    rows.forEach((row) => {
      expect(row).toHaveAttribute("tabIndex", "0");
    });
  });

  it("renders empty table when no suppliers", () => {
    render(
      <BrowserRouter>
        <SupplierTable suppliers={[]} />
      </BrowserRouter>
    );
    
    // Table should still render with headers
    expect(screen.getByText(/supplier name/i)).toBeInTheDocument();
  });

  it("formats dates correctly", () => {
    render(
      <BrowserRouter>
        <SupplierTable suppliers={mockSuppliers} />
      </BrowserRouter>
    );
    
    // Dates should be formatted as "Jan 15, 2024" style
    expect(screen.getByText(/Jan 15, 2024/i)).toBeInTheDocument();
  });
});

