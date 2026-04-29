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
  workflowStepDocument,
  documentTemplate,
} from "@supplex/db";
import { eq } from "drizzle-orm";
import { completeStep } from "../complete-step";

import { insertOneOrThrow, selectFirstOrThrow } from "../../db-helpers";
/**
 * Integration Tests: completeStep Transaction Rollback
 * Verifies that document-check failures inside the transaction
 * cause a full rollback (step status does NOT remain as "completed").
 */

describe("completeStep transaction rollback", () => {
  let tenant: { id: string };
  let user: { id: string };
  let template: { id: string };

  beforeAll(async () => {
    tenant = await insertOneOrThrow(db, tenants, {
      name: "Rollback Test Tenant",
      slug: `rollback-tenant-${Date.now()}`,
    });

    user = await insertOneOrThrow(db, users, {
      id: crypto.randomUUID(),
      tenantId: tenant.id,
      email: `rollback-user-${Date.now()}@test.com`,
      fullName: "Rollback Test User",
      role: "admin",
    });

    template = await insertOneOrThrow(db, workflowTemplate, {
      tenantId: tenant.id,
      name: "Rollback Test Template",
      status: "published",
      createdBy: user.id,
    });
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenant.id));
  });

  test("document check failure rolls back step status to active (not completed)", async () => {
    // Create a document template with a required document.
    //
    // Historic note: the previous revision of this test cast the entire
    // insert builder to `any` to bypass type errors caused by stale field
    // names (`name` / `createdBy`) that don't exist on the
    // `document_template` schema. The actual columns are `templateName`
    // and have no `createdBy`. Using the real schema fields removes the
    // need for the cast and exercises a realistic insert path.
    const docTmpl = await insertOneOrThrow(db, documentTemplate, {
      tenantId: tenant.id,
      templateName: "Rollback Doc Template",
      requiredDocuments: [{ name: "Required Doc", required: true }],
    });

    const stepTmpl = await insertOneOrThrow(db, workflowStepTemplate, {
      workflowTemplateId: template.id,
      tenantId: tenant.id,
      stepOrder: 1,
      name: "Document Step",
      stepType: "document",
      taskTitle: "Upload docs",
      assigneeType: "role",
      assigneeRole: "admin",
      documentTemplateId: docTmpl.id,
    });

    const proc = await insertOneOrThrow(db, processInstance, {
      tenantId: tenant.id,
      workflowTemplateId: template.id,
      processType: "workflow_execution",
      entityType: "supplier",
      entityId: crypto.randomUUID(),
      status: "in_progress",
      initiatedBy: user.id,
      initiatedDate: new Date(),
    });

    const stepInst = await insertOneOrThrow(db, stepInstance, {
      tenantId: tenant.id,
      processInstanceId: proc.id,
      workflowStepTemplateId: stepTmpl.id,
      stepOrder: 1,
      stepName: "Document Step",
      stepType: "document",
      status: "active",
    });

    // Insert a required document in "pending" status (NOT uploaded)
    await db.insert(workflowStepDocument).values({
      tenantId: tenant.id,
      processInstanceId: proc.id,
      stepInstanceId: stepInst.id,
      requiredDocumentName: "Required Doc",
      status: "pending",
    });

    // Try to complete the step — should fail because doc is not uploaded
    const result = await db.transaction(async (tx) => {
      return completeStep(tx, {
        tenantId: tenant.id,
        stepInstanceId: stepInst.id,
        completedBy: user.id,
        outcome: "completed",
      });
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("required document");

    // Verify the step is still "active" (transaction rolled back)
    const stepAfter = await selectFirstOrThrow(
      db.select().from(stepInstance).where(eq(stepInstance.id, stepInst.id))
    );
    expect(stepAfter.status).toBe("active");

    await db
      .delete(workflowStepTemplate)
      .where(eq(workflowStepTemplate.id, stepTmpl.id));
    await db
      .delete(documentTemplate)
      .where(eq(documentTemplate.id, docTmpl.id));
  });
});
