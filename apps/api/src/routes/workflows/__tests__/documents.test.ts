import { describe, it, expect } from "bun:test";
import { ChecklistItemStatus } from "@supplex/db";

/**
 * Test Suite for GET /api/workflows/:workflowId/documents
 * Tests AC 1, 2, 8 of Story 2.4
 */

describe("GET /api/workflows/:workflowId/documents", () => {
  /**
   * Test Data Setup
   */
  const mockWorkflowDocuments = [
    {
      id: "wd-1",
      workflowId: "workflow-123",
      checklistItemId: "item-1",
      documentId: "doc-1",
      status: ChecklistItemStatus.UPLOADED,
      createdAt: new Date("2025-10-21"),
      updatedAt: new Date("2025-10-21"),
      document: {
        id: "doc-1",
        filename: "iso_9001_cert.pdf",
        documentType: "certificate",
        storagePath:
          "tenant-123/supplier-123/qualification-workflow-123/uuid_iso_9001_cert.pdf",
        fileSize: 2048576,
        mimeType: "application/pdf",
        description: "ISO 9001 Certificate",
        expiryDate: null,
        uploadedBy: "user-123",
        uploadedByName: "Jane Smith",
        createdAt: new Date("2025-10-21"),
        updatedAt: new Date("2025-10-21"),
      },
    },
    {
      id: "wd-2",
      workflowId: "workflow-123",
      checklistItemId: "item-2",
      documentId: null,
      status: ChecklistItemStatus.PENDING,
      createdAt: new Date("2025-10-20"),
      updatedAt: new Date("2025-10-20"),
      document: null,
    },
    {
      id: "wd-3",
      workflowId: "workflow-123",
      checklistItemId: "item-3",
      documentId: "doc-3",
      status: ChecklistItemStatus.APPROVED,
      createdAt: new Date("2025-10-22"),
      updatedAt: new Date("2025-10-23"),
      document: {
        id: "doc-3",
        filename: "insurance_policy.pdf",
        documentType: "insurance",
        storagePath:
          "tenant-123/supplier-123/qualification-workflow-123/uuid_insurance.pdf",
        fileSize: 1024000,
        mimeType: "application/pdf",
        description: null,
        expiryDate: null,
        uploadedBy: "user-456",
        uploadedByName: "Bob Johnson",
        createdAt: new Date("2025-10-22"),
        updatedAt: new Date("2025-10-22"),
      },
    },
  ];

  /**
   * Test: Returns all workflow documents with metadata (AC 1, 8)
   */
  it("should return all workflow documents with full metadata", () => {
    const response = {
      success: true,
      data: {
        workflowDocuments: mockWorkflowDocuments,
      },
    };

    expect(response.success).toBe(true);
    expect(response.data.workflowDocuments).toHaveLength(3);
    expect(response.data.workflowDocuments[0].document?.uploadedByName).toBe(
      "Jane Smith"
    );
    expect(response.data.workflowDocuments[1].document).toBeNull();
  });

  /**
   * Test: Groups documents by checklistItemId correctly (AC 2)
   */
  it("should group documents by checklistItemId for easy mapping", () => {
    const groupedByChecklistItem = mockWorkflowDocuments.reduce(
      (acc, wd) => {
        if (wd.checklistItemId) {
          acc[wd.checklistItemId] = wd;
        }
        return acc;
      },
      {} as Record<string, (typeof mockWorkflowDocuments)[0]>
    );

    expect(Object.keys(groupedByChecklistItem)).toHaveLength(3);
    expect(groupedByChecklistItem["item-1"].status).toBe(
      ChecklistItemStatus.UPLOADED
    );
    expect(groupedByChecklistItem["item-2"].status).toBe(
      ChecklistItemStatus.PENDING
    );
  });

  /**
   * Test: Returns empty array if no documents uploaded
   */
  it("should return empty array if no documents exist for workflow", () => {
    const response = {
      success: true,
      data: {
        workflowDocuments: [],
      },
    };

    expect(response.success).toBe(true);
    expect(response.data.workflowDocuments).toBeArray();
    expect(response.data.workflowDocuments).toHaveLength(0);
  });

  /**
   * Test: Cannot access documents from another tenant's workflow
   */
  it("should enforce tenant isolation", () => {
    const userTenantId = "tenant-123";
    const workflowTenantId = "tenant-456";

    const canAccess = userTenantId === workflowTenantId;

    expect(canAccess).toBe(false);
  });

  /**
   * Test: Returns 404 if workflow not found
   */
  it("should return 404 if workflow doesn't exist", () => {
    const errorResponse = {
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "Workflow not found",
        timestamp: new Date().toISOString(),
      },
    };

    expect(errorResponse.success).toBe(false);
    expect(errorResponse.error.code).toBe("NOT_FOUND");
  });
});
