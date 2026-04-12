import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { db } from "../../index";
import {
  tenants,
  users,
  workflowTemplate,
  workflowTemplateVersion,
  workflowStepTemplate,
  formTemplate,
  formTemplateVersion,
  FormTemplateStatus,
} from "../index";
import { eq, and, isNull } from "drizzle-orm";

/**
 * Integration Tests: Workflow Template Tenant Isolation
 * Story 2.2.6
 *
 * Tests tenant isolation, CASCADE deletes, versioning constraints,
 * multi-approver configuration, and index performance for workflow template tables.
 */

describe("Workflow Template Tenant Isolation", () => {
  let tenantA: { id: string };
  let tenantB: { id: string };
  let userA: { id: string };
  let userB: { id: string };

  beforeAll(async () => {
    // Create two test tenants
    const [insertedTenantA] = await db
      .insert(tenants)
      .values({
        name: "Test Tenant A",
        slug: `test-tenant-a-wf-${Date.now()}`,
      })
      .returning();

    const [insertedTenantB] = await db
      .insert(tenants)
      .values({
        name: "Test Tenant B",
        slug: `test-tenant-b-wf-${Date.now()}`,
      })
      .returning();

    tenantA = insertedTenantA;
    tenantB = insertedTenantB;

    // Create test users for each tenant
    [userA] = await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        tenantId: tenantA.id,
        email: `user-a-wf-${Date.now()}@test.com`,
        fullName: "User A",
        role: "admin",
      })
      .returning();

    [userB] = await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        tenantId: tenantB.id,
        email: `user-b-wf-${Date.now()}@test.com`,
        fullName: "User B",
        role: "admin",
      })
      .returning();
  });

  afterAll(async () => {
    // Clean up test tenants (CASCADE will clean up all related data including users)
    await db.delete(tenants).where(eq(tenants.id, tenantA.id));
    await db.delete(tenants).where(eq(tenants.id, tenantB.id));
  });

  test("tenant isolation - workflow templates from tenant A not visible to tenant B", async () => {
    // Create workflow template for tenant A
    const [templateA] = await db
      .insert(workflowTemplate)
      .values({
        tenantId: tenantA.id,
        name: "Tenant A Workflow",
        status: "draft",
        createdBy: userA.id,
      })
      .returning();

    // Create workflow template for tenant B
    const [templateB] = await db
      .insert(workflowTemplate)
      .values({
        tenantId: tenantB.id,
        name: "Tenant B Workflow",
        status: "draft",
        createdBy: userB.id,
      })
      .returning();

    // Query tenant A's templates
    const tenantATemplates = await db
      .select()
      .from(workflowTemplate)
      .where(
        and(
          eq(workflowTemplate.tenantId, tenantA.id),
          isNull(workflowTemplate.deletedAt)
        )
      );

    // Query tenant B's templates
    const tenantBTemplates = await db
      .select()
      .from(workflowTemplate)
      .where(
        and(
          eq(workflowTemplate.tenantId, tenantB.id),
          isNull(workflowTemplate.deletedAt)
        )
      );

    // Verify tenant A only sees their template
    expect(tenantATemplates).toHaveLength(1);
    expect(tenantATemplates[0].id).toBe(templateA.id);
    expect(tenantATemplates[0].name).toBe("Tenant A Workflow");

    // Verify tenant B only sees their template
    expect(tenantBTemplates).toHaveLength(1);
    expect(tenantBTemplates[0].id).toBe(templateB.id);
    expect(tenantBTemplates[0].name).toBe("Tenant B Workflow");
  });

  test("cascade delete - deleting tenant removes all workflow templates and related records", async () => {
    // Create a temporary tenant for this test
    const [tempTenant] = await db
      .insert(tenants)
      .values({
        name: "Temp Tenant",
        slug: `temp-tenant-wf-${Date.now()}`,
      })
      .returning();

    const [tempUser] = await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        tenantId: tempTenant.id,
        email: `temp-user-wf-${Date.now()}@test.com`,
        fullName: "Temp User",
        role: "admin",
      })
      .returning();

    // Create workflow template
    const [template] = await db
      .insert(workflowTemplate)
      .values({
        tenantId: tempTenant.id,
        name: "Temp Workflow",
        status: "draft",
        createdBy: tempUser.id,
      })
      .returning();

    // Create version
    const [version] = await db
      .insert(workflowTemplateVersion)
      .values({
        workflowTemplateId: template.id,
        tenantId: tempTenant.id,
        version: 1,
        status: "draft",
        isPublished: false,
      })
      .returning();

    // Create step
    await db
      .insert(workflowStepTemplate)
      .values({
        workflowTemplateVersionId: version.id,
        tenantId: tempTenant.id,
        stepOrder: 1,
        name: "Step 1",
        stepType: "task",

        declineReturnsToStepOffset: 1,
      })
      .returning();

    // Verify records exist
    const templatesBefore = await db
      .select()
      .from(workflowTemplate)
      .where(eq(workflowTemplate.tenantId, tempTenant.id));
    expect(templatesBefore).toHaveLength(1);

    // Delete tenant (CASCADE should delete all related records)
    await db.delete(tenants).where(eq(tenants.id, tempTenant.id));

    // Verify all related records are deleted
    const templatesAfter = await db
      .select()
      .from(workflowTemplate)
      .where(eq(workflowTemplate.tenantId, tempTenant.id));
    expect(templatesAfter).toHaveLength(0);

    const versionsAfter = await db
      .select()
      .from(workflowTemplateVersion)
      .where(eq(workflowTemplateVersion.tenantId, tempTenant.id));
    expect(versionsAfter).toHaveLength(0);

    const stepsAfter = await db
      .select()
      .from(workflowStepTemplate)
      .where(eq(workflowStepTemplate.tenantId, tempTenant.id));
    expect(stepsAfter).toHaveLength(0);
  });
});

