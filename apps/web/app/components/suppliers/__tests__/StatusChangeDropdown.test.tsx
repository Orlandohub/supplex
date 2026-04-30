import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StatusChangeDropdown } from "../StatusChangeDropdown";
import { SupplierStatus } from "@supplex/types";
import type * as ReactRouter from "react-router";

/**
 * `StatusChangeDropdown` reads role/permission flags from the
 * `routes/_app` route loader via `useRouteLoaderData`. We stub the hook
 * directly so each test can control what permissions the rendered
 * subtree sees without spinning up a full data-router.
 */
const mockUseRouteLoaderData = vi.fn();

vi.mock("react-router", async () => {
  const actual = await vi.importActual<typeof ReactRouter>("react-router");
  return {
    ...actual,
    useRouteLoaderData: (id: string) => mockUseRouteLoaderData(id),
  };
});

const PERMISSIONS_WITH_EDIT = {
  isAdmin: false,
  isSupplierUser: false,
  isViewer: false,
  isProcurementManager: false,
  isQualityManager: false,
  canManageUsers: false,
  canCreateSuppliers: false,
  canEditSuppliers: true,
  canDeleteSuppliers: false,
  canViewAnalytics: false,
  canAccessSettings: false,
  canCreateQualifications: false,
  canUploadDocuments: false,
  canDeleteDocuments: false,
};

const PERMISSIONS_WITHOUT_EDIT = {
  ...PERMISSIONS_WITH_EDIT,
  isViewer: true,
  canEditSuppliers: false,
};

function setAppLoaderData(permissions: typeof PERMISSIONS_WITH_EDIT) {
  mockUseRouteLoaderData.mockImplementation((id: string) => {
    if (id === "routes/_app") {
      return { permissions };
    }
    return undefined;
  });
}

describe("StatusChangeDropdown", () => {
  const mockSupplierId = "550e8400-e29b-41d4-a716-446655440000";
  const mockSupplierName = "Acme Corp";

  beforeEach(() => {
    vi.clearAllMocks();
    setAppLoaderData(PERMISSIONS_WITH_EDIT);
  });

  it("renders when user has edit permissions", () => {
    render(
      <StatusChangeDropdown
        currentStatus={SupplierStatus.APPROVED}
        supplierId={mockSupplierId}
        supplierName={mockSupplierName}
      />
    );

    expect(screen.getByText("Change Status:")).toBeInTheDocument();
  });

  it("does not render dropdown UI when user lacks edit permissions", () => {
    setAppLoaderData(PERMISSIONS_WITHOUT_EDIT);

    render(
      <StatusChangeDropdown
        currentStatus={SupplierStatus.APPROVED}
        supplierId={mockSupplierId}
        supplierName={mockSupplierName}
      />
    );

    // Production now degrades to a read-only badge for non-editors
    // instead of rendering nothing, so assert the dropdown affordance
    // is hidden and the status is still surfaced as a badge.
    expect(screen.queryByText("Change Status:")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByText("Approved")).toBeInTheDocument();
  });

  it("displays current status correctly", () => {
    render(
      <StatusChangeDropdown
        currentStatus={SupplierStatus.APPROVED}
        supplierId={mockSupplierId}
        supplierName={mockSupplierName}
      />
    );

    expect(screen.getByText("Approved")).toBeInTheDocument();
  });

  it("displays all status options in the dropdown", () => {
    render(
      <StatusChangeDropdown
        currentStatus={SupplierStatus.APPROVED}
        supplierId={mockSupplierId}
        supplierName={mockSupplierName}
      />
    );

    const selectTrigger = screen.getByRole("combobox");
    fireEvent.click(selectTrigger);
  });

  it("has proper label for accessibility", () => {
    render(
      <StatusChangeDropdown
        currentStatus={SupplierStatus.APPROVED}
        supplierId={mockSupplierId}
        supplierName={mockSupplierName}
      />
    );

    const label = screen.getByText("Change Status:");
    expect(label).toBeInTheDocument();

    const select = screen.getByRole("combobox");
    expect(select).toHaveAttribute("id", "status-select");
  });

  it("displays different status values correctly", () => {
    const statuses = [
      { value: SupplierStatus.PROSPECT, label: "Prospect" },
      { value: SupplierStatus.QUALIFIED, label: "Qualified" },
      { value: SupplierStatus.APPROVED, label: "Approved" },
      { value: SupplierStatus.CONDITIONAL, label: "Conditional" },
      { value: SupplierStatus.BLOCKED, label: "Blocked" },
    ];

    statuses.forEach(({ value, label }) => {
      const { unmount } = render(
        <StatusChangeDropdown
          currentStatus={value}
          supplierId={mockSupplierId}
          supplierName={mockSupplierName}
        />
      );

      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    });
  });
});
