import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  setDefaultTimeout,
} from "bun:test";

setDefaultTimeout(30_000);
import { db } from "../../db";
import {
  tenants,
  users,
  workflowTemplate,
  workflowStepTemplate,
  processInstance,
  stepInstance,
  taskInstance,
  workflowStepDocument,
  workflowType,
  supplierStatus,
  suppliers,
  documentReviewDecision,
} from "@supplex/db";
import { eq, and } from "drizzle-orm";
import { reviewStepDocuments } from "../review-step-documents";

/**
 * Integration Tests: Document Review Engine Function
 * Revised: Per-reviewer document approval model with explicit validation rounds
 */

describe("reviewStepDocuments", () => {
  let tenant: { id: string };
  let user: { id: string };
  let user2: { id: string };
  let template: { id: string };

  beforeAll(async () => {
    tenant = (
      await db
        .insert(tenants)
        .values({
          name: "Doc Review Test Tenant",
          slug: `doc-review-tenant-${Date.now()}`,
        })
        .returning()
    )[0]!;

    user = (
      await db
        .insert(users)
        .values({
          id: crypto.randomUUID(),
          tenantId: tenant.id,
          email: `doc-review-user-${Date.now()}@test.com`,
          fullName: "Doc Review User",
          role: "admin",
        })
        .returning()
    )[0]!;

    user2 = (
      await db
        .insert(users)
        .values({
          id: crypto.randomUUID(),
          tenantId: tenant.id,
          email: `doc-review-user2-${Date.now()}@test.com`,
          fullName: "Quality Manager User",
          role: "quality_manager",
        })
        .returning()
    )[0]!;

    template = (
      await db
        .insert(workflowTemplate)
        .values({
          tenantId: tenant.id,
          name: "Doc Review Test Template",
          status: "published",
          createdBy: user.id,
        })
        .returning()
    )[0]!;
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenant.id));
  });

  test("single reviewer approves all → decision rows created, step validated, transition", async () => {
    const step1Tmpl = (
      await db
        .insert(workflowStepTemplate)
        .values({
          workflowTemplateId: template.id,
          tenantId: tenant.id,
          stepOrder: 1,
          name: "Document Upload",
          stepType: "document",
          requiresValidation: true,
          taskTitle: "Upload docs",
          assigneeType: "role",
          assigneeRole: "admin",
        })
        .returning()
    )[0]!;

    const step2Tmpl = (
      await db
        .insert(workflowStepTemplate)
        .values({
          workflowTemplateId: template.id,
          tenantId: tenant.id,
          stepOrder: 2,
          name: "Review Form",
          stepType: "form",
          taskTitle: "Fill form",
          assigneeType: "role",
          assigneeRole: "admin",
        })
        .returning()
    )[0]!;

    const proc = (
      await db
        .insert(processInstance)
        .values({
          tenantId: tenant.id,
          workflowTemplateId: template.id,
          processType: "workflow_execution",
          entityType: "supplier",
          entityId: crypto.randomUUID(),
          status: "in_progress",
          initiatedBy: user.id,
          initiatedDate: new Date(),
        })
        .returning()
    )[0]!;

    const stepInst1 = (
      await db
        .insert(stepInstance)
        .values({
          tenantId: tenant.id,
          processInstanceId: proc.id,
          workflowStepTemplateId: step1Tmpl.id,
          stepOrder: 1,
          stepName: "Document Upload",
          stepType: "document",
          status: "awaiting_validation",
          validationRound: 1,
        })
        .returning()
    )[0]!;

    await db.insert(stepInstance).values({
      tenantId: tenant.id,
      processInstanceId: proc.id,
      workflowStepTemplateId: step2Tmpl.id,
      stepOrder: 2,
      stepName: "Review Form",
      stepType: "form",
      status: "blocked",
    });

    await db.insert(workflowStepDocument).values([
      {
        tenantId: tenant.id,
        processInstanceId: proc.id,
        stepInstanceId: stepInst1.id,
        requiredDocumentName: "Tax Certificate",
        status: "uploaded",
      },
      {
        tenantId: tenant.id,
        processInstanceId: proc.id,
        stepInstanceId: stepInst1.id,
        requiredDocumentName: "Insurance Policy",
        status: "uploaded",
      },
    ]);

    const valTask = (
      await db
        .insert(taskInstance)
        .values({
          tenantId: tenant.id,
          processInstanceId: proc.id,
          stepInstanceId: stepInst1.id,
          assigneeType: "role",
          assigneeRole: "admin",
          title: "Validate: Document Upload",
          taskType: "validation",
          status: "pending",
          validationRound: 1,
        })
        .returning()
    )[0]!;

    const result = await db.transaction(async (tx) => {
      return reviewStepDocuments(tx, {
        tenantId: tenant.id,
        stepInstanceId: stepInst1.id,
        reviewedBy: user.id,
        taskId: valTask.id,
        decisions: [
          { requiredDocumentName: "Tax Certificate", action: "approve" },
          { requiredDocumentName: "Insurance Policy", action: "approve" },
        ],
      });
    });

    expect(result.success).toBe(true);
    expect(result.outcome).toBe("all_approved");
    expect(result.allValidationsComplete).toBe(true);
    expect(result.approvedCount).toBe(2);
    expect(result.nextStepActivated).toBe(true);

    // Verify decision rows were created
    const decisionRows = await db
      .select()
      .from(documentReviewDecision)
      .where(
        and(
          eq(documentReviewDecision.stepInstanceId, stepInst1.id),
          eq(documentReviewDecision.validationRound, 1)
        )
      );
    expect(decisionRows.length).toBe(2);
    expect(decisionRows.every((d) => d.decision === "approved")).toBe(true);
    expect(decisionRows.every((d) => d.reviewerUserId === user.id)).toBe(true);
    expect(decisionRows.every((d) => d.validationRound === 1)).toBe(true);

    // Verify aggregate doc statuses
    const docs = await db
      .select()
      .from(workflowStepDocument)
      .where(eq(workflowStepDocument.stepInstanceId, stepInst1.id));
    expect(docs.every((d) => d.status === "approved")).toBe(true);

    // Verify step status
    const updatedStep1 = (
      await db
        .select()
        .from(stepInstance)
        .where(eq(stepInstance.id, stepInst1.id))
    )[0]!;
    expect(updatedStep1.status).toBe("validated");

    await db
      .delete(workflowStepTemplate)
      .where(eq(workflowStepTemplate.id, step1Tmpl.id));
    await db
      .delete(workflowStepTemplate)
      .where(eq(workflowStepTemplate.id, step2Tmpl.id));
  });

  test("all-approved on last step → process completed → supplier status updated", async () => {
    const status = (
      await db
        .insert(supplierStatus)
        .values({
          tenantId: tenant.id,
          name: `qualified-${Date.now()}`,
          displayOrder: 1,
        })
        .returning()
    )[0]!;

    const wfType = (
      await db
        .insert(workflowType)
        .values({
          tenantId: tenant.id,
          name: `Qualification-${Date.now()}`,
          supplierStatusId: status.id,
        })
        .returning()
    )[0]!;

    const singleTemplate = (
      await db
        .insert(workflowTemplate)
        .values({
          tenantId: tenant.id,
          name: `Single Step Template-${Date.now()}`,
          status: "published",
          createdBy: user.id,
          workflowTypeId: wfType.id,
        })
        .returning()
    )[0]!;

    const stepTmpl = (
      await db
        .insert(workflowStepTemplate)
        .values({
          workflowTemplateId: singleTemplate.id,
          tenantId: tenant.id,
          stepOrder: 1,
          name: "Upload Documents",
          stepType: "document",
          requiresValidation: true,
          taskTitle: "Upload docs",
          assigneeType: "role",
          assigneeRole: "admin",
        })
        .returning()
    )[0]!;

    const supplier = (
      await db
        .insert(suppliers)
        .values({
          tenantId: tenant.id,
          name: "Test Supplier",
          taxId: `TAX-${Date.now()}`,
          category: "IT",
          status: "prospect",
          contactName: "John",
          contactEmail: `john-${Date.now()}@test.com`,
          address: { street: "123 St", city: "Test" },
          createdBy: user.id,
        })
        .returning()
    )[0]!;

    const proc = (
      await db
        .insert(processInstance)
        .values({
          tenantId: tenant.id,
          workflowTemplateId: singleTemplate.id,
          processType: "workflow_execution",
          entityType: "supplier",
          entityId: supplier.id,
          status: "in_progress",
          initiatedBy: user.id,
          initiatedDate: new Date(),
          totalSteps: 1,
        })
        .returning()
    )[0]!;

    const stepInst = (
      await db
        .insert(stepInstance)
        .values({
          tenantId: tenant.id,
          processInstanceId: proc.id,
          workflowStepTemplateId: stepTmpl.id,
          stepOrder: 1,
          stepName: "Upload Documents",
          stepType: "document",
          status: "awaiting_validation",
          validationRound: 1,
        })
        .returning()
    )[0]!;

    await db.insert(workflowStepDocument).values({
      tenantId: tenant.id,
      processInstanceId: proc.id,
      stepInstanceId: stepInst.id,
      requiredDocumentName: "Tax Certificate",
      status: "uploaded",
    });

    const valTask = (
      await db
        .insert(taskInstance)
        .values({
          tenantId: tenant.id,
          processInstanceId: proc.id,
          stepInstanceId: stepInst.id,
          assigneeType: "role",
          assigneeRole: "admin",
          title: "Validate: Upload Documents",
          taskType: "validation",
          status: "pending",
          validationRound: 1,
        })
        .returning()
    )[0]!;

    const result = await db.transaction(async (tx) => {
      return reviewStepDocuments(tx, {
        tenantId: tenant.id,
        stepInstanceId: stepInst.id,
        reviewedBy: user.id,
        taskId: valTask.id,
        decisions: [
          { requiredDocumentName: "Tax Certificate", action: "approve" },
        ],
      });
    });

    expect(result.success).toBe(true);
    expect(result.outcome).toBe("all_approved");
    expect(result.processCompleted).toBe(true);

    const updatedProc = (
      await db
        .select()
        .from(processInstance)
        .where(eq(processInstance.id, proc.id))
    )[0]!;
    expect(updatedProc.status).toBe("complete");

    const updatedSupplier = (
      await db.select().from(suppliers).where(eq(suppliers.id, supplier.id))
    )[0]!;
    expect(updatedSupplier.status).toBe(status.name);
    expect(updatedSupplier.supplierStatusId).toBe(status.id);
  });

  test("any-declined → decision rows created with comments → step reset to active", async () => {
    const stepTmpl = (
      await db
        .insert(workflowStepTemplate)
        .values({
          workflowTemplateId: template.id,
          tenantId: tenant.id,
          stepOrder: 100,
          name: "Decline Test Step",
          stepType: "document",
          requiresValidation: true,
          taskTitle: "Upload docs",
          assigneeType: "role",
          assigneeRole: "admin",
        })
        .returning()
    )[0]!;

    const proc = (
      await db
        .insert(processInstance)
        .values({
          tenantId: tenant.id,
          workflowTemplateId: template.id,
          processType: "workflow_execution",
          entityType: "supplier",
          entityId: crypto.randomUUID(),
          status: "in_progress",
          initiatedBy: user.id,
          initiatedDate: new Date(),
        })
        .returning()
    )[0]!;

    const stepInst = (
      await db
        .insert(stepInstance)
        .values({
          tenantId: tenant.id,
          processInstanceId: proc.id,
          workflowStepTemplateId: stepTmpl.id,
          stepOrder: 100,
          stepName: "Decline Test Step",
          stepType: "document",
          status: "awaiting_validation",
          validationRound: 1,
        })
        .returning()
    )[0]!;

    await db.insert(workflowStepDocument).values([
      {
        tenantId: tenant.id,
        processInstanceId: proc.id,
        stepInstanceId: stepInst.id,
        requiredDocumentName: "Tax Certificate",
        status: "uploaded",
      },
      {
        tenantId: tenant.id,
        processInstanceId: proc.id,
        stepInstanceId: stepInst.id,
        requiredDocumentName: "Insurance Policy",
        status: "uploaded",
      },
    ]);

    const valTask = (
      await db
        .insert(taskInstance)
        .values({
          tenantId: tenant.id,
          processInstanceId: proc.id,
          stepInstanceId: stepInst.id,
          assigneeType: "role",
          assigneeRole: "admin",
          title: "Validate: Decline Test",
          taskType: "validation",
          status: "pending",
          validationRound: 1,
        })
        .returning()
    )[0]!;

    const result = await db.transaction(async (tx) => {
      return reviewStepDocuments(tx, {
        tenantId: tenant.id,
        stepInstanceId: stepInst.id,
        reviewedBy: user.id,
        taskId: valTask.id,
        decisions: [
          { requiredDocumentName: "Tax Certificate", action: "approve" },
          {
            requiredDocumentName: "Insurance Policy",
            action: "decline",
            comment: "Document is expired",
          },
        ],
      });
    });

    expect(result.success).toBe(true);
    expect(result.outcome).toBe("declined");
    expect(result.approvedCount).toBe(1);
    expect(result.declinedCount).toBe(1);

    // Verify decision rows were recorded for audit
    const decisionRows = await db
      .select()
      .from(documentReviewDecision)
      .where(
        and(
          eq(documentReviewDecision.stepInstanceId, stepInst.id),
          eq(documentReviewDecision.validationRound, 1)
        )
      );
    expect(decisionRows.length).toBe(2);
    const approvedDecision = decisionRows.find(
      (d) => d.decision === "approved"
    );
    const declinedDecision = decisionRows.find(
      (d) => d.decision === "declined"
    );
    expect(approvedDecision).toBeTruthy();
    expect(declinedDecision).toBeTruthy();
    expect(declinedDecision!.comment).toBe("Document is expired");

    // Verify doc statuses
    const docs = await db
      .select()
      .from(workflowStepDocument)
      .where(eq(workflowStepDocument.stepInstanceId, stepInst.id));
    const taxDoc = docs.find(
      (d) => d.requiredDocumentName === "Tax Certificate"
    );
    const insDoc = docs.find(
      (d) => d.requiredDocumentName === "Insurance Policy"
    );

    expect(taxDoc!.status).toBe("uploaded"); // not changed to approved on decline path
    expect(insDoc!.status).toBe("pending");
    expect(insDoc!.documentId).toBeNull();
    expect(insDoc!.declineComment).toBe("Document is expired");

    const updatedStep = (
      await db
        .select()
        .from(stepInstance)
        .where(eq(stepInstance.id, stepInst.id))
    )[0]!;
    expect(updatedStep.status).toBe("active");

    const updatedProc = (
      await db
        .select()
        .from(processInstance)
        .where(eq(processInstance.id, proc.id))
    )[0]!;
    expect(updatedProc.status).toBe("declined_resubmit");

    await db
      .delete(workflowStepTemplate)
      .where(eq(workflowStepTemplate.id, stepTmpl.id));
  });

  test("CAS conflict / idempotency — second review with same task fails, no duplicate decisions", async () => {
    const stepTmpl = (
      await db
        .insert(workflowStepTemplate)
        .values({
          workflowTemplateId: template.id,
          tenantId: tenant.id,
          stepOrder: 200,
          name: "CAS Conflict Step",
          stepType: "document",
          requiresValidation: true,
          taskTitle: "Upload docs",
          assigneeType: "role",
          assigneeRole: "admin",
        })
        .returning()
    )[0]!;

    const step2Tmpl = (
      await db
        .insert(workflowStepTemplate)
        .values({
          workflowTemplateId: template.id,
          tenantId: tenant.id,
          stepOrder: 201,
          name: "After CAS Step",
          stepType: "form",
          taskTitle: "Next task",
          assigneeType: "role",
          assigneeRole: "admin",
        })
        .returning()
    )[0]!;

    const proc = (
      await db
        .insert(processInstance)
        .values({
          tenantId: tenant.id,
          workflowTemplateId: template.id,
          processType: "workflow_execution",
          entityType: "supplier",
          entityId: crypto.randomUUID(),
          status: "in_progress",
          initiatedBy: user.id,
          initiatedDate: new Date(),
        })
        .returning()
    )[0]!;

    const stepInst = (
      await db
        .insert(stepInstance)
        .values({
          tenantId: tenant.id,
          processInstanceId: proc.id,
          workflowStepTemplateId: stepTmpl.id,
          stepOrder: 200,
          stepName: "CAS Conflict Step",
          stepType: "document",
          status: "awaiting_validation",
          validationRound: 1,
        })
        .returning()
    )[0]!;

    await db.insert(stepInstance).values({
      tenantId: tenant.id,
      processInstanceId: proc.id,
      workflowStepTemplateId: step2Tmpl.id,
      stepOrder: 201,
      stepName: "After CAS Step",
      stepType: "form",
      status: "blocked",
    });

    await db.insert(workflowStepDocument).values({
      tenantId: tenant.id,
      processInstanceId: proc.id,
      stepInstanceId: stepInst.id,
      requiredDocumentName: "Certificate",
      status: "uploaded",
    });

    const valTask = (
      await db
        .insert(taskInstance)
        .values({
          tenantId: tenant.id,
          processInstanceId: proc.id,
          stepInstanceId: stepInst.id,
          assigneeType: "role",
          assigneeRole: "admin",
          title: "Validate: CAS Test",
          taskType: "validation",
          status: "pending",
          validationRound: 1,
        })
        .returning()
    )[0]!;

    const result1 = await db.transaction(async (tx) => {
      return reviewStepDocuments(tx, {
        tenantId: tenant.id,
        stepInstanceId: stepInst.id,
        reviewedBy: user.id,
        taskId: valTask.id,
        decisions: [{ requiredDocumentName: "Certificate", action: "approve" }],
      });
    });

    expect(result1.success).toBe(true);
    expect(result1.outcome).toBe("all_approved");

    // Same task ID again — CAS rejects (task already completed)
    const result2 = await db.transaction(async (tx) => {
      return reviewStepDocuments(tx, {
        tenantId: tenant.id,
        stepInstanceId: stepInst.id,
        reviewedBy: user.id,
        taskId: valTask.id,
        decisions: [{ requiredDocumentName: "Certificate", action: "approve" }],
      });
    });

    expect(result2.success).toBe(false);
    expect(result2.conflict).toBe(true);

    // Verify no duplicate decision rows (ON CONFLICT DO NOTHING)
    const decisionRows = await db
      .select()
      .from(documentReviewDecision)
      .where(eq(documentReviewDecision.taskInstanceId, valTask.id));
    expect(decisionRows.length).toBe(1);

    await db
      .delete(workflowStepTemplate)
      .where(eq(workflowStepTemplate.id, stepTmpl.id));
    await db
      .delete(workflowStepTemplate)
      .where(eq(workflowStepTemplate.id, step2Tmpl.id));
  });

  test("step not in awaiting_validation → immediate failure", async () => {
    const stepTmpl = (
      await db
        .insert(workflowStepTemplate)
        .values({
          workflowTemplateId: template.id,
          tenantId: tenant.id,
          stepOrder: 300,
          name: "Wrong State Step",
          stepType: "document",
          taskTitle: "Upload docs",
          assigneeType: "role",
          assigneeRole: "admin",
        })
        .returning()
    )[0]!;

    const proc = (
      await db
        .insert(processInstance)
        .values({
          tenantId: tenant.id,
          workflowTemplateId: template.id,
          processType: "workflow_execution",
          entityType: "supplier",
          entityId: crypto.randomUUID(),
          status: "in_progress",
          initiatedBy: user.id,
          initiatedDate: new Date(),
        })
        .returning()
    )[0]!;

    const stepInst = (
      await db
        .insert(stepInstance)
        .values({
          tenantId: tenant.id,
          processInstanceId: proc.id,
          workflowStepTemplateId: stepTmpl.id,
          stepOrder: 300,
          stepName: "Wrong State Step",
          stepType: "document",
          status: "active",
        })
        .returning()
    )[0]!;

    await db.insert(workflowStepDocument).values({
      tenantId: tenant.id,
      processInstanceId: proc.id,
      stepInstanceId: stepInst.id,
      requiredDocumentName: "Certificate",
      status: "uploaded",
    });

    const result = await db.transaction(async (tx) => {
      return reviewStepDocuments(tx, {
        tenantId: tenant.id,
        stepInstanceId: stepInst.id,
        reviewedBy: user.id,
        taskId: crypto.randomUUID(),
        decisions: [{ requiredDocumentName: "Certificate", action: "approve" }],
      });
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("not awaiting validation");

    await db
      .delete(workflowStepTemplate)
      .where(eq(workflowStepTemplate.id, stepTmpl.id));
  });

  test("multi-approver: reviewer 1 approves → partial, reviewer 2 approves → final with transition", async () => {
    const stepTmpl = (
      await db
        .insert(workflowStepTemplate)
        .values({
          workflowTemplateId: template.id,
          tenantId: tenant.id,
          stepOrder: 400,
          name: "Multi-Approver Step",
          stepType: "document",
          requiresValidation: true,
          taskTitle: "Upload docs",
          assigneeType: "role",
          assigneeRole: "admin",
        })
        .returning()
    )[0]!;

    const step2Tmpl = (
      await db
        .insert(workflowStepTemplate)
        .values({
          workflowTemplateId: template.id,
          tenantId: tenant.id,
          stepOrder: 401,
          name: "After Multi-Approver",
          stepType: "form",
          taskTitle: "Next task",
          assigneeType: "role",
          assigneeRole: "admin",
        })
        .returning()
    )[0]!;

    const proc = (
      await db
        .insert(processInstance)
        .values({
          tenantId: tenant.id,
          workflowTemplateId: template.id,
          processType: "workflow_execution",
          entityType: "supplier",
          entityId: crypto.randomUUID(),
          status: "in_progress",
          initiatedBy: user.id,
          initiatedDate: new Date(),
        })
        .returning()
    )[0]!;

    const stepInst = (
      await db
        .insert(stepInstance)
        .values({
          tenantId: tenant.id,
          processInstanceId: proc.id,
          workflowStepTemplateId: stepTmpl.id,
          stepOrder: 400,
          stepName: "Multi-Approver Step",
          stepType: "document",
          status: "awaiting_validation",
          validationRound: 1,
        })
        .returning()
    )[0]!;

    await db.insert(stepInstance).values({
      tenantId: tenant.id,
      processInstanceId: proc.id,
      workflowStepTemplateId: step2Tmpl.id,
      stepOrder: 401,
      stepName: "After Multi-Approver",
      stepType: "form",
      status: "blocked",
    });

    await db.insert(workflowStepDocument).values({
      tenantId: tenant.id,
      processInstanceId: proc.id,
      stepInstanceId: stepInst.id,
      requiredDocumentName: "Certificate",
      status: "uploaded",
    });

    const task1 = (
      await db
        .insert(taskInstance)
        .values({
          tenantId: tenant.id,
          processInstanceId: proc.id,
          stepInstanceId: stepInst.id,
          assigneeType: "role",
          assigneeRole: "quality_manager",
          title: "Validate: Multi-Approver",
          taskType: "validation",
          status: "pending",
          validationRound: 1,
          metadata: {},
        })
        .returning()
    )[0]!;

    const task2 = (
      await db
        .insert(taskInstance)
        .values({
          tenantId: tenant.id,
          processInstanceId: proc.id,
          stepInstanceId: stepInst.id,
          assigneeType: "role",
          assigneeRole: "admin",
          title: "Validate: Multi-Approver",
          taskType: "validation",
          status: "pending",
          validationRound: 1,
          metadata: {},
        })
        .returning()
    )[0]!;

    // --- First reviewer approves → partial ---
    const result1 = await db.transaction(async (tx) => {
      return reviewStepDocuments(tx, {
        tenantId: tenant.id,
        stepInstanceId: stepInst.id,
        reviewedBy: user2.id,
        taskId: task1.id,
        decisions: [{ requiredDocumentName: "Certificate", action: "approve" }],
      });
    });

    expect(result1.success).toBe(true);
    expect(result1.outcome).toBe("all_approved");
    expect(result1.allValidationsComplete).toBe(false);
    expect(result1.remainingApprovals).toBe(1);
    expect(result1.stepCompleted).toBe(false);
    expect(result1.nextStepActivated).toBe(false);

    // Step still awaiting_validation
    const stepAfterFirst = (
      await db
        .select()
        .from(stepInstance)
        .where(eq(stepInstance.id, stepInst.id))
    )[0]!;
    expect(stepAfterFirst.status).toBe("awaiting_validation");

    // Document status NOT changed to approved (aggregate stays uploaded)
    const docAfterFirst = (
      await db
        .select()
        .from(workflowStepDocument)
        .where(eq(workflowStepDocument.stepInstanceId, stepInst.id))
    )[0]!;
    expect(docAfterFirst.status).toBe("uploaded");

    // Task 1 completed, task 2 still pending
    const t1 = (
      await db.select().from(taskInstance).where(eq(taskInstance.id, task1.id))
    )[0]!;
    const t2 = (
      await db.select().from(taskInstance).where(eq(taskInstance.id, task2.id))
    )[0]!;
    expect(t1.status).toBe("completed");
    expect(t2.status).toBe("pending");

    // Decision row exists for reviewer 1
    const decisionsAfterFirst = await db
      .select()
      .from(documentReviewDecision)
      .where(
        and(
          eq(documentReviewDecision.stepInstanceId, stepInst.id),
          eq(documentReviewDecision.validationRound, 1)
        )
      );
    expect(decisionsAfterFirst.length).toBe(1);
    expect(decisionsAfterFirst[0]!.reviewerUserId).toBe(user2.id);

    // --- Second reviewer approves → final with transition ---
    const result2 = await db.transaction(async (tx) => {
      return reviewStepDocuments(tx, {
        tenantId: tenant.id,
        stepInstanceId: stepInst.id,
        reviewedBy: user.id,
        taskId: task2.id,
        decisions: [{ requiredDocumentName: "Certificate", action: "approve" }],
      });
    });

    expect(result2.success).toBe(true);
    expect(result2.outcome).toBe("all_approved");
    expect(result2.allValidationsComplete).toBe(true);
    expect(result2.stepCompleted).toBe(true);
    expect(result2.nextStepActivated).toBe(true);

    // Step validated
    const stepAfterSecond = (
      await db
        .select()
        .from(stepInstance)
        .where(eq(stepInstance.id, stepInst.id))
    )[0]!;
    expect(stepAfterSecond.status).toBe("validated");

    // Document now approved (aggregate)
    const docAfterSecond = (
      await db
        .select()
        .from(workflowStepDocument)
        .where(eq(workflowStepDocument.stepInstanceId, stepInst.id))
    )[0]!;
    expect(docAfterSecond.status).toBe("approved");

    // Both reviewers' decisions exist
    const allDecisions = await db
      .select()
      .from(documentReviewDecision)
      .where(
        and(
          eq(documentReviewDecision.stepInstanceId, stepInst.id),
          eq(documentReviewDecision.validationRound, 1)
        )
      );
    expect(allDecisions.length).toBe(2);
    expect(allDecisions.every((d) => d.decision === "approved")).toBe(true);

    await db
      .delete(workflowStepTemplate)
      .where(eq(workflowStepTemplate.id, stepTmpl.id));
    await db
      .delete(workflowStepTemplate)
      .where(eq(workflowStepTemplate.id, step2Tmpl.id));
  });

  test("resubmission round isolation: old round decisions not consulted in new round", async () => {
    const stepTmpl = (
      await db
        .insert(workflowStepTemplate)
        .values({
          workflowTemplateId: template.id,
          tenantId: tenant.id,
          stepOrder: 500,
          name: "Round Isolation Step",
          stepType: "document",
          requiresValidation: true,
          taskTitle: "Upload docs",
          assigneeType: "role",
          assigneeRole: "admin",
        })
        .returning()
    )[0]!;

    const step2Tmpl = (
      await db
        .insert(workflowStepTemplate)
        .values({
          workflowTemplateId: template.id,
          tenantId: tenant.id,
          stepOrder: 501,
          name: "After Round Isolation",
          stepType: "form",
          taskTitle: "Next task",
          assigneeType: "role",
          assigneeRole: "admin",
        })
        .returning()
    )[0]!;

    const proc = (
      await db
        .insert(processInstance)
        .values({
          tenantId: tenant.id,
          workflowTemplateId: template.id,
          processType: "workflow_execution",
          entityType: "supplier",
          entityId: crypto.randomUUID(),
          status: "in_progress",
          initiatedBy: user.id,
          initiatedDate: new Date(),
        })
        .returning()
    )[0]!;

    const stepInst = (
      await db
        .insert(stepInstance)
        .values({
          tenantId: tenant.id,
          processInstanceId: proc.id,
          workflowStepTemplateId: stepTmpl.id,
          stepOrder: 500,
          stepName: "Round Isolation Step",
          stepType: "document",
          status: "awaiting_validation",
          validationRound: 1,
        })
        .returning()
    )[0]!;

    await db.insert(stepInstance).values({
      tenantId: tenant.id,
      processInstanceId: proc.id,
      workflowStepTemplateId: step2Tmpl.id,
      stepOrder: 501,
      stepName: "After Round Isolation",
      stepType: "form",
      status: "blocked",
    });

    await db.insert(workflowStepDocument).values({
      tenantId: tenant.id,
      processInstanceId: proc.id,
      stepInstanceId: stepInst.id,
      requiredDocumentName: "Certificate",
      status: "uploaded",
    });

    // Round 1 task
    const round1Task = (
      await db
        .insert(taskInstance)
        .values({
          tenantId: tenant.id,
          processInstanceId: proc.id,
          stepInstanceId: stepInst.id,
          assigneeType: "role",
          assigneeRole: "admin",
          title: "Validate: Round 1",
          taskType: "validation",
          status: "pending",
          validationRound: 1,
          metadata: {},
        })
        .returning()
    )[0]!;

    // Round 1: decline → step resets
    const declineResult = await db.transaction(async (tx) => {
      return reviewStepDocuments(tx, {
        tenantId: tenant.id,
        stepInstanceId: stepInst.id,
        reviewedBy: user.id,
        taskId: round1Task.id,
        decisions: [
          {
            requiredDocumentName: "Certificate",
            action: "decline",
            comment: "Bad quality",
          },
        ],
      });
    });

    expect(declineResult.success).toBe(true);
    expect(declineResult.outcome).toBe("declined");

    // Verify round 1 decision persisted for audit
    const round1Decisions = await db
      .select()
      .from(documentReviewDecision)
      .where(
        and(
          eq(documentReviewDecision.stepInstanceId, stepInst.id),
          eq(documentReviewDecision.validationRound, 1)
        )
      );
    expect(round1Decisions.length).toBe(1);
    expect(round1Decisions[0]!.decision).toBe("declined");

    // Simulate resubmission: step is now active, validation round would be incremented
    // by completeStep. Manually set to round 2 for this test.
    await db
      .update(stepInstance)
      .set({ status: "awaiting_validation", validationRound: 2 })
      .where(eq(stepInstance.id, stepInst.id));

    // Re-upload the document
    await db
      .update(workflowStepDocument)
      .set({ status: "uploaded" })
      .where(eq(workflowStepDocument.stepInstanceId, stepInst.id));

    // Create round 2 task
    const round2Task = (
      await db
        .insert(taskInstance)
        .values({
          tenantId: tenant.id,
          processInstanceId: proc.id,
          stepInstanceId: stepInst.id,
          assigneeType: "role",
          assigneeRole: "admin",
          title: "Validate: Round 2",
          taskType: "validation",
          status: "pending",
          validationRound: 2,
          metadata: {},
        })
        .returning()
    )[0]!;

    // Round 2: approve → should only consider round 2 decisions
    const approveResult = await db.transaction(async (tx) => {
      return reviewStepDocuments(tx, {
        tenantId: tenant.id,
        stepInstanceId: stepInst.id,
        reviewedBy: user.id,
        taskId: round2Task.id,
        decisions: [{ requiredDocumentName: "Certificate", action: "approve" }],
      });
    });

    expect(approveResult.success).toBe(true);
    expect(approveResult.outcome).toBe("all_approved");
    expect(approveResult.allValidationsComplete).toBe(true);
    expect(approveResult.stepCompleted).toBe(true);

    // Verify round 2 decision exists
    const round2Decisions = await db
      .select()
      .from(documentReviewDecision)
      .where(
        and(
          eq(documentReviewDecision.stepInstanceId, stepInst.id),
          eq(documentReviewDecision.validationRound, 2)
        )
      );
    expect(round2Decisions.length).toBe(1);
    expect(round2Decisions[0]!.decision).toBe("approved");

    // Round 1 decisions still exist (audit)
    const allDecisions = await db
      .select()
      .from(documentReviewDecision)
      .where(eq(documentReviewDecision.stepInstanceId, stepInst.id));
    expect(allDecisions.length).toBe(2);

    await db
      .delete(workflowStepTemplate)
      .where(eq(workflowStepTemplate.id, stepTmpl.id));
    await db
      .delete(workflowStepTemplate)
      .where(eq(workflowStepTemplate.id, step2Tmpl.id));
  });

  test("validationRound starts at 0, first validation = round 1", async () => {
    const proc = (
      await db
        .insert(processInstance)
        .values({
          tenantId: tenant.id,
          workflowTemplateId: template.id,
          processType: "workflow_execution",
          entityType: "supplier",
          entityId: crypto.randomUUID(),
          status: "in_progress",
          initiatedBy: user.id,
          initiatedDate: new Date(),
        })
        .returning()
    )[0]!;

    // Step starts with default validationRound = 0
    const stepInst = (
      await db
        .insert(stepInstance)
        .values({
          tenantId: tenant.id,
          processInstanceId: proc.id,
          stepOrder: 600,
          stepName: "Round Counter Step",
          stepType: "document",
          status: "active",
        })
        .returning()
    )[0]!;

    expect(stepInst.validationRound).toBe(0);

    // Simulate what completeStep does: increment to 1
    const updatedStep = (
      await db
        .update(stepInstance)
        .set({
          status: "awaiting_validation",
          validationRound: 1,
        })
        .where(eq(stepInstance.id, stepInst.id))
        .returning()
    )[0]!;

    expect(updatedStep.validationRound).toBe(1);
    expect(updatedStep.status).toBe("awaiting_validation");
  });
});
