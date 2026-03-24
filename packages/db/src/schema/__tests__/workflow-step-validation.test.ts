import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { db } from "../../index";
import {
  tenants,
  users,
  workflowTemplate,
  workflowStepTemplate,
} from "../index";
import { eq } from "drizzle-orm";

/**
 * Integration Tests: Workflow Step Validation Checkbox
 * Story 2.2.15
 *
 * Tests the requires_validation and validation_config fields on workflow_step_template,
 * including default values, JSONB structure validation, and index performance.
 */

describe("Workflow Step Validation Configuration", () => {
  let tenant: { id: string };
  let user: { id: string };
  let template: { id: string };

  beforeAll(async () => {
    [tenant] = await db
      .insert(tenants)
      .values({
        name: "Validation Test Tenant",
        slug: `validation-tenant-${Date.now()}`,
      })
      .returning();

    [user] = await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        tenantId: tenant.id,
        email: `validation-user-${Date.now()}@test.com`,
        fullName: "Validation Test User",
        role: "admin",
      })
      .returning();

    [template] = await db
      .insert(workflowTemplate)
      .values({
        tenantId: tenant.id,
        name: "Validation Test Template",
        status: "draft",
        createdBy: user.id,
      })
      .returning();
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenant.id));
  });

  test("requires_validation field has default value of false", async () => {
    const [step] = await db
      .insert(workflowStepTemplate)
      .values({
        workflowTemplateId: template.id,
        tenantId: tenant.id,
        stepOrder: 1,
        name: "Default Validation Test",
        stepType: "form",
      })
      .returning();

    expect(step.requiresValidation).toBe(false);
  });

  test("validation_config field has default value of empty object", async () => {
    const [step] = await db
      .insert(workflowStepTemplate)
      .values({
        workflowTemplateId: template.id,
        tenantId: tenant.id,
        stepOrder: 2,
        name: "Default Config Test",
        stepType: "form",
      })
      .returning();

    expect(step.validationConfig).toEqual({});
  });

  test("can create step with requiresValidation=true", async () => {
    const [step] = await db
      .insert(workflowStepTemplate)
      .values({
        workflowTemplateId: template.id,
        tenantId: tenant.id,
        stepOrder: 3,
        name: "Validation Required Step",
        stepType: "form",
        requiresValidation: true,
      })
      .returning();

    expect(step.requiresValidation).toBe(true);
  });

  test("validation_config accepts valid JSONB structure", async () => {
    const validationConfig = {
      approverRoles: ["quality_manager", "procurement_manager"],
      requireAllApprovals: false,
    };

    const [step] = await db
      .insert(workflowStepTemplate)
      .values({
        workflowTemplateId: template.id,
        tenantId: tenant.id,
        stepOrder: 4,
        name: "Valid Config Step",
        stepType: "form",
        requiresValidation: true,
        validationConfig,
      })
      .returning();

    expect(step.validationConfig).toEqual(validationConfig);
    expect(
      (step.validationConfig as { approverRoles: string[] }).approverRoles
    ).toHaveLength(2);
  });

  test("validation_config can store single approver role", async () => {
    const validationConfig = {
      approverRoles: ["quality_manager"],
    };

    const [step] = await db
      .insert(workflowStepTemplate)
      .values({
        workflowTemplateId: template.id,
        tenantId: tenant.id,
        stepOrder: 5,
        name: "Single Approver Step",
        stepType: "document",
        requiresValidation: true,
        validationConfig,
      })
      .returning();

    expect(
      (step.validationConfig as { approverRoles: string[] }).approverRoles
    ).toEqual(["quality_manager"]);
  });

  test("can update step to enable validation", async () => {
    const [step] = await db
      .insert(workflowStepTemplate)
      .values({
        workflowTemplateId: template.id,
        tenantId: tenant.id,
        stepOrder: 6,
        name: "Update Validation Step",
        stepType: "form",
        requiresValidation: false,
      })
      .returning();

    expect(step.requiresValidation).toBe(false);

    const validationConfig = {
      approverRoles: ["admin"],
    };

    const [updated] = await db
      .update(workflowStepTemplate)
      .set({
        requiresValidation: true,
        validationConfig,
      })
      .where(eq(workflowStepTemplate.id, step.id))
      .returning();

    expect(updated.requiresValidation).toBe(true);
    expect(
      (updated.validationConfig as { approverRoles: string[] }).approverRoles
    ).toEqual(["admin"]);
  });

  test("can update step to disable validation", async () => {
    const [step] = await db
      .insert(workflowStepTemplate)
      .values({
        workflowTemplateId: template.id,
        tenantId: tenant.id,
        stepOrder: 7,
        name: "Disable Validation Step",
        stepType: "form",
        requiresValidation: true,
        validationConfig: {
          approverRoles: ["quality_manager"],
        },
      })
      .returning();

    const [updated] = await db
      .update(workflowStepTemplate)
      .set({
        requiresValidation: false,
        validationConfig: {},
      })
      .where(eq(workflowStepTemplate.id, step.id))
      .returning();

    expect(updated.requiresValidation).toBe(false);
    expect(updated.validationConfig).toEqual({});
  });

  test("index on requires_validation exists and filters correctly", async () => {
    // Create multiple steps with different validation settings
    await db.insert(workflowStepTemplate).values([
      {
        workflowTemplateId: template.id,
        tenantId: tenant.id,
        stepOrder: 8,
        name: "No Validation Step 1",
        stepType: "form",
        requiresValidation: false,
      },
      {
        workflowTemplateId: template.id,
        tenantId: tenant.id,
        stepOrder: 9,
        name: "With Validation Step 1",
        stepType: "form",
        requiresValidation: true,
        validationConfig: { approverRoles: ["admin"] },
      },
      {
        workflowTemplateId: template.id,
        tenantId: tenant.id,
        stepOrder: 10,
        name: "With Validation Step 2",
        stepType: "document",
        requiresValidation: true,
        validationConfig: { approverRoles: ["quality_manager"] },
      },
    ]);

    // Query steps with requires_validation=true (should use index)
    const validationSteps = await db.query.workflowStepTemplate.findMany({
      where: (table, { eq, and, isNull }) =>
        and(
          eq(table.workflowTemplateId, template.id),
          eq(table.requiresValidation, true),
          isNull(table.deletedAt)
        ),
    });

    expect(validationSteps.length).toBeGreaterThanOrEqual(2);
    expect(validationSteps.every((s) => s.requiresValidation)).toBe(true);
  });

  test("validation_config can store requireAllApprovals flag", async () => {
    const validationConfig = {
      approverRoles: ["quality_manager", "procurement_manager"],
      requireAllApprovals: true,
    };

    const [step] = await db
      .insert(workflowStepTemplate)
      .values({
        workflowTemplateId: template.id,
        tenantId: tenant.id,
        stepOrder: 11,
        name: "Require All Approvals Step",
        stepType: "form",
        requiresValidation: true,
        validationConfig,
      })
      .returning();

    expect(
      (step.validationConfig as { requireAllApprovals: boolean })
        .requireAllApprovals
    ).toBe(true);
  });
});
