import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { treaty } from "@elysiajs/eden";
import type { App } from "../../../../index";
import { db } from "../../../../lib/db";
import { tenants, users, workflowTemplate } from "@supplex/db";
import { eq } from "drizzle-orm";

/**
 * Integration Tests: Workflow Step Validation Config API
 * Story 2.2.15
 *
 * Tests the validation config endpoints (create/update steps with requiresValidation and validationConfig)
 */

const API_URL = process.env.API_URL || "http://localhost:3000";
const client = treaty<App>(API_URL);

describe("Workflow Step Validation Config API", () => {
  let tenant: { id: string };
  let adminUser: { id: string; email: string };
  let template: { id: string };
  let adminToken: string;

  beforeAll(async () => {
    // Create tenant
    tenant = (
      await db
        .insert(tenants)
        .values({
          name: "Validation API Test Tenant",
          slug: `validation-api-tenant-${Date.now()}`,
        })
        .returning()
    )[0]!;

    // Create admin user
    const adminEmail = `admin-validation-${Date.now()}@test.com`;
    adminUser = (
      await db
        .insert(users)
        .values({
          id: crypto.randomUUID(),
          tenantId: tenant.id,
          email: adminEmail,
          fullName: "Admin User",
          role: "admin",
        })
        .returning()
    )[0]!;

    // Mock JWT token for admin
    adminToken = `mock-token-admin-${adminUser.id}`;

    // Create draft workflow template
    template = (
      await db
        .insert(workflowTemplate)
        .values({
          tenantId: tenant.id,
          name: "Validation Test Template",
          status: "draft",
          createdBy: adminUser.id,
        })
        .returning()
    )[0]!;
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenant.id));
  });

  test("create step with requiresValidation=true and valid approverRoles", async () => {
    const response = await (client.api["workflow-templates"] as any)[
      template.id
    ].steps.post(
      {
        name: "Submit Supplier Profile",
        stepType: "form",
        requiresValidation: true,
        validationConfig: {
          approverRoles: ["quality_manager", "procurement_manager"],
          requireAllApprovals: false,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      }
    );

    expect(response.status).toBe(200);
    expect(response.data?.success).toBe(true);
    expect(response.data?.data?.requiresValidation).toBe(true);
    expect(response.data?.data?.validationConfig.approverRoles).toEqual([
      "quality_manager",
      "procurement_manager",
    ]);
  });

  test("create step with requiresValidation=true but empty approverRoles should fail", async () => {
    const response = await (client.api["workflow-templates"] as any)[
      template.id
    ].steps.post(
      {
        name: "Invalid Step",
        stepType: "form",
        requiresValidation: true,
        validationConfig: {
          approverRoles: [],
        },
      },
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      }
    );

    expect(response.status).toBe(400);
    expect(response.data?.error?.code).toBe("INVALID_VALIDATION_CONFIG");
  });

  test("create step with requiresValidation=true but missing validationConfig should fail", async () => {
    const response = await (client.api["workflow-templates"] as any)[
      template.id
    ].steps.post(
      {
        name: "Missing Config Step",
        stepType: "form",
        requiresValidation: true,
      },
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      }
    );

    expect(response.status).toBe(400);
    expect(response.data?.error?.code).toBe("INVALID_VALIDATION_CONFIG");
  });

  test("create step with requiresValidation=false (default) should succeed without validationConfig", async () => {
    const response = await (client.api["workflow-templates"] as any)[
      template.id
    ].steps.post(
      {
        name: "No Validation Step",
        stepType: "form",
      },
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      }
    );

    expect(response.status).toBe(200);
    expect(response.data?.success).toBe(true);
    expect(response.data?.data?.requiresValidation).toBe(false);
    expect(response.data?.data?.validationConfig).toEqual({});
  });

  test("update step to add validation config", async () => {
    // Create step without validation
    const createResponse = await (client.api["workflow-templates"] as any)[
      template.id
    ].steps.post(
      {
        name: "Update Test Step",
        stepType: "document",
        requiresValidation: false,
      },
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      }
    );

    const stepId = createResponse.data?.data?.id;
    expect(stepId).toBeDefined();

    // Update step to enable validation
    const updateResponse = await (client.api["workflow-templates"] as any)[
      template.id
    ].steps[stepId!].put(
      {
        name: "Update Test Step",
        stepType: "document",
        requiresValidation: true,
        validationConfig: {
          approverRoles: ["admin"],
        },
      },
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      }
    );

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.data?.success).toBe(true);
    expect(updateResponse.data?.data?.requiresValidation).toBe(true);
    expect(updateResponse.data?.data?.validationConfig.approverRoles).toEqual([
      "admin",
    ]);
  });

  test("update step to remove validation config", async () => {
    // Create step with validation
    const createResponse = await (client.api["workflow-templates"] as any)[
      template.id
    ].steps.post(
      {
        name: "Remove Validation Step",
        stepType: "form",
        requiresValidation: true,
        validationConfig: {
          approverRoles: ["quality_manager"],
        },
      },
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      }
    );

    const stepId = createResponse.data?.data?.id;
    expect(stepId).toBeDefined();

    // Update step to disable validation
    const updateResponse = await (client.api["workflow-templates"] as any)[
      template.id
    ].steps[stepId!].put(
      {
        name: "Remove Validation Step",
        stepType: "form",
        requiresValidation: false,
        validationConfig: {
          approverRoles: [],
        },
      },
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      }
    );

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.data?.success).toBe(true);
    expect(updateResponse.data?.data?.requiresValidation).toBe(false);
  });

  test("retrieve step and verify validation config persisted", async () => {
    // Create step with validation
    const createResponse = await (client.api["workflow-templates"] as any)[
      template.id
    ].steps.post(
      {
        name: "Persist Test Step",
        stepType: "form",
        requiresValidation: true,
        validationConfig: {
          approverRoles: ["procurement_manager", "quality_manager"],
          requireAllApprovals: true,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      }
    );

    const stepId = createResponse.data?.data?.id;

    // Retrieve template with steps
    const getResponse = await (client.api["workflow-templates"] as any)[
      template.id
    ].get({
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    expect(getResponse.status).toBe(200);
    const step = getResponse.data?.data?.steps?.find(
      (s: any) => s.id === stepId
    );
    expect(step).toBeDefined();
    expect(step?.requiresValidation).toBe(true);
    expect(step?.validationConfig.approverRoles).toEqual([
      "procurement_manager",
      "quality_manager",
    ]);
    expect(step?.validationConfig.requireAllApprovals).toBe(true);
  });
});
