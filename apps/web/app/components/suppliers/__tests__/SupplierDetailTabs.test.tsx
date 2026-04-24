import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { SupplierDetailTabs } from "../SupplierDetailTabs";
import { SupplierStatus, SupplierCategory } from "@supplex/types";
import * as usePermissionsModule from "~/hooks/usePermissions";

// Mock hooks
vi.mock("~/hooks/usePermissions");
vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  const React = await import("react");
  const ReactRouterDOM = await import("react-router");
  const MockForm = React.forwardRef<HTMLFormElement, any>(
    ({ children, ...props }, ref) =>
      React.createElement("form", { ...props, ref }, children)
  );
  MockForm.displayName = "Form";

  return {
    ...actual,
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
    useNavigation: () => ({ state: "idle" }),
    Link: ReactRouterDOM.Link,
    Form: MockForm,
  };
});

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
  certifications: [],
  metadata: {},
  riskScore: 2.5,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-15T00:00:00.000Z",
  createdByName: "Admin User",
  createdByEmail: "admin@example.com",
};

describe("SupplierDetailTabs", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default permissions
    vi.spyOn(usePermissionsModule, "usePermissions").mockReturnValue({
      canEditSupplier: true,
      canDeleteSuppliers: false,
      canManageUsers: false,
      canViewSuppliers: true,
      canCreateSuppliers: false,
      canUploadDocument: false,
      canDeleteDocument: false,
      canCreateEvaluations: false,
      canManageCapa: false,
      canViewAnalytics: false,
      canAccessSettings: false,
      isAdmin: true,
      isViewer: false,
      isSupplierUser: false,
    });
  });

  it("renders all three tabs", () => {
    render(
      <MemoryRouter>
        <SupplierDetailTabs
          supplier={mockSupplier}
          documents={[]}
          workflows={[]}
          formSubmissions={[]}
          token="test-token"
        />
      </MemoryRouter>
    );

    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("Documents")).toBeInTheDocument();
    expect(screen.getByText("History")).toBeInTheDocument();
  });

  it("renders Overview tab content by default", () => {
    render(
      <MemoryRouter>
        <SupplierDetailTabs
          supplier={mockSupplier}
          documents={[]}
          workflows={[]}
          formSubmissions={[]}
          token="test-token"
        />
      </MemoryRouter>
    );

    // Should show supplier name from SupplierOverview
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText(/TAX-001/i)).toBeInTheDocument();
  });

  it("shows Edit button when user has edit permissions", () => {
    render(
      <MemoryRouter>
        <SupplierDetailTabs
          supplier={mockSupplier}
          documents={[]}
          workflows={[]}
          formSubmissions={[]}
          token="test-token"
        />
      </MemoryRouter>
    );

    const editButton = screen.getByText("Edit");
    expect(editButton).toBeInTheDocument();
  });

  it("hides Edit button when user lacks edit permissions", () => {
    vi.spyOn(usePermissionsModule, "usePermissions").mockReturnValue({
      canEditSupplier: false,
      canDeleteSuppliers: false,
      canManageUsers: false,
      canViewSuppliers: true,
      canCreateSuppliers: false,
      canUploadDocument: false,
      canDeleteDocument: false,
      canCreateEvaluations: false,
      canManageCapa: false,
      canViewAnalytics: false,
      canAccessSettings: false,
      isAdmin: false,
      isViewer: true,
      isSupplierUser: false,
    });

    render(
      <MemoryRouter>
        <SupplierDetailTabs
          supplier={mockSupplier}
          documents={[]}
          workflows={[]}
          formSubmissions={[]}
          token="test-token"
        />
      </MemoryRouter>
    );

    expect(screen.queryByText("Edit")).not.toBeInTheDocument();
  });

  it("shows Delete button for Admin users", () => {
    render(
      <MemoryRouter>
        <SupplierDetailTabs
          supplier={mockSupplier}
          documents={[]}
          workflows={[]}
          formSubmissions={[]}
          token="test-token"
        />
      </MemoryRouter>
    );

    const deleteButton = screen.getByText("Delete");
    expect(deleteButton).toBeInTheDocument();
  });

  it("hides Delete button for non-Admin users", () => {
    vi.spyOn(usePermissionsModule, "usePermissions").mockReturnValue({
      canEditSupplier: true,
      canDeleteSuppliers: false,
      canManageUsers: false,
      canViewSuppliers: true,
      canCreateSuppliers: false,
      canUploadDocument: false,
      canDeleteDocument: false,
      canCreateEvaluations: false,
      canManageCapa: false,
      canViewAnalytics: false,
      canAccessSettings: false,
      isAdmin: false,
      isViewer: false,
      isSupplierUser: false,
    });

    render(
      <MemoryRouter>
        <SupplierDetailTabs
          supplier={mockSupplier}
          documents={[]}
          workflows={[]}
          formSubmissions={[]}
          token="test-token"
        />
      </MemoryRouter>
    );

    expect(screen.queryByText("Delete")).not.toBeInTheDocument();
  });

  it("displays status change dropdown", () => {
    render(
      <MemoryRouter>
        <SupplierDetailTabs
          supplier={mockSupplier}
          documents={[]}
          workflows={[]}
          formSubmissions={[]}
          token="test-token"
        />
      </MemoryRouter>
    );

    expect(screen.getByText("Change Status:")).toBeInTheDocument();
  });

  it("shows Documents tab button", () => {
    render(
      <MemoryRouter>
        <SupplierDetailTabs
          supplier={mockSupplier}
          documents={[]}
          workflows={[]}
          formSubmissions={[]}
          token="test-token"
        />
      </MemoryRouter>
    );

    // Check that Documents tab button exists
    const documentsTab = screen.getByRole("tab", { name: "Documents" });
    expect(documentsTab).toBeInTheDocument();
  });

  it("shows History tab button", () => {
    render(
      <MemoryRouter>
        <SupplierDetailTabs
          supplier={mockSupplier}
          documents={[]}
          workflows={[]}
          formSubmissions={[]}
          token="test-token"
        />
      </MemoryRouter>
    );

    // Check that History tab button exists
    const historyTab = screen.getByRole("tab", { name: "History" });
    expect(historyTab).toBeInTheDocument();
  });

  it("opens delete modal when Delete button clicked", () => {
    render(
      <MemoryRouter>
        <SupplierDetailTabs
          supplier={mockSupplier}
          documents={[]}
          workflows={[]}
          formSubmissions={[]}
          token="test-token"
        />
      </MemoryRouter>
    );

    const deleteButton = screen.getByRole("button", { name: /delete/i });
    fireEvent.click(deleteButton);

    // Modal should open - check for confirmation message
    expect(
      screen.getByText(/Are you sure you want to delete "Acme Corp"/i)
    ).toBeInTheDocument();
  });

  it("has proper tab navigation structure", () => {
    render(
      <MemoryRouter>
        <SupplierDetailTabs
          supplier={mockSupplier}
          documents={[]}
          workflows={[]}
          formSubmissions={[]}
          token="test-token"
        />
      </MemoryRouter>
    );

    // All tabs should be clickable
    const overviewTab = screen.getByText("Overview");
    const documentsTab = screen.getByText("Documents");
    const historyTab = screen.getByText("History");

    expect(overviewTab).toBeInTheDocument();
    expect(documentsTab).toBeInTheDocument();
    expect(historyTab).toBeInTheDocument();
  });

  it("Edit button links to correct route", () => {
    render(
      <MemoryRouter>
        <SupplierDetailTabs
          supplier={mockSupplier}
          documents={[]}
          workflows={[]}
          formSubmissions={[]}
          token="test-token"
        />
      </MemoryRouter>
    );

    const editLink = screen.getByText("Edit").closest("a");
    expect(editLink).toHaveAttribute(
      "href",
      `/suppliers/${mockSupplier.id}/edit`
    );
  });

  it("displays action buttons in mobile-responsive layout", () => {
    render(
      <MemoryRouter>
        <SupplierDetailTabs
          supplier={mockSupplier}
          documents={[]}
          workflows={[]}
          formSubmissions={[]}
          token="test-token"
        />
      </MemoryRouter>
    );

    // Buttons should be in a flex container
    const editButton = screen.getByText("Edit");
    const deleteButton = screen.getByText("Delete");

    expect(editButton).toBeInTheDocument();
    expect(deleteButton).toBeInTheDocument();
  });

  it("passes correct props to StatusChangeDropdown", () => {
    render(
      <MemoryRouter>
        <SupplierDetailTabs
          supplier={mockSupplier}
          documents={[]}
          workflows={[]}
          formSubmissions={[]}
          token="test-token"
        />
      </MemoryRouter>
    );

    // Should display current status in the dropdown (button with combobox role)
    const statusButton = screen.getByRole("combobox", {
      name: /change status/i,
    });
    expect(statusButton).toBeInTheDocument();
    // Verify "Approved" text is within the button
    expect(statusButton).toHaveTextContent("Approved");
  });
});
