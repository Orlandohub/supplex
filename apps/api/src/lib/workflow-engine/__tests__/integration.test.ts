/**
 * Workflow Engine Integration Tests
 * Story: 2.2.8 - Workflow Execution Engine
 * 
 * Tests complete workflow lifecycle from instantiation to completion
 */

import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { db } from "../../db";
import {
  tenants,
  users,
  processInstance,
  stepInstance,
  taskInstance,
  commentThread,
  workflowTemplate,
  workflowTemplateVersion,
  workflowStepTemplate,
} from "@supplex/db";
import { eq } from "drizzle-orm";
import { instantiateWorkflow } from "../instantiate-workflow";
import { completeStep } from "../complete-step";
import { createTasksForStep } from "../create-tasks-for-step";

let TEST_TENANT_ID: string;
let TEST_USER_ID: string;
let TEST_TEMPLATE_ID: string;
let TEST_VERSION_ID: string;

beforeAll(async () => {
  // Create test tenant
  const [tenant] = await db
    .insert(tenants)
    .values({
      name: "Test Tenant Integration",
      slug: `test-tenant-integration-${Date.now()}`,
    })
    .returning();
  TEST_TENANT_ID = tenant.id;

  // Create test user
  [{ id: TEST_USER_ID }] = await db
    .insert(users)
    .values({
      id: crypto.randomUUID(),
      tenantId: TEST_TENANT_ID,
      email: `user-integration-${Date.now()}@test.com`,
      fullName: "Test User",
      role: "admin",
    })
    .returning();

  // Create test template
  const [template] = await db
    .insert(workflowTemplate)
    .values({
      tenantId: TEST_TENANT_ID,
      name: "Integration Test Template",
      description: "Template for integration testing",
      processType: "supplier_qualification",
      entityType: "supplier",
      createdBy: TEST_USER_ID,
    })
    .returning();
  TEST_TEMPLATE_ID = template.id;

  // Create test version
  const [version] = await db
    .insert(workflowTemplateVersion)
    .values({
      tenantId: TEST_TENANT_ID,
      workflowTemplateVersionId: TEST_VERSION_ID,
      versionNumber: 1,
      isActive: true,
      createdBy: TEST_USER_ID,
    })
    .returning();
  TEST_VERSION_ID = version.id;

  // Create test steps
  await db.insert(workflowStepTemplate).values([
    {
      tenantId: TEST_TENANT_ID,
      workflowTemplateVersionId: TEST_VERSION_ID,
      stepOrder: 1,
      stepName: "Initial Review",
      stepType: "review",
      isOptional: false,
      requiredApprovals: 1,
      assignmentConfig: {
        type: "role",
        role: "reviewer",
      },
    },
    {
      tenantId: TEST_TENANT_ID,
      workflowTemplateVersionId: TEST_VERSION_ID,
      stepOrder: 2,
      stepName: "Manager Approval",
      stepType: "approval",
      isOptional: false,
      requiredApprovals: 1,
      assignmentConfig: {
        type: "role",
        role: "manager",
      },
    },
    {
      tenantId: TEST_TENANT_ID,
      workflowTemplateVersionId: TEST_VERSION_ID,
      stepOrder: 3,
      stepName: "Final Documentation",
      stepType: "data_entry",
      isOptional: false,
      requiredApprovals: 1,
      assignmentConfig: {
        type: "user",
        userId: TEST_USER_ID,
      },
    },
  ]);
});

afterAll(async () => {
  // Clean up test data
  await db
    .delete(commentThread)
    .where(eq(commentThread.tenantId, TEST_TENANT_ID));
  await db
    .delete(taskInstance)
    .where(eq(taskInstance.tenantId, TEST_TENANT_ID));
  await db
    .delete(stepInstance)
    .where(eq(stepInstance.tenantId, TEST_TENANT_ID));
  await db
    .delete(processInstance)
    .where(eq(processInstance.tenantId, TEST_TENANT_ID));
  await db
    .delete(workflowStepTemplate)
    .where(eq(workflowStepTemplate.tenantId, TEST_TENANT_ID));
  await db
    .delete(workflowTemplateVersion)
    .where(eq(workflowTemplateVersion.tenantId, TEST_TENANT_ID));
  await db
    .delete(workflowTemplate)
    .where(eq(workflowTemplate.tenantId, TEST_TENANT_ID));
  await db.delete(users).where(eq(users.tenantId, TEST_TENANT_ID));
  await db.delete(tenants).where(eq(tenants.id, TEST_TENANT_ID));
});

