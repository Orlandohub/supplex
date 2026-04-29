import type * as React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SupplierForm } from "../SupplierForm";
import { SupplierCategory, SupplierStatus } from "@supplex/types";
import type { SerializedSupplier } from "@supplex/types";

type FormMockProps = React.FormHTMLAttributes<HTMLFormElement> & {
  children?: React.ReactNode;
};

const mockNavigate = vi.fn();
vi.mock("react-router", () => ({
  Form: ({ children, ...props }: FormMockProps) => (
    <form {...props}>{children}</form>
  ),
  useNavigate: () => mockNavigate,
  useBeforeUnload: vi.fn(),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

describe("SupplierForm", () => {
  beforeEach(() => {
    localStorageMock.clear();
    mockNavigate.mockClear();
  });

  describe("Create Mode", () => {
    it("renders all required form fields", () => {
      render(
        <SupplierForm
          mode="create"
          isSubmitting={false}
          actionData={undefined}
        />
      );

      // Company Information
      expect(screen.getByLabelText(/Company Name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Tax ID/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Category/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Status/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Website/i)).toBeInTheDocument();

      // Address fields
      expect(screen.getByLabelText(/Street/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/City/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/State/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Postal Code/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Country/i)).toBeInTheDocument();

      // Contact fields
      expect(
        screen.getByLabelText(/Name/i, { selector: "#contactName" })
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText(/Email/i, { selector: "#contactEmail" })
      ).toBeInTheDocument();
      expect(screen.getByLabelText(/Phone/i)).toBeInTheDocument();

      // Notes
      expect(screen.getByLabelText(/Notes/i)).toBeInTheDocument();

      // Buttons
      expect(
        screen.getByRole("button", { name: /Cancel/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Create Supplier/i })
      ).toBeInTheDocument();
    });

    it("disables save button initially when form is invalid", () => {
      render(
        <SupplierForm
          mode="create"
          isSubmitting={false}
          actionData={undefined}
        />
      );

      const submitButton = screen.getByRole("button", {
        name: /Create Supplier/i,
      });
      expect(submitButton).toBeDisabled();
    });

    it("displays validation error for required company name", async () => {
      const user = userEvent.setup();
      render(
        <SupplierForm
          mode="create"
          isSubmitting={false}
          actionData={undefined}
        />
      );

      const nameInput = screen.getByLabelText(/Company Name/i);
      await user.click(nameInput);
      await user.tab(); // Blur the field

      await waitFor(() => {
        expect(
          screen.getByText(/Company name is required/i)
        ).toBeInTheDocument();
      });
    });

    it("displays validation error for invalid email", async () => {
      const user = userEvent.setup();
      render(
        <SupplierForm
          mode="create"
          isSubmitting={false}
          actionData={undefined}
        />
      );

      const emailInput = screen.getByLabelText(/Email/i, {
        selector: "#contactEmail",
      });
      await user.type(emailInput, "invalid-email");
      await user.tab(); // Blur the field

      await waitFor(() => {
        expect(screen.getByText(/Invalid email format/i)).toBeInTheDocument();
      });
    });

    it("displays validation error for invalid URL", async () => {
      const user = userEvent.setup();
      render(
        <SupplierForm
          mode="create"
          isSubmitting={false}
          actionData={undefined}
        />
      );

      const websiteInput = screen.getByLabelText(/Website/i);
      await user.type(websiteInput, "not-a-url");
      await user.tab(); // Blur the field

      await waitFor(() => {
        expect(screen.getByText(/Invalid URL format/i)).toBeInTheDocument();
      });
    });

    it("enables save button when all required fields are valid", async () => {
      const user = userEvent.setup();
      render(
        <SupplierForm
          mode="create"
          isSubmitting={false}
          actionData={undefined}
        />
      );

      // Fill in all required fields
      await user.type(screen.getByLabelText(/Company Name/i), "Acme Corp");
      await user.type(screen.getByLabelText(/Tax ID/i), "12-3456789");
      await user.type(screen.getByLabelText(/Street/i), "123 Main St");
      await user.type(screen.getByLabelText(/City/i), "New York");
      await user.type(screen.getByLabelText(/State/i), "NY");
      await user.type(screen.getByLabelText(/Postal Code/i), "10001");
      await user.type(screen.getByLabelText(/Country/i), "USA");
      await user.type(
        screen.getByLabelText(/Name/i, { selector: "#contactName" }),
        "John Doe"
      );
      await user.type(
        screen.getByLabelText(/Email/i, { selector: "#contactEmail" }),
        "john@example.com"
      );

      await waitFor(() => {
        const submitButton = screen.getByRole("button", {
          name: /Create Supplier/i,
        });
        expect(submitButton).not.toBeDisabled();
      });
    });

    it("shows Cancel button and navigates back on click when form is not dirty", async () => {
      const user = userEvent.setup();
      render(
        <SupplierForm
          mode="create"
          isSubmitting={false}
          actionData={undefined}
        />
      );

      const cancelButton = screen.getByRole("button", { name: /Cancel/i });
      await user.click(cancelButton);

      // Since form is not dirty, should navigate immediately
      expect(mockNavigate).toHaveBeenCalledWith("/suppliers");
    });

    it("shows unsaved changes modal when canceling with dirty form", async () => {
      const user = userEvent.setup();
      render(
        <SupplierForm
          mode="create"
          isSubmitting={false}
          actionData={undefined}
        />
      );

      // Make form dirty
      await user.type(screen.getByLabelText(/Company Name/i), "Acme");

      const cancelButton = screen.getByRole("button", { name: /Cancel/i });
      await user.click(cancelButton);

      // Unsaved changes modal should appear
      await waitFor(() => {
        expect(
          screen.getByText(/You have unsaved changes/i)
        ).toBeInTheDocument();
      });
    });

    it("disables all inputs when isSubmitting is true", () => {
      render(
        <SupplierForm
          mode="create"
          isSubmitting={true}
          actionData={undefined}
        />
      );

      const submitButton = screen.getByRole("button", { name: /Creating/i });
      expect(submitButton).toBeDisabled();

      const cancelButton = screen.getByRole("button", { name: /Cancel/i });
      expect(cancelButton).toBeDisabled();
    });
  });

  describe("Edit Mode", () => {
    const mockSupplier: SerializedSupplier = {
      id: "123",
      tenantId: "tenant-1",
      supplierStatusId: null,
      supplierUserId: null,
      name: "Existing Corp",
      taxId: "98-7654321",
      category: SupplierCategory.COMPONENTS,
      status: SupplierStatus.APPROVED,
      performanceScore: null,
      contactName: "Jane Smith",
      contactEmail: "jane@existing.com",
      contactPhone: "+1-555-0100",
      address: {
        street: "456 Oak Ave",
        city: "Boston",
        state: "MA",
        postalCode: "02101",
        country: "USA",
      },
      certifications: [],
      metadata: {
        website: "https://existing.com",
        notes: "Test notes",
      },
      riskScore: null,
      createdBy: "user-1",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
      deletedAt: null,
    };

    it("pre-populates form fields with existing supplier data", () => {
      render(
        <SupplierForm
          mode="edit"
          supplier={mockSupplier}
          isSubmitting={false}
          actionData={undefined}
        />
      );

      expect(screen.getByLabelText(/Company Name/i)).toHaveValue(
        "Existing Corp"
      );
      expect(screen.getByLabelText(/Tax ID/i)).toHaveValue("98-7654321");
      expect(screen.getByLabelText(/Street/i)).toHaveValue("456 Oak Ave");
      expect(screen.getByLabelText(/City/i)).toHaveValue("Boston");
      expect(screen.getByLabelText(/State/i)).toHaveValue("MA");
      expect(screen.getByLabelText(/Postal Code/i)).toHaveValue("02101");
      expect(screen.getByLabelText(/Country/i)).toHaveValue("USA");
      expect(
        screen.getByLabelText(/Name/i, { selector: "#contactName" })
      ).toHaveValue("Jane Smith");
      expect(
        screen.getByLabelText(/Email/i, { selector: "#contactEmail" })
      ).toHaveValue("jane@existing.com");
      expect(screen.getByLabelText(/Phone/i)).toHaveValue("+1-555-0100");
      expect(screen.getByLabelText(/Website/i)).toHaveValue(
        "https://existing.com"
      );
      expect(screen.getByLabelText(/Notes/i)).toHaveValue("Test notes");
    });

    it("shows Save Changes button in edit mode", () => {
      render(
        <SupplierForm
          mode="edit"
          supplier={mockSupplier}
          isSubmitting={false}
          actionData={undefined}
        />
      );

      expect(
        screen.getByRole("button", { name: /Save Changes/i })
      ).toBeInTheDocument();
    });

    it("navigates to supplier detail page on cancel in edit mode", async () => {
      const user = userEvent.setup();
      render(
        <SupplierForm
          mode="edit"
          supplier={mockSupplier}
          isSubmitting={false}
          actionData={undefined}
        />
      );

      const cancelButton = screen.getByRole("button", { name: /Cancel/i });
      await user.click(cancelButton);

      expect(mockNavigate).toHaveBeenCalledWith("/suppliers/123");
    });

    it("enables save button when form is valid in edit mode", () => {
      render(
        <SupplierForm
          mode="edit"
          supplier={mockSupplier}
          isSubmitting={false}
          actionData={undefined}
        />
      );

      const submitButton = screen.getByRole("button", {
        name: /Save Changes/i,
      });
      // Form should be valid with pre-populated data
      expect(submitButton).not.toBeDisabled();
    });
  });

  describe("Auto-save functionality", () => {
    it("saves form data to localStorage after debounce", async () => {
      vi.useFakeTimers();
      const user = userEvent.setup({ delay: null });

      render(
        <SupplierForm
          mode="create"
          isSubmitting={false}
          actionData={undefined}
        />
      );

      await user.type(screen.getByLabelText(/Company Name/i), "Test Company");

      // Fast-forward time to trigger debounced save
      vi.advanceTimersByTime(500);

      await waitFor(() => {
        const saved = localStorageMock.getItem(
          "supplier-form-draft-create-new"
        );
        expect(saved).toBeTruthy();
        if (saved) {
          const data = JSON.parse(saved);
          expect(data.name).toBe("Test Company");
        }
      });

      vi.useRealTimers();
    });
  });
});
