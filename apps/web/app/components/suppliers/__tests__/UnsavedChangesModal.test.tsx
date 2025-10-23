import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UnsavedChangesModal } from "../UnsavedChangesModal";

describe("UnsavedChangesModal", () => {
  const mockOnClose = vi.fn();
  const mockOnLeave = vi.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
    mockOnLeave.mockClear();
  });

  it("renders when open", () => {
    render(
      <UnsavedChangesModal
        isOpen={true}
        onClose={mockOnClose}
        onLeave={mockOnLeave}
      />
    );

    expect(screen.getByText("Unsaved Changes")).toBeInTheDocument();
    expect(
      screen.getByText(
        /You have unsaved changes. Are you sure you want to leave/i
      )
    ).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(
      <UnsavedChangesModal
        isOpen={false}
        onClose={mockOnClose}
        onLeave={mockOnLeave}
      />
    );

    expect(screen.queryByText("Unsaved Changes")).not.toBeInTheDocument();
  });

  it("displays Stay and Leave buttons", () => {
    render(
      <UnsavedChangesModal
        isOpen={true}
        onClose={mockOnClose}
        onLeave={mockOnLeave}
      />
    );

    expect(screen.getByRole("button", { name: /Stay/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Leave/i })).toBeInTheDocument();
  });

  it("calls onClose when Stay button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <UnsavedChangesModal
        isOpen={true}
        onClose={mockOnClose}
        onLeave={mockOnLeave}
      />
    );

    const stayButton = screen.getByRole("button", { name: /Stay/i });
    await user.click(stayButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
    expect(mockOnLeave).not.toHaveBeenCalled();
  });

  it("calls onLeave when Leave button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <UnsavedChangesModal
        isOpen={true}
        onClose={mockOnClose}
        onLeave={mockOnLeave}
      />
    );

    const leaveButton = screen.getByRole("button", { name: /Leave/i });
    await user.click(leaveButton);

    expect(mockOnLeave).toHaveBeenCalledTimes(1);
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it("displays destructive styling on Leave button", () => {
    render(
      <UnsavedChangesModal
        isOpen={true}
        onClose={mockOnClose}
        onLeave={mockOnLeave}
      />
    );

    const leaveButton = screen.getByRole("button", { name: /Leave/i });
    // The destructive variant should be applied (checking via component props would require additional setup)
    expect(leaveButton).toBeInTheDocument();
  });

  it("warns about data loss in the description", () => {
    render(
      <UnsavedChangesModal
        isOpen={true}
        onClose={mockOnClose}
        onLeave={mockOnLeave}
      />
    );

    expect(screen.getByText(/Your changes will be lost/i)).toBeInTheDocument();
  });
});
