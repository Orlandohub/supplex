import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DuplicateWarningModal } from "../DuplicateWarningModal";
import { SupplierCategory, SupplierStatus } from "@supplex/types";

// Mock Remix Link and Form
vi.mock("react-router", () => ({
  Link: ({ children, to, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  Form: ({ children, ...props }: any) => <form {...props}>{children}</form>,
}));

describe("DuplicateWarningModal", () => {
  const mockOnClose = vi.fn();
  const mockOnSaveAnyway = vi.fn();

  const mockFormData = {
    name: "Acme Corp",
    taxId: "12-3456789",
    category: SupplierCategory.RAW_MATERIALS,
    status: SupplierStatus.PROSPECT,
    contactName: "John Doe",
    contactEmail: "john@acme.com",
    contactPhone: "+1-555-0100",
    address: {
      street: "123 Main St",
      city: "New York",
      state: "NY",
      postalCode: "10001",
      country: "USA",
    },
    website: "https://acme.com",
    notes: "Test notes",
  };

  const mockDuplicates = [
    { id: "dup-1", name: "ACME Corporation" },
    { id: "dup-2", name: "Acme Corp Ltd" },
  ];

  beforeEach(() => {
    mockOnClose.mockClear();
    mockOnSaveAnyway.mockClear();
  });

  it("renders when open", () => {
    render(
      <DuplicateWarningModal
        isOpen={true}
        onClose={mockOnClose}
        duplicates={mockDuplicates}
        formData={mockFormData}
        onSaveAnyway={mockOnSaveAnyway}
      />
    );

    expect(
      screen.getByText("Potential Duplicate Supplier")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/A supplier with a similar name already exists/i)
    ).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(
      <DuplicateWarningModal
        isOpen={false}
        onClose={mockOnClose}
        duplicates={mockDuplicates}
        formData={mockFormData}
        onSaveAnyway={mockOnSaveAnyway}
      />
    );

    expect(
      screen.queryByText("Potential Duplicate Supplier")
    ).not.toBeInTheDocument();
  });

  it("displays list of duplicate suppliers", () => {
    render(
      <DuplicateWarningModal
        isOpen={true}
        onClose={mockOnClose}
        duplicates={mockDuplicates}
        formData={mockFormData}
        onSaveAnyway={mockOnSaveAnyway}
      />
    );

    expect(screen.getByText("ACME Corporation")).toBeInTheDocument();
    expect(screen.getByText("Acme Corp Ltd")).toBeInTheDocument();
  });

  it("displays view links for each duplicate", () => {
    render(
      <DuplicateWarningModal
        isOpen={true}
        onClose={mockOnClose}
        duplicates={mockDuplicates}
        formData={mockFormData}
        onSaveAnyway={mockOnSaveAnyway}
      />
    );

    const viewLinks = screen.getAllByText("View");
    expect(viewLinks).toHaveLength(2);
    expect(viewLinks[0]).toHaveAttribute("href", "/suppliers/dup-1");
    expect(viewLinks[1]).toHaveAttribute("href", "/suppliers/dup-2");
  });

  it("calls onClose when Cancel button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <DuplicateWarningModal
        isOpen={true}
        onClose={mockOnClose}
        duplicates={mockDuplicates}
        formData={mockFormData}
        onSaveAnyway={mockOnSaveAnyway}
      />
    );

    const cancelButton = screen.getByRole("button", { name: /Cancel/i });
    await user.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("includes all form data as hidden inputs when Save Anyway is clicked", () => {
    render(
      <DuplicateWarningModal
        isOpen={true}
        onClose={mockOnClose}
        duplicates={mockDuplicates}
        formData={mockFormData}
        onSaveAnyway={mockOnSaveAnyway}
      />
    );

    // Check for forceSave hidden input
    const forceSaveInput = screen.getByDisplayValue("true");
    expect(forceSaveInput).toHaveAttribute("name", "forceSave");

    // Check for form data hidden inputs
    expect(screen.getByDisplayValue(mockFormData.name)).toHaveAttribute(
      "name",
      "name"
    );
    expect(screen.getByDisplayValue(mockFormData.taxId)).toHaveAttribute(
      "name",
      "taxId"
    );
    expect(screen.getByDisplayValue(mockFormData.category)).toHaveAttribute(
      "name",
      "category"
    );
    expect(screen.getByDisplayValue(mockFormData.status)).toHaveAttribute(
      "name",
      "status"
    );
    expect(screen.getByDisplayValue(mockFormData.contactName)).toHaveAttribute(
      "name",
      "contactName"
    );
    expect(screen.getByDisplayValue(mockFormData.contactEmail)).toHaveAttribute(
      "name",
      "contactEmail"
    );
    expect(
      screen.getByDisplayValue(mockFormData.contactPhone!)
    ).toHaveAttribute("name", "contactPhone");

    // Check address fields
    expect(
      screen.getByDisplayValue(mockFormData.address.street)
    ).toHaveAttribute("name", "address.street");
    expect(screen.getByDisplayValue(mockFormData.address.city)).toHaveAttribute(
      "name",
      "address.city"
    );
    expect(
      screen.getByDisplayValue(mockFormData.address.state)
    ).toHaveAttribute("name", "address.state");
    expect(
      screen.getByDisplayValue(mockFormData.address.postalCode)
    ).toHaveAttribute("name", "address.postalCode");
    expect(
      screen.getByDisplayValue(mockFormData.address.country)
    ).toHaveAttribute("name", "address.country");

    // Check optional fields
    expect(screen.getByDisplayValue(mockFormData.website!)).toHaveAttribute(
      "name",
      "website"
    );
    expect(screen.getByDisplayValue(mockFormData.notes!)).toHaveAttribute(
      "name",
      "notes"
    );
  });

  it("calls onSaveAnyway when Save Anyway button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <DuplicateWarningModal
        isOpen={true}
        onClose={mockOnClose}
        duplicates={mockDuplicates}
        formData={mockFormData}
        onSaveAnyway={mockOnSaveAnyway}
      />
    );

    const saveAnywayButton = screen.getByRole("button", {
      name: /Save Anyway/i,
    });
    await user.click(saveAnywayButton);

    expect(mockOnSaveAnyway).toHaveBeenCalledTimes(1);
  });

  it("handles optional fields correctly when they are empty", () => {
    const formDataWithoutOptionals = {
      ...mockFormData,
      contactPhone: undefined,
      website: undefined,
      notes: undefined,
    };

    render(
      <DuplicateWarningModal
        isOpen={true}
        onClose={mockOnClose}
        duplicates={mockDuplicates}
        formData={formDataWithoutOptionals}
        onSaveAnyway={mockOnSaveAnyway}
      />
    );

    // Should not have hidden inputs for optional fields when they're undefined
    const hiddenInputs = screen.getAllByDisplayValue(/./);
    const inputNames = hiddenInputs.map((input) => input.getAttribute("name"));

    expect(inputNames).not.toContain("contactPhone");
    expect(inputNames).not.toContain("website");
    expect(inputNames).not.toContain("notes");
  });
});