describe("Workflow Template Versioning", () => {
  let tenant: { id: string };
  let user: { id: string };

  beforeAll(async () => {
    [tenant] = await db
      .insert(tenants)
      .values({
        name: "Versioning Test Tenant",
        slug: `versioning-tenant-${Date.now()}`,
      })
      .returning();

    [user] = await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        tenantId: tenant.id,
        email: `versioning-user-${Date.now()}@test.com`,
        fullName: "Versioning User",
        role: "admin",
      })
      .returning();
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenant.id));
  });

  test("version numbers are sequential", async () => {
    // Create template
    const [template] = await db
      .insert(workflowTemplate)
      .values({
        tenantId: tenant.id,
        name: "Sequential Version Test",
        status: "draft",
        createdBy: user.id,
      })
      .returning();

    // Create versions 1, 2, 3
    const [version1] = await db
      .insert(workflowTemplateVersion)
      .values({
        workflowTemplateId: template.id,
        tenantId: tenant.id,
        version: 1,
        status: "draft",
        isPublished: false,
      })
      .returning();

    const [version2] = await db
      .insert(workflowTemplateVersion)
      .values({
        workflowTemplateId: template.id,
        tenantId: tenant.id,
        version: 2,
        status: "draft",
        isPublished: false,
      })
      .returning();

    const [version3] = await db
      .insert(workflowTemplateVersion)
      .values({
        workflowTemplateId: template.id,
        tenantId: tenant.id,
        version: 3,
        status: "draft",
        isPublished: false,
      })
      .returning();

    // Verify versions are sequential
    expect(version1.version).toBe(1);
    expect(version2.version).toBe(2);
    expect(version3.version).toBe(3);

    // Verify all versions are associated with the same template
    const versions = await db
      .select()
      .from(workflowTemplateVersion)
      .where(
        and(
          eq(workflowTemplateVersion.workflowTemplateId, template.id),
          isNull(workflowTemplateVersion.deletedAt)
        )
      )
      .orderBy(workflowTemplateVersion.version);

    expect(versions).toHaveLength(3);
    expect(versions[0].version).toBe(1);
    expect(versions[1].version).toBe(2);
    expect(versions[2].version).toBe(3);
  });

  test("unique constraint on (workflow_template_id, version)", async () => {
    // Create template
    const [template] = await db
      .insert(workflowTemplate)
      .values({
        tenantId: tenant.id,
        name: "Unique Version Test",
        status: "draft",
        createdBy: user.id,
      })
      .returning();

    // Create version 1
    await db
      .insert(workflowTemplateVersion)
      .values({
        workflowTemplateId: template.id,
        tenantId: tenant.id,
        version: 1,
        status: "draft",
        isPublished: false,
      })
      .returning();

    // Attempt to create duplicate version 1 (should fail)
    await expect(
      db
        .insert(workflowTemplateVersion)
        .values({
          workflowTemplateId: template.id,
          tenantId: tenant.id,
          version: 1,
          status: "draft",
          isPublished: false,
        })
        .returning()
    ).rejects.toThrow();
  });

  test("is_published flag consistency with status", async () => {
    // Create template
    const [template] = await db
      .insert(workflowTemplate)
      .values({
        tenantId: tenant.id,
        name: "Published Status Test",
        status: "draft",
        createdBy: user.id,
      })
      .returning();

    // Create draft version with is_published = false (should succeed)
    const [draftVersion] = await db
      .insert(workflowTemplateVersion)
      .values({
        workflowTemplateId: template.id,
        tenantId: tenant.id,
        version: 1,
        status: "draft",
        isPublished: false,
      })
      .returning();

    expect(draftVersion.isPublished).toBe(false);
    expect(draftVersion.status).toBe("draft");

    // Create published version with is_published = true (should succeed)
    const [publishedVersion] = await db
      .insert(workflowTemplateVersion)
      .values({
        workflowTemplateId: template.id,
        tenantId: tenant.id,
        version: 2,
        status: "published",
        isPublished: true,
      })
      .returning();

    expect(publishedVersion.isPublished).toBe(true);
    expect(publishedVersion.status).toBe("published");

    // Attempt to create version with is_published = true but status = 'draft' (should fail due to CHECK constraint)
    await expect(
      db
        .insert(workflowTemplateVersion)
        .values({
          workflowTemplateId: template.id,
          tenantId: tenant.id,
          version: 3,
          status: "draft",
          isPublished: true,
        })
        .returning()
    ).rejects.toThrow();
  });

  test("cascade delete - deleting template removes all versions", async () => {
    // Create template
    const [template] = await db
      .insert(workflowTemplate)
      .values({
        tenantId: tenant.id,
        name: "Cascade Version Test",
        status: "draft",
        createdBy: user.id,
      })
      .returning();

    // Create multiple versions
    await db.insert(workflowTemplateVersion).values([
      {
        workflowTemplateId: template.id,
        tenantId: tenant.id,
        version: 1,
        status: "draft",
        isPublished: false,
      },
      {
        workflowTemplateId: template.id,
        tenantId: tenant.id,
        version: 2,
        status: "draft",
        isPublished: false,
      },
    ]);

    // Verify versions exist
    const versionsBefore = await db
      .select()
      .from(workflowTemplateVersion)
      .where(eq(workflowTemplateVersion.workflowTemplateId, template.id));
    expect(versionsBefore).toHaveLength(2);

    // Delete template (CASCADE should delete all versions)
    await db.delete(workflowTemplate).where(eq(workflowTemplate.id, template.id));

    // Verify versions are deleted
    const versionsAfter = await db
      .select()
      .from(workflowTemplateVersion)
      .where(eq(workflowTemplateVersion.workflowTemplateId, template.id));
    expect(versionsAfter).toHaveLength(0);
  });
});

