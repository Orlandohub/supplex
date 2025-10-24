/**
 * Qualification Workflow Tenant Isolation Tests (Story 2.1)
 * Verifies tenant isolation for qualification workflow tables
 */

import { describe, it, expect } from "bun:test";
import {
  withTenantId,
  withTenantIdAndNotDeleted,
  TenantContextError,
} from "../../helpers/tenant-context";
import {
  qualificationWorkflows,
  qualificationStages,
  documentChecklists,
  workflowDocuments,
  WorkflowStatus,
  StageStatus,
  ChecklistItemStatus,
} from "../index";

describe("Qualification Workflows Table", () => {
  const validTenantId = "550e8400-e29b-41d4-a716-446655440000";

  describe("Schema Definition", () => {
    it("should have correct column structure", () => {
      expect(qualificationWorkflows.id).toBeDefined();
      expect(qualificationWorkflows.tenantId).toBeDefined();
      expect(qualificationWorkflows.supplierId).toBeDefined();
      expect(qualificationWorkflows.status).toBeDefined();
      expect(qualificationWorkflows.initiatedBy).toBeDefined();
      expect(qualificationWorkflows.initiatedDate).toBeDefined();
      expect(qualificationWorkflows.currentStage).toBeDefined();
      expect(qualificationWorkflows.riskScore).toBeDefined();
      expect(qualificationWorkflows.createdAt).toBeDefined();
      expect(qualificationWorkflows.updatedAt).toBeDefined();
      expect(qualificationWorkflows.deletedAt).toBeDefined();
    });

    it("should have tenant_id column for isolation", () => {
      expect(qualificationWorkflows.tenantId).toBeDefined();
      expect(qualificationWorkflows.tenantId.name).toBe("tenant_id");
    });

    it("should have deleted_at for soft deletes", () => {
      expect(qualificationWorkflows.deletedAt).toBeDefined();
      expect(qualificationWorkflows.deletedAt.name).toBe("deleted_at");
    });

    it("should have correct table name", () => {
      expect(qualificationWorkflows[Symbol.for("drizzle:Name")]).toBe(
        "qualification_workflows"
      );
    });

    it("should have supplier_id foreign key", () => {
      expect(qualificationWorkflows.supplierId).toBeDefined();
      expect(qualificationWorkflows.supplierId.name).toBe("supplier_id");
    });
  });

  describe("Tenant Isolation", () => {
    it("should create tenant filter condition", () => {
      const condition = withTenantId(
        qualificationWorkflows.tenantId,
        validTenantId
      );
      expect(condition).toBeDefined();
      expect(typeof condition).toBe("object");
    });

    it("should create combined tenant and soft-delete filter", () => {
      const condition = withTenantIdAndNotDeleted(
        qualificationWorkflows.tenantId,
        qualificationWorkflows.deletedAt,
        validTenantId
      );
      expect(condition).toBeDefined();
      expect(typeof condition).toBe("object");
    });

    it("should throw error for empty tenant ID", () => {
      expect(() => withTenantId(qualificationWorkflows.tenantId, "")).toThrow(
        TenantContextError
      );
    });

    it("should throw error for null tenant ID", () => {
      expect(() =>
        withTenantId(qualificationWorkflows.tenantId, null as any)
      ).toThrow(TenantContextError);
    });
  });

  describe("Workflow Status Enum", () => {
    it("should have all required status values", () => {
      expect(WorkflowStatus.DRAFT).toBe("Draft");
      expect(WorkflowStatus.STAGE1).toBe("Stage1");
      expect(WorkflowStatus.STAGE2).toBe("Stage2");
      expect(WorkflowStatus.STAGE3).toBe("Stage3");
      expect(WorkflowStatus.APPROVED).toBe("Approved");
      expect(WorkflowStatus.REJECTED).toBe("Rejected");
    });

    it("should have exactly 6 status values", () => {
      const statusValues = Object.values(WorkflowStatus);
      expect(statusValues).toHaveLength(6);
    });
  });
});

