import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  setDefaultTimeout,
  mock,
} from "bun:test";
import { Elysia } from "elysia";

setDefaultTimeout(30_000);

mock.module("../../../../lib/rbac/middleware", () => ({
  authenticate: new Elysia({ name: "auth" }),
}));

const { completeStepRoute } = await import("../complete");
const { withApiErrorHandler } = await import("../../../../lib/test-utils");
import { db } from "../../../../lib/db";
import { eq } from "drizzle-orm";
import {
  tenants,
  users,
  workflowTemplate,
  workflowStepTemplate,
  processInstance,
  stepInstance,
  taskInstance,
} from "@supplex/db";
import type { AuthContext } from "../../../../lib/rbac/middleware";
import { logger } from "../../../../lib/logger";
import { asUserRole } from "../../../../lib/test-utils";
import {
  insertOneOrThrow,
  selectFirstOrThrow,
} from "../../../../lib/db-helpers";

function createWfApp(user: AuthContext["user"]) {
  return withApiErrorHandler(
    new Elysia({ prefix: "/api/workflows" })
      .derive(() => ({ user, requestLogger: logger.child({ test: true }) }))
      .use(completeStepRoute)
  );
}

describe("POST /api/workflows/steps/:id/complete submit", () => {
  let tenant: { id: string };
  let user: AuthContext["user"];
  let tmpl: { id: string };
  let stepT: { id: string };

  beforeAll(async () => {
    tenant = await insertOneOrThrow(db, tenants, {
      name: "WfCompleteSubmit",
      slug: `wfcs-${Date.now()}`,
    });
    const row = await insertOneOrThrow(db, users, {
      id: crypto.randomUUID(),
      tenantId: tenant.id,
      email: `wfcs-${Date.now()}@test.com`,
      fullName: "Wf Complete Submit",
      role: "admin",
    });
    user = {
      id: row.id,
      email: row.email,
      role: asUserRole(row.role),
      tenantId: tenant.id,
      fullName: row.fullName,
    };

    tmpl = await insertOneOrThrow(db, workflowTemplate, {
      tenantId: tenant.id,
      name: "WF",
      status: "published",
      createdBy: row.id,
    });

    stepT = await insertOneOrThrow(db, workflowStepTemplate, {
      workflowTemplateId: tmpl.id,
      tenantId: tenant.id,
      stepOrder: 1,
      name: "Simple",
      stepType: "approval",
      requiresValidation: false,
      taskTitle: "Do",
      assigneeType: "role",
      assigneeRole: "admin",
    });
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenant.id));
  });

  test("submit action → 200, step leaves active", async () => {
    const proc = await insertOneOrThrow(db, processInstance, {
      tenantId: tenant.id,
      workflowTemplateId: tmpl.id,
      processType: "workflow_execution",
      entityType: "supplier",
      entityId: crypto.randomUUID(),
      status: "in_progress",
      initiatedBy: user.id,
      initiatedDate: new Date(),
    });

    const step = await insertOneOrThrow(db, stepInstance, {
      tenantId: tenant.id,
      processInstanceId: proc.id,
      workflowStepTemplateId: stepT.id,
      stepOrder: 1,
      stepName: "Simple",
      stepType: "approval",
      status: "active",
    });

    await db.insert(taskInstance).values({
      tenantId: tenant.id,
      processInstanceId: proc.id,
      stepInstanceId: step.id,
      assigneeType: "user",
      assigneeUserId: user.id,
      title: "Do",
      taskType: "action",
      status: "pending",
      metadata: {},
    });

    const app = createWfApp(user);
    const res = await app.handle(
      new Request(`http://localhost/api/workflows/steps/${step.id}/complete`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "submit" }),
      })
    );
    expect(res.status).toBe(200);
    const updated = await selectFirstOrThrow(
      db.select().from(stepInstance).where(eq(stepInstance.id, step.id))
    );
    expect(["completed", "awaiting_validation"]).toContain(updated.status);
  });
});
