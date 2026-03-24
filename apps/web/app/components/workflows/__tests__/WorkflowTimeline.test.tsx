import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { WorkflowTimeline } from "../WorkflowTimeline";
import { WorkflowEventType } from "@supplex/types";
import type { TimelineEvent } from "@supplex/types";

/**
 * Test Suite for WorkflowTimeline Component
 * Tests AC 1, 2, 3, 9, 10, 14 of Story 2.10
 *
 * Coverage:
 * - Timeline rendering with events
 * - Event filtering (all, approvals, rejections, documents, comments)
 * - Expandable/collapsible comments
 * - Timestamp formatting
 * - Empty state handling
 * - Print audit trail button
 * - Mobile responsive layout
 */

// Mock global fetch for PDF export
global.fetch = vi.fn();

// Mock window.URL methods for PDF download
const mockCreateObjectURL = vi.fn();
const mockRevokeObjectURL = vi.fn();
global.URL.createObjectURL = mockCreateObjectURL;
global.URL.revokeObjectURL = mockRevokeObjectURL;

// Helper function to create mock timeline events
function createMockEvent(
  overrides: Partial<TimelineEvent> = {}
): TimelineEvent {
  return {
    eventId: "event-123",
    eventType: WorkflowEventType.WORKFLOW_INITIATED,
    eventDescription: "Workflow initiated",
    actorName: "John Doe",
    actorRole: "procurement_manager",
    timestamp: new Date("2025-10-26T14:30:00Z").toISOString(),
    comments: null,
    documentName: null,
    documentType: null,
    stageNumber: null,
    stageName: null,
    reviewerName: null,
    metadata: null,
    ...overrides,
  };
}

