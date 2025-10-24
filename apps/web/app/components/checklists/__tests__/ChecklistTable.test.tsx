import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChecklistTable } from "../ChecklistTable";
import type { DocumentChecklist } from "@supplex/types";

type SerializedDocumentChecklist = Omit<
  DocumentChecklist,
  "createdAt" | "updatedAt" | "deletedAt"
> & {
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

const mockChecklists: SerializedDocumentChecklist[] = [
  {
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
      {
        name: "Business License",
        description: "Valid business license",
        required: true,
        type: "LEGAL",
      },
    ],
    isDefault: true,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-15T00:00:00.000Z",
    deletedAt: null,
  },
  {
    id: "checklist-2",
    tenantId: "tenant-123",
    templateName: "Basic Supplier Qualification",
    requiredDocuments: [
      {
        name: "Business License",
        description: "Valid business license",
        required: true,
        type: "LEGAL",
      },
    ],
    isDefault: false,
    createdAt: "2024-01-02T00:00:00.000Z",
    updatedAt: "2024-01-16T00:00:00.000Z",
    deletedAt: null,
  },
];

describe("ChecklistTable", () => {
  const mockOnCreateClick = vi.fn();
  const mockOnEditClick = vi.fn();
  const mockOnDeleteClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state when no checklists", () => {
    render(
      <ChecklistTable
        checklists={[]}
        onCreateClick={mockOnCreateClick}
        onEditClick={mockOnEditClick}
        onDeleteClick={mockOnDeleteClick}
      />
    );

    expect(screen.getByText("No checklist templates")).toBeInTheDocument();
    expect(
      screen.getByText(/get started by creating a new checklist template/i)
    ).toBeInTheDocument();
    expect(screen.getByText("Create Template")).toBeInTheDocument();
  });

  it("renders table with checklist data", () => {
    render(
      <ChecklistTable
        checklists={mockChecklists}
        onCreateClick={mockOnCreateClick}
        onEditClick={mockOnEditClick}
        onDeleteClick={mockOnDeleteClick}
      />
    );

    expect(
      screen.getByText("ISO 9001 Standard Qualification")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Basic Supplier Qualification")
    ).toBeInTheDocument();
  });

  it("shows default badge correctly", () => {
    render(
      <ChecklistTable
        checklists={mockChecklists}
        onCreateClick={mockOnCreateClick}
        onEditClick={mockOnEditClick}
        onDeleteClick={mockOnDeleteClick}
      />
    );

    const badges = screen.getAllByText("Default");
    expect(badges.length).toBeGreaterThan(0); // At least one default badge should be present
  });

  it("displays correct number of required documents", () => {
    render(
      <ChecklistTable
        checklists={mockChecklists}
        onCreateClick={mockOnCreateClick}
        onEditClick={mockOnEditClick}
        onDeleteClick={mockOnDeleteClick}
      />
    );

    // First checklist has 2 required documents
    expect(screen.getByText("2")).toBeInTheDocument();
    // Second checklist has 1 required document
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("calls edit handler on edit button click", () => {
    render(
      <ChecklistTable
        checklists={mockChecklists}
        onCreateClick={mockOnCreateClick}
        onEditClick={mockOnEditClick}
        onDeleteClick={mockOnDeleteClick}
      />
    );

    const editButtons = screen.getAllByLabelText(/edit/i);
    fireEvent.click(editButtons[0]);

    expect(mockOnEditClick).toHaveBeenCalledWith(mockChecklists[0]);
  });

  it("calls delete handler on delete button click", () => {
    render(
      <ChecklistTable
        checklists={mockChecklists}
        onCreateClick={mockOnCreateClick}
        onEditClick={mockOnEditClick}
        onDeleteClick={mockOnDeleteClick}
      />
    );

    const deleteButtons = screen.getAllByLabelText(/delete/i);
    fireEvent.click(deleteButtons[0]);

    expect(mockOnDeleteClick).toHaveBeenCalledWith(mockChecklists[0]);
  });

  it("calls create handler on create button click in empty state", () => {
    render(
      <ChecklistTable
        checklists={[]}
        onCreateClick={mockOnCreateClick}
        onEditClick={mockOnEditClick}
        onDeleteClick={mockOnDeleteClick}
      />
    );

    const createButton = screen.getByText("Create Template");
    fireEvent.click(createButton);

    expect(mockOnCreateClick).toHaveBeenCalled();
  });

  it("formats dates correctly", () => {
    render(
      <ChecklistTable
        checklists={mockChecklists}
        onCreateClick={mockOnCreateClick}
        onEditClick={mockOnEditClick}
        onDeleteClick={mockOnDeleteClick}
      />
    );

    // Check that dates are formatted (should contain month abbreviation)
    expect(screen.getByText(/Jan/i)).toBeInTheDocument();
  });

  it("renders both desktop and mobile views", () => {
    const { container } = render(
      <ChecklistTable
        checklists={mockChecklists}
        onCreateClick={mockOnCreateClick}
        onEditClick={mockOnEditClick}
        onDeleteClick={mockOnDeleteClick}
      />
    );

    // Desktop view (table) should have class "hidden md:block"
    const desktopTable = container.querySelector(".hidden.md\\:block");
    expect(desktopTable).toBeInTheDocument();

    // Mobile view (cards) should have class "md:hidden"
    const mobileCards = container.querySelector(".md\\:hidden");
    expect(mobileCards).toBeInTheDocument();
  });

  it("displays all column headers in desktop view", () => {
    render(
      <ChecklistTable
        checklists={mockChecklists}
        onCreateClick={mockOnCreateClick}
        onEditClick={mockOnEditClick}
        onDeleteClick={mockOnDeleteClick}
      />
    );

    expect(screen.getByText("Template Name")).toBeInTheDocument();
    expect(screen.getByText("# of Required Docs")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Created Date")).toBeInTheDocument();
    expect(screen.getByText("Last Modified")).toBeInTheDocument();
    expect(screen.getByText("Actions")).toBeInTheDocument();
  });
});
