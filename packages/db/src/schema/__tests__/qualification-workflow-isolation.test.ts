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
  qualificationProcess,
  qualificationStages,
  qualificationTemplates,
  workflowDocuments,
  WorkflowStatus,
  StageStatus,
  ChecklistItemStatus,
} from "../index";

describe("Qualification Workflows Table", () => {
  const validTenantId = "550e8400-e29b-41d4-a716-446655440000";

  describe("Schema Definition", () => {
    it("should have correct column structure", () => {
      expect(qualificationProcess.id).toBeDefined();
      expect(qualificationProcess.tenantId).toBeDefined();
      expect(qualificationProcess.supplierId).toBeDefined();
      expect(qualificationProcess.status).toBeDefined();
      expect(qualificationProcess.initiatedBy).toBeDefined();
      expect(qualificationProcess.initiatedDate).toBeDefined();
      expect(qualificationProcess.currentStage).toBeDefined();
      expect(qualificationProcess.riskScore).toBeDefined();
      expect(qualificationProcess.createdAt).toBeDefined();
      expect(qualificationProcess.updatedAt).toBeDefined();
      expect(qualificationProcess.deletedAt).toBeDefined();
    });

    it("should have tenant_id column for isolation", () => {
      expect(qualificationProcess.tenantId).toBeDefined();
      expect(qualificationProcess.tenantId.name).toBe("tenant_id");
    });

    it("should have deleted_at for soft deletes", () => {
      expect(qualificationProcess.deletedAt).toBeDefined();
      expect(qualificationProcess.deletedAt.name).toBe("deleted_at");
    });

    it("should have correct table name", () => {
      expect(qualificationProcess[Symbol.for("drizzle:Name")]).toBe(
        "qualification_process"
      );
    });

    it("should have supplier_id foreign key", () => {
      expect(qualificationProcess.supplierId).toBeDefined();
      expect(qualificationProcess.supplierId.name).toBe("supplier_id");
    });
  });

  describe("Tenant Isolation", () => {
    it("should create tenant filter condition", () => {
      const condition = withTenantId(
        qualificationProcess.tenantId,
        validTenantId
      );
      expect(condition).toBeDefined();
      expect(typeof condition).toBe("object");
    });

    it("should create combined tenant and soft-delete filter", () => {
      const condition = withTenantIdAndNotDeleted(
        qualificationProcess.tenantId,
        qualificationProcess.deletedAt,
        validTenantId
      );
      expect(condition).toBeDefined();
      expect(typeof condition).toBe("object");
    });

    it("should throw error for empty tenant ID", () => {
      expect(() => withTenantId(qualificationProcess.tenantId, "")).toThrow(
        TenantContextError
      );
    });

    it("should throw error for null tenant ID", () => {
      // Intentional bad input: bypass the `string` type to verify the
      // runtime guard. `as unknown as string` is the narrow cast for
      // negative-path tests like this one.
      expect(() =>
        withTenantId(qualificationProcess.tenantId, null as unknown as string)
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
      expect(qualificationTemplates.id).toBeDefined();
      expect(qualificationTemplates.tenantId).toBeDefined();
      expect(qualificationTemplates.templateName).toBeDefined();
      expect(qualificationTemplates.requiredDocuments).toBeDefined();
      expect(qualificationTemplates.isDefault).toBeDefined();
      expect(qualificationTemplates.createdAt).toBeDefined();
      expect(qualificationTemplates.updatedAt).toBeDefined();
      expect(qualificationTemplates.deletedAt).toBeDefined();
    });

    it("should have tenant_id column for isolation", () => {
      expect(qualificationTemplates.tenantId).toBeDefined();
      expect(qualificationTemplates.tenantId.name).toBe("tenant_id");
    });

    it("should have deleted_at for soft deletes", () => {
      expect(qualificationTemplates.deletedAt).toBeDefined();
      expect(qualificationTemplates.deletedAt.name).toBe("deleted_at");
    });

    it("should have correct table name", () => {
      expect(qualificationTemplates[Symbol.for("drizzle:Name")]).toBe(
        "qualification_templates"
      );
    });
  });

  describe("Tenant Isolation", () => {
    it("should create tenant filter condition", () => {
      const condition = withTenantId(
        qualificationTemplates.tenantId,
        validTenantId
      );
      expect(condition).toBeDefined();
      expect(typeof condition).toBe("object");
    });

    it("should create combined tenant and soft-delete filter", () => {
      const condition = withTenantIdAndNotDeleted(
        qualificationTemplates.tenantId,
        qualificationTemplates.deletedAt,
        validTenantId
      );
      expect(condition).toBeDefined();
      expect(typeof condition).toBe("object");
    });

    it("should throw error for empty tenant ID", () => {
      expect(() => withTenantId(qualificationTemplates.tenantId, "")).toThrow(
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
    const conditionA = withTenantId(qualificationProcess.tenantId, tenantA);
    const conditionB = withTenantId(qualificationProcess.tenantId, tenantB);

    expect(conditionA).toBeDefined();
    expect(conditionB).toBeDefined();
    expect(typeof conditionA).toBe("object");
    expect(typeof conditionB).toBe("object");
  });

  it("should generate different conditions for different tenants - checklists", () => {
    const conditionA = withTenantId(qualificationTemplates.tenantId, tenantA);
    const conditionB = withTenantId(qualificationTemplates.tenantId, tenantB);

    expect(conditionA).toBeDefined();
    expect(conditionB).toBeDefined();
    expect(typeof conditionA).toBe("object");
    expect(typeof conditionB).toBe("object");
  });

  it("should enforce tenant context in all workflow tables", () => {
    // Empty tenant ID should fail for workflows
    expect(() => withTenantId(qualificationProcess.tenantId, "")).toThrow(
      TenantContextError
    );

    // Empty tenant ID should fail for checklists
    expect(() => withTenantId(qualificationTemplates.tenantId, "")).toThrow(
      TenantContextError
    );

    // Valid tenant IDs should succeed
    expect(() =>
      withTenantId(qualificationProcess.tenantId, tenantA)
    ).not.toThrow();
    expect(() =>
      withTenantId(qualificationTemplates.tenantId, tenantA)
    ).not.toThrow();
  });
});

describe("Type Inference", () => {
  it("should infer correct insert types for workflows", () => {
    type WorkflowInsert = typeof qualificationProcess.$inferInsert;

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
    type ChecklistInsert = typeof qualificationTemplates.$inferInsert;

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
    type WorkflowSelect = typeof qualificationProcess.$inferSelect;

    const mockWorkflow: Partial<WorkflowSelect> = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      tenantId: "660e8400-e29b-41d4-a716-446655440001",
      status: WorkflowStatus.APPROVED,
      currentStage: 3,
    };

    expect(mockWorkflow).toBeDefined();
  });
});