describe("Workflow Step Template Configuration", () => {
  let tenant: { id: string };
  let user: { id: string };
  let template: { id: string };
  let version: { id: string };
  let formVersion: { id: string };

  beforeAll(async () => {
    [tenant] = await db
      .insert(tenants)
      .values({
        name: "Step Config Test Tenant",
        slug: `step-config-tenant-${Date.now()}`,
      })
      .returning();

    [user] = await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        tenantId: tenant.id,
        email: `step-config-user-${Date.now()}@test.com`,
        fullName: "Step Config User",
        role: "admin",
      })
      .returning();

    [template] = await db
      .insert(workflowTemplate)
      .values({
        tenantId: tenant.id,
        name: "Step Config Test Workflow",
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

    // Create form template and version for form integration tests
    const [formTemp] = await db
      .insert(formTemplate)
      .values({
        tenantId: tenant.id,
        name: "Test Form",
        status: FormTemplateStatus.PUBLISHED,
      })
      .returning();

    [formVersion] = await db
      .insert(formTemplateVersion)
      .values({
        formTemplateId: formTemp.id,
        tenantId: tenant.id,
        version: 1,
        status: FormTemplateStatus.PUBLISHED,
        isPublished: true,
      })
      .returning();
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenant.id));
  });

  test("steps ordered by step_order", async () => {
    // Create steps in random order
    await db.insert(workflowStepTemplate).values([
      {
        workflowTemplateVersionId: version.id,
        tenantId: tenant.id,
        stepOrder: 3,
        name: "Step 3",
        stepType: "task",

        declineReturnsToStepOffset: 1,
      },
      {
        workflowTemplateVersionId: version.id,
        tenantId: tenant.id,
        stepOrder: 1,
        name: "Step 1",
        stepType: "form",

        declineReturnsToStepOffset: 1,
      },
      {
        workflowTemplateVersionId: version.id,
        tenantId: tenant.id,
        stepOrder: 2,
        name: "Step 2",
        stepType: "approval",

        declineReturnsToStepOffset: 1,
      },
    ]);

    // Query steps ordered by step_order
    const steps = await db
      .select()
      .from(workflowStepTemplate)
      .where(
        and(
          eq(workflowStepTemplate.workflowTemplateVersionId, version.id),
          isNull(workflowStepTemplate.deletedAt)
        )
      )
      .orderBy(workflowStepTemplate.stepOrder);

    // Verify steps are ordered correctly
    expect(steps).toHaveLength(3);
    expect(steps[0].stepOrder).toBe(1);
    expect(steps[0].name).toBe("Step 1");
    expect(steps[1].stepOrder).toBe(2);
    expect(steps[1].name).toBe("Step 2");
    expect(steps[2].stepOrder).toBe(3);
    expect(steps[2].name).toBe("Step 3");
  });

  test("cascade delete - deleting version removes all steps", async () => {
    // Create new version for this test
    const [testVersion] = await db
      .insert(workflowTemplateVersion)
      .values({
        workflowTemplateId: template.id,
        tenantId: tenant.id,
        version: 99,
        status: "draft",
        isPublished: false,
      })
      .returning();

    // Create steps
    await db.insert(workflowStepTemplate).values([
      {
        workflowTemplateVersionId: testVersion.id,
        tenantId: tenant.id,
        stepOrder: 1,
        name: "Test Step 1",
        stepType: "task",

        declineReturnsToStepOffset: 1,
      },
      {
        workflowTemplateVersionId: testVersion.id,
        tenantId: tenant.id,
        stepOrder: 2,
        name: "Test Step 2",
        stepType: "task",

        declineReturnsToStepOffset: 1,
      },
    ]);

    // Verify steps exist
    const stepsBefore = await db
      .select()
      .from(workflowStepTemplate)
      .where(eq(workflowStepTemplate.workflowTemplateVersionId, testVersion.id));
    expect(stepsBefore).toHaveLength(2);

    // Delete version (CASCADE should delete all steps)
    await db
      .delete(workflowTemplateVersion)
      .where(eq(workflowTemplateVersion.id, testVersion.id));

    // Verify steps are deleted
    const stepsAfter = await db
      .select()
      .from(workflowStepTemplate)
      .where(eq(workflowStepTemplate.workflowTemplateVersionId, testVersion.id));
    expect(stepsAfter).toHaveLength(0);
  });

  test("form integration - form_template_version_id and form_action_mode", async () => {
    // Create step with form integration
    const [step] = await db
      .insert(workflowStepTemplate)
      .values({
        workflowTemplateVersionId: version.id,
        tenantId: tenant.id,
        stepOrder: 10,
        name: "Form Step",
        stepType: "form",
        formTemplateVersionId: formVersion.id,
        formActionMode: "fill_out",

        declineReturnsToStepOffset: 1,
      })
      .returning();

    expect(step.formTemplateVersionId).toBe(formVersion.id);
    expect(step.formActionMode).toBe("fill_out");

    // Create approval step with validate mode
    const [approvalStep] = await db
      .insert(workflowStepTemplate)
      .values({
        workflowTemplateVersionId: version.id,
        tenantId: tenant.id,
        stepOrder: 11,
        name: "Approval Step",
        stepType: "approval",
        formTemplateVersionId: formVersion.id,
        formActionMode: "validate",

        declineReturnsToStepOffset: 1,
      })
      .returning();

    expect(approvalStep.formActionMode).toBe("validate");
  });

  test("task configuration fields", async () => {
    // Create step with full task configuration
    const [step] = await db
      .insert(workflowStepTemplate)
      .values({
        workflowTemplateVersionId: version.id,
        tenantId: tenant.id,
        stepOrder: 20,
        name: "Task Config Step",
        stepType: "task",
        taskTitle: "Complete supplier information",
        taskDescription: "Fill out all required fields",
        dueDays: 7,
        assigneeType: "role",
        assigneeRole: "procurement_manager",

        declineReturnsToStepOffset: 1,
      })
      .returning();

    expect(step.taskTitle).toBe("Complete supplier information");
    expect(step.taskDescription).toBe("Fill out all required fields");
    expect(step.dueDays).toBe(7);
    expect(step.assigneeType).toBe("role");
    expect(step.assigneeRole).toBe("procurement_manager");
  });

  test("decline_returns_to_step_offset default value", async () => {
    // Create step without specifying decline_returns_to_step_offset
    const [step] = await db
      .insert(workflowStepTemplate)
      .values({
        workflowTemplateVersionId: version.id,
        tenantId: tenant.id,
        stepOrder: 40,
        name: "Default Decline Step",
        stepType: "task",

      })
      .returning();

    // Verify default value is 1
    expect(step.declineReturnsToStepOffset).toBe(1);
  });
});

