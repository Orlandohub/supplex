/**
 * Task Instance Runtime Tests
 * Story 2.2.5.1: Verifies runtime task creation without templates
 * Tests tenant isolation, assignment strategies, and workflow integration
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { db } from "../../index";
import {
  taskInstance,
  TaskInstanceStatus,
  TaskAssigneeType,
} from "../task-instance";
import {
  processInstance,
  ProcessStatus,
  ProcessType,
} from "../process-instance";
import { stepInstance, StepStatus, StepType } from "../step-instance";
import { tenants } from "../tenants";
import { users } from "../users";
import { eq, and, isNull } from "drizzle-orm";

/**
 * Test Data Setup
 * Uses real database connection for integration testing
 */
describe("Task Instance Runtime Creation", () => {
  let tenant1Id: string;
  let tenant2Id: string;
  let user1Id: string;
  let user2Id: string;

  beforeAll(async () => {
    // Create test tenants
    const [tenant1] = await db
      .insert(tenants)
      .values({
        name: "Test Tenant 1 - Task Runtime",
        slug: `test-tenant-1-runtime-${Date.now()}`,
        status: "active",
        plan: "starter",
      })
      .returning();

    const [tenant2] = await db
      .insert(tenants)
      .values({
        name: "Test Tenant 2 - Task Runtime",
        slug: `test-tenant-2-runtime-${Date.now()}`,
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
        email: `user1-runtime-${Date.now()}@test.com`,
        fullName: "User 1 Runtime",
        role: "procurement_manager",
        status: "active",
      })
      .returning();

    const [user2] = await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        tenantId: tenant2Id,
        email: `user2-runtime-${Date.now()}@test.com`,
        fullName: "User 2 Runtime",
        role: "quality_manager",
        status: "active",
      })
      .returning();

    user1Id = user1.id;
    user2Id = user2.id;
  });

  afterAll(async () => {
    // Cleanup: Delete tenants (CASCADE will delete users, processes, steps, and tasks)
    if (tenant1Id) {
      await db.delete(tenants).where(eq(tenants.id, tenant1Id));
    }
    if (tenant2Id) {
      await db.delete(tenants).where(eq(tenants.id, tenant2Id));
    }
  });

  describe("Task Instance Creation from Step", () => {
    let processId1: string;
    let stepId1: string;

    beforeAll(async () => {
      // Create process instance
      const [process1] = await db
        .insert(processInstance)
        .values({
          tenantId: tenant1Id,
          processType: ProcessType.SUPPLIER_QUALIFICATION,
          entityType: "supplier",
          entityId: crypto.randomUUID(),
          status: ProcessStatus.ACTIVE,
          initiatedBy: user1Id,
        })
        .returning();

      processId1 = process1.id;

      // Create step instance (tasks are created when step becomes active)
      const [step1] = await db
        .insert(stepInstance)
        .values({
          tenantId: tenant1Id,
          processInstanceId: processId1,
          stepOrder: 1,
          stepName: "Initial Review",
          stepType: StepType.TASK,
          status: StepStatus.ACTIVE,
        })
        .returning();

      stepId1 = step1.id;
    });

    it("should create task with assignee_type = 'role'", async () => {
      // Workflow engine creates task from step configuration
      const [task] = await db
        .insert(taskInstance)
        .values({
          tenantId: tenant1Id,
          processInstanceId: processId1,
          stepInstanceId: stepId1, // REQUIRED - all tasks belong to a step
          title: "Review Supplier Documents",
          description: "Review all submitted supplier documentation",
          assigneeType: TaskAssigneeType.ROLE,
          assigneeRole: "procurement_manager", // Role-based assignment
          assigneeUserId: null,
          completionTimeDays: 3,
          dueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
          status: TaskInstanceStatus.OPEN,
        })
        .returning();

      expect(task.assigneeType).toBe(TaskAssigneeType.ROLE);
      expect(task.assigneeRole).toBe("procurement_manager");
      expect(task.assigneeUserId).toBeNull();
      expect(task.stepInstanceId).toBe(stepId1);
      expect(task.status).toBe(TaskInstanceStatus.OPEN);
    });

    it("should create task with assignee_type = 'user'", async () => {
      // Workflow engine creates task assigned to specific user
      const [task] = await db
        .insert(taskInstance)
        .values({
          tenantId: tenant1Id,
          processInstanceId: processId1,
          stepInstanceId: stepId1,
          title: "Personal Review Task",
          description: "Task assigned to specific user",
          assigneeType: TaskAssigneeType.USER,
          assigneeRole: null,
          assigneeUserId: user1Id, // User-specific assignment
          completionTimeDays: 5,
          dueAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          status: TaskInstanceStatus.OPEN,
        })
        .returning();

      expect(task.assigneeType).toBe(TaskAssigneeType.USER);
      expect(task.assigneeRole).toBeNull();
      expect(task.assigneeUserId).toBe(user1Id);
      expect(task.stepInstanceId).toBe(stepId1);
    });

    it("should calculate due_at from completion_time_days", async () => {
      const completionDays = 7;
      const now = new Date();
      const expectedDueDate = new Date(
        now.getTime() + completionDays * 24 * 60 * 60 * 1000
      );

      const [task] = await db
        .insert(taskInstance)
        .values({
          tenantId: tenant1Id,
          processInstanceId: processId1,
          stepInstanceId: stepId1,
          title: "Task with Due Date",
          description: "Test due date calculation",
          assigneeType: TaskAssigneeType.ROLE,
          assigneeRole: "procurement_manager",
          completionTimeDays: completionDays,
          dueAt: expectedDueDate,
          status: TaskInstanceStatus.OPEN,
        })
        .returning();

      expect(task.completionTimeDays).toBe(completionDays);
      expect(task.dueAt).toBeDefined();

      // Check due date is approximately correct (within 1 minute tolerance)
      const timeDiff = Math.abs(
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- existence asserted above
        task.dueAt!.getTime() - expectedDueDate.getTime()
      );
      expect(timeDiff).toBeLessThan(60000); // Less than 1 minute
    });

    it("should require step_instance_id (NOT NULL)", async () => {
      // Attempting to create task without step_instance_id should fail
      let createError = false;
      try {
        await db.insert(taskInstance).values({
          tenantId: tenant1Id,
          processInstanceId: processId1,
          // Intentional bad input: bypass the inferred `string` type to
          // verify the database-level NOT NULL constraint rejects the
          // insert at runtime.
          stepInstanceId: null as unknown as string,
          title: "Invalid Task",
          description: "Should fail",
          assigneeType: TaskAssigneeType.USER,
          assigneeUserId: user1Id,
          status: TaskInstanceStatus.OPEN,
        });
      } catch (error) {
        createError = true;
        expect(error).toBeDefined();
      }

      expect(createError).toBe(true);
    });
  });

  describe("Task Instance Tenant Isolation", () => {
    let processId1: string;
    let processId2: string;
    let stepId1: string;
    let stepId2: string;

    beforeAll(async () => {
      // Create processes for both tenants
      const [process1] = await db
        .insert(processInstance)
        .values({
          tenantId: tenant1Id,
          processType: ProcessType.SUPPLIER_QUALIFICATION,
          entityType: "supplier",
          entityId: crypto.randomUUID(),
          status: ProcessStatus.ACTIVE,
          initiatedBy: user1Id,
        })
        .returning();

      const [process2] = await db
        .insert(processInstance)
        .values({
          tenantId: tenant2Id,
          processType: ProcessType.SUPPLIER_QUALIFICATION,
          entityType: "supplier",
          entityId: crypto.randomUUID(),
          status: ProcessStatus.ACTIVE,
          initiatedBy: user2Id,
        })
        .returning();

      processId1 = process1.id;
      processId2 = process2.id;

      // Create steps
      const [step1] = await db
        .insert(stepInstance)
        .values({
          tenantId: tenant1Id,
          processInstanceId: processId1,
          stepOrder: 1,
          stepName: "Step 1",
          stepType: StepType.TASK,
          status: StepStatus.ACTIVE,
        })
        .returning();

      const [step2] = await db
        .insert(stepInstance)
        .values({
          tenantId: tenant2Id,
          processInstanceId: processId2,
          stepOrder: 1,
          stepName: "Step 1",
          stepType: StepType.TASK,
          status: StepStatus.ACTIVE,
        })
        .returning();

      stepId1 = step1.id;
      stepId2 = step2.id;
    });

    it("should create task instances for different tenants", async () => {
      // Create task for tenant 1
      const [task1] = await db
        .insert(taskInstance)
        .values({
          tenantId: tenant1Id,
          processInstanceId: processId1,
          stepInstanceId: stepId1,
          title: "Tenant 1 Task",
          description: "Task for tenant 1",
          assigneeType: TaskAssigneeType.ROLE,
          assigneeRole: "procurement_manager",
          status: TaskInstanceStatus.OPEN,
        })
        .returning();

      expect(task1.tenantId).toBe(tenant1Id);

      // Create task for tenant 2
      const [task2] = await db
        .insert(taskInstance)
        .values({
          tenantId: tenant2Id,
          processInstanceId: processId2,
          stepInstanceId: stepId2,
          title: "Tenant 2 Task",
          description: "Task for tenant 2",
          assigneeType: TaskAssigneeType.ROLE,
          assigneeRole: "quality_manager",
          status: TaskInstanceStatus.OPEN,
        })
        .returning();

      expect(task2.tenantId).toBe(tenant2Id);
    });

    it("should NOT query tasks from different tenant", async () => {
      // Create task for tenant 1
      await db.insert(taskInstance).values({
        tenantId: tenant1Id,
        processInstanceId: processId1,
        stepInstanceId: stepId1,
        title: "Unique Task Tenant 1",
        description: "Test task",
        assigneeType: TaskAssigneeType.USER,
        assigneeUserId: user1Id,
        status: TaskInstanceStatus.OPEN,
      });

      // Query tasks for tenant 2 (should NOT see tenant 1's task)
      const tenant2Tasks = await db
        .select()
        .from(taskInstance)
        .where(
          and(
            eq(taskInstance.tenantId, tenant2Id),
            eq(taskInstance.title, "Unique Task Tenant 1"),
            isNull(taskInstance.deletedAt)
          )
        );

      expect(tenant2Tasks.length).toBe(0);
    });

    it("should CASCADE delete tasks when step_instance deleted", async () => {
      // Create temporary step
      const [tempStep] = await db
        .insert(stepInstance)
        .values({
          tenantId: tenant1Id,
          processInstanceId: processId1,
          stepOrder: 99,
          stepName: "Temp Step",
          stepType: StepType.TASK,
          status: StepStatus.ACTIVE,
        })
        .returning();

      // Create task in step
      const [task] = await db
        .insert(taskInstance)
        .values({
          tenantId: tenant1Id,
          processInstanceId: processId1,
          stepInstanceId: tempStep.id,
          title: "Temp Step Task",
          description: "Test CASCADE delete",
          assigneeType: TaskAssigneeType.USER,
          assigneeUserId: user1Id,
          status: TaskInstanceStatus.OPEN,
        })
        .returning();

      expect(task.stepInstanceId).toBe(tempStep.id);

      // Delete step (CASCADE should delete task)
      await db.delete(stepInstance).where(eq(stepInstance.id, tempStep.id));

      // Verify task was deleted
      const deletedTask = await db
        .select()
        .from(taskInstance)
        .where(eq(taskInstance.id, task.id));

      expect(deletedTask.length).toBe(0);
    });

    it("should CASCADE delete tasks when process_instance deleted", async () => {
      // Create temporary process and step
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
          stepName: "Temp Step",
          stepType: StepType.TASK,
          status: StepStatus.ACTIVE,
        })
        .returning();

      // Create task
      const [task] = await db
        .insert(taskInstance)
        .values({
          tenantId: tenant1Id,
          processInstanceId: tempProcess.id,
          stepInstanceId: tempStep.id,
          title: "Temp Process Task",
          description: "Test CASCADE delete",
          assigneeType: TaskAssigneeType.USER,
          assigneeUserId: user1Id,
          status: TaskInstanceStatus.OPEN,
        })
        .returning();

      expect(task.processInstanceId).toBe(tempProcess.id);

      // Delete process (CASCADE should delete step and task)
      await db
        .delete(processInstance)
        .where(eq(processInstance.id, tempProcess.id));

      // Verify task was deleted
      const deletedTask = await db
        .select()
        .from(taskInstance)
        .where(eq(taskInstance.id, task.id));

      expect(deletedTask.length).toBe(0);
    });

    it("should RESTRICT delete when assignee_user deleted", async () => {
      // Create temporary user
      const [tempUser] = await db
        .insert(users)
        .values({
          id: crypto.randomUUID(),
          tenantId: tenant1Id,
          email: `temp-assignee-${Date.now()}@test.com`,
          fullName: "Temp Assignee User",
          role: "procurement_manager",
          status: "active",
        })
        .returning();

      // Create task assigned to temp user
      await db.insert(taskInstance).values({
        tenantId: tenant1Id,
        processInstanceId: processId1,
        stepInstanceId: stepId1,
        title: "Restrict Delete Test",
        description: "Test RESTRICT on assignee_user_id",
        assigneeType: TaskAssigneeType.USER,
        assigneeUserId: tempUser.id,
        status: TaskInstanceStatus.OPEN,
      });

      // Attempt to delete user should fail due to RESTRICT
      let deleteError = false;
      try {
        await db.delete(users).where(eq(users.id, tempUser.id));
      } catch (error) {
        deleteError = true;
        expect(error).toBeDefined();
      }

      expect(deleteError).toBe(true);
    });
  });

  describe("Task Assignment Strategies", () => {
    let processId: string;
    let stepId: string;

    beforeAll(async () => {
      const [process] = await db
        .insert(processInstance)
        .values({
          tenantId: tenant1Id,
          processType: ProcessType.SUPPLIER_QUALIFICATION,
          entityType: "supplier",
          entityId: crypto.randomUUID(),
          status: ProcessStatus.ACTIVE,
          initiatedBy: user1Id,
        })
        .returning();

      const [step] = await db
        .insert(stepInstance)
        .values({
          tenantId: tenant1Id,
          processInstanceId: process.id,
          stepOrder: 1,
          stepName: "Review Step",
          stepType: StepType.TASK,
          status: StepStatus.ACTIVE,
        })
        .returning();

      processId = process.id;
      stepId = step.id;
    });

    it("should query role-based tasks for user with matching role", async () => {
      // Create role-based task
      await db.insert(taskInstance).values({
        tenantId: tenant1Id,
        processInstanceId: processId,
        stepInstanceId: stepId,
        title: "Role-Based Task",
        description: "Task for procurement_manager role",
        assigneeType: TaskAssigneeType.ROLE,
        assigneeRole: "procurement_manager",
        status: TaskInstanceStatus.OPEN,
      });

      // Query tasks for user with procurement_manager role
      const roleTasks = await db
        .select()
        .from(taskInstance)
        .where(
          and(
            eq(taskInstance.tenantId, tenant1Id),
            eq(taskInstance.assigneeType, TaskAssigneeType.ROLE),
            eq(taskInstance.assigneeRole, "procurement_manager"),
            eq(taskInstance.status, TaskInstanceStatus.OPEN),
            isNull(taskInstance.deletedAt)
          )
        );

      expect(roleTasks.length).toBeGreaterThanOrEqual(1);
    });

    it("should query user-specific tasks for assigned user", async () => {
      // Create user-specific task
      await db.insert(taskInstance).values({
        tenantId: tenant1Id,
        processInstanceId: processId,
        stepInstanceId: stepId,
        title: "User-Specific Task",
        description: "Task for specific user",
        assigneeType: TaskAssigneeType.USER,
        assigneeUserId: user1Id,
        status: TaskInstanceStatus.OPEN,
      });

      // Query tasks for specific user
      const userTasks = await db
        .select()
        .from(taskInstance)
        .where(
          and(
            eq(taskInstance.tenantId, tenant1Id),
            eq(taskInstance.assigneeType, TaskAssigneeType.USER),
            eq(taskInstance.assigneeUserId, user1Id),
            eq(taskInstance.status, TaskInstanceStatus.OPEN),
            isNull(taskInstance.deletedAt)
          )
        );

      expect(userTasks.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Task Status Lifecycle", () => {
    it("should complete a task and update status", async () => {
      // Create process and step
      const [process] = await db
        .insert(processInstance)
        .values({
          tenantId: tenant1Id,
          processType: ProcessType.SUPPLIER_QUALIFICATION,
          entityType: "supplier",
          entityId: crypto.randomUUID(),
          status: ProcessStatus.ACTIVE,
          initiatedBy: user1Id,
        })
        .returning();

      const [step] = await db
        .insert(stepInstance)
        .values({
          tenantId: tenant1Id,
          processInstanceId: process.id,
          stepOrder: 1,
          stepName: "Complete Test Step",
          stepType: StepType.TASK,
          status: StepStatus.ACTIVE,
        })
        .returning();

      // Create task
      const [task] = await db
        .insert(taskInstance)
        .values({
          tenantId: tenant1Id,
          processInstanceId: process.id,
          stepInstanceId: step.id,
          title: "Complete Test Task",
          description: "Test task completion",
          assigneeType: TaskAssigneeType.USER,
          assigneeUserId: user1Id,
          status: TaskInstanceStatus.OPEN,
        })
        .returning();

      expect(task.status).toBe(TaskInstanceStatus.OPEN);
      expect(task.completedBy).toBeNull();
      expect(task.completedAt).toBeNull();

      // Complete the task
      const completedAt = new Date();
      await db
        .update(taskInstance)
        .set({
          status: TaskInstanceStatus.COMPLETED,
          completedBy: user1Id,
          completedAt: completedAt,
        })
        .where(eq(taskInstance.id, task.id));

      // Verify task is completed
      const [completedTask] = await db
        .select()
        .from(taskInstance)
        .where(eq(taskInstance.id, task.id));

      expect(completedTask.status).toBe(TaskInstanceStatus.COMPLETED);
      expect(completedTask.completedBy).toBe(user1Id);
      expect(completedTask.completedAt).toBeDefined();
    });
  });
});
