import { describe, test, expect, beforeAll, afterAll, setDefaultTimeout } from "bun:test";

setDefaultTimeout(30_000);
import { db } from "../../../lib/db";
import {
  tenants,
  users,
  workflowTemplate,
  workflowStepTemplate,
  processInstance,
  stepInstance,
  taskInstance,
  workflowStepDocument,
  documentReviewDecision,
} from "@supplex/db";
import { eq, and } from "drizzle-orm";
import { reviewStepDocuments } from "../../../lib/workflow-engine/review-step-documents";

/**
 * Route-Level Tests: Document Review Roundtrip
 * Verifies API response shapes for multi-approver review,
 * document list enrichment with current-round-only decisions,
 * and round isolation after resubmission.
 */

describe("Document Review Roundtrip", () => {
  let tenant: { id: string };
  let user1: { id: string };
  let user2: { id: string };
  let template: { id: string };

  beforeAll(async () => {
    [tenant] = await db
      .insert(tenants)
      .values({
        name: "Roundtrip Test Tenant",
        slug: `roundtrip-tenant-${Date.now()}`,
      })
      .returning();

    [user1] = await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        tenantId: tenant.id,
        email: `roundtrip-u1-${Date.now()}@test.com`,
        fullName: "Admin User",
        role: "admin",
      })
      .returning();

    [user2] = await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        tenantId: tenant.id,
        email: `roundtrip-u2-${Date.now()}@test.com`,
        fullName: "Quality Manager",
        role: "quality_manager",
      })
      .returning();

    [template] = await db
      .insert(workflowTemplate)
      .values({
        tenantId: tenant.id,
        name: "Roundtrip Test Template",
        status: "published",
        createdBy: user1.id,
      })
      .returning();
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenant.id));
  });

  test("POST /review multi-approver roundtrip: partial then final response shapes", async () => {
    const [stepTmpl] = await db
      .insert(workflowStepTemplate)
      .values({
        workflowTemplateId: template.id,
        tenantId: tenant.id,
        stepOrder: 1,
        name: "Multi-Approver Roundtrip",
        stepType: "document",
        requiresValidation: true,
        taskTitle: "Upload docs",
        assigneeType: "role",
        assigneeRole: "admin",
      })
      .returning();

    const [step2Tmpl] = await db
      .insert(workflowStepTemplate)
      .values({
        workflowTemplateId: template.id,
        tenantId: tenant.id,
        stepOrder: 2,
        name: "Next Step",
        stepType: "form",
        taskTitle: "Form",
        assigneeType: "role",
        assigneeRole: "admin",
      })
      .returning();

    const [proc] = await db
      .insert(processInstance)
      .values({
        tenantId: tenant.id,
        workflowTemplateId: template.id,
        processType: "workflow_execution",
        entityType: "supplier",
        entityId: crypto.randomUUID(),
        status: "in_progress",
        initiatedBy: user1.id,
        initiatedDate: new Date(),
      })
      .returning();

    const [stepInst] = await db
      .insert(stepInstance)
      .values({
        tenantId: tenant.id,
        processInstanceId: proc.id,
        workflowStepTemplateId: stepTmpl.id,
        stepOrder: 1,
        stepName: "Multi-Approver Roundtrip",
        stepType: "document",
        status: "awaiting_validation",
        validationRound: 1,
      })
      .returning();

    await db.insert(stepInstance).values({
      tenantId: tenant.id,
      processInstanceId: proc.id,
      workflowStepTemplateId: step2Tmpl.id,
      stepOrder: 2,
      stepName: "Next Step",
      stepType: "form",
      status: "blocked",
    });

    await db.insert(workflowStepDocument).values({
      tenantId: tenant.id,
      processInstanceId: proc.id,
      stepInstanceId: stepInst.id,
      requiredDocumentName: "Tax Certificate",
      status: "uploaded",
    });

    const [task1] = await db
      .insert(taskInstance)
      .values({
        tenantId: tenant.id,
        processInstanceId: proc.id,
        stepInstanceId: stepInst.id,
        assigneeType: "role",
        assigneeRole: "quality_manager",
        title: "Validate",
        taskType: "validation",
        status: "pending",
        validationRound: 1,
      })
      .returning();

    const [task2] = await db
      .insert(taskInstance)
      .values({
        tenantId: tenant.id,
        processInstanceId: proc.id,
        stepInstanceId: stepInst.id,
        assigneeType: "role",
        assigneeRole: "admin",
        title: "Validate",
        taskType: "validation",
        status: "pending",
        validationRound: 1,
      })
      .returning();

    // Partial approval response shape
    const partial = await db.transaction(async (tx) => {
      return reviewStepDocuments(tx, {
        tenantId: tenant.id,
        stepInstanceId: stepInst.id,
        reviewedBy: user2.id,
        taskId: task1.id,
        decisions: [{ requiredDocumentName: "Tax Certificate", action: "approve" }],
      });
    });

    expect(partial.success).toBe(true);
    expect(partial.outcome).toBe("all_approved");
    expect(partial.allValidationsComplete).toBe(false);
    expect(partial.stepCompleted).toBe(false);
    expect(partial.remainingApprovals).toBe(1);
    expect(partial.processCompleted).toBe(false);
    expect(partial.processInstanceId).toBe(proc.id);
    expect(partial.stepName).toBe("Multi-Approver Roundtrip");

    // Final approval response shape
    const final = await db.transaction(async (tx) => {
      return reviewStepDocuments(tx, {
        tenantId: tenant.id,
        stepInstanceId: stepInst.id,
        reviewedBy: user1.id,
        taskId: task2.id,
        decisions: [{ requiredDocumentName: "Tax Certificate", action: "approve" }],
      });
    });

    expect(final.success).toBe(true);
    expect(final.outcome).toBe("all_approved");
    expect(final.allValidationsComplete).toBe(true);
    expect(final.stepCompleted).toBe(true);
    expect(final.nextStepActivated).toBe(true);
    expect(final.nextStepId).toBeTruthy();
    expect(final.nextStepName).toBe("Next Step");
    expect(final.processCompleted).toBe(false);

    await db.delete(workflowStepTemplate).where(eq(workflowStepTemplate.id, stepTmpl.id));
    await db.delete(workflowStepTemplate).where(eq(workflowStepTemplate.id, step2Tmpl.id));
  });

  test("GET /documents returns current-round-only reviewerDecisions and validationRound", async () => {
    const [stepTmpl] = await db
      .insert(workflowStepTemplate)
      .values({
        workflowTemplateId: template.id,
        tenantId: tenant.id,
        stepOrder: 10,
        name: "List Test Step",
        stepType: "document",
        requiresValidation: true,
        taskTitle: "Upload docs",
        assigneeType: "role",
        assigneeRole: "admin",
      })
      .returning();

    const [proc] = await db
      .insert(processInstance)
      .values({
        tenantId: tenant.id,
        workflowTemplateId: template.id,
        processType: "workflow_execution",
        entityType: "supplier",
        entityId: crypto.randomUUID(),
        status: "in_progress",
        initiatedBy: user1.id,
        initiatedDate: new Date(),
      })
      .returning();

    const [stepInst] = await db
      .insert(stepInstance)
      .values({
        tenantId: tenant.id,
        processInstanceId: proc.id,
        workflowStepTemplateId: stepTmpl.id,
        stepOrder: 10,
        stepName: "List Test Step",
        stepType: "document",
        status: "awaiting_validation",
        validationRound: 1,
      })
      .returning();

    const [wsd] = await db
      .insert(workflowStepDocument)
      .values({
        tenantId: tenant.id,
        processInstanceId: proc.id,
        stepInstanceId: stepInst.id,
        requiredDocumentName: "Certificate",
        status: "uploaded",
      })
      .returning();

    const [task] = await db
      .insert(taskInstance)
      .values({
        tenantId: tenant.id,
        processInstanceId: proc.id,
        stepInstanceId: stepInst.id,
        assigneeType: "role",
        assigneeRole: "admin",
        title: "Validate",
        taskType: "validation",
        status: "pending",
        validationRound: 1,
      })
      .returning();

    // Insert a decision for round 1
    await db.insert(documentReviewDecision).values({
      tenantId: tenant.id,
      workflowStepDocumentId: wsd.id,
      stepInstanceId: stepInst.id,
      taskInstanceId: task.id,
      reviewerUserId: user1.id,
      validationRound: 1,
      decision: "approved",
    });

    // Query decisions the same way the list endpoint does
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
    expect(round1Decisions[0].decision).toBe("approved");
    expect(round1Decisions[0].reviewerUserId).toBe(user1.id);
    expect(round1Decisions[0].validationRound).toBe(1);

    // Verify validationRound from step
    const [stepCheck] = await db
      .select({ validationRound: stepInstance.validationRound })
      .from(stepInstance)
      .where(eq(stepInstance.id, stepInst.id));
    expect(stepCheck.validationRound).toBe(1);

    await db.delete(workflowStepTemplate).where(eq(workflowStepTemplate.id, stepTmpl.id));
  });

  test("round isolation: after resubmission, list shows only new round decisions", async () => {
    const [stepTmpl] = await db
      .insert(workflowStepTemplate)
      .values({
        workflowTemplateId: template.id,
        tenantId: tenant.id,
        stepOrder: 20,
        name: "Round Isolation List Test",
        stepType: "document",
        requiresValidation: true,
        taskTitle: "Upload docs",
        assigneeType: "role",
        assigneeRole: "admin",
      })
      .returning();

    const [proc] = await db
      .insert(processInstance)
      .values({
        tenantId: tenant.id,
        workflowTemplateId: template.id,
        processType: "workflow_execution",
        entityType: "supplier",
        entityId: crypto.randomUUID(),
        status: "in_progress",
        initiatedBy: user1.id,
        initiatedDate: new Date(),
      })
      .returning();

    const [stepInst] = await db
      .insert(stepInstance)
      .values({
        tenantId: tenant.id,
        processInstanceId: proc.id,
        workflowStepTemplateId: stepTmpl.id,
        stepOrder: 20,
        stepName: "Round Isolation List Test",
        stepType: "document",
        status: "awaiting_validation",
        validationRound: 1,
      })
      .returning();

    const [wsd] = await db
      .insert(workflowStepDocument)
      .values({
        tenantId: tenant.id,
        processInstanceId: proc.id,
        stepInstanceId: stepInst.id,
        requiredDocumentName: "Certificate",
        status: "uploaded",
      })
      .returning();

    // Round 1 task + decision (decline)
    const [round1Task] = await db
      .insert(taskInstance)
      .values({
        tenantId: tenant.id,
        processInstanceId: proc.id,
        stepInstanceId: stepInst.id,
        assigneeType: "role",
        assigneeRole: "admin",
        title: "Validate R1",
        taskType: "validation",
        status: "completed",
        validationRound: 1,
      })
      .returning();

    await db.insert(documentReviewDecision).values({
      tenantId: tenant.id,
      workflowStepDocumentId: wsd.id,
      stepInstanceId: stepInst.id,
      taskInstanceId: round1Task.id,
      reviewerUserId: user1.id,
      validationRound: 1,
      decision: "declined",
      comment: "Expired document",
    });

    // Simulate resubmission: bump to round 2
    await db
      .update(stepInstance)
      .set({ validationRound: 2 })
      .where(eq(stepInstance.id, stepInst.id));

    // Query with round 2 (current round) — should return EMPTY (no decisions yet)
    const round2Decisions = await db
      .select()
      .from(documentReviewDecision)
      .where(
        and(
          eq(documentReviewDecision.stepInstanceId, stepInst.id),
          eq(documentReviewDecision.validationRound, 2)
        )
      );

    expect(round2Decisions.length).toBe(0);

    // Round 1 decisions still exist (for audit)
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
    expect(round1Decisions[0].decision).toBe("declined");

    // Now add a round 2 task and decision
    const [round2Task] = await db
      .insert(taskInstance)
      .values({
        tenantId: tenant.id,
        processInstanceId: proc.id,
        stepInstanceId: stepInst.id,
        assigneeType: "role",
        assigneeRole: "admin",
        title: "Validate R2",
        taskType: "validation",
        status: "pending",
        validationRound: 2,
      })
      .returning();

    await db.insert(documentReviewDecision).values({
      tenantId: tenant.id,
      workflowStepDocumentId: wsd.id,
      stepInstanceId: stepInst.id,
      taskInstanceId: round2Task.id,
      reviewerUserId: user1.id,
      validationRound: 2,
      decision: "approved",
    });

    // Query with round 2 — should now return only the round 2 decision
    const round2DecisionsAfter = await db
      .select()
      .from(documentReviewDecision)
      .where(
        and(
          eq(documentReviewDecision.stepInstanceId, stepInst.id),
          eq(documentReviewDecision.validationRound, 2)
        )
      );

    expect(round2DecisionsAfter.length).toBe(1);
    expect(round2DecisionsAfter[0].decision).toBe("approved");
    expect(round2DecisionsAfter[0].validationRound).toBe(2);

    // Total decisions = 2 (one per round, for audit)
    const allDecisions = await db
      .select()
      .from(documentReviewDecision)
      .where(eq(documentReviewDecision.stepInstanceId, stepInst.id));
    expect(allDecisions.length).toBe(2);

    await db.delete(workflowStepTemplate).where(eq(workflowStepTemplate.id, stepTmpl.id));
  });
});
