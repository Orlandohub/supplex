import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SupplierContactCard } from "../SupplierContactCard";
import * as RemixReact from "react-router";

// Mock Remix hooks
vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    useRouteLoaderData: vi.fn(),
    useRevalidator: vi.fn(() => ({
      revalidate: vi.fn(),
      state: "idle",
    })),
  };
});

// Mock API client
vi.mock("~/lib/api-client", () => ({
  createEdenTreatyClient: vi.fn(() => ({
    api: {
      suppliers: {
        "test-supplier-id": {
          contact: {
            patch: vi.fn(() =>
              Promise.resolve({
                data: { success: true },
                error: null,
              })
            ),
          },
        },
      },
    },
  })),
}));

// Mock toast hook
const mockToast = vi.fn();
vi.mock("~/hooks/use-toast", () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

const mockActiveSupplierUser = {
  id: "user-123",
  email: "contact@supplier.com",
  fullName: "John Doe",
  role: "supplier_user",
  isActive: true,
  status: "active",
};

const mockDeactivatedSupplierUser = {
  id: "user-456",
  email: "inactive@supplier.com",
  fullName: "Jane Smith",
  role: "supplier_user",
  isActive: false,
  status: "deactivated",
};

describe("SupplierContactCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Display Tests", () => {
    it("should show 'No contact user associated' when supplierUser is null", () => {
      // Mock permissions - doesn't matter for null case
      vi.mocked(RemixReact.useRouteLoaderData).mockReturnValue({
        permissions: { canEditSuppliers: false },
      });

      render(
        <SupplierContactCard
          supplierUser={null}
          supplierId="test-supplier-id"
          token="mock-token"
        />
      );

      expect(
        screen.getByText("No contact user associated")
      ).toBeInTheDocument();
      expect(screen.queryByText("Edit Contact")).not.toBeInTheDocument();
    });

    it("should display contact information when supplierUser exists", () => {
      vi.mocked(RemixReact.useRouteLoaderData).mockReturnValue({
        permissions: { canEditSuppliers: true },
      });

      render(
        <SupplierContactCard
          supplierUser={mockActiveSupplierUser}
          supplierId="test-supplier-id"
          token="mock-token"
        />
      );

      // Check contact name
      expect(screen.getByText("Contact Name")).toBeInTheDocument();
      expect(screen.getByText("John Doe")).toBeInTheDocument();

      // Check contact email
      expect(screen.getByText("Contact Email")).toBeInTheDocument();
      expect(screen.getByText("contact@supplier.com")).toBeInTheDocument();

      // Check access status
      expect(screen.getByText("Access Status")).toBeInTheDocument();
      expect(screen.getByText("Active")).toBeInTheDocument();
    });

    it("should display 'Active' badge for active users", () => {
      vi.mocked(RemixReact.useRouteLoaderData).mockReturnValue({
        permissions: { canEditSuppliers: false },
      });

      render(
        <SupplierContactCard
          supplierUser={mockActiveSupplierUser}
          supplierId="test-supplier-id"
          token="mock-token"
        />
      );

      const activeBadge = screen.getByText("Active");
      expect(activeBadge).toBeInTheDocument();
    });

    it("should display 'Deactivated' badge for inactive users", () => {
      vi.mocked(RemixReact.useRouteLoaderData).mockReturnValue({
        permissions: { canEditSuppliers: false },
      });

      render(
        <SupplierContactCard
          supplierUser={mockDeactivatedSupplierUser}
          supplierId="test-supplier-id"
          token="mock-token"
        />
      );

      const deactivatedBadge = screen.getByText("Deactivated");
      expect(deactivatedBadge).toBeInTheDocument();
    });
  });

  describe("Permission Tests (SSR-First)", () => {
    it("should show edit button when user has canEditSuppliers permission", () => {
      vi.mocked(RemixReact.useRouteLoaderData).mockReturnValue({
        permissions: { canEditSuppliers: true },
      });

      render(
        <SupplierContactCard
          supplierUser={mockActiveSupplierUser}
          supplierId="test-supplier-id"
          token="mock-token"
        />
      );

      expect(screen.getByText("Edit Contact")).toBeInTheDocument();
    });

    it("should hide edit button when user lacks canEditSuppliers permission", () => {
      vi.mocked(RemixReact.useRouteLoaderData).mockReturnValue({
        permissions: { canEditSuppliers: false },
      });

      render(
        <SupplierContactCard
          supplierUser={mockActiveSupplierUser}
          supplierId="test-supplier-id"
          token="mock-token"
        />
      );

      expect(screen.queryByText("Edit Contact")).not.toBeInTheDocument();
    });

    it("should hide edit button when permissions are undefined (fallback)", () => {
      vi.mocked(RemixReact.useRouteLoaderData).mockReturnValue(null);

      render(
        <SupplierContactCard
          supplierUser={mockActiveSupplierUser}
          supplierId="test-supplier-id"
          token="mock-token"
        />
      );

      expect(screen.queryByText("Edit Contact")).not.toBeInTheDocument();
    });

    it("should not show edit button when no contact user exists", () => {
      vi.mocked(RemixReact.useRouteLoaderData).mockReturnValue({
        permissions: { canEditSuppliers: true },
      });

      render(
        <SupplierContactCard
          supplierUser={null}
          supplierId="test-supplier-id"
          token="mock-token"
        />
      );

      expect(screen.queryByText("Edit Contact")).not.toBeInTheDocument();
    });
  });

  describe("Modal Interaction Tests", () => {
    it("should open edit modal when edit button is clicked", () => {
      vi.mocked(RemixReact.useRouteLoaderData).mockReturnValue({
        permissions: { canEditSuppliers: true },
      });

      render(
        <SupplierContactCard
          supplierUser={mockActiveSupplierUser}
          supplierId="test-supplier-id"
          token="mock-token"
        />
      );

      const editButton = screen.getByText("Edit Contact");
      fireEvent.click(editButton);

      // Modal should be rendered (EditSupplierContactModal is rendered conditionally)
      // The modal title should appear
      expect(screen.getByText("Edit Supplier Contact")).toBeInTheDocument();
    });

    it("should close modal when cancel is clicked", async () => {
      vi.mocked(RemixReact.useRouteLoaderData).mockReturnValue({
        permissions: { canEditSuppliers: true },
      });

      render(
        <SupplierContactCard
          supplierUser={mockActiveSupplierUser}
          supplierId="test-supplier-id"
          token="mock-token"
        />
      );

      // Open modal
      const editButton = screen.getByText("Edit Contact");
      fireEvent.click(editButton);

      // Modal should be open
      expect(screen.getByText("Edit Supplier Contact")).toBeInTheDocument();

      // Click cancel
      const cancelButton = screen.getByText("Cancel");
      fireEvent.click(cancelButton);

      // Modal should close (dialog no longer visible)
      await waitFor(() => {
        expect(
          screen.queryByText("Edit Supplier Contact")
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("Component Structure Tests", () => {
    it("should have Platform Access as card title", () => {
      vi.mocked(RemixReact.useRouteLoaderData).mockReturnValue({
        permissions: { canEditSuppliers: false },
      });

      render(
        <SupplierContactCard
          supplierUser={mockActiveSupplierUser}
          supplierId="test-supplier-id"
          token="mock-token"
        />
      );

      expect(screen.getByText("Platform Access")).toBeInTheDocument();
    });

    it("should render as a Card component", () => {
      vi.mocked(RemixReact.useRouteLoaderData).mockReturnValue({
        permissions: { canEditSuppliers: false },
      });

      const { container } = render(
        <SupplierContactCard
          supplierUser={mockActiveSupplierUser}
          supplierId="test-supplier-id"
          token="mock-token"
        />
      );

      // Card components typically have specific class names
      expect(container.querySelector('[class*="card"]')).toBeTruthy();
    });

    it("should render icons for contact info", () => {
      vi.mocked(RemixReact.useRouteLoaderData).mockReturnValue({
        permissions: { canEditSuppliers: false },
      });

      const { container } = render(
        <SupplierContactCard
          supplierUser={mockActiveSupplierUser}
          supplierId="test-supplier-id"
          token="mock-token"
        />
      );

      // Check for SVG icons (lucide-react renders as SVG)
      const svgs = container.querySelectorAll("svg");
      expect(svgs.length).toBeGreaterThan(0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle undefined permission object gracefully", () => {
      vi.mocked(RemixReact.useRouteLoaderData).mockReturnValue({
        permissions: undefined,
      });

      render(
        <SupplierContactCard
          supplierUser={mockActiveSupplierUser}
          supplierId="test-supplier-id"
          token="mock-token"
        />
      );

      // Should not crash and should hide edit button
      expect(screen.queryByText("Edit Contact")).not.toBeInTheDocument();
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    it("should handle missing loader data gracefully", () => {
      vi.mocked(RemixReact.useRouteLoaderData).mockReturnValue(undefined);

      render(
        <SupplierContactCard
          supplierUser={mockActiveSupplierUser}
          supplierId="test-supplier-id"
          token="mock-token"
        />
      );

      // Should not crash
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });
  });
});

/**
 * Integration Test Notes:
 *
 * These tests cover:
 * âœ… Display logic (null vs active vs deactivated user)
 * âœ… SSR-first permissions (useRouteLoaderData instead of usePermissions)
 * âœ… Edit button visibility based on permissions
 * âœ… Modal open/close interactions
 * âœ… Component structure and styling
 * âœ… Edge cases and error handling
 *
 * Not covered (would require more complex mocking):
 * - Actual API calls in the modal
 * - Form validation in the modal
 * - Success toast notifications
 * - Page revalidation after successful update
 * - Duplicate email error handling
 *
 * For full coverage, consider:
 * - E2E tests with Playwright for modal form submission
 * - Integration tests with MSW for API mocking
 * - Visual regression tests with Chromatic/Percy
 */