describe("Form Action Mode Integration", () => {
  let tenant: { id: string };
  let user: { id: string };
  let template: { id: string };
  let version: { id: string };
  let formVersion: { id: string };

  beforeAll(async () => {
    [tenant] = await db
      .insert(tenants)
      .values({
        name: "Form Action Mode Test Tenant",
        slug: `form-action-tenant-${Date.now()}`,
      })
      .returning();

    [user] = await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        tenantId: tenant.id,
        email: `form-action-user-${Date.now()}@test.com`,
        fullName: "Form Action User",
        role: "admin",
      })
      .returning();

    [template] = await db
      .insert(workflowTemplate)
      .values({
        tenantId: tenant.id,
        name: "Form Action Test Workflow",
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

    // Create form template and version
    const [formTemp] = await db
      .insert(formTemplate)
      .values({
        tenantId: tenant.id,
        name: "Test Form",
        status: FormTemplateStatus.PUBLISHED,
      })
      .returning();

    [formVersion] = await db
      .insert(formTemplateVersion)
      .values({
        formTemplateId: formTemp.id,
        tenantId: tenant.id,
        version: 1,
        status: FormTemplateStatus.PUBLISHED,
        isPublished: true,
      })
      .returning();
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenant.id));
  });

  test("step with form_action_mode = 'fill_out'", async () => {
    const [step] = await db
      .insert(workflowStepTemplate)
      .values({
        workflowTemplateVersionId: version.id,
        tenantId: tenant.id,
        stepOrder: 1,
        name: "Fill Out Form",
        stepType: "form",
        formTemplateVersionId: formVersion.id,
        formActionMode: "fill_out",

        declineReturnsToStepOffset: 1,
      })
      .returning();

    expect(step.formActionMode).toBe("fill_out");
    expect(step.formTemplateVersionId).toBe(formVersion.id);
  });

  test("step with form_action_mode = 'validate'", async () => {
    const [step] = await db
      .insert(workflowStepTemplate)
      .values({
        workflowTemplateVersionId: version.id,
        tenantId: tenant.id,
        stepOrder: 2,
        name: "Validate Form",
        stepType: "approval",
        formTemplateVersionId: formVersion.id,
        formActionMode: "validate",

        declineReturnsToStepOffset: 1,
      })
      .returning();

    expect(step.formActionMode).toBe("validate");
    expect(step.formTemplateVersionId).toBe(formVersion.id);
  });
});

