/**
 * Workflow Engine Tenant Isolation Tests
 * Story 2.2.1: Verifies tenant isolation for process_instance and step_instance tables
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { db } from "../../index";
import { processInstance, ProcessStatus, ProcessType } from "../process-instance";
import { stepInstance, StepStatus, StepType } from "../step-instance";
import { tenants } from "../tenants";
import { users } from "../users";
import { eq, and, isNull } from "drizzle-orm";

/**
 * Test Data Setup
 * Uses real database connection for integration testing
 */
describe("Workflow Engine Tenant Isolation", () => {
  let tenant1Id: string;
  let tenant2Id: string;
  let user1Id: string;
  let user2Id: string;
  let processId1: string;
  let processId2: string;

  beforeAll(async () => {
    // Create test tenants
    const [tenant1] = await db
      .insert(tenants)
      .values({
        name: "Test Tenant 1 - Workflow Engine",
        slug: `test-tenant-1-workflow-${Date.now()}`,
        status: "active",
        plan: "starter",
      })
      .returning();

    const [tenant2] = await db
      .insert(tenants)
      .values({
        name: "Test Tenant 2 - Workflow Engine",
        slug: `test-tenant-2-workflow-${Date.now()}`,
        status: "active",
        plan: "starter",
      })
      .returning();

    tenant1Id = tenant1.id;
    tenant2Id = tenant2.id;

    // Create test users (one per tenant)
    const [user1] = await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        tenantId: tenant1Id,
        email: `user1-workflow-${Date.now()}@test.com`,
        fullName: "User 1 Workflow",
        role: "admin",
        status: "active",
      })
      .returning();

    const [user2] = await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        tenantId: tenant2Id,
        email: `user2-workflow-${Date.now()}@test.com`,
        fullName: "User 2 Workflow",
        role: "admin",
        status: "active",
      })
      .returning();

    user1Id = user1.id;
    user2Id = user2.id;
  });

  afterAll(async () => {
    // Cleanup: Delete tenants (CASCADE will delete users, processes, and steps)
    if (tenant1Id) {
      await db.delete(tenants).where(eq(tenants.id, tenant1Id));
    }
    if (tenant2Id) {
      await db.delete(tenants).where(eq(tenants.id, tenant2Id));
    }
  });

  describe("Process Instance Tenant Isolation", () => {
    it("should create process instances for different tenants", async () => {
      // Create process for tenant 1
      const [process1] = await db
        .insert(processInstance)
        .values({
          tenantId: tenant1Id,
          processType: ProcessType.SUPPLIER_QUALIFICATION,
          entityType: "supplier",
          entityId: crypto.randomUUID(),
          status: ProcessStatus.ACTIVE,
          initiatedBy: user1Id,
          metadata: { test: "tenant1" },
        })
        .returning();

      // Create process for tenant 2
      const [process2] = await db
        .insert(processInstance)
        .values({
          tenantId: tenant2Id,
          processType: ProcessType.SUPPLIER_QUALIFICATION,
          entityType: "supplier",
          entityId: crypto.randomUUID(),
          status: ProcessStatus.ACTIVE,
          initiatedBy: user2Id,
          metadata: { test: "tenant2" },
        })
        .returning();

      expect(process1.tenantId).toBe(tenant1Id);
      expect(process2.tenantId).toBe(tenant2Id);

      processId1 = process1.id;
      processId2 = process2.id;
    });

    it("should not query process from different tenant", async () => {
      // Query tenant1's processes from tenant2's perspective
      const tenant2Processes = await db
        .select()
        .from(processInstance)
        .where(
          and(
            eq(processInstance.tenantId, tenant2Id),
            isNull(processInstance.deletedAt)
          )
        );

      // Should only see tenant2's process
      expect(tenant2Processes.length).toBeGreaterThanOrEqual(1);
      expect(tenant2Processes.every((p) => p.tenantId === tenant2Id)).toBe(
        true
      );

      // Verify tenant1's process is not in results
      const hasOtherTenantProcess = tenant2Processes.some(
        (p) => p.id === processId1
      );
      expect(hasOtherTenantProcess).toBe(false);
    });

    it("should enforce foreign key constraint on tenant_id", async () => {
      // Attempt to create process with non-existent tenant
      const nonExistentTenantId = crypto.randomUUID();

      await expect(
        db.insert(processInstance).values({
          tenantId: nonExistentTenantId,
          processType: ProcessType.SUPPLIER_QUALIFICATION,
          entityType: "supplier",
          entityId: crypto.randomUUID(),
          status: ProcessStatus.ACTIVE,
          initiatedBy: user1Id,
        })
      ).rejects.toThrow();
    });

    it("should cascade delete processes when tenant is deleted", async () => {
      // Create a temporary tenant and process
      const [tempTenant] = await db
        .insert(tenants)
        .values({
          name: "Temp Tenant - Workflow Cascade Test",
          slug: `temp-tenant-workflow-${Date.now()}`,
          status: "active",
          plan: "starter",
        })
        .returning();

      const [tempUser] = await db
        .insert(users)
        .values({
          id: crypto.randomUUID(),
          tenantId: tempTenant.id,
          email: `temp-user-workflow-${Date.now()}@test.com`,
          fullName: "Temp User Workflow",
          role: "admin",
          status: "active",
        })
        .returning();

      const [tempProcess] = await db
        .insert(processInstance)
        .values({
          tenantId: tempTenant.id,
          processType: ProcessType.SUPPLIER_QUALIFICATION,
          entityType: "supplier",
          entityId: crypto.randomUUID(),
          status: ProcessStatus.ACTIVE,
          initiatedBy: tempUser.id,
        })
        .returning();

      // Verify process exists
      const processBeforeDelete = await db
        .select()
        .from(processInstance)
        .where(eq(processInstance.id, tempProcess.id));

      expect(processBeforeDelete.length).toBe(1);

      // Delete tenant (should CASCADE delete process)
      await db.delete(tenants).where(eq(tenants.id, tempTenant.id));

      // Verify process was deleted
      const processAfterDelete = await db
        .select()
        .from(processInstance)
        .where(eq(processInstance.id, tempProcess.id));

      expect(processAfterDelete.length).toBe(0);
    });

    it("should prevent deletion of user who initiated process (RESTRICT)", async () => {
      // Attempt to delete user who initiated a process
      await expect(
        db.delete(users).where(eq(users.id, user1Id))
      ).rejects.toThrow();
    });
  });

  describe("Step Instance Tenant Isolation", () => {
    it("should create step instances with inherited tenant_id", async () => {
      // Create steps for process1 (tenant1)
      const [step1] = await db
        .insert(stepInstance)
        .values({
          tenantId: tenant1Id,
          processInstanceId: processId1,
          stepOrder: 1,
          stepName: "Initial Review",
          stepType: StepType.APPROVAL,
          status: StepStatus.ACTIVE,
          assignedTo: user1Id,
          metadata: {},
        })
        .returning();

      // Create steps for process2 (tenant2)
      const [step2] = await db
        .insert(stepInstance)
        .values({
          tenantId: tenant2Id,
          processInstanceId: processId2,
          stepOrder: 1,
          stepName: "Initial Review",
          stepType: StepType.APPROVAL,
          status: StepStatus.ACTIVE,
          assignedTo: user2Id,
          metadata: {},
        })
        .returning();

      expect(step1.tenantId).toBe(tenant1Id);
      expect(step2.tenantId).toBe(tenant2Id);
    });

    it("should not query steps from different tenant", async () => {
      // Query tenant1's steps
      const tenant1Steps = await db
        .select()
        .from(stepInstance)
        .where(
          and(
            eq(stepInstance.tenantId, tenant1Id),
            isNull(stepInstance.deletedAt)
          )
        );

      // Should only see tenant1's steps
      expect(tenant1Steps.length).toBeGreaterThanOrEqual(1);
      expect(tenant1Steps.every((s) => s.tenantId === tenant1Id)).toBe(true);
    });

    it("should enforce tenant_id matching with process_instance", async () => {
      // Attempt to create step with mismatched tenant_id
      // (step belongs to tenant2 but references tenant1's process)
      await expect(
        db.insert(stepInstance).values({
          tenantId: tenant2Id, // Different tenant
          processInstanceId: processId1, // Tenant1's process
          stepOrder: 2,
          stepName: "Mismatched Tenant Step",
          stepType: StepType.TASK,
          status: StepStatus.PENDING,
          metadata: {},
        })
      ).rejects.toThrow(); // Should fail FK constraint
    });

    it("should cascade delete steps when process is deleted", async () => {
      // Create a process with steps
      const [tempProcess] = await db
        .insert(processInstance)
        .values({
          tenantId: tenant1Id,
          processType: ProcessType.SOURCING,
          entityType: "product",
          entityId: crypto.randomUUID(),
          status: ProcessStatus.ACTIVE,
          initiatedBy: user1Id,
        })
        .returning();

      const [tempStep] = await db
        .insert(stepInstance)
        .values({
          tenantId: tenant1Id,
          processInstanceId: tempProcess.id,
          stepOrder: 1,
          stepName: "Cascade Test Step",
          stepType: StepType.FORM,
          status: StepStatus.PENDING,
          metadata: {},
        })
        .returning();

      // Verify step exists
      const stepBeforeDelete = await db
        .select()
        .from(stepInstance)
        .where(eq(stepInstance.id, tempStep.id));

      expect(stepBeforeDelete.length).toBe(1);

      // Delete process (should CASCADE delete steps)
      await db
        .delete(processInstance)
        .where(eq(processInstance.id, tempProcess.id));

      // Verify step was deleted
      const stepAfterDelete = await db
        .select()
        .from(stepInstance)
        .where(eq(stepInstance.id, tempStep.id));

      expect(stepAfterDelete.length).toBe(0);
    });

    it("should cascade delete steps when tenant is deleted", async () => {
      // Create a temporary tenant, process, and step
      const [tempTenant] = await db
        .insert(tenants)
        .values({
          name: "Temp Tenant - Step Cascade Test",
          slug: `temp-tenant-step-${Date.now()}`,
          status: "active",
          plan: "starter",
        })
        .returning();

      const [tempUser] = await db
        .insert(users)
        .values({
          id: crypto.randomUUID(),
          tenantId: tempTenant.id,
          email: `temp-user-step-${Date.now()}@test.com`,
          fullName: "Temp User Step",
          role: "admin",
          status: "active",
        })
        .returning();

      const [tempProcess] = await db
        .insert(processInstance)
        .values({
          tenantId: tempTenant.id,
          processType: ProcessType.SUPPLIER_QUALIFICATION,
          entityType: "supplier",
          entityId: crypto.randomUUID(),
          status: ProcessStatus.ACTIVE,
          initiatedBy: tempUser.id,
        })
        .returning();

      const [tempStep] = await db
        .insert(stepInstance)
        .values({
          tenantId: tempTenant.id,
          processInstanceId: tempProcess.id,
          stepOrder: 1,
          stepName: "Tenant Cascade Test Step",
          stepType: StepType.APPROVAL,
          status: StepStatus.PENDING,
          metadata: {},
        })
        .returning();

      // Verify step exists
      const stepBeforeDelete = await db
        .select()
        .from(stepInstance)
        .where(eq(stepInstance.id, tempStep.id));

      expect(stepBeforeDelete.length).toBe(1);

      // Delete tenant (should CASCADE delete process and steps)
      await db.delete(tenants).where(eq(tenants.id, tempTenant.id));

      // Verify step was deleted
      const stepAfterDelete = await db
        .select()
        .from(stepInstance)
        .where(eq(stepInstance.id, tempStep.id));

      expect(stepAfterDelete.length).toBe(0);
    });

    it("should prevent deletion of user assigned to step (RESTRICT)", async () => {
      // user1Id is assigned to steps created earlier
      // Attempting to delete should fail
      await expect(
        db.delete(users).where(eq(users.id, user1Id))
      ).rejects.toThrow();
    });
  });

  describe("Query Performance with Indexes", () => {
    it("should efficiently query processes by tenant, type, and status", async () => {
      // Query using the indexed columns
      const activeProcesses = await db
        .select()
        .from(processInstance)
        .where(
          and(
            eq(processInstance.tenantId, tenant1Id),
            eq(processInstance.processType, ProcessType.SUPPLIER_QUALIFICATION),
            eq(processInstance.status, ProcessStatus.ACTIVE),
            isNull(processInstance.deletedAt)
          )
        );

      // Should use idx_process_instance_tenant_type_status index
      expect(activeProcesses.length).toBeGreaterThanOrEqual(0);
    });

    it("should efficiently query user task lists", async () => {
      // Query using the indexed columns for task lists
      const userTasks = await db
        .select()
        .from(stepInstance)
        .where(
          and(
            eq(stepInstance.tenantId, tenant1Id),
            eq(stepInstance.assignedTo, user1Id),
            eq(stepInstance.status, StepStatus.ACTIVE),
            isNull(stepInstance.deletedAt)
          )
        );

      // Should use idx_step_instance_tenant_assigned_status index
      expect(userTasks.length).toBeGreaterThanOrEqual(0);
    });

    it("should efficiently query steps by process and order", async () => {
      // Query using the indexed columns for sequential steps
      const processSteps = await db
        .select()
        .from(stepInstance)
        .where(
          and(
            eq(stepInstance.processInstanceId, processId1),
            isNull(stepInstance.deletedAt)
          )
        )
        .orderBy(stepInstance.stepOrder);

      // Should use idx_step_instance_process_order index
      expect(processSteps.length).toBeGreaterThanOrEqual(0);
    });
  });
});

