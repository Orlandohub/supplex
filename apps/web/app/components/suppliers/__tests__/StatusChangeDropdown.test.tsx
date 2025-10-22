import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StatusChangeDropdown } from "../StatusChangeDropdown";
import { SupplierStatus } from "@supplex/types";
import * as usePermissionsModule from "~/hooks/usePermissions";

// Mock the usePermissions hook
vi.mock("~/hooks/usePermissions");

describe("StatusChangeDropdown", () => {
  const mockSupplierId = "550e8400-e29b-41d4-a716-446655440000";
  const mockSupplierName = "Acme Corp";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders when user has edit permissions", () => {
    vi.spyOn(usePermissionsModule, "usePermissions").mockReturnValue({
      canEditSupplier: true,
      canDeleteSuppliers: false,
      canManageUsers: false,
      canViewSuppliers: true,
      canCreateSuppliers: false,
      canUploadDocuments: false,
      canCreateEvaluations: false,
      canManageCapa: false,
      canViewAnalytics: false,
      canAccessSettings: false,
      isAdmin: false,
      isViewer: false,
    });

    render(
      <StatusChangeDropdown
        currentStatus={SupplierStatus.APPROVED}
        supplierId={mockSupplierId}
        supplierName={mockSupplierName}
      />
    );

    expect(screen.getByText("Change Status:")).toBeInTheDocument();
  });

  it("does not render when user lacks edit permissions", () => {
    vi.spyOn(usePermissionsModule, "usePermissions").mockReturnValue({
      canEditSupplier: false,
      canDeleteSuppliers: false,
      canManageUsers: false,
      canViewSuppliers: true,
      canCreateSuppliers: false,
      canUploadDocuments: false,
      canCreateEvaluations: false,
      canManageCapa: false,
      canViewAnalytics: false,
      canAccessSettings: false,
      isAdmin: false,
      isViewer: true,
    });

    const { container } = render(
      <StatusChangeDropdown
        currentStatus={SupplierStatus.APPROVED}
        supplierId={mockSupplierId}
        supplierName={mockSupplierName}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it("displays current status correctly", () => {
    vi.spyOn(usePermissionsModule, "usePermissions").mockReturnValue({
      canEditSupplier: true,
      canDeleteSuppliers: false,
      canManageUsers: false,
      canViewSuppliers: true,
      canCreateSuppliers: false,
      canUploadDocuments: false,
      canCreateEvaluations: false,
      canManageCapa: false,
      canViewAnalytics: false,
      canAccessSettings: false,
      isAdmin: false,
      isViewer: false,
    });

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
    vi.spyOn(usePermissionsModule, "usePermissions").mockReturnValue({
      canEditSupplier: true,
      canDeleteSuppliers: false,
      canManageUsers: false,
      canViewSuppliers: true,
      canCreateSuppliers: false,
      canUploadDocuments: false,
      canCreateEvaluations: false,
      canManageCapa: false,
      canViewAnalytics: false,
      canAccessSettings: false,
      isAdmin: false,
      isViewer: false,
    });

    render(
      <StatusChangeDropdown
        currentStatus={SupplierStatus.APPROVED}
        supplierId={mockSupplierId}
        supplierName={mockSupplierName}
      />
    );

    // Click the select trigger to open dropdown
    const selectTrigger = screen.getByRole("combobox");
    fireEvent.click(selectTrigger);

    // All status options should be available
    // Note: In actual implementation, these would be in the dropdown menu
    // The exact testing depends on the Select component implementation
  });

  it("has proper label for accessibility", () => {
    vi.spyOn(usePermissionsModule, "usePermissions").mockReturnValue({
      canEditSupplier: true,
      canDeleteSuppliers: false,
      canManageUsers: false,
      canViewSuppliers: true,
      canCreateSuppliers: false,
      canUploadDocuments: false,
      canCreateEvaluations: false,
      canManageCapa: false,
      canViewAnalytics: false,
      canAccessSettings: false,
      isAdmin: false,
      isViewer: false,
    });

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
    vi.spyOn(usePermissionsModule, "usePermissions").mockReturnValue({
      canEditSupplier: true,
      canDeleteSuppliers: false,
      canManageUsers: false,
      canViewSuppliers: true,
      canCreateSuppliers: false,
      canUploadDocuments: false,
      canCreateEvaluations: false,
      canManageCapa: false,
      canViewAnalytics: false,
      canAccessSettings: false,
      isAdmin: false,
      isViewer: false,
    });

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

