import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { db } from "../../../../lib/db";
import {
  tenants,
  users,
  workflowTemplate,
  workflowStepTemplate,
} from "@supplex/db";
import { and, asc, eq, isNull } from "drizzle-orm";
import { insertOneOrThrow } from "../../../../lib/db-helpers";
import { compactWorkflowTemplateStepOrders } from "../compact-step-orders";

/**
 * Renumbering invariants the delete route relies on so that downstream
 * consumers (`instantiate-workflow.ts`, `transition-to-next-step.ts`,
 * `return-to-previous-step.ts`) keep working after a step is removed.
 */
describe("compactWorkflowTemplateStepOrders", () => {
  let tenantId: string;
  let userId: string;

  beforeAll(async () => {
    const tenant = await insertOneOrThrow(db, tenants, {
      name: "Compact Step Orders Tenant",
      slug: `compact-step-orders-${Date.now()}`,
    });
    tenantId = tenant.id;

    const user = await insertOneOrThrow(db, users, {
      id: crypto.randomUUID(),
      tenantId,
      email: `compact-step-orders-${Date.now()}@test.com`,
      fullName: "Test User",
      role: "admin",
    });
    userId = user.id;
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  async function readSteps(templateId: string) {
    return db
      .select({
        id: workflowStepTemplate.id,
        name: workflowStepTemplate.name,
        stepOrder: workflowStepTemplate.stepOrder,
      })
      .from(workflowStepTemplate)
      .where(
        and(
          eq(workflowStepTemplate.workflowTemplateId, templateId),
          isNull(workflowStepTemplate.deletedAt)
        )
      )
      .orderBy(asc(workflowStepTemplate.stepOrder));
  }

  test("renumbers surviving steps to a contiguous 1..n sequence after a gap", async () => {
    const template = await insertOneOrThrow(db, workflowTemplate, {
      tenantId,
      name: "Renumber Template",
      status: "draft",
      createdBy: userId,
    });

    await db.insert(workflowStepTemplate).values([
      {
        tenantId,
        workflowTemplateId: template.id,
        stepOrder: 1,
        name: "Step 1",
        stepType: "form",
        deletedAt: new Date(),
      },
      {
        tenantId,
        workflowTemplateId: template.id,
        stepOrder: 2,
        name: "Step 2",
        stepType: "form",
      },
      {
        tenantId,
        workflowTemplateId: template.id,
        stepOrder: 3,
        name: "Step 3",
        stepType: "approval",
      },
    ]);

    await db.transaction(async (tx) => {
      await compactWorkflowTemplateStepOrders(tx, template.id, tenantId);
    });

    const steps = await readSteps(template.id);
    expect(steps.map((s) => s.stepOrder)).toEqual([1, 2]);
    expect(steps.map((s) => s.name)).toEqual(["Step 2", "Step 3"]);
  });

  test("is idempotent when step orders are already contiguous", async () => {
    const template = await insertOneOrThrow(db, workflowTemplate, {
      tenantId,
      name: "Already Contiguous Template",
      status: "draft",
      createdBy: userId,
    });

    await db.insert(workflowStepTemplate).values([
      {
        tenantId,
        workflowTemplateId: template.id,
        stepOrder: 1,
        name: "Step 1",
        stepType: "form",
      },
      {
        tenantId,
        workflowTemplateId: template.id,
        stepOrder: 2,
        name: "Step 2",
        stepType: "approval",
      },
    ]);

    await db.transaction(async (tx) => {
      await compactWorkflowTemplateStepOrders(tx, template.id, tenantId);
    });

    const steps = await readSteps(template.id);
    expect(steps.map((s) => s.stepOrder)).toEqual([1, 2]);
    expect(steps.map((s) => s.name)).toEqual(["Step 1", "Step 2"]);
  });

  test("scopes renumbering to the requested template and tenant", async () => {
    const otherTenant = await insertOneOrThrow(db, tenants, {
      name: "Other Tenant",
      slug: `compact-other-tenant-${Date.now()}`,
    });

    const target = await insertOneOrThrow(db, workflowTemplate, {
      tenantId,
      name: "Target Template",
      status: "draft",
      createdBy: userId,
    });

    const sibling = await insertOneOrThrow(db, workflowTemplate, {
      tenantId,
      name: "Sibling Template",
      status: "draft",
      createdBy: userId,
    });

    const otherTenantUser = await insertOneOrThrow(db, users, {
      id: crypto.randomUUID(),
      tenantId: otherTenant.id,
      email: `compact-other-${Date.now()}@test.com`,
      fullName: "Other Tenant User",
      role: "admin",
    });

    const otherTenantTemplate = await insertOneOrThrow(db, workflowTemplate, {
      tenantId: otherTenant.id,
      name: "Other Tenant Template",
      status: "draft",
      createdBy: otherTenantUser.id,
    });

    await db.insert(workflowStepTemplate).values([
      {
        tenantId,
        workflowTemplateId: target.id,
        stepOrder: 5,
        name: "Target Survivor",
        stepType: "form",
      },
      {
        tenantId,
        workflowTemplateId: sibling.id,
        stepOrder: 9,
        name: "Sibling Untouched",
        stepType: "form",
      },
      {
        tenantId: otherTenant.id,
        workflowTemplateId: otherTenantTemplate.id,
        stepOrder: 9,
        name: "Other Tenant Untouched",
        stepType: "form",
      },
    ]);

    await db.transaction(async (tx) => {
      await compactWorkflowTemplateStepOrders(tx, target.id, tenantId);
    });

    const targetSteps = await readSteps(target.id);
    expect(targetSteps.map((s) => s.stepOrder)).toEqual([1]);

    const siblingSteps = await readSteps(sibling.id);
    expect(siblingSteps.map((s) => s.stepOrder)).toEqual([9]);

    const otherTenantSteps = await readSteps(otherTenantTemplate.id);
    expect(otherTenantSteps.map((s) => s.stepOrder)).toEqual([9]);

    await db.delete(tenants).where(eq(tenants.id, otherTenant.id));
  });
});
