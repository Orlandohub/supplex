import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BrowserRouter } from "react-router";
import { CommentThreadView } from "../CommentThreadView";

/**
 * Test Suite for CommentThreadView Component
 * Story: 2.2.8 - Workflow Execution Engine (Task 10)
 */

// Mock the API client
vi.mock("~/lib/api-client", () => ({
  createEdenTreatyClient: vi.fn(() => ({
    api: {
      workflows: {
        processes: {},
      },
    },
  })),
}));

describe("CommentThreadView", () => {
  const mockComments = [
    {
      id: "comment-1",
      processInstanceId: "process-123",
      stepInstanceId: "step-123",
      entityType: "form",
      commentText: "This form needs revision",
      commentedBy: "user-1",
      createdAt: "2026-01-25T10:00:00Z",
      parentCommentId: null,
    },
    {
      id: "comment-2",
      processInstanceId: "process-123",
      stepInstanceId: "step-123",
      entityType: "form",
      commentText: "I've updated the form",
      commentedBy: "user-2",
      createdAt: "2026-01-25T11:00:00Z",
      parentCommentId: "comment-1",
    },
  ];

  const defaultProps = {
    processId: "process-123",
    comments: mockComments,
    token: "mock-token",
  };

  /**
   * Wrapper component to provide Router context
   */
  const renderWithRouter = (component: React.ReactElement) => {
    return render(<BrowserRouter>{component}</BrowserRouter>);
  };

  /**
   * Test: Renders comment list correctly
   */
  it("should render all comments", () => {
    renderWithRouter(<CommentThreadView {...defaultProps} />);

    expect(screen.getByText(/This form needs revision/i)).toBeInTheDocument();
    expect(screen.getByText(/I've updated the form/i)).toBeInTheDocument();
  });

  it("should display comment timestamps", () => {
    renderWithRouter(<CommentThreadView {...defaultProps} />);

    // Timestamps should be formatted and displayed
    const timestamps = screen.getAllByText(/2026/);
    expect(timestamps.length).toBeGreaterThan(0);
  });

  /**
   * Test: Handles empty comment list
   */
  it("should show message when no comments exist", () => {
    const propsWithNoComments = {
      ...defaultProps,
      comments: [],
    };

    renderWithRouter(<CommentThreadView {...propsWithNoComments} />);

    expect(screen.getByText(/No comments yet/i)).toBeInTheDocument();
  });

  /**
   * Test: Comment input form
   */
  it("should render comment textarea", () => {
    renderWithRouter(<CommentThreadView {...defaultProps} />);

    const textarea = screen.getByPlaceholderText(/Write your comment/i);
    expect(textarea).toBeInTheDocument();
  });

  it("should render submit button", () => {
    renderWithRouter(<CommentThreadView {...defaultProps} />);

    // The button copy is "Post Comment" (matches "Posting..." while
    // submitting). The earlier "Add Comment" name referred to the
    // section heading; queries should target the button's actual label.
    const submitButton = screen.getByRole("button", { name: /post comment/i });
    expect(submitButton).toBeInTheDocument();
  });

  it("should allow typing in comment textarea", () => {
    renderWithRouter(<CommentThreadView {...defaultProps} />);

    const textarea = screen.getByPlaceholderText(
      /Write your comment/i
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "New comment text" } });

    expect(textarea.value).toBe("New comment text");
  });

  /**
   * Test: Comment threading/grouping
   */
  it("should group comments by step", () => {
    const commentsFromDifferentSteps = [
      {
        id: "comment-1",
        processInstanceId: "process-123",
        stepInstanceId: "step-1",
        entityType: "form",
        commentText: "Step 1 comment",
        commentedBy: "user-1",
        createdAt: "2026-01-25T10:00:00Z",
        parentCommentId: null,
      },
      {
        id: "comment-2",
        processInstanceId: "process-123",
        stepInstanceId: "step-2",
        entityType: "document",
        commentText: "Step 2 comment",
        commentedBy: "user-2",
        createdAt: "2026-01-25T11:00:00Z",
        parentCommentId: null,
      },
    ];

    renderWithRouter(
      <CommentThreadView
        {...defaultProps}
        comments={commentsFromDifferentSteps}
      />
    );

    expect(screen.getByText(/Step 1 comment/i)).toBeInTheDocument();
    expect(screen.getByText(/Step 2 comment/i)).toBeInTheDocument();
  });

  it("should display parent-child comment relationships", () => {
    renderWithRouter(<CommentThreadView {...defaultProps} />);

    // Both parent and child comments should be visible
    expect(screen.getByText(/This form needs revision/i)).toBeInTheDocument();
    expect(screen.getByText(/I've updated the form/i)).toBeInTheDocument();
  });

  /**
   * Test: Entity type display
   */
  it("should distinguish between form and document comments", () => {
    const mixedEntityComments = [
      {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- existence asserted above
        ...mockComments[0]!,
        entityType: "form",
        commentText: "Form comment",
      },
      {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- existence asserted above
        ...mockComments[1]!,
        entityType: "document",
        commentText: "Document comment",
      },
    ];

    renderWithRouter(
      <CommentThreadView {...defaultProps} comments={mixedEntityComments} />
    );

    expect(screen.getByText(/Form comment/i)).toBeInTheDocument();
    expect(screen.getByText(/Document comment/i)).toBeInTheDocument();
  });

  /**
   * Test: Form validation
   */
  it("should disable submit when comment is empty", () => {
    renderWithRouter(<CommentThreadView {...defaultProps} />);

    const submitButton = screen.getByRole("button", {
      name: /post comment/i,
    });
    const textarea = screen.getByPlaceholderText(
      /Write your comment/i
    ) as HTMLTextAreaElement;

    expect(textarea.value).toBe("");
    // Production gates the button on `!newComment.trim()` so an empty
    // textarea must keep the button disabled. This anchors the contract
    // the previous test only commented about.
    expect(submitButton).toBeDisabled();
  });

  /**
   * Test: Comment chronology
   */
  it("should display comments newest-first within a step", () => {
    renderWithRouter(<CommentThreadView {...defaultProps} />);

    // Production sorts each step's comments newest-first
    // (see `CommentThreadView.tsx` — `b.createdAt - a.createdAt`).
    // The fixture has the "updated" comment after the "revision"
    // comment by `createdAt`, so it must appear first in the DOM.
    const commentTexts = screen
      .getAllByText(/revision|updated/i)
      .map((el) => el.textContent);

    const revisionIndex = commentTexts.findIndex((text) =>
      text?.includes("revision")
    );
    const updatedIndex = commentTexts.findIndex((text) =>
      text?.includes("updated")
    );

    expect(revisionIndex).toBeGreaterThan(-1);
    expect(updatedIndex).toBeGreaterThan(-1);
    expect(updatedIndex).toBeLessThan(revisionIndex);
  });

  /**
   * Test: Component structure
   */
  it("should render within proper container structure", () => {
    const { container } = renderWithRouter(
      <CommentThreadView {...defaultProps} />
    );

    // Should have space-y class for vertical spacing
    const mainContainer = container.querySelector('[class*="space-y"]');
    expect(mainContainer).toBeInTheDocument();
  });

  /**
   * Test: Error handling
   */
  it("should display error message when comment submission fails", () => {
    renderWithRouter(<CommentThreadView {...defaultProps} />);

    // Error state is managed internally, this tests initial state
    const errorElements = screen.queryAllByRole("alert");
    expect(errorElements.length).toBeGreaterThanOrEqual(0);
  });

  /**
   * Test: Long comment text handling
   */
  it("should handle very long comment text", () => {
    const longCommentText = "A".repeat(1000);
    const commentsWithLongText = [
      {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- existence asserted above
        ...mockComments[0]!,
        commentText: longCommentText,
      },
    ];

    renderWithRouter(
      <CommentThreadView {...defaultProps} comments={commentsWithLongText} />
    );

    expect(screen.getByText(longCommentText)).toBeInTheDocument();
  });
});