describe("WorkflowTimeline Component", () => {
  const defaultProps = {
    workflowId: "workflow-123",
    token: "test-token",
    timelineEvents: [],
    activeFilter: "all" as const,
  };

  describe("Empty State Handling", () => {
    it("should render empty state when no events exist", () => {
      render(<WorkflowTimeline {...defaultProps} />);

      expect(screen.getByText("No audit trail events found")).toBeInTheDocument();
    });

    it("should show filter dropdown when onFilterChange is provided", () => {
      const mockOnFilterChange = vi.fn();
      render(<WorkflowTimeline {...defaultProps} onFilterChange={mockOnFilterChange} />);

      const filterDropdown = screen.getByLabelText("Filter Events");
      expect(filterDropdown).toBeInTheDocument();
    });

    it("should not show filter dropdown when onFilterChange is not provided", () => {
      render(<WorkflowTimeline {...defaultProps} />);

      const filterDropdown = screen.queryByLabelText("Filter Events");
      expect(filterDropdown).not.toBeInTheDocument();
    });

    it("should show print button even with empty events", () => {
      render(<WorkflowTimeline {...defaultProps} />);

      const printButton = screen.getByRole("button", { name: /print audit trail/i });
      expect(printButton).toBeInTheDocument();
    });
  });

  describe("Event Rendering", () => {
    it("should render single timeline event", () => {
      const events = [createMockEvent()];

      render(<WorkflowTimeline {...defaultProps} timelineEvents={events} />);

      expect(screen.getByText("Workflow initiated")).toBeInTheDocument();
      expect(screen.getByText(/John Doe/i)).toBeInTheDocument();
      expect(screen.getByText(/procurement_manager/i)).toBeInTheDocument();
    });

    it("should render multiple timeline events", () => {
      const events = [
        createMockEvent({
          eventId: "event-1",
          eventDescription: "Workflow initiated",
        }),
        createMockEvent({
          eventId: "event-2",
          eventType: WorkflowEventType.DOCUMENT_UPLOADED,
          eventDescription: "Document uploaded",
          documentName: "ISO9001.pdf",
        }),
        createMockEvent({
          eventId: "event-3",
          eventType: WorkflowEventType.STAGE_APPROVED,
          eventDescription: "Stage 1 approved",
          stageNumber: 1,
        }),
      ];

      render(<WorkflowTimeline {...defaultProps} timelineEvents={events} />);

      expect(screen.getByText("Workflow initiated")).toBeInTheDocument();
      expect(screen.getByText("Document uploaded")).toBeInTheDocument();
      expect(screen.getByText("Stage 1 approved")).toBeInTheDocument();
    });

    it("should display actor name and role for each event", () => {
      const events = [
        createMockEvent({
          actorName: "Alice Johnson",
          actorRole: "quality_manager",
        }),
      ];

      render(<WorkflowTimeline {...defaultProps} timelineEvents={events} />);

      expect(screen.getByText(/Alice Johnson/i)).toBeInTheDocument();
      expect(screen.getByText(/quality_manager/i)).toBeInTheDocument();
    });

    it("should display document name for document events", () => {
      const events = [
        createMockEvent({
          eventType: WorkflowEventType.DOCUMENT_UPLOADED,
          documentName: "Certificate_ISO9001.pdf",
        }),
      ];

      render(<WorkflowTimeline {...defaultProps} timelineEvents={events} />);

      expect(screen.getByText(/Certificate_ISO9001.pdf/i)).toBeInTheDocument();
    });

    it("should display stage information for stage events", () => {
      const events = [
        createMockEvent({
          eventType: WorkflowEventType.STAGE_APPROVED,
          stageNumber: 2,
          reviewerName: "Bob Smith",
        }),
      ];

      render(<WorkflowTimeline {...defaultProps} timelineEvents={events} />);

      expect(screen.getByText(/Stage 2/i)).toBeInTheDocument();
      expect(screen.getByText(/Bob Smith/i)).toBeInTheDocument();
    });
  });

  describe("Event Icons", () => {
    it("should render PlayCircle icon for WORKFLOW_INITIATED", () => {
      const events = [
        createMockEvent({
          eventType: WorkflowEventType.WORKFLOW_INITIATED,
        }),
      ];

      const { container } = render(
        <WorkflowTimeline {...defaultProps} timelineEvents={events} />
      );

      const icon = container.querySelector("svg");
      expect(icon).toBeInTheDocument();
    });

    it("should render Upload icon for DOCUMENT_UPLOADED", () => {
      const events = [
        createMockEvent({
          eventType: WorkflowEventType.DOCUMENT_UPLOADED,
        }),
      ];

      const { container } = render(
        <WorkflowTimeline {...defaultProps} timelineEvents={events} />
      );

      const icon = container.querySelector("svg");
      expect(icon).toBeInTheDocument();
    });

    it("should render CheckCircle icon for STAGE_APPROVED", () => {
      const events = [
        createMockEvent({
          eventType: WorkflowEventType.STAGE_APPROVED,
        }),
      ];

      const { container } = render(
        <WorkflowTimeline {...defaultProps} timelineEvents={events} />
      );

      const icon = container.querySelector("svg");
      expect(icon).toBeInTheDocument();
    });

    it("should render XCircle icon for STAGE_REJECTED", () => {
      const events = [
        createMockEvent({
          eventType: WorkflowEventType.STAGE_REJECTED,
        }),
      ];

      const { container } = render(
        <WorkflowTimeline {...defaultProps} timelineEvents={events} />
      );

      const icon = container.querySelector("svg");
      expect(icon).toBeInTheDocument();
    });
  });

  describe("Comments Expand/Collapse", () => {
    it("should show 'Show Comments' button when comments exist", () => {
      const events = [
        createMockEvent({
          comments: "This is a test comment with important information",
        }),
      ];

      render(<WorkflowTimeline {...defaultProps} timelineEvents={events} />);

      expect(screen.getByRole("button", { name: /show comments/i })).toBeInTheDocument();
    });

    it("should not show comments button when comments are null", () => {
      const events = [
        createMockEvent({
          comments: null,
        }),
      ];

      render(<WorkflowTimeline {...defaultProps} timelineEvents={events} />);

      expect(screen.queryByRole("button", { name: /show comments/i })).not.toBeInTheDocument();
    });

    it("should expand comments when 'Show Comments' is clicked", () => {
      const events = [
        createMockEvent({
          comments: "This is a test comment with important information",
        }),
      ];

      render(<WorkflowTimeline {...defaultProps} timelineEvents={events} />);

      const showButton = screen.getByRole("button", { name: /show comments/i });
      fireEvent.click(showButton);

      expect(screen.getByText("This is a test comment with important information")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /hide comments/i })).toBeInTheDocument();
    });

    it("should collapse comments when 'Hide Comments' is clicked", () => {
      const events = [
        createMockEvent({
          comments: "This is a test comment",
        }),
      ];

      render(<WorkflowTimeline {...defaultProps} timelineEvents={events} />);

      // Expand comments
      const showButton = screen.getByRole("button", { name: /show comments/i });
      fireEvent.click(showButton);

      // Collapse comments
      const hideButton = screen.getByRole("button", { name: /hide comments/i });
      fireEvent.click(hideButton);

      // Comments text should not be visible
      expect(screen.queryByText("This is a test comment")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /show comments/i })).toBeInTheDocument();
    });

    it("should handle multiple events with independent expand/collapse", () => {
      const events = [
        createMockEvent({
          eventId: "event-1",
          comments: "Comment 1",
        }),
        createMockEvent({
          eventId: "event-2",
          comments: "Comment 2",
        }),
      ];

      render(<WorkflowTimeline {...defaultProps} timelineEvents={events} />);

      const showButtons = screen.getAllByRole("button", { name: /show comments/i });

      // Expand only first event
      fireEvent.click(showButtons[0]);

      expect(screen.getByText("Comment 1")).toBeInTheDocument();
      expect(screen.queryByText("Comment 2")).not.toBeInTheDocument();
    });
  });

  describe("Timeline Filtering", () => {
    const mixedEvents = [
      createMockEvent({
        eventId: "event-1",
        eventType: WorkflowEventType.WORKFLOW_INITIATED,
      }),
      createMockEvent({
        eventId: "event-2",
        eventType: WorkflowEventType.DOCUMENT_UPLOADED,
      }),
      createMockEvent({
        eventId: "event-3",
        eventType: WorkflowEventType.STAGE_APPROVED,
      }),
      createMockEvent({
        eventId: "event-4",
        eventType: WorkflowEventType.STAGE_REJECTED,
      }),
    ];

    it("should render filter dropdown with all options", () => {
      const mockOnFilterChange = vi.fn();
      render(
        <WorkflowTimeline
          {...defaultProps}
          timelineEvents={mixedEvents}
          onFilterChange={mockOnFilterChange}
        />
      );

      const filterDropdown = screen.getByLabelText("Filter Events");
      expect(filterDropdown).toBeInTheDocument();

      // Check filter options
      expect(screen.getByRole("option", { name: /all events/i })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: /approvals/i })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: /rejections/i })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: /documents/i })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: /comments/i })).toBeInTheDocument();
    });

    it("should call onFilterChange when filter is changed", () => {
      const mockOnFilterChange = vi.fn();

      render(
        <WorkflowTimeline
          {...defaultProps}
          timelineEvents={mixedEvents}
          onFilterChange={mockOnFilterChange}
        />
      );

      const filterDropdown = screen.getByLabelText("Filter Events");
      fireEvent.change(filterDropdown, { target: { value: "approvals" } });

      expect(mockOnFilterChange).toHaveBeenCalledWith("approvals");
    });

    it("should display correct active filter value", () => {
      const mockOnFilterChange = vi.fn();
      render(
        <WorkflowTimeline
          {...defaultProps}
          timelineEvents={mixedEvents}
          onFilterChange={mockOnFilterChange}
          activeFilter="approvals"
        />
      );

      const filterDropdown = screen.getByLabelText("Filter Events") as HTMLSelectElement;
      expect(filterDropdown.value).toBe("approvals");
    });
  });

  describe("Timestamp Display", () => {
    it("should display timestamp for each event", () => {
      const events = [
        createMockEvent({
          timestamp: new Date("2025-10-26T14:30:00Z").toISOString(),
        }),
      ];

      const { container } = render(
        <WorkflowTimeline {...defaultProps} timelineEvents={events} />
      );

      const timestamp = container.querySelector("time");
      expect(timestamp).toBeInTheDocument();
    });

    it("should have UTC timestamp in title attribute for tooltip", () => {
      const testDate = new Date("2025-10-26T14:30:00Z");
      const events = [
        createMockEvent({
          timestamp: testDate.toISOString(),
        }),
      ];

      const { container } = render(
        <WorkflowTimeline {...defaultProps} timelineEvents={events} />
      );

      const timestamp = container.querySelector("time");
      expect(timestamp).toHaveAttribute("title");
      expect(timestamp?.getAttribute("title")).toContain("UTC");
    });

    it("should display relative time for recent events", () => {
      // Event from 30 minutes ago
      const now = new Date();
      const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

      const events = [
        createMockEvent({
          timestamp: thirtyMinutesAgo.toISOString(),
        }),
      ];

      const { container } = render(
        <WorkflowTimeline {...defaultProps} timelineEvents={events} />
      );

      const timestamp = container.querySelector("time");
      // Should display "30 minutes ago" or similar relative format
      expect(timestamp?.textContent).toMatch(/\d+\s+(minute|hour)/i);
    });
  });

  describe("Print Audit Trail Button", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should render Print Audit Trail button", () => {
      render(<WorkflowTimeline {...defaultProps} />);

      const printButton = screen.getByRole("button", { name: /print audit trail/i });
      expect(printButton).toBeInTheDocument();
    });

    it("should have printer icon in button", () => {
      const { container } = render(<WorkflowTimeline {...defaultProps} />);

      const printButton = screen.getByRole("button", { name: /print audit trail/i });
      const icon = printButton.querySelector("svg");

      expect(icon).toBeInTheDocument();
    });

    it("should show loading state when PDF is being generated", async () => {
      // Mock fetch to delay response
      (global.fetch as any).mockImplementation(() =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              blob: () => Promise.resolve(new Blob(["PDF content"], { type: "application/pdf" })),
            });
          }, 100);
        })
      );

      render(<WorkflowTimeline {...defaultProps} />);

      const printButton = screen.getByRole("button", { name: /print audit trail/i });
      fireEvent.click(printButton);

      // Should show loading text immediately
      expect(screen.getByText(/generating pdf/i)).toBeInTheDocument();

      // Button should be disabled
      expect(printButton).toBeDisabled();

      await waitFor(() => {
        expect(screen.queryByText(/generating pdf/i)).not.toBeInTheDocument();
      });
    });

    it("should trigger PDF download on button click", async () => {
      const mockBlob = new Blob(["PDF content"], { type: "application/pdf" });
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      mockCreateObjectURL.mockReturnValue("blob:mock-url");

      // Mock document.body methods
      const mockAppendChild = vi.spyOn(document.body, "appendChild");
      const mockRemoveChild = vi.spyOn(document.body, "removeChild");

      render(<WorkflowTimeline {...defaultProps} workflowId="workflow-123" />);

      const printButton = screen.getByRole("button", { name: /print audit trail/i });
      fireEvent.click(printButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/workflows/workflow-123/timeline/export-pdf",
          expect.objectContaining({
            method: "GET",
            headers: expect.objectContaining({
              Authorization: "Bearer test-token",
            }),
          })
        );
      });

      await waitFor(() => {
        expect(mockCreateObjectURL).toHaveBeenCalledWith(mockBlob);
        expect(mockAppendChild).toHaveBeenCalled();
        expect(mockRemoveChild).toHaveBeenCalled();
        expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
      });
    });

    it("should handle PDF download error gracefully", async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error("Network error"));

      // Mock window.alert
      const mockAlert = vi.spyOn(window, "alert").mockImplementation(() => {});

      render(<WorkflowTimeline {...defaultProps} />);

      const printButton = screen.getByRole("button", { name: /print audit trail/i });
      fireEvent.click(printButton);

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith(
          "Failed to export audit trail. Please try again."
        );
      });

      mockAlert.mockRestore();
    });
  });

  describe("Mobile Responsiveness", () => {
    it("should apply responsive classes to timeline container", () => {
      const events = [createMockEvent()];
      const { container } = render(
        <WorkflowTimeline {...defaultProps} timelineEvents={events} />
      );

      // Check for mobile-responsive wrapper classes
      const timelineContainer = container.querySelector(".workflow-timeline");
      expect(timelineContainer).toBeInTheDocument();
    });

    it("should render filter dropdown with responsive classes", () => {
      const mockOnFilterChange = vi.fn();
      render(<WorkflowTimeline {...defaultProps} onFilterChange={mockOnFilterChange} />);

      const filterDropdown = screen.getByLabelText("Filter Events");
      const filterContainer = filterDropdown.parentElement;

      // Should have flex-1 for responsive layout
      expect(filterContainer?.className).toContain("flex-1");
    });

    it("should render print button with responsive classes", () => {
      render(<WorkflowTimeline {...defaultProps} />);

      const printButton = screen.getByRole("button", { name: /print audit trail/i });

      // Should have mobile-responsive width classes
      expect(printButton.className).toMatch(/w-full|md:w-/);
    });
  });

  describe("Accessibility", () => {
    it("should have accessible time elements", () => {
      const events = [
        createMockEvent({
          timestamp: new Date("2025-10-26T14:30:00Z").toISOString(),
        }),
      ];

      const { container } = render(
        <WorkflowTimeline {...defaultProps} timelineEvents={events} />
      );

      const timeElement = container.querySelector("time");
      expect(timeElement).toHaveAttribute("dateTime");
      expect(timeElement).toHaveAttribute("title"); // For tooltip
    });

    it("should have accessible filter label", () => {
      const mockOnFilterChange = vi.fn();
      render(<WorkflowTimeline {...defaultProps} onFilterChange={mockOnFilterChange} />);

      const filterLabel = screen.getByLabelText("Filter Events");
      expect(filterLabel).toBeInTheDocument();
    });

    it("should have accessible button labels", () => {
      render(<WorkflowTimeline {...defaultProps} />);

      const printButton = screen.getByRole("button", { name: /print audit trail/i });
      expect(printButton).toBeInTheDocument();
    });
  });
});

