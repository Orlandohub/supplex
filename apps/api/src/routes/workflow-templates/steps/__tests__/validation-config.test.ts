import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { treaty } from "@elysiajs/eden";
import type { App } from "../../../../index";
import { db } from "../../../../lib/db";
import { insertOneOrThrow } from "../../../../lib/db-helpers";
import { tenants, users, workflowTemplate } from "@supplex/db";
import { eq } from "drizzle-orm";

/**
 * Integration Tests: Workflow Step Validation Config API
 * Story 2.2.15
 *
 * Tests the validation config endpoints (create/update steps with
 * `requiresValidation` and `validationConfig`).
 */

const API_URL = process.env.API_URL || "http://localhost:3000";
const client = treaty<App>(API_URL);

interface WorkflowStepFixture {
  id: string;
  requiresValidation: boolean;
  validationConfig: {
    approverRoles?: string[];
    requireAllApprovals?: boolean;
  };
}

interface ApiErrorBody {
  success: false;
  error: { code: string; message?: string };
}

/**
 * Treaty puts the response body in `response.data` for 2xx responses and
 * `response.error.value` for non-2xx. This helper extracts the typed error
 * envelope without each call site needing a type assertion.
 */
function errorBody(error: { value: unknown } | null): ApiErrorBody | null {
  if (!error) return null;
  return error.value as ApiErrorBody;
}

