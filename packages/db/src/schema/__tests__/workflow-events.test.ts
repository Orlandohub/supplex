import { describe, it, expect } from "bun:test";
import {
  workflowEvents,
  WorkflowEventType,
  type InsertWorkflowEvent,
  type SelectWorkflowEvent,
} from "../workflow-events";

/**
 * Unit Tests for Workflow Events Schema
 * Verifies schema compiles without TypeScript errors and types are correctly inferred
 */
describe("Workflow Events Schema", () => {
  it("should compile without TypeScript errors", () => {
    // This test passes if TypeScript compilation succeeds
    expect(workflowEvents).toBeDefined();
  });

  it("should export WorkflowEventType constants", () => {
    expect(WorkflowEventType.WORKFLOW_INITIATED).toBe("WORKFLOW_INITIATED");
    expect(WorkflowEventType.DOCUMENT_UPLOADED).toBe("DOCUMENT_UPLOADED");
    expect(WorkflowEventType.DOCUMENT_REMOVED).toBe("DOCUMENT_REMOVED");
    expect(WorkflowEventType.STAGE_SUBMITTED).toBe("STAGE_SUBMITTED");
    expect(WorkflowEventType.STAGE_APPROVED).toBe("STAGE_APPROVED");
    expect(WorkflowEventType.STAGE_REJECTED).toBe("STAGE_REJECTED");
    expect(WorkflowEventType.RISK_SCORE_CHANGED).toBe("RISK_SCORE_CHANGED");
    expect(WorkflowEventType.COMMENTS_ADDED).toBe("COMMENTS_ADDED");
  });

  it("should infer correct InsertWorkflowEvent type", () => {
    // Type test: this will fail compilation if types are wrong
    const mockInsert: InsertWorkflowEvent = {
      tenantId: "tenant-uuid",
      workflowId: "workflow-uuid",
      eventType: WorkflowEventType.WORKFLOW_INITIATED,
      eventDescription: "Test event",
      actorName: "John Doe",
      actorRole: "admin",
      metadata: {},
    };

    expect(mockInsert).toBeDefined();
    expect(mockInsert.eventType).toBe(WorkflowEventType.WORKFLOW_INITIATED);
  });

  it("should infer correct SelectWorkflowEvent type", () => {
    // Type test: this will fail compilation if types are wrong
    const mockSelect: SelectWorkflowEvent = {
      id: "event-uuid",
      tenantId: "tenant-uuid",
      workflowId: "workflow-uuid",
      eventType: WorkflowEventType.DOCUMENT_UPLOADED,
      eventDescription: "Document uploaded",
      actorUserId: "user-uuid",
      actorName: "Jane Smith",
      actorRole: "procurement_manager",
      targetDocumentId: "doc-uuid",
      targetDocumentName: "ISO9001.pdf",
      targetStageNumber: null,
      targetReviewerName: null,
      comments: null,
      metadata: {},
      createdAt: new Date(),
    };

    expect(mockSelect).toBeDefined();
    expect(mockSelect.actorName).toBe("Jane Smith");
  });

  it("should have all required fields defined in schema", () => {
    const schema = workflowEvents;
    
    // Verify key fields exist
    expect(schema.id).toBeDefined();
    expect(schema.tenantId).toBeDefined();
    expect(schema.workflowId).toBeDefined();
    expect(schema.eventType).toBeDefined();
    expect(schema.eventDescription).toBeDefined();
    expect(schema.actorName).toBeDefined();
    expect(schema.actorRole).toBeDefined();
    expect(schema.createdAt).toBeDefined();
  });

  it("should support optional fields", () => {
    // Type test: optional fields should be nullable
    const minimalEvent: InsertWorkflowEvent = {
      tenantId: "tenant-uuid",
      workflowId: "workflow-uuid",
      eventType: WorkflowEventType.COMMENTS_ADDED,
      eventDescription: "Comment added",
      actorName: "Bob Johnson",
      actorRole: "viewer",
      // All other fields are optional/nullable
    };

    expect(minimalEvent).toBeDefined();
  });
});

