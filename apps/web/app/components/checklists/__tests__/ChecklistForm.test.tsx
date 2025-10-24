import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ChecklistForm } from "../ChecklistForm";
import type { DocumentChecklist } from "@supplex/types";

type SerializedDocumentChecklist = Omit<
  DocumentChecklist,
  "createdAt" | "updatedAt" | "deletedAt"
> & {
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

const mockChecklist: SerializedDocumentChecklist = {
  id: "checklist-1",
  tenantId: "tenant-123",
  templateName: "ISO 9001 Standard Qualification",
  requiredDocuments: [
    {
      name: "ISO 9001 Certificate",
      description: "Current ISO 9001 certification",
      required: true,
      type: "CERTIFICATION",
    },
  ],
  isDefault: false,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-15T00:00:00.000Z",
  deletedAt: null,
};

describe("ChecklistForm", () => {
  const mockOnSubmit = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("pre-populates default documents on create mode", () => {
    render(
      <ChecklistForm
        mode="create"
        isSubmitting={false}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    // Should have default documents pre-populated
    expect(
      screen.getByDisplayValue("ISO 9001 Certificate")
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("Business License")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("Insurance Certificate")
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("W-9 Tax Form")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Quality Manual")).toBeInTheDocument();
  });

  it("validates required fields (template name)", async () => {
    render(
      <ChecklistForm
        mode="create"
        isSubmitting={false}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    const submitButton = screen.getByText("Create Template");
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText(/template name is required/i)
      ).toBeInTheDocument();
    });

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it("allows adding document items", () => {
    render(
      <ChecklistForm
        mode="create"
        isSubmitting={false}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    const addButton = screen.getByText("Add Document");
    fireEvent.click(addButton);

    // Should have 6 documents now (5 default + 1 added)
    const documentSections = screen.getAllByText(/document \d+/i);
    expect(documentSections).toHaveLength(6);
  });

  it("allows removing document items", () => {
    render(
      <ChecklistForm
        mode="create"
        isSubmitting={false}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    // Get all remove buttons (should be 5 for the default documents)
    const removeButtons = screen.getAllByLabelText(/remove document/i);
    expect(removeButtons).toHaveLength(5);

    // Remove one document
    fireEvent.click(removeButtons[0]);

    // Should have 4 documents now
    const documentSections = screen.getAllByText(/document \d+/i);
    expect(documentSections).toHaveLength(4);
  });

  it("populates form with checklist data in edit mode", () => {
    render(
      <ChecklistForm
        mode="edit"
        checklist={mockChecklist}
        isSubmitting={false}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    expect(
      screen.getByDisplayValue("ISO 9001 Standard Qualification")
    ).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("ISO 9001 Certificate")
    ).toBeInTheDocument();
  });

  it("calls onCancel when cancel button is clicked", () => {
    render(
      <ChecklistForm
        mode="create"
        isSubmitting={false}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    const cancelButton = screen.getByText("Cancel");
    fireEvent.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it("disables submit button when submitting", () => {
    render(
      <ChecklistForm
        mode="create"
        isSubmitting={true}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    const submitButton = screen.getByText("Saving...");
    expect(submitButton).toBeDisabled();
  });

  it("shows correct button text for create mode", () => {
    render(
      <ChecklistForm
        mode="create"
        isSubmitting={false}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText("Create Template")).toBeInTheDocument();
  });

  it("shows correct button text for edit mode", () => {
    render(
      <ChecklistForm
        mode="edit"
        checklist={mockChecklist}
        isSubmitting={false}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText("Update Template")).toBeInTheDocument();
  });

  it("displays is default checkbox", () => {
    render(
      <ChecklistForm
        mode="create"
        isSubmitting={false}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    expect(
      screen.getByLabelText(/set as default template/i)
    ).toBeInTheDocument();
  });

  it("displays document type dropdown", () => {
    render(
      <ChecklistForm
        mode="create"
        isSubmitting={false}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    // Should have document type labels
    const typeLabels = screen.getAllByText(/document type/i);
    expect(typeLabels.length).toBeGreaterThan(0);
  });

  it("displays is required checkbox for each document", () => {
    render(
      <ChecklistForm
        mode="create"
        isSubmitting={false}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    const requiredCheckboxes = screen.getAllByLabelText(
      /this document is required/i
    );
    expect(requiredCheckboxes).toHaveLength(5); // 5 default documents
  });

  it("validates template name max length", async () => {
    render(
      <ChecklistForm
        mode="create"
        isSubmitting={false}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    const templateNameInput = screen.getByLabelText(/template name/i);
    fireEvent.change(templateNameInput, {
      target: { value: "A".repeat(201) }, // Exceeds 200 char limit
    });
    fireEvent.blur(templateNameInput);

    await waitFor(() => {
      expect(
        screen.getByText(/template name must be less than 200 characters/i)
      ).toBeInTheDocument();
    });
  });
});
