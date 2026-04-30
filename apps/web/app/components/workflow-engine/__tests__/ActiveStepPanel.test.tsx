import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router";
import { ActiveStepPanel } from "../ActiveStepPanel";

/**
 * Test Suite for ActiveStepPanel Component
 * Story: 2.2.8 - Workflow Execution Engine (Task 9)
 */

// Mock the API client
vi.mock("~/lib/api-client", () => ({
  createEdenTreatyClient: vi.fn(() => ({
    api: {
      workflows: {
        steps: {},
      },
    },
  })),
}));

describe("ActiveStepPanel", () => {
  const mockStep = {
    id: "step-123",
    stepOrder: 1,
    stepName: "Review Documents",
    stepType: "approval",
    status: "active",
    metadata: {},
  };

  const mockTasks = [
    {
      id: "task-123",
      title: "Review Supplier Documents",
      description: "Review all uploaded documents",
      assigneeType: "user",
      status: "open",
      dueAt: "2026-02-01T00:00:00Z",
    },
  ];

  const defaultProps = {
    step: mockStep,
    userTasks: mockTasks,
    processId: "process-123",
    token: "mock-token",
  };

  /**
   * Wrapper component to provide Router context
   */
  const renderWithRouter = (component: React.ReactElement) => {
    return render(<BrowserRouter>{component}</BrowserRouter>);
  };

  /**
   * Test: Renders step information correctly
   */
  it("should render step name and order", () => {
    renderWithRouter(<ActiveStepPanel {...defaultProps} />);

    expect(screen.getByText(/Review Documents/i)).toBeInTheDocument();
  });

  it("should render step status badge", () => {
    renderWithRouter(<ActiveStepPanel {...defaultProps} />);

    expect(screen.getByText(/active/i)).toBeInTheDocument();
  });

  /**
   * Test: Renders task information
   */
  it("should render task title when tasks exist", () => {
    renderWithRouter(<ActiveStepPanel {...defaultProps} />);

    expect(screen.getByText(/Review Supplier Documents/i)).toBeInTheDocument();
  });

  it("should render task description when provided", () => {
    renderWithRouter(<ActiveStepPanel {...defaultProps} />);

    expect(
      screen.getByText(/Review all uploaded documents/i)
    ).toBeInTheDocument();
  });

  it("should display due date when provided", () => {
    renderWithRouter(<ActiveStepPanel {...defaultProps} />);

    // Due date should be formatted and displayed
    expect(screen.getByText(/Due:/i)).toBeInTheDocument();
  });

  /**
   * Test: Handles empty task list
   */
  it("should handle no assigned tasks gracefully", () => {
    const propsWithNoTasks = {
      ...defaultProps,
      userTasks: [],
    };

    renderWithRouter(<ActiveStepPanel {...propsWithNoTasks} />);

    // Production shows "This step is assigned to another user or role"
    // when the current viewer has no assigned tasks. The previous
    // "/No tasks assigned/i" copy never existed in this component.
    expect(
      screen.getByText(/assigned to another user or role/i)
    ).toBeInTheDocument();
  });

  /**
   * Test: Renders action buttons based on step type
   */
  it("should render approve button for approval steps", () => {
    renderWithRouter(<ActiveStepPanel {...defaultProps} />);

    // Approval steps render "Approve & Continue" (not just "Complete");
    // anchor on the visible label production actually ships.
    const approveButton = screen.getByRole("button", {
      name: /approve & continue/i,
    });
    expect(approveButton).toBeInTheDocument();
  });

  it("should render decline button for approval steps", () => {
    renderWithRouter(<ActiveStepPanel {...defaultProps} />);

    const declineButton = screen.getByRole("button", { name: /decline/i });
    expect(declineButton).toBeInTheDocument();
  });

  /**
   * Test: Handles different step types
   */
  it("should render appropriate UI for form fill_out step", () => {
    const formStep = {
      ...mockStep,
      stepType: "form",
      metadata: { formActionMode: "fill_out" },
    };

    renderWithRouter(<ActiveStepPanel {...defaultProps} step={formStep} />);

    expect(screen.getByText(/Fill Out Form/i)).toBeInTheDocument();
  });

  it("should render appropriate UI for document upload step", () => {
    const documentStep = {
      ...mockStep,
      stepType: "document",
      metadata: { documentActionMode: "upload" },
    };

    renderWithRouter(<ActiveStepPanel {...defaultProps} step={documentStep} />);

    expect(screen.getByText(/Upload Documents/i)).toBeInTheDocument();
  });

  /**
   * Test: Displays multiple tasks
   */
  it("should render all assigned tasks", () => {
    const multipleTasks = [
      {
        id: "task-1",
        title: "Task One",
        description: "First task",
        assigneeType: "user",
        status: "open",
        dueAt: null,
      },
      {
        id: "task-2",
        title: "Task Two",
        description: "Second task",
        assigneeType: "user",
        status: "open",
        dueAt: null,
      },
    ];

    const propsWithMultipleTasks = {
      ...defaultProps,
      userTasks: multipleTasks,
    };

    renderWithRouter(<ActiveStepPanel {...propsWithMultipleTasks} />);

    expect(screen.getByText(/Task One/i)).toBeInTheDocument();
    expect(screen.getByText(/Task Two/i)).toBeInTheDocument();
  });

  /**
   * Test: Initial idle render keeps action buttons enabled.
   *
   * The Approve button in production gates on
   * `isCompleting || !allTasksCompleted`. The default fixture's task
   * has status "open", which forces the gate to fire even without any
   * in-flight submission, so we mark the task complete to exercise the
   * idle path the test name implies (approve & decline both enabled).
   */
  it("does not disable action buttons before a submission starts", () => {
    const baseTask = mockTasks[0];
    if (!baseTask) {
      throw new Error("expected a baseline mock task");
    }
    const completedTaskProps = {
      ...defaultProps,
      userTasks: [{ ...baseTask, status: "completed" }],
    };

    renderWithRouter(<ActiveStepPanel {...completedTaskProps} />);

    const buttons = screen.getAllByRole("button");
    buttons.forEach((button) => {
      expect(button).not.toBeDisabled();
    });
  });

  /**
   * Test: Component structure and styling
   */
  it("should render within a Card component", () => {
    const { container } = renderWithRouter(
      <ActiveStepPanel {...defaultProps} />
    );

    // Card components typically have specific class patterns
    const card = container.querySelector('[class*="card"]');
    expect(card).toBeInTheDocument();
  });

  /**
   * Test: Metadata handling
   */
  it("should handle step with empty metadata", () => {
    const stepWithoutMetadata = {
      ...mockStep,
      metadata: {},
    };

    renderWithRouter(
      <ActiveStepPanel {...defaultProps} step={stepWithoutMetadata} />
    );

    expect(screen.getByText(/Review Documents/i)).toBeInTheDocument();
  });

  it("should handle step with null metadata fields", () => {
    const stepWithNullMetadata = {
      ...mockStep,
      metadata: { formActionMode: null, documentActionMode: null },
    };

    renderWithRouter(
      <ActiveStepPanel {...defaultProps} step={stepWithNullMetadata} />
    );

    expect(screen.getByText(/Review Documents/i)).toBeInTheDocument();
  });
});