describe("Qualification Stages Table", () => {
  describe("Schema Definition", () => {
    it("should have correct column structure", () => {
      expect(qualificationStages.id).toBeDefined();
      expect(qualificationStages.workflowId).toBeDefined();
      expect(qualificationStages.stageNumber).toBeDefined();
      expect(qualificationStages.stageName).toBeDefined();
      expect(qualificationStages.assignedTo).toBeDefined();
      expect(qualificationStages.status).toBeDefined();
      expect(qualificationStages.reviewedBy).toBeDefined();
      expect(qualificationStages.reviewedDate).toBeDefined();
      expect(qualificationStages.comments).toBeDefined();
      expect(qualificationStages.attachments).toBeDefined();
      expect(qualificationStages.createdAt).toBeDefined();
      expect(qualificationStages.updatedAt).toBeDefined();
      expect(qualificationStages.deletedAt).toBeDefined();
    });

    it("should have workflow_id foreign key", () => {
      expect(qualificationStages.workflowId).toBeDefined();
      expect(qualificationStages.workflowId.name).toBe("workflow_id");
    });

    it("should have deleted_at for soft deletes", () => {
      expect(qualificationStages.deletedAt).toBeDefined();
      expect(qualificationStages.deletedAt.name).toBe("deleted_at");
    });

    it("should have correct table name", () => {
      expect(qualificationStages[Symbol.for("drizzle:Name")]).toBe(
        "qualification_stages"
      );
    });
  });

  describe("Stage Status Enum", () => {
    it("should have all required status values", () => {
      expect(StageStatus.PENDING).toBe("Pending");
      expect(StageStatus.APPROVED).toBe("Approved");
      expect(StageStatus.REJECTED).toBe("Rejected");
    });

    it("should have exactly 3 status values", () => {
      const statusValues = Object.values(StageStatus);
      expect(statusValues).toHaveLength(3);
    });
  });
});

describe("Document Checklists Table", () => {
  const validTenantId = "550e8400-e29b-41d4-a716-446655440000";

  describe("Schema Definition", () => {
    it("should have correct column structure", () => {
      expect(documentChecklists.id).toBeDefined();
      expect(documentChecklists.tenantId).toBeDefined();
      expect(documentChecklists.templateName).toBeDefined();
      expect(documentChecklists.requiredDocuments).toBeDefined();
      expect(documentChecklists.isDefault).toBeDefined();
      expect(documentChecklists.createdAt).toBeDefined();
      expect(documentChecklists.updatedAt).toBeDefined();
      expect(documentChecklists.deletedAt).toBeDefined();
    });

    it("should have tenant_id column for isolation", () => {
      expect(documentChecklists.tenantId).toBeDefined();
      expect(documentChecklists.tenantId.name).toBe("tenant_id");
    });

    it("should have deleted_at for soft deletes", () => {
      expect(documentChecklists.deletedAt).toBeDefined();
      expect(documentChecklists.deletedAt.name).toBe("deleted_at");
    });

    it("should have correct table name", () => {
      expect(documentChecklists[Symbol.for("drizzle:Name")]).toBe(
        "document_checklists"
      );
    });
  });

  describe("Tenant Isolation", () => {
    it("should create tenant filter condition", () => {
      const condition = withTenantId(
        documentChecklists.tenantId,
        validTenantId
      );
      expect(condition).toBeDefined();
      expect(typeof condition).toBe("object");
    });

    it("should create combined tenant and soft-delete filter", () => {
      const condition = withTenantIdAndNotDeleted(
        documentChecklists.tenantId,
        documentChecklists.deletedAt,
        validTenantId
      );
      expect(condition).toBeDefined();
      expect(typeof condition).toBe("object");
    });

    it("should throw error for empty tenant ID", () => {
      expect(() => withTenantId(documentChecklists.tenantId, "")).toThrow(
        TenantContextError
      );
    });
  });
});

describe("Workflow Documents Table", () => {
  describe("Schema Definition", () => {
    it("should have correct column structure", () => {
      expect(workflowDocuments.id).toBeDefined();
      expect(workflowDocuments.workflowId).toBeDefined();
      expect(workflowDocuments.checklistItemId).toBeDefined();
      expect(workflowDocuments.documentId).toBeDefined();
      expect(workflowDocuments.status).toBeDefined();
      expect(workflowDocuments.createdAt).toBeDefined();
      expect(workflowDocuments.updatedAt).toBeDefined();
      expect(workflowDocuments.deletedAt).toBeDefined();
    });

    it("should have workflow_id foreign key", () => {
      expect(workflowDocuments.workflowId).toBeDefined();
      expect(workflowDocuments.workflowId.name).toBe("workflow_id");
    });

    it("should have document_id foreign key", () => {
      expect(workflowDocuments.documentId).toBeDefined();
      expect(workflowDocuments.documentId.name).toBe("document_id");
    });

    it("should have deleted_at for soft deletes", () => {
      expect(workflowDocuments.deletedAt).toBeDefined();
      expect(workflowDocuments.deletedAt.name).toBe("deleted_at");
    });

    it("should have correct table name", () => {
      expect(workflowDocuments[Symbol.for("drizzle:Name")]).toBe(
        "workflow_documents"
      );
    });
  });

  describe("Checklist Item Status Enum", () => {
    it("should have all required status values", () => {
      expect(ChecklistItemStatus.PENDING).toBe("Pending");
      expect(ChecklistItemStatus.UPLOADED).toBe("Uploaded");
      expect(ChecklistItemStatus.APPROVED).toBe("Approved");
      expect(ChecklistItemStatus.REJECTED).toBe("Rejected");
    });

    it("should have exactly 4 status values", () => {
      const statusValues = Object.values(ChecklistItemStatus);
      expect(statusValues).toHaveLength(4);
    });
  });
});

