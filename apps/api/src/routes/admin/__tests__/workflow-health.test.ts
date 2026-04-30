import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { db } from "../../../lib/db";
import {
  tenants,
  users,
  processInstance,
  stepInstance,
  taskInstance,
} from "@supplex/db";
import { eq, and, isNull, sql, inArray } from "drizzle-orm";

import { insertOneOrThrow } from "../../../lib/db-helpers";
/**
 * Tests for Workflow Health-Check Endpoint
 * Story: 2.2.21 + SEC-002 - Tenant isolation
 *
 * Uses direct-query tests (fallback approach) because the test infrastructure
 * does not support easy mocking of the full auth middleware chain for endpoint-level
 * testing. Revisit for handler-level tests when test utils are available.
 *
 * Verifies that tenant-scoped queries return data only for the requesting tenant.
 */

describe("Workflow Health-Check Queries", () => {
  let tenantAId: string;
  let tenantBId: string;
  let userAId: string;
  let userBId: string;
  const createdProcessIds: string[] = [];
  const createdStepIds: string[] = [];
  const createdTaskIds: string[] = [];

  beforeAll(async () => {
    // Tenant A
    const tenantA = await insertOneOrThrow(db, tenants, {
      name: "Health Check Tenant A",
      slug: `health-a-${Date.now()}`,
    });
    tenantAId = tenantA.id;

    ({ id: userAId } = await insertOneOrThrow(db, users, {
      id: crypto.randomUUID(),
      tenantId: tenantAId,
      email: `health-a-${Date.now()}@test.com`,
      fullName: "Tenant A Admin",
      role: "admin",
    }));

    // Tenant B
    const tenantB = await insertOneOrThrow(db, tenants, {
      name: "Health Check Tenant B",
      slug: `health-b-${Date.now()}`,
    });
    tenantBId = tenantB.id;

    ({ id: userBId } = await insertOneOrThrow(db, users, {
      id: crypto.randomUUID(),
      tenantId: tenantBId,
      email: `health-b-${Date.now()}@test.com`,
      fullName: "Tenant B Admin",
      role: "admin",
    }));
  });

  afterAll(async () => {
    const bothTenants = [tenantAId, tenantBId];
    await db
      .delete(taskInstance)
      .where(inArray(taskInstance.tenantId, bothTenants));
    await db
      .delete(stepInstance)
      .where(inArray(stepInstance.tenantId, bothTenants));
    await db
      .delete(processInstance)
      .where(inArray(processInstance.tenantId, bothTenants));
    await db.delete(users).where(inArray(users.tenantId, bothTenants));
    await db.delete(tenants).where(inArray(tenants.id, bothTenants));
  });

  test("detects stuck processes (in_progress with no current step)", async () => {
    const proc = await insertOneOrThrow(db, processInstance, {
      tenantId: tenantAId,
      processType: "health_test",
      entityType: "supplier",
      entityId: crypto.randomUUID(),
      status: "in_progress",
      currentStepInstanceId: null,
      initiatedBy: userAId,
      initiatedDate: new Date(),
    });
    createdProcessIds.push(proc.id);

    const stuckProcesses = await db
      .select({ id: processInstance.id })
      .from(processInstance)
      .where(eq(processInstance.status, "in_progress"));

    const stuck = stuckProcesses.filter((p) => p.id === proc.id);
    expect(stuck.length).toBe(1);
  });

  test("detects orphaned tasks (pending but step is completed)", async () => {
    const proc = await insertOneOrThrow(db, processInstance, {
      tenantId: tenantAId,
      processType: "health_test_orphan",
      entityType: "supplier",
      entityId: crypto.randomUUID(),
      status: "in_progress",
      initiatedBy: userAId,
      initiatedDate: new Date(),
    });
    createdProcessIds.push(proc.id);

    const step = await insertOneOrThrow(db, stepInstance, {
      tenantId: tenantAId,
      processInstanceId: proc.id,
      stepOrder: 1,
      stepName: "Completed Step",
      stepType: "form",
      status: "completed",
    });
    createdStepIds.push(step.id);

    const task = await insertOneOrThrow(db, taskInstance, {
      tenantId: tenantAId,
      processInstanceId: proc.id,
      stepInstanceId: step.id,
      title: "Orphaned Task",
      assigneeType: "role",
      assigneeRole: "admin",
      taskType: "action",
      status: "pending",
    });
    createdTaskIds.push(task.id);

    const orphaned = await db
      .select({ id: taskInstance.id, stepStatus: stepInstance.status })
      .from(taskInstance)
      .innerJoin(stepInstance, eq(taskInstance.stepInstanceId, stepInstance.id))
      .where(eq(taskInstance.id, task.id));

    expect(orphaned.length).toBe(1);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- existence asserted above
    expect(orphaned[0]!.stepStatus).toBe("completed");
  });

  // ─── SEC-002: Tenant Isolation Tests ───────────────────────────────

  test("Q1 (stuck processes): tenant-scoped query returns only own tenant's data", async () => {
    // Seed a stuck process in Tenant A
    const procA = await insertOneOrThrow(db, processInstance, {
      tenantId: tenantAId,
      processType: "iso_stuck_a",
      entityType: "supplier",
      entityId: crypto.randomUUID(),
      status: "in_progress",
      currentStepInstanceId: null,
      initiatedBy: userAId,
      initiatedDate: new Date(),
    });
    createdProcessIds.push(procA.id);

    // Seed a stuck process in Tenant B
    const procB = await insertOneOrThrow(db, processInstance, {
      tenantId: tenantBId,
      processType: "iso_stuck_b",
      entityType: "supplier",
      entityId: crypto.randomUUID(),
      status: "in_progress",
      currentStepInstanceId: null,
      initiatedBy: userBId,
      initiatedDate: new Date(),
    });
    createdProcessIds.push(procB.id);

    // Query scoped to Tenant A (replicates handler query)
    const resultA = await db
      .select({ id: processInstance.id })
      .from(processInstance)
      .where(
        and(
          eq(processInstance.tenantId, tenantAId),
          eq(processInstance.status, "in_progress"),
          isNull(processInstance.currentStepInstanceId),
          isNull(processInstance.deletedAt)
        )
      );

    const idsA = resultA.map((r) => r.id);
    expect(idsA).toContain(procA.id);
    expect(idsA).not.toContain(procB.id);
  });

  test("Q2 (orphaned tasks): tenant-scoped query returns only own tenant's data", async () => {
    // Tenant A: orphaned task
    const procA = await insertOneOrThrow(db, processInstance, {
      tenantId: tenantAId,
      processType: "iso_orphan_a",
      entityType: "supplier",
      entityId: crypto.randomUUID(),
      status: "in_progress",
      initiatedBy: userAId,
      initiatedDate: new Date(),
    });
    createdProcessIds.push(procA.id);

    const stepA = await insertOneOrThrow(db, stepInstance, {
      tenantId: tenantAId,
      processInstanceId: procA.id,
      stepOrder: 1,
      stepName: "Done Step A",
      stepType: "form",
      status: "completed",
    });
    createdStepIds.push(stepA.id);

    const taskA = await insertOneOrThrow(db, taskInstance, {
      tenantId: tenantAId,
      processInstanceId: procA.id,
      stepInstanceId: stepA.id,
      title: "Orphan A",
      assigneeType: "role",
      assigneeRole: "admin",
      taskType: "action",
      status: "pending",
    });
    createdTaskIds.push(taskA.id);

    // Tenant B: orphaned task
    const procB = await insertOneOrThrow(db, processInstance, {
      tenantId: tenantBId,
      processType: "iso_orphan_b",
      entityType: "supplier",
      entityId: crypto.randomUUID(),
      status: "in_progress",
      initiatedBy: userBId,
      initiatedDate: new Date(),
    });
    createdProcessIds.push(procB.id);

    const stepB = await insertOneOrThrow(db, stepInstance, {
      tenantId: tenantBId,
      processInstanceId: procB.id,
      stepOrder: 1,
      stepName: "Done Step B",
      stepType: "form",
      status: "completed",
    });
    createdStepIds.push(stepB.id);

    const taskB = await insertOneOrThrow(db, taskInstance, {
      tenantId: tenantBId,
      processInstanceId: procB.id,
      stepInstanceId: stepB.id,
      title: "Orphan B",
      assigneeType: "role",
      assigneeRole: "admin",
      taskType: "action",
      status: "pending",
    });
    createdTaskIds.push(taskB.id);

    // Query scoped to Tenant A
    const resultA = await db
      .select({ id: taskInstance.id })
      .from(taskInstance)
      .innerJoin(stepInstance, eq(taskInstance.stepInstanceId, stepInstance.id))
      .where(
        and(
          eq(taskInstance.tenantId, tenantAId),
          eq(taskInstance.status, "pending"),
          isNull(taskInstance.deletedAt),
          sql`${stepInstance.status} NOT IN ('active', 'awaiting_validation')`
        )
      );

    const idsA = resultA.map((r) => r.id);
    expect(idsA).toContain(taskA.id);
    expect(idsA).not.toContain(taskB.id);
  });

  test("Q3 (state mismatches): tenant-scoped query returns only own tenant's data", async () => {
    // Tenant A: mismatch (in_progress, no active steps)
    const procA = await insertOneOrThrow(db, processInstance, {
      tenantId: tenantAId,
      processType: "iso_mismatch_a",
      entityType: "supplier",
      entityId: crypto.randomUUID(),
      status: "in_progress",
      initiatedBy: userAId,
      initiatedDate: new Date(),
    });
    createdProcessIds.push(procA.id);

    // Tenant B: mismatch
    const procB = await insertOneOrThrow(db, processInstance, {
      tenantId: tenantBId,
      processType: "iso_mismatch_b",
      entityType: "supplier",
      entityId: crypto.randomUUID(),
      status: "in_progress",
      initiatedBy: userBId,
      initiatedDate: new Date(),
    });
    createdProcessIds.push(procB.id);

    // Query scoped to Tenant A
    const resultA = await db
      .select({ id: processInstance.id })
      .from(processInstance)
      .where(
        and(
          eq(processInstance.tenantId, tenantAId),
          eq(processInstance.status, "in_progress"),
          isNull(processInstance.deletedAt),
          sql`NOT EXISTS (
            SELECT 1 FROM step_instance s2
            WHERE s2.process_instance_id = ${processInstance.id}
              AND s2.status IN ('active', 'blocked', 'pending')
          )`
        )
      );

    const idsA = resultA.map((r) => r.id);
    expect(idsA).toContain(procA.id);
    expect(idsA).not.toContain(procB.id);
  });
});
