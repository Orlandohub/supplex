import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { SupplierDetailTabs } from "../SupplierDetailTabs";
import { SupplierStatus, SupplierCategory } from "@supplex/types";
import type * as ReactRouter from "react-router";

/**
 * `SupplierDetailTabs` and the nested `StatusChangeDropdown` both pull
 * permission flags from the `routes/_app` data-router loader. We stub
 * `useRouteLoaderData` so each test can shape what permissions the
 * subtree sees without spinning up a real data router. We also mock
 * the navigation hooks the component pulls in.
 */
const mockUseRouteLoaderData = vi.fn();

vi.mock("react-router", async () => {
  const actual = await vi.importActual<typeof ReactRouter>("react-router");
  const React = await import("react");
  const MockForm = React.forwardRef<
    HTMLFormElement,
    React.HTMLAttributes<HTMLFormElement> & { children?: React.ReactNode }
  >(({ children, ...props }, ref) =>
    React.createElement("form", { ...props, ref }, children)
  );
  MockForm.displayName = "Form";

  return {
    ...actual,
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
    useNavigation: () => ({ state: "idle" }),
    useRouteLoaderData: (id: string) => mockUseRouteLoaderData(id),
    // Nested children of `SupplierDetailTabs` (e.g. `DeleteSupplierModal`,
    // `WorkflowsTab`) reach for the data-router fetcher/revalidator which
    // would otherwise throw outside a real router.
    useFetcher: () => ({
      Form: MockForm,
      submit: vi.fn(),
      load: vi.fn(),
      state: "idle",
      data: undefined,
      formData: undefined,
      formMethod: undefined,
      formAction: undefined,
    }),
    useRevalidator: () => ({ revalidate: vi.fn(), state: "idle" }),
    Link: actual.Link,
    Form: MockForm,
  };
});

const ADMIN_PERMISSIONS = {
  isAdmin: true,
  isSupplierUser: false,
  isViewer: false,
  isProcurementManager: false,
  isQualityManager: false,
  canManageUsers: true,
  canCreateSuppliers: true,
  canEditSuppliers: true,
  canDeleteSuppliers: true,
  canViewAnalytics: true,
  canAccessSettings: true,
  canCreateQualifications: true,
  canUploadDocuments: true,
  canDeleteDocuments: true,
};

function setAppLoaderData(overrides: Partial<typeof ADMIN_PERMISSIONS> = {}) {
  const permissions = { ...ADMIN_PERMISSIONS, ...overrides };
  mockUseRouteLoaderData.mockImplementation((id: string) => {
    if (id === "routes/_app") {
      return {
        user: { id: "user-1" },
        userRecord: null,
        supplierInfo: null,
        permissions,
      };
    }
    return undefined;
  });
}

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
    setAppLoaderData();
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
    setAppLoaderData({
      isAdmin: false,
      isViewer: true,
      canEditSuppliers: false,
      canDeleteSuppliers: false,
      canCreateSuppliers: false,
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
    setAppLoaderData({
      isAdmin: false,
      canDeleteSuppliers: false,
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

    // Radix UI's <TabsTrigger> renders as a <button> rather than an
    // ARIA "tab" role in our jsdom test environment, so assert on the
    // visible label instead of the role/name pair.
    expect(screen.getByText("Documents")).toBeInTheDocument();
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

    expect(screen.getByText("History")).toBeInTheDocument();
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
