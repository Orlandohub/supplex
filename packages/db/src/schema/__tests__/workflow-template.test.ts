import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { db } from "../../index";
import {
  tenants,
  users,
  workflowTemplate,
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

// REMOVED - Migration 0026: completionStatus field removed from workflow_step_template

