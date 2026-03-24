/**
 * Frontend Component Tests: Workflow Step Builder Validation Checkbox
 * Story 2.2.15
 *
 * Tests the validation checkbox and approver role selector in WorkflowStepBuilder
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, test, expect, vi } from "vitest";
import { WorkflowStepBuilder } from "../WorkflowStepBuilder";

// Mock the API client
vi.mock("~/lib/api-client", () => ({
  createClientEdenTreatyClient: vi.fn(() => ({
    api: {
      "workflow-templates": {
        "test-template-id": {
          steps: {
            get: vi.fn(() => Promise.resolve({ data: { success: true, data: [] } })),
            post: vi.fn(() => Promise.resolve({ data: { success: true } })),
          },
        },
      },
      "form-templates": {
        published: {
          get: vi.fn(() => Promise.resolve({ data: { success: true, data: [] } })),
        },
      },
      "document-templates": {
        published: {
          get: vi.fn(() => Promise.resolve({ data: { success: true, data: [] } })),
        },
      },
    },
  })),
}));

// Mock toast
vi.mock("~/hooks/use-toast", () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe("WorkflowStepBuilder - Validation Checkbox", () => {
  const mockUsers = [
    { id: "1", email: "admin@test.com", name: "Admin User", role: "admin" },
  ];

  test("checkbox renders correctly", async () => {
    render(
      <WorkflowStepBuilder
        templateId="test-template-id"
        canEdit={true}
        users={mockUsers}
        token="test-token"
      />
    );

    // Open the add step dialog
    const addButton = screen.getByText("Add Step");
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByLabelText(/Requires Validation/i)).toBeInTheDocument();
    });
  });

  test("checkbox toggles correctly", async () => {
    render(
      <WorkflowStepBuilder
        templateId="test-template-id"
        canEdit={true}
        users={mockUsers}
        token="test-token"
      />
    );

    const addButton = screen.getByText("Add Step");
    fireEvent.click(addButton);

    await waitFor(() => {
      const checkbox = screen.getByLabelText(/Requires Validation/i);
      expect(checkbox).not.toBeChecked();

      // Toggle on
      fireEvent.click(checkbox);
      expect(checkbox).toBeChecked();

      // Toggle off
      fireEvent.click(checkbox);
      expect(checkbox).not.toBeChecked();
    });
  });

  test("approver role selector appears when checkbox is checked", async () => {
    render(
      <WorkflowStepBuilder
        templateId="test-template-id"
        canEdit={true}
        users={mockUsers}
        token="test-token"
      />
    );

    const addButton = screen.getByText("Add Step");
    fireEvent.click(addButton);

    await waitFor(() => {
      const checkbox = screen.getByLabelText(/Requires Validation/i);
      
      // Initially, approver role selector should not be visible
      expect(screen.queryByText(/Validation Approver Roles/i)).not.toBeInTheDocument();

      // Check the checkbox
      fireEvent.click(checkbox);

      // Approver role selector should now be visible
      expect(screen.getByText(/Validation Approver Roles/i)).toBeInTheDocument();
      expect(screen.getByText(/Admin/i)).toBeInTheDocument();
      expect(screen.getByText(/Procurement Manager/i)).toBeInTheDocument();
      expect(screen.getByText(/Quality Manager/i)).toBeInTheDocument();
    });
  });

  test("approver role selector hidden when checkbox is unchecked", async () => {
    render(
      <WorkflowStepBuilder
        templateId="test-template-id"
        canEdit={true}
        users={mockUsers}
        token="test-token"
      />
    );

    const addButton = screen.getByText("Add Step");
    fireEvent.click(addButton);

    await waitFor(() => {
      const checkbox = screen.getByLabelText(/Requires Validation/i);
      
      // Check the checkbox
      fireEvent.click(checkbox);
      expect(screen.getByText(/Validation Approver Roles/i)).toBeInTheDocument();

      // Uncheck the checkbox
      fireEvent.click(checkbox);
      expect(screen.queryByText(/Validation Approver Roles/i)).not.toBeInTheDocument();
    });
  });

  test("form validation fails if checkbox checked but no roles selected", async () => {
    render(
      <WorkflowStepBuilder
        templateId="test-template-id"
        canEdit={true}
        users={mockUsers}
        token="test-token"
      />
    );

    const addButton = screen.getByText("Add Step");
    fireEvent.click(addButton);

    await waitFor(async () => {
      // Fill required fields
      const nameInput = screen.getByLabelText(/Step Name/i);
      fireEvent.change(nameInput, { target: { value: "Test Step" } });

      // Check validation checkbox
      const checkbox = screen.getByLabelText(/Requires Validation/i);
      fireEvent.click(checkbox);

      // Don't select any roles

      // Try to submit
      const submitButton = screen.getByText(/Create Step/i);
      fireEvent.click(submitButton);

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText(/At least one approver role is required/i)).toBeInTheDocument();
      });
    });
  });

  test("can select and deselect approver roles", async () => {
    render(
      <WorkflowStepBuilder
        templateId="test-template-id"
        canEdit={true}
        users={mockUsers}
        token="test-token"
      />
    );

    const addButton = screen.getByText("Add Step");
    fireEvent.click(addButton);

    await waitFor(() => {
      const checkbox = screen.getByLabelText(/Requires Validation/i);
      fireEvent.click(checkbox);

      // Find role checkboxes
      const roleCheckboxes = screen.getAllByRole("checkbox");
      const adminCheckbox = roleCheckboxes.find((cb) => 
        cb.parentElement?.textContent?.includes("Admin")
      );
      const qualityCheckbox = roleCheckboxes.find((cb) =>
        cb.parentElement?.textContent?.includes("Quality Manager")
      );

      // Select admin role
      if (adminCheckbox) {
        fireEvent.click(adminCheckbox);
        expect(adminCheckbox).toBeChecked();
      }

      // Select quality manager role
      if (qualityCheckbox) {
        fireEvent.click(qualityCheckbox);
        expect(qualityCheckbox).toBeChecked();
      }

      // Deselect admin role
      if (adminCheckbox) {
        fireEvent.click(adminCheckbox);
        expect(adminCheckbox).not.toBeChecked();
      }
    });
  });

  test("form submission includes validation config in payload", async () => {
    const mockPost = vi.fn(() => Promise.resolve({ data: { success: true } }));
    
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    vi.mocked(require("~/lib/api-client").createClientEdenTreatyClient).mockReturnValue({
      api: {
        "workflow-templates": {
          "test-template-id": {
            steps: {
              get: vi.fn(() => Promise.resolve({ data: { success: true, data: [] } })),
              post: mockPost,
            },
          },
        },
        "form-templates": {
          published: {
            get: vi.fn(() => Promise.resolve({ data: { success: true, data: [] } })),
          },
        },
        "document-templates": {
          published: {
            get: vi.fn(() => Promise.resolve({ data: { success: true, data: [] } })),
          },
        },
      },
    });

    render(
      <WorkflowStepBuilder
        templateId="test-template-id"
        canEdit={true}
        users={mockUsers}
        token="test-token"
      />
    );

    const addButton = screen.getByText("Add Step");
    fireEvent.click(addButton);

    await waitFor(async () => {
      // Fill required fields
      const nameInput = screen.getByLabelText(/Step Name/i);
      fireEvent.change(nameInput, { target: { value: "Test Validation Step" } });

      // Check validation checkbox
      const checkbox = screen.getByLabelText(/Requires Validation/i);
      fireEvent.click(checkbox);

      // Select quality manager role
      const roleCheckboxes = screen.getAllByRole("checkbox");
      const qualityCheckbox = roleCheckboxes.find((cb) =>
        cb.parentElement?.textContent?.includes("Quality Manager")
      );
      if (qualityCheckbox) {
        fireEvent.click(qualityCheckbox);
      }

      // Submit form
      const submitButton = screen.getByText(/Create Step/i);
      fireEvent.click(submitButton);

      // Verify API was called with validation config
      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith(
          expect.objectContaining({
            requiresValidation: true,
            validationConfig: expect.objectContaining({
              approverRoles: expect.arrayContaining(["quality_manager"]),
            }),
          })
        );
      });
    });
  });
});