describe("Workflow Engine Integration Tests", () => {
  test("Complete workflow lifecycle - instantiation to completion", async () => {
    // Step 1: Instantiate workflow
    const instantiateResult = await instantiateWorkflow(db, {
      tenantId: TEST_TENANT_ID,
      workflowTemplateVersionId: TEST_VERSION_ID,
      entityType: "supplier",
      entityId: "supplier-123",
      initiatedBy: TEST_USER_ID,
      metadata: {
        supplierName: "Test Supplier",
      },
    });

    expect(instantiateResult.success).toBe(true);
    expect(instantiateResult.data).toBeDefined();

    const processId = instantiateResult.data!.processInstance.id;

    // Verify process instance was created
    const [process] = await db
      .select()
      .from(processInstance)
      .where(eq(processInstance.id, processId));

    expect(process).toBeDefined();
    expect(process.status).toBe("active");
    expect(process.entityType).toBe("supplier");
    expect(process.entityId).toBe("supplier-123");

    // Verify all steps were created
    const steps = await db
      .select()
      .from(stepInstance)
      .where(eq(stepInstance.processInstanceId, processId))
      .orderBy(stepInstance.stepOrder);

    expect(steps).toHaveLength(3);
    expect(steps[0].status).toBe("active");
    expect(steps[1].status).toBe("blocked");
    expect(steps[2].status).toBe("blocked");

    // Step 2: Create tasks for first step
    const step1 = steps[0];
    const tasksResult = await createTasksForStep(db, {
      tenantId: TEST_TENANT_ID,
      processInstanceId: processId,
      stepInstanceId: step1.id,
      assignmentConfig: {
        type: "role",
        role: "reviewer",
      },
      taskTitle: "Review supplier documentation",
      taskDescription: "Complete the initial review",
    });

    expect(tasksResult.success).toBe(true);
    expect(tasksResult.data).toBeDefined();

    // Verify tasks were created
    const tasks = await db
      .select()
      .from(taskInstance)
      .where(eq(taskInstance.stepInstanceId, step1.id));

    expect(tasks).toHaveLength(1);
    expect(tasks[0].status).toBe("pending");
    expect(tasks[0].assigneeRole).toBe("reviewer");

    // Step 3: Complete first step
    const completeStep1Result = await completeStep(db, {
      tenantId: TEST_TENANT_ID,
      stepInstanceId: step1.id,
      completedBy: TEST_USER_ID,
      outcome: "approved",
      comments: "Review completed successfully",
    });

    expect(completeStep1Result.success).toBe(true);

    // Verify first step is completed and second step is active
    const updatedSteps = await db
      .select()
      .from(stepInstance)
      .where(eq(stepInstance.processInstanceId, processId))
      .orderBy(stepInstance.stepOrder);

    expect(updatedSteps[0].status).toBe("completed");
    expect(updatedSteps[1].status).toBe("active");
    expect(updatedSteps[2].status).toBe("blocked");

    // Step 4: Complete second step
    const step2 = updatedSteps[1];
    const completeStep2Result = await completeStep(db, {
      tenantId: TEST_TENANT_ID,
      stepInstanceId: step2.id,
      completedBy: TEST_USER_ID,
      outcome: "approved",
      comments: "Manager approval granted",
    });

    expect(completeStep2Result.success).toBe(true);

    // Verify second step is completed and third step is active
    const finalSteps = await db
      .select()
      .from(stepInstance)
      .where(eq(stepInstance.processInstanceId, processId))
      .orderBy(stepInstance.stepOrder);

    expect(finalSteps[0].status).toBe("completed");
    expect(finalSteps[1].status).toBe("completed");
    expect(finalSteps[2].status).toBe("active");

    // Step 5: Complete final step
    const step3 = finalSteps[2];
    const completeStep3Result = await completeStep(db, {
      tenantId: TEST_TENANT_ID,
      stepInstanceId: step3.id,
      completedBy: TEST_USER_ID,
      outcome: "completed",
      comments: "Documentation finalized",
    });

    expect(completeStep3Result.success).toBe(true);

    // Verify workflow is completed
    const [finalProcess] = await db
      .select()
      .from(processInstance)
      .where(eq(processInstance.id, processId));

    expect(finalProcess.status).toBe("completed");
    expect(finalProcess.completedDate).toBeDefined();

    const allFinalSteps = await db
      .select()
      .from(stepInstance)
      .where(eq(stepInstance.processInstanceId, processId));

    expect(allFinalSteps.every((s) => s.status === "completed")).toBe(true);
  }, 30000); // 30 second timeout for integration test

  test("Workflow with declined step", async () => {
    // Instantiate workflow
    const instantiateResult = await instantiateWorkflow(db, {
      tenantId: TEST_TENANT_ID,
      workflowTemplateVersionId: TEST_VERSION_ID,
      entityType: "supplier",
      entityId: "supplier-456",
      initiatedBy: TEST_USER_ID,
      metadata: {},
    });

    expect(instantiateResult.success).toBe(true);
    const processId = instantiateResult.data!.processInstance.id;

    // Get first step
    const [step1] = await db
      .select()
      .from(stepInstance)
      .where(eq(stepInstance.processInstanceId, processId))
      .orderBy(stepInstance.stepOrder)
      .limit(1);

    // Decline first step
    const declineResult = await completeStep(db, {
      tenantId: TEST_TENANT_ID,
      stepInstanceId: step1.id,
      completedBy: TEST_USER_ID,
      outcome: "declined",
      comments: "Documentation incomplete",
    });

    expect(declineResult.success).toBe(true);

    // Verify step is declined and process is cancelled
    const [updatedStep] = await db
      .select()
      .from(stepInstance)
      .where(eq(stepInstance.id, step1.id));

    expect(updatedStep.status).toBe("declined");

    const [updatedProcess] = await db
      .select()
      .from(processInstance)
      .where(eq(processInstance.id, processId));

    expect(updatedProcess.status).toBe("cancelled");
  });

  test("Task assignment and completion", async () => {
    // Instantiate workflow
    const instantiateResult = await instantiateWorkflow(db, {
      tenantId: TEST_TENANT_ID,
      workflowTemplateVersionId: TEST_VERSION_ID,
      entityType: "supplier",
      entityId: "supplier-789",
      initiatedBy: TEST_USER_ID,
      metadata: {},
    });

    const processId = instantiateResult.data!.processInstance.id;

    // Get active step
    const [activeStep] = await db
      .select()
      .from(stepInstance)
      .where(eq(stepInstance.processInstanceId, processId))
      .orderBy(stepInstance.stepOrder)
      .limit(1);

    // Create multiple tasks
    await createTasksForStep(db, {
      tenantId: TEST_TENANT_ID,
      processInstanceId: processId,
      stepInstanceId: activeStep.id,
      assignmentConfig: { type: "role", role: "reviewer" },
      taskTitle: "Task 1",
      taskDescription: "First task",
    });

    await createTasksForStep(db, {
      tenantId: TEST_TENANT_ID,
      processInstanceId: processId,
      stepInstanceId: activeStep.id,
      assignmentConfig: { type: "user", userId: TEST_USER_ID },
      taskTitle: "Task 2",
      taskDescription: "Second task",
    });

    // Verify tasks were created
    const tasks = await db
      .select()
      .from(taskInstance)
      .where(eq(taskInstance.stepInstanceId, activeStep.id));

    expect(tasks).toHaveLength(2);
    expect(tasks[0].assigneeType).toBe("role");
    expect(tasks[1].assigneeType).toBe("user");
  });

  test("Comment thread functionality", async () => {
    // Instantiate workflow
    const instantiateResult = await instantiateWorkflow(db, {
      tenantId: TEST_TENANT_ID,
      workflowTemplateVersionId: TEST_VERSION_ID,
      entityType: "supplier",
      entityId: "supplier-comment",
      initiatedBy: TEST_USER_ID,
      metadata: {},
    });

    const processId = instantiateResult.data!.processInstance.id;

    // Add comment to process
    const [comment1] = await db
      .insert(commentThread)
      .values({
        tenantId: TEST_TENANT_ID,
        processInstanceId: processId,
        stepInstanceId: null,
        entityType: "process_instance",
        commentText: "This is a process-level comment",
        commentedBy: TEST_USER_ID,
      })
      .returning();

    expect(comment1).toBeDefined();
    expect(comment1.commentText).toBe("This is a process-level comment");

    // Get step and add comment
    const [step] = await db
      .select()
      .from(stepInstance)
      .where(eq(stepInstance.processInstanceId, processId))
      .limit(1);

    const [comment2] = await db
      .insert(commentThread)
      .values({
        tenantId: TEST_TENANT_ID,
        processInstanceId: processId,
        stepInstanceId: step.id,
        entityType: "step_instance",
        commentText: "This is a step-level comment",
        commentedBy: TEST_USER_ID,
      })
      .returning();

    expect(comment2).toBeDefined();
    expect(comment2.stepInstanceId).toBe(step.id);

    // Verify comments can be queried
    const allComments = await db
      .select()
      .from(commentThread)
      .where(eq(commentThread.processInstanceId, processId));

    expect(allComments).toHaveLength(2);
  });

  test("Error handling - invalid step completion", async () => {
    // Instantiate workflow
    const instantiateResult = await instantiateWorkflow(db, {
      tenantId: TEST_TENANT_ID,
      workflowTemplateVersionId: TEST_VERSION_ID,
      entityType: "supplier",
      entityId: "supplier-error",
      initiatedBy: TEST_USER_ID,
      metadata: {},
    });

    const processId = instantiateResult.data!.processInstance.id;

    // Get blocked step (should not be completable)
    const steps = await db
      .select()
      .from(stepInstance)
      .where(eq(stepInstance.processInstanceId, processId))
      .orderBy(stepInstance.stepOrder);

    const blockedStep = steps[1]; // Second step should be blocked

    // Try to complete blocked step
    const result = await completeStep(db, {
      tenantId: TEST_TENANT_ID,
      stepInstanceId: blockedStep.id,
      completedBy: TEST_USER_ID,
      outcome: "approved",
      comments: "Should fail",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("not in active state");
  });
});

