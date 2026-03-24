import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { db } from "../../index";
import {
  tenants,
  users,
  workflowTemplate,
  workflowTemplateVersion,
  workflowStepTemplate,
} from "../index";
import { eq, and, isNull } from "drizzle-orm";

/**
 * Integration Tests: Workflow Template Active Field and Completion Status
 * Story 2.2.9
 *
 * Tests the new active field on workflow_template and completion_status field
 * on workflow_step_template, including default values, nullable constraints,
 * and index performance.
 */

describe("Workflow Template Active Field", () => {
  let tenant: { id: string };
  let user: { id: string };

  beforeAll(async () => {
    [tenant] = await db
      .insert(tenants)
      .values({
        name: "Active Field Test Tenant",
        slug: `active-field-tenant-${Date.now()}`,
      })
      .returning();

    [user] = await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        tenantId: tenant.id,
        email: `active-field-user-${Date.now()}@test.com`,
        fullName: "Active Field User",
        role: "admin",
      })
      .returning();
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenant.id));
  });

  test("active field has default value of true", async () => {
    // Create workflow template without specifying active field
    const [template] = await db
      .insert(workflowTemplate)
      .values({
        tenantId: tenant.id,
        name: "Default Active Test",
        status: "draft",
        createdBy: user.id,
      })
      .returning();

    // Verify default value is true
    expect(template.active).toBe(true);
  });

  test("can create workflow template with active=false", async () => {
    // Create workflow template with active=false
    const [template] = await db
      .insert(workflowTemplate)
      .values({
        tenantId: tenant.id,
        name: "Inactive Template",
        status: "draft",
        active: false,
        createdBy: user.id,
      })
      .returning();

    // Verify active is false
    expect(template.active).toBe(false);
  });

  test("can toggle active field", async () => {
    // Create workflow template with active=true
    const [template] = await db
      .insert(workflowTemplate)
      .values({
        tenantId: tenant.id,
        name: "Toggle Active Test",
        status: "published",
        active: true,
        createdBy: user.id,
      })
      .returning();

    expect(template.active).toBe(true);

    // Toggle to false
    const [updated1] = await db
      .update(workflowTemplate)
      .set({ active: false })
      .where(eq(workflowTemplate.id, template.id))
      .returning();

    expect(updated1.active).toBe(false);

    // Toggle back to true
    const [updated2] = await db
      .update(workflowTemplate)
      .set({ active: true })
      .where(eq(workflowTemplate.id, template.id))
      .returning();

    expect(updated2.active).toBe(true);
  });

  test("filter workflow templates by active status", async () => {
    // Create multiple templates with different active states
    const [activeTemplate] = await db
      .insert(workflowTemplate)
      .values({
        tenantId: tenant.id,
        name: "Active Template for Filter",
        status: "published",
        active: true,
        createdBy: user.id,
      })
      .returning();

    const [inactiveTemplate] = await db
      .insert(workflowTemplate)
      .values({
        tenantId: tenant.id,
        name: "Inactive Template for Filter",
        status: "published",
        active: false,
        createdBy: user.id,
      })
      .returning();

    // Query only active templates
    const activeTemplates = await db
      .select()
      .from(workflowTemplate)
      .where(
        and(
          eq(workflowTemplate.tenantId, tenant.id),
          eq(workflowTemplate.active, true),
          isNull(workflowTemplate.deletedAt)
        )
      );

    // Query only inactive templates
    const inactiveTemplates = await db
      .select()
      .from(workflowTemplate)
      .where(
        and(
          eq(workflowTemplate.tenantId, tenant.id),
          eq(workflowTemplate.active, false),
          isNull(workflowTemplate.deletedAt)
        )
      );

    // Verify filtering works correctly
    expect(activeTemplates.some((t) => t.id === activeTemplate.id)).toBe(true);
    expect(
      activeTemplates.some((t) => t.id === inactiveTemplate.id)
    ).toBe(false);
    expect(
      inactiveTemplates.some((t) => t.id === inactiveTemplate.id)
    ).toBe(true);
    expect(
      inactiveTemplates.some((t) => t.id === activeTemplate.id)
    ).toBe(false);
  });

  test("composite index filters by tenant_id, status, and active", async () => {
    // Create templates with different combinations
    await db.insert(workflowTemplate).values([
      {
        tenantId: tenant.id,
        name: "Published Active",
        status: "published",
        active: true,
        createdBy: user.id,
      },
      {
        tenantId: tenant.id,
        name: "Published Inactive",
        status: "published",
        active: false,
        createdBy: user.id,
      },
      {
        tenantId: tenant.id,
        name: "Draft Active",
        status: "draft",
        active: true,
        createdBy: user.id,
      },
      {
        tenantId: tenant.id,
        name: "Draft Inactive",
        status: "draft",
        active: false,
        createdBy: user.id,
      },
    ]);

    // Query published AND active templates (typical dropdown query)
    const publishedActiveTemplates = await db
      .select()
      .from(workflowTemplate)
      .where(
        and(
          eq(workflowTemplate.tenantId, tenant.id),
          eq(workflowTemplate.status, "published"),
          eq(workflowTemplate.active, true),
          isNull(workflowTemplate.deletedAt)
        )
      );

    // Verify only published AND active templates are returned
    publishedActiveTemplates.forEach((template) => {
      expect(template.status).toBe("published");
      expect(template.active).toBe(true);
    });
  });
});