describe("Document Action Mode Integration", () => {
  let tenant: { id: string };
  let user: { id: string };
  let template: { id: string };
  let version: { id: string };

  beforeAll(async () => {
    [tenant] = await db
      .insert(tenants)
      .values({
        name: "Document Action Mode Test Tenant",
        slug: `doc-action-tenant-${Date.now()}`,
      })
      .returning();

    [user] = await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        tenantId: tenant.id,
        email: `doc-action-user-${Date.now()}@test.com`,
        fullName: "Document Action User",
        role: "admin",
      })
      .returning();

    [template] = await db
      .insert(workflowTemplate)
      .values({
        tenantId: tenant.id,
        name: "Document Action Test Workflow",
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

  test("step with document_action_mode = 'upload'", async () => {
    const [step] = await db
      .insert(workflowStepTemplate)
      .values({
        workflowTemplateVersionId: version.id,
        tenantId: tenant.id,
        stepOrder: 1,
        name: "Upload Documents",
        stepType: "document",
        documentActionMode: "upload",

        declineReturnsToStepOffset: 1,
      })
      .returning();

    expect(step.documentActionMode).toBe("upload");
    expect(step.stepType).toBe("document");
  });

  test("step with document_action_mode = 'validate'", async () => {
    const [step] = await db
      .insert(workflowStepTemplate)
      .values({
        workflowTemplateVersionId: version.id,
        tenantId: tenant.id,
        stepOrder: 2,
        name: "Validate Documents",
        stepType: "document",
        documentActionMode: "validate",

        declineReturnsToStepOffset: 1,
      })
      .returning();

    expect(step.documentActionMode).toBe("validate");
    expect(step.stepType).toBe("document");
  });
});

