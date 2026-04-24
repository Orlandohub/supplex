import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SupplierOverview } from "../SupplierOverview";
import { SupplierStatus, SupplierCategory } from "@supplex/types";

const mockSupplier = {
  id: "550e8400-e29b-41d4-a716-446655440000",
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
  certifications: [
    {
      type: "ISO 9001",
      issueDate: "2023-01-01T00:00:00.000Z",
      expiryDate: "2026-01-01T00:00:00.000Z",
      documentId: "750e8400-e29b-41d4-a716-446655440000",
    },
  ],
  metadata: {
    notes: "Primary supplier for raw materials",
    website: "https://acme.com",
  },
  riskScore: 2.5,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-15T00:00:00.000Z",
  createdByName: "Admin User",
  createdByEmail: "admin@example.com",
};

describe("SupplierOverview", () => {
  it("renders supplier name and tax ID", () => {
    render(<SupplierOverview supplier={mockSupplier} token="test-token" />);

    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText(/TAX-001/i)).toBeInTheDocument();
  });

  it("displays status badge", () => {
    render(<SupplierOverview supplier={mockSupplier} token="test-token" />);

    expect(screen.getByText("Approved")).toBeInTheDocument();
  });

  it("displays contact information with clickable links", () => {
    render(<SupplierOverview supplier={mockSupplier} token="test-token" />);

    expect(screen.getByText("John Doe")).toBeInTheDocument();

    const emailLink = screen.getByText("john@acme.com");
    expect(emailLink).toHaveAttribute("href", "mailto:john@acme.com");

    const phoneLink = screen.getByText("+1234567890");
    expect(phoneLink).toHaveAttribute("href", "tel:+1234567890");
  });

  it("displays website link when available", () => {
    render(<SupplierOverview supplier={mockSupplier} token="test-token" />);

    const websiteLink = screen.getByText("https://acme.com");
    expect(websiteLink).toHaveAttribute("href", "https://acme.com");
    expect(websiteLink).toHaveAttribute("target", "_blank");
    expect(websiteLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("displays formatted address", () => {
    render(<SupplierOverview supplier={mockSupplier} token="test-token" />);

    expect(screen.getByText("123 Main St")).toBeInTheDocument();
    expect(screen.getByText(/New York, NY 10001/i)).toBeInTheDocument();
    expect(screen.getByText("USA")).toBeInTheDocument();
  });

  it("displays category badge", () => {
    render(<SupplierOverview supplier={mockSupplier} token="test-token" />);

    expect(screen.getByText("Raw Materials")).toBeInTheDocument();
  });

  it("displays performance score when available", () => {
    render(<SupplierOverview supplier={mockSupplier} token="test-token" />);

    expect(screen.getByText("Performance Score")).toBeInTheDocument();
    expect(screen.getByText("4.5/5")).toBeInTheDocument();
  });

  it("displays risk score when available", () => {
    render(<SupplierOverview supplier={mockSupplier} token="test-token" />);

    expect(screen.getByText("Risk Score")).toBeInTheDocument();
    expect(screen.getByText("2.5/10")).toBeInTheDocument();
  });

  it("hides metrics section when scores are null", () => {
    const supplierWithoutScores = {
      ...mockSupplier,
      performanceScore: null,
      riskScore: null,
    };

    render(
      <SupplierOverview supplier={supplierWithoutScores} token="test-token" />
    );

    expect(screen.queryByText("Performance Score")).not.toBeInTheDocument();
    expect(screen.queryByText("Risk Score")).not.toBeInTheDocument();
  });

  it("displays certifications list", () => {
    render(<SupplierOverview supplier={mockSupplier} token="test-token" />);

    expect(screen.getByText("ISO 9001")).toBeInTheDocument();
    expect(screen.getByText(/January 1, 2023/i)).toBeInTheDocument();
    expect(screen.getByText(/January 1, 2026/i)).toBeInTheDocument();
  });

  it("hides certifications section when empty", () => {
    const supplierWithoutCerts = {
      ...mockSupplier,
      certifications: [],
    };

    render(
      <SupplierOverview supplier={supplierWithoutCerts} token="test-token" />
    );

    expect(screen.queryByText("Certifications")).not.toBeInTheDocument();
  });

  it("displays notes when available", () => {
    render(<SupplierOverview supplier={mockSupplier} token="test-token" />);

    expect(screen.getByText("Notes")).toBeInTheDocument();
    expect(
      screen.getByText("Primary supplier for raw materials")
    ).toBeInTheDocument();
  });

  it("hides notes section when not available", () => {
    const supplierWithoutNotes = {
      ...mockSupplier,
      metadata: {},
    };

    render(
      <SupplierOverview supplier={supplierWithoutNotes} token="test-token" />
    );

    expect(screen.queryByText("Notes")).not.toBeInTheDocument();
  });

  it("displays record information with formatted dates", () => {
    render(<SupplierOverview supplier={mockSupplier} token="test-token" />);

    expect(screen.getByText("Record Information")).toBeInTheDocument();
    expect(screen.getByText(/January 1, 2024/i)).toBeInTheDocument();
    expect(screen.getByText(/January 15, 2024/i)).toBeInTheDocument();
  });

  it("displays created by user name", () => {
    render(<SupplierOverview supplier={mockSupplier} token="test-token" />);

    expect(screen.getByText("by Admin User")).toBeInTheDocument();
  });

  it("handles missing created by name gracefully", () => {
    const supplierWithoutCreator = {
      ...mockSupplier,
      createdByName: undefined,
    };

    render(
      <SupplierOverview supplier={supplierWithoutCreator} token="test-token" />
    );

    // Should still render the created date
    expect(screen.getByText(/January 1, 2024/i)).toBeInTheDocument();
    // Should not show "by undefined"
    expect(screen.queryByText("by undefined")).not.toBeInTheDocument();
  });

  it("renders multiple certifications correctly", () => {
    const supplierWithMultipleCerts = {
      ...mockSupplier,
      certifications: [
        {
          type: "ISO 9001",
          issueDate: "2023-01-01T00:00:00.000Z",
          expiryDate: "2026-01-01T00:00:00.000Z",
        },
        {
          type: "ISO 14001",
          issueDate: "2023-06-01T00:00:00.000Z",
          expiryDate: "2026-06-01T00:00:00.000Z",
        },
      ],
    };

    render(
      <SupplierOverview
        supplier={supplierWithMultipleCerts}
        token="test-token"
      />
    );

    expect(screen.getByText("ISO 9001")).toBeInTheDocument();
    expect(screen.getByText("ISO 14001")).toBeInTheDocument();
  });

  it("renders all supplier categories correctly", () => {
    const categories = [
      { value: SupplierCategory.RAW_MATERIALS, label: "Raw Materials" },
      { value: SupplierCategory.COMPONENTS, label: "Components" },
      { value: SupplierCategory.SERVICES, label: "Services" },
      { value: SupplierCategory.PACKAGING, label: "Packaging" },
      { value: SupplierCategory.LOGISTICS, label: "Logistics" },
    ];

    categories.forEach(({ value, label }) => {
      const supplier = { ...mockSupplier, category: value };
      const { unmount } = render(
        <SupplierOverview supplier={supplier} token="test-token" />
      );
      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    });
  });

  it("has proper section headings for accessibility", () => {
    render(<SupplierOverview supplier={mockSupplier} token="test-token" />);

    expect(screen.getByText("Contact Information")).toBeInTheDocument();
    expect(screen.getByText("Address")).toBeInTheDocument();
    expect(screen.getByText("Category")).toBeInTheDocument();
    expect(screen.getByText("Metrics")).toBeInTheDocument();
    expect(screen.getByText("Certifications")).toBeInTheDocument();
  });
});