describe("Workflow Step Validation Config API", () => {
  let tenant: { id: string };
  let adminUser: { id: string; email: string };
  let template: { id: string };
  let adminToken: string;

  beforeAll(async () => {
    tenant = await insertOneOrThrow(db, tenants, {
      name: "Validation API Test Tenant",
      slug: `validation-api-tenant-${Date.now()}`,
    });

    const adminEmail = `admin-validation-${Date.now()}@test.com`;
    adminUser = await insertOneOrThrow(db, users, {
      id: crypto.randomUUID(),
      tenantId: tenant.id,
      email: adminEmail,
      fullName: "Admin User",
      role: "admin",
    });

    adminToken = `mock-token-admin-${adminUser.id}`;

    template = await insertOneOrThrow(db, workflowTemplate, {
      tenantId: tenant.id,
      name: "Validation Test Template",
      status: "draft",
      createdBy: adminUser.id,
    });
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenant.id));
  });

  // Treaty's dynamic-path call `client.api["workflow-templates"]({ templateId })`
  // nests step routes (`:templateId/steps/...`), publish (`:templateId/publish`),
  // etc., under one segment name (`templateId` = workflow_template.id).
  // TypeScript merges branches into a union; `StepsBranch` narrow keeps
  // `steps.post|put...` inferred without resorting to `as any`.

  type WorkflowTemplateBranches = ReturnType<
    (typeof client.api)["workflow-templates"]
  >;
  type StepsBranch = Extract<WorkflowTemplateBranches, { steps: unknown }>;

  function stepsRoot(id: string): StepsBranch["steps"] {
    return (
      client.api["workflow-templates"]({
        templateId: id,
      }) as StepsBranch
    ).steps;
  }

  const authHeaders = () => ({
    headers: { Authorization: `Bearer ${adminToken}` },
  });

  test("create step with requiresValidation=true and valid approverRoles", async () => {
    const response = await stepsRoot(template.id).post(
      {
        name: "Submit Supplier Profile",
        stepType: "form",
        requiresValidation: true,
        validationConfig: {
          approverRoles: ["quality_manager", "procurement_manager"],
          requireAllApprovals: false,
        },
      },
      authHeaders()
    );

    expect(response.status).toBe(200);
    expect(response.data?.success).toBe(true);
    if (!response.data?.success) return;
    const data = response.data.data as WorkflowStepFixture;
    expect(data.requiresValidation).toBe(true);
    expect(data.validationConfig.approverRoles).toEqual([
      "quality_manager",
      "procurement_manager",
    ]);
  });

  test("create step with requiresValidation=true but empty approverRoles should fail", async () => {
    const response = await stepsRoot(template.id).post(
      {
        name: "Invalid Step",
        stepType: "form",
        requiresValidation: true,
        validationConfig: {
          approverRoles: [],
        },
      },
      authHeaders()
    );

    expect(response.status).toBe(400);
    const body = errorBody(response.error);
    expect(body?.error.code).toBe("INVALID_VALIDATION_CONFIG");
  });

  test("create step with requiresValidation=true but missing validationConfig should fail", async () => {
    const response = await stepsRoot(template.id).post(
      {
        name: "Missing Config Step",
        stepType: "form",
        requiresValidation: true,
      },
      authHeaders()
    );

    expect(response.status).toBe(400);
    const body = errorBody(response.error);
    expect(body?.error.code).toBe("INVALID_VALIDATION_CONFIG");
  });

  test("create step with requiresValidation=false (default) should succeed without validationConfig", async () => {
    const response = await stepsRoot(template.id).post(
      {
        name: "No Validation Step",
        stepType: "form",
      },
      authHeaders()
    );

    expect(response.status).toBe(200);
    expect(response.data?.success).toBe(true);
    if (!response.data?.success) return;
    const data = response.data.data as WorkflowStepFixture;
    expect(data.requiresValidation).toBe(false);
    expect(data.validationConfig).toEqual({});
  });

  test("update step to add validation config", async () => {
    const createResponse = await stepsRoot(template.id).post(
      {
        name: "Update Test Step",
        stepType: "document",
        requiresValidation: false,
      },
      authHeaders()
    );

    expect(createResponse.data?.success).toBe(true);
    if (!createResponse.data?.success) return;
    const created = createResponse.data.data as WorkflowStepFixture;
    const stepId = created.id;
    expect(stepId).toBeDefined();

    const updateResponse = await stepsRoot(template.id)({ stepId }).put(
      {
        name: "Update Test Step",
        stepType: "document",
        requiresValidation: true,
        validationConfig: {
          approverRoles: ["admin"],
        },
      },
      authHeaders()
    );

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.data?.success).toBe(true);
    if (!updateResponse.data?.success) return;
    const updated = updateResponse.data.data as WorkflowStepFixture;
    expect(updated.requiresValidation).toBe(true);
    expect(updated.validationConfig.approverRoles).toEqual(["admin"]);
  });

  test("update step to remove validation config", async () => {
    const createResponse = await stepsRoot(template.id).post(
      {
        name: "Remove Validation Step",
        stepType: "form",
        requiresValidation: true,
        validationConfig: {
          approverRoles: ["quality_manager"],
        },
      },
      authHeaders()
    );

    expect(createResponse.data?.success).toBe(true);
    if (!createResponse.data?.success) return;
    const created = createResponse.data.data as WorkflowStepFixture;
    const stepId = created.id;

    const updateResponse = await stepsRoot(template.id)({ stepId }).put(
      {
        name: "Remove Validation Step",
        stepType: "form",
        requiresValidation: false,
        validationConfig: {
          approverRoles: [],
        },
      },
      authHeaders()
    );

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.data?.success).toBe(true);
    if (!updateResponse.data?.success) return;
    const updated = updateResponse.data.data as WorkflowStepFixture;
    expect(updated.requiresValidation).toBe(false);
  });

  test("retrieve step and verify validation config persisted", async () => {
    const createResponse = await stepsRoot(template.id).post(
      {
        name: "Persist Test Step",
        stepType: "form",
        requiresValidation: true,
        validationConfig: {
          approverRoles: ["procurement_manager", "quality_manager"],
          requireAllApprovals: true,
        },
      },
      authHeaders()
    );

    expect(createResponse.data?.success).toBe(true);
    if (!createResponse.data?.success) return;
    const created = createResponse.data.data as WorkflowStepFixture;
    const stepId = created.id;

    const getResponse = await client.api["workflow-templates"]({
      templateId: template.id,
    }).get(authHeaders());

    expect(getResponse.status).toBe(200);
    if (!getResponse.data?.success) {
      throw new Error("Expected workflow template fetch to succeed");
    }
    const templateData = getResponse.data.data as {
      steps?: WorkflowStepFixture[];
    };
    const step = templateData.steps?.find((s) => s.id === stepId);
    expect(step).toBeDefined();
    expect(step?.requiresValidation).toBe(true);
    expect(step?.validationConfig.approverRoles).toEqual([
      "procurement_manager",
      "quality_manager",
    ]);
    expect(step?.validationConfig.requireAllApprovals).toBe(true);
  });
});