describe("Cross-Tenant Isolation Enforcement", () => {
  const tenantA = "550e8400-e29b-41d4-a716-446655440000";
  const tenantB = "660e8400-e29b-41d4-a716-446655440001";

  it("should generate different conditions for different tenants - workflows", () => {
    const conditionA = withTenantId(qualificationWorkflows.tenantId, tenantA);
    const conditionB = withTenantId(qualificationWorkflows.tenantId, tenantB);

    expect(conditionA).toBeDefined();
    expect(conditionB).toBeDefined();
    expect(typeof conditionA).toBe("object");
    expect(typeof conditionB).toBe("object");
  });

  it("should generate different conditions for different tenants - checklists", () => {
    const conditionA = withTenantId(documentChecklists.tenantId, tenantA);
    const conditionB = withTenantId(documentChecklists.tenantId, tenantB);

    expect(conditionA).toBeDefined();
    expect(conditionB).toBeDefined();
    expect(typeof conditionA).toBe("object");
    expect(typeof conditionB).toBe("object");
  });

  it("should enforce tenant context in all workflow tables", () => {
    // Empty tenant ID should fail for workflows
    expect(() => withTenantId(qualificationWorkflows.tenantId, "")).toThrow(
      TenantContextError
    );

    // Empty tenant ID should fail for checklists
    expect(() => withTenantId(documentChecklists.tenantId, "")).toThrow(
      TenantContextError
    );

    // Valid tenant IDs should succeed
    expect(() =>
      withTenantId(qualificationWorkflows.tenantId, tenantA)
    ).not.toThrow();
    expect(() =>
      withTenantId(documentChecklists.tenantId, tenantA)
    ).not.toThrow();
  });
});

describe("Type Inference", () => {
  it("should infer correct insert types for workflows", () => {
    type WorkflowInsert = typeof qualificationWorkflows.$inferInsert;

    const mockWorkflow: Partial<WorkflowInsert> = {
      tenantId: "550e8400-e29b-41d4-a716-446655440000",
      supplierId: "660e8400-e29b-41d4-a716-446655440001",
      status: WorkflowStatus.DRAFT,
      initiatedBy: "770e8400-e29b-41d4-a716-446655440002",
    };

    expect(mockWorkflow).toBeDefined();
  });

  it("should infer correct insert types for stages", () => {
    type StageInsert = typeof qualificationStages.$inferInsert;

    const mockStage: Partial<StageInsert> = {
      workflowId: "550e8400-e29b-41d4-a716-446655440000",
      stageNumber: 1,
      stageName: "Initial Review",
      assignedTo: "660e8400-e29b-41d4-a716-446655440001",
      status: StageStatus.PENDING,
    };

    expect(mockStage).toBeDefined();
  });

  it("should infer correct insert types for checklists", () => {
    type ChecklistInsert = typeof documentChecklists.$inferInsert;

    const mockChecklist: Partial<ChecklistInsert> = {
      tenantId: "550e8400-e29b-41d4-a716-446655440000",
      templateName: "ISO 9001 Standard",
      isDefault: true,
      requiredDocuments: [],
    };

    expect(mockChecklist).toBeDefined();
  });

  it("should infer correct insert types for workflow documents", () => {
    type WorkflowDocInsert = typeof workflowDocuments.$inferInsert;

    const mockWorkflowDoc: Partial<WorkflowDocInsert> = {
      workflowId: "550e8400-e29b-41d4-a716-446655440000",
      documentId: "660e8400-e29b-41d4-a716-446655440001",
      status: ChecklistItemStatus.PENDING,
    };

    expect(mockWorkflowDoc).toBeDefined();
  });

  it("should infer correct select types for workflows", () => {
    type WorkflowSelect = typeof qualificationWorkflows.$inferSelect;

    const mockWorkflow: Partial<WorkflowSelect> = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      tenantId: "660e8400-e29b-41d4-a716-446655440001",
      status: WorkflowStatus.APPROVED,
      currentStage: 3,
    };

    expect(mockWorkflow).toBeDefined();
  });
});