describe("Workflow Step Template Completion Status Field", () => {
  let tenant: { id: string };
  let user: { id: string };
  let template: { id: string };
  let version: { id: string };

  beforeAll(async () => {
    [tenant] = await db
      .insert(tenants)
      .values({
        name: "Completion Status Test Tenant",
        slug: `completion-status-tenant-${Date.now()}`,
      })
      .returning();

    [user] = await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        tenantId: tenant.id,
        email: `completion-status-user-${Date.now()}@test.com`,
        fullName: "Completion Status User",
        role: "admin",
      })
      .returning();

    [template] = await db
      .insert(workflowTemplate)
      .values({
        tenantId: tenant.id,
        name: "Completion Status Test Workflow",
        status: "draft",
        createdBy: user.id,
      })
      .returning();

    [version] = await db
      .insert(workflowTemplateVersion)
      .values({
        workflowTemplateId: template.id,
        tenantId: tenant.id,
        version: 1,
        status: "draft",
        isPublished: false,
      })
      .returning();
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenant.id));
  });

  test("completion_status field is nullable (default is NULL)", async () => {
    // Create workflow step without specifying completion_status
    const [step] = await db
      .insert(workflowStepTemplate)
      .values({
        workflowTemplateVersionId: version.id,
        tenantId: tenant.id,
        stepOrder: 1,
        name: "Step Without Completion Status",
        stepType: "task",
        multiApprover: false,
        declineReturnsToStepOffset: 1,
      })
      .returning();

    // Verify completion_status is null
    expect(step.completionStatus).toBeNull();
  });

  test("can create workflow step with completion_status", async () => {
    // Create workflow step with completion_status
    const [step] = await db
      .insert(workflowStepTemplate)
      .values({
        workflowTemplateVersionId: version.id,
        tenantId: tenant.id,
        stepOrder: 2,
        name: "Step With Completion Status",
        stepType: "task",
        completionStatus: "Documents Submitted",
        multiApprover: false,
        declineReturnsToStepOffset: 1,
      })
      .returning();

    // Verify completion_status is set
    expect(step.completionStatus).toBe("Documents Submitted");
  });

  test("completion_status VARCHAR(100) length enforcement", async () => {
    // Create step with exactly 100 characters
    const status100 = "A".repeat(100);
    const [step100] = await db
      .insert(workflowStepTemplate)
      .values({
        workflowTemplateVersionId: version.id,
        tenantId: tenant.id,
        stepOrder: 3,
        name: "100 Char Status",
        stepType: "task",
        completionStatus: status100,
        multiApprover: false,
        declineReturnsToStepOffset: 1,
      })
      .returning();

    expect(step100.completionStatus).toBe(status100);
    expect(step100.completionStatus?.length).toBe(100);

    // Attempt to create step with more than 100 characters (should fail)
    const status101 = "A".repeat(101);
    await expect(
      db
        .insert(workflowStepTemplate)
        .values({
          workflowTemplateVersionId: version.id,
          tenantId: tenant.id,
          stepOrder: 4,
          name: "101 Char Status",
          stepType: "task",
          completionStatus: status101,
          multiApprover: false,
          declineReturnsToStepOffset: 1,
        })
        .returning()
    ).rejects.toThrow();
  });

  test("can update completion_status from NULL to value", async () => {
    // Create step without completion_status
    const [step] = await db
      .insert(workflowStepTemplate)
      .values({
        workflowTemplateVersionId: version.id,
        tenantId: tenant.id,
        stepOrder: 5,
        name: "Update Completion Status",
        stepType: "approval",
        multiApprover: false,
        declineReturnsToStepOffset: 1,
      })
      .returning();

    expect(step.completionStatus).toBeNull();

    // Update to add completion_status
    const [updated] = await db
      .update(workflowStepTemplate)
      .set({ completionStatus: "Under Review" })
      .where(eq(workflowStepTemplate.id, step.id))
      .returning();

    expect(updated.completionStatus).toBe("Under Review");
  });

  test("can update completion_status from value to NULL", async () => {
    // Create step with completion_status
    const [step] = await db
      .insert(workflowStepTemplate)
      .values({
        workflowTemplateVersionId: version.id,
        tenantId: tenant.id,
        stepOrder: 6,
        name: "Clear Completion Status",
        stepType: "task",
        completionStatus: "Approved",
        multiApprover: false,
        declineReturnsToStepOffset: 1,
      })
      .returning();

    expect(step.completionStatus).toBe("Approved");

    // Update to clear completion_status
    const [updated] = await db
      .update(workflowStepTemplate)
      .set({ completionStatus: null })
      .where(eq(workflowStepTemplate.id, step.id))
      .returning();

    expect(updated.completionStatus).toBeNull();
  });

  test("multiple steps with different completion_status values", async () => {
    // Create workflow with multiple steps, each with different completion_status
    const steps = await db
      .insert(workflowStepTemplate)
      .values([
        {
          workflowTemplateVersionId: version.id,
          tenantId: tenant.id,
          stepOrder: 10,
          name: "Submit Documents",
          stepType: "document",
          completionStatus: "Documents Submitted",
          multiApprover: false,
          declineReturnsToStepOffset: 1,
        },
        {
          workflowTemplateVersionId: version.id,
          tenantId: tenant.id,
          stepOrder: 11,
          name: "Initial Review",
          stepType: "approval",
          completionStatus: "Under Initial Review",
          multiApprover: false,
          declineReturnsToStepOffset: 1,
        },
        {
          workflowTemplateVersionId: version.id,
          tenantId: tenant.id,
          stepOrder: 12,
          name: "Quality Audit",
          stepType: "task",
          completionStatus: "Audit in Progress",
          multiApprover: false,
          declineReturnsToStepOffset: 1,
        },
        {
          workflowTemplateVersionId: version.id,
          tenantId: tenant.id,
          stepOrder: 13,
          name: "Final Approval",
          stepType: "approval",
          completionStatus: "Qualified",
          multiApprover: false,
          declineReturnsToStepOffset: 1,
        },
        {
          workflowTemplateVersionId: version.id,
          tenantId: tenant.id,
          stepOrder: 14,
          name: "Send Notification",
          stepType: "task",
          completionStatus: null, // No status change for this step
          multiApprover: false,
          declineReturnsToStepOffset: 1,
        },
      ])
      .returning();

    // Verify each step has the correct completion_status
    expect(steps[0].completionStatus).toBe("Documents Submitted");
    expect(steps[1].completionStatus).toBe("Under Initial Review");
    expect(steps[2].completionStatus).toBe("Audit in Progress");
    expect(steps[3].completionStatus).toBe("Qualified");
    expect(steps[4].completionStatus).toBeNull();
  });
});

