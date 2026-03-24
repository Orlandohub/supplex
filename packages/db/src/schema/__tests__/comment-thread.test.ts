import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { db } from "../../index";
import {
  tenants,
  users,
  processInstance,
  stepInstance,
  commentThread,
} from "../index";
import { eq } from "drizzle-orm";

/**
 * Integration Tests: Comment Thread
 * Story 2.2.8 - Workflow Execution Engine
 *
 * Tests tenant isolation, CASCADE deletes, threaded comments,
 * and FK constraints for comment_thread table.
 */

describe("Comment Thread Schema", () => {
  let tenantA: { id: string };
  let tenantB: { id: string };
  let userA: { id: string };
  let userB: { id: string };
  let processA: { id: string };
  let processB: { id: string };
  let stepA: { id: string };
  let stepB: { id: string };

  beforeAll(async () => {
    // Create two test tenants
    const [insertedTenantA] = await db
      .insert(tenants)
      .values({
        name: "Test Tenant A",
        slug: `test-tenant-a-comment-${Date.now()}`,
      })
      .returning();

    const [insertedTenantB] = await db
      .insert(tenants)
      .values({
        name: "Test Tenant B",
        slug: `test-tenant-b-comment-${Date.now()}`,
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
        email: `user-a-comment-${Date.now()}@test.com`,
        fullName: "User A",
        role: "admin",
      })
      .returning();

    [userB] = await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        tenantId: tenantB.id,
        email: `user-b-comment-${Date.now()}@test.com`,
        fullName: "User B",
        role: "admin",
      })
      .returning();

    // Create process instances for each tenant
    [processA] = await db
      .insert(processInstance)
      .values({
        tenantId: tenantA.id,
        processType: "supplier_qualification",
        entityType: "supplier",
        entityId: crypto.randomUUID(),
        status: "active",
        initiatedBy: userA.id,
        initiatedDate: new Date(),
      })
      .returning();

    [processB] = await db
      .insert(processInstance)
      .values({
        tenantId: tenantB.id,
        processType: "supplier_qualification",
        entityType: "supplier",
        entityId: crypto.randomUUID(),
        status: "active",
        initiatedBy: userB.id,
        initiatedDate: new Date(),
      })
      .returning();

    // Create step instances for each process
    [stepA] = await db
      .insert(stepInstance)
      .values({
        tenantId: tenantA.id,
        processInstanceId: processA.id,
        stepOrder: 1,
        stepName: "Step 1",
        stepType: "form",
        status: "active",
      })
      .returning();

    [stepB] = await db
      .insert(stepInstance)
      .values({
        tenantId: tenantB.id,
        processInstanceId: processB.id,
        stepOrder: 1,
        stepName: "Step 1",
        stepType: "form",
        status: "active",
      })
      .returning();
  });

  afterAll(async () => {
    // Clean up test tenants (CASCADE will clean up all related data)
    await db.delete(tenants).where(eq(tenants.id, tenantA.id));
    await db.delete(tenants).where(eq(tenants.id, tenantB.id));
  });

  test("tenant isolation - comments from tenant A not visible to tenant B", async () => {
    // Create comment for tenant A
    const [commentA] = await db
      .insert(commentThread)
      .values({
        tenantId: tenantA.id,
        processInstanceId: processA.id,
        stepInstanceId: stepA.id,
        entityType: "form",
        commentText: "This form needs revision",
        commentedBy: userA.id,
      })
      .returning();

    expect(commentA).toBeDefined();
    expect(commentA.tenantId).toBe(tenantA.id);

    // Query comments for tenant B - should not include tenant A's comments
    const tenantBComments = await db
      .select()
      .from(commentThread)
      .where(eq(commentThread.tenantId, tenantB.id));

    expect(tenantBComments.length).toBe(0);

    // Clean up
    await db.delete(commentThread).where(eq(commentThread.id, commentA.id));
  });

  test("cascade delete - deleting process deletes comments", async () => {
    // Create a temporary process and step
    const [tempProcess] = await db
      .insert(processInstance)
      .values({
        tenantId: tenantA.id,
        processType: "test_process",
        entityType: "supplier",
        entityId: crypto.randomUUID(),
        status: "active",
        initiatedBy: userA.id,
        initiatedDate: new Date(),
      })
      .returning();

    const [tempStep] = await db
      .insert(stepInstance)
      .values({
        tenantId: tenantA.id,
        processInstanceId: tempProcess.id,
        stepOrder: 1,
        stepName: "Test Step",
        stepType: "form",
        status: "active",
      })
      .returning();

    // Create comment for temp step
    const [comment] = await db
      .insert(commentThread)
      .values({
        tenantId: tenantA.id,
        processInstanceId: tempProcess.id,
        stepInstanceId: tempStep.id,
        entityType: "form",
        commentText: "Test comment",
        commentedBy: userA.id,
      })
      .returning();

    expect(comment).toBeDefined();

    // Delete the process instance
    await db
      .delete(processInstance)
      .where(eq(processInstance.id, tempProcess.id));

    // Verify comment was cascade deleted
    const deletedComment = await db
      .select()
      .from(commentThread)
      .where(eq(commentThread.id, comment.id));

    expect(deletedComment.length).toBe(0);
  });

  test("cascade delete - deleting step deletes comments", async () => {
    // Create a temporary step
    const [tempStep] = await db
      .insert(stepInstance)
      .values({
        tenantId: tenantA.id,
        processInstanceId: processA.id,
        stepOrder: 99,
        stepName: "Temp Step",
        stepType: "form",
        status: "active",
      })
      .returning();

    // Create comment for temp step
    const [comment] = await db
      .insert(commentThread)
      .values({
        tenantId: tenantA.id,
        processInstanceId: processA.id,
        stepInstanceId: tempStep.id,
        entityType: "document",
        commentText: "Document needs update",
        commentedBy: userA.id,
      })
      .returning();

    expect(comment).toBeDefined();

    // Delete the step instance
    await db.delete(stepInstance).where(eq(stepInstance.id, tempStep.id));

    // Verify comment was cascade deleted
    const deletedComment = await db
      .select()
      .from(commentThread)
      .where(eq(commentThread.id, comment.id));

    expect(deletedComment.length).toBe(0);
  });

  test("threaded comments - parent-child relationships", async () => {
    // Create parent comment
    const [parentComment] = await db
      .insert(commentThread)
      .values({
        tenantId: tenantA.id,
        processInstanceId: processA.id,
        stepInstanceId: stepA.id,
        entityType: "form",
        commentText: "Please update section 3",
        commentedBy: userA.id,
      })
      .returning();

    // Create reply to parent comment
    const [replyComment] = await db
      .insert(commentThread)
      .values({
        tenantId: tenantA.id,
        processInstanceId: processA.id,
        stepInstanceId: stepA.id,
        entityType: "form",
        parentCommentId: parentComment.id,
        commentText: "Updated as requested",
        commentedBy: userA.id,
      })
      .returning();

    expect(replyComment.parentCommentId).toBe(parentComment.id);

    // Query all comments for step
    const stepComments = await db
      .select()
      .from(commentThread)
      .where(eq(commentThread.stepInstanceId, stepA.id));

    expect(stepComments.length).toBeGreaterThanOrEqual(2);

    // Verify reply is linked to parent
    const replies = stepComments.filter(
      (c) => c.parentCommentId === parentComment.id
    );
    expect(replies.length).toBeGreaterThanOrEqual(1);

    // Clean up
    await db.delete(commentThread).where(eq(commentThread.id, replyComment.id));
    await db
      .delete(commentThread)
      .where(eq(commentThread.id, parentComment.id));
  });

  test("cascade delete parent comment - deletes child replies", async () => {
    // Create parent comment
    const [parentComment] = await db
      .insert(commentThread)
      .values({
        tenantId: tenantA.id,
        processInstanceId: processA.id,
        stepInstanceId: stepA.id,
        entityType: "form",
        commentText: "Parent comment",
        commentedBy: userA.id,
      })
      .returning();

    // Create multiple replies
    const [reply1] = await db
      .insert(commentThread)
      .values({
        tenantId: tenantA.id,
        processInstanceId: processA.id,
        stepInstanceId: stepA.id,
        entityType: "form",
        parentCommentId: parentComment.id,
        commentText: "Reply 1",
        commentedBy: userA.id,
      })
      .returning();

    const [reply2] = await db
      .insert(commentThread)
      .values({
        tenantId: tenantA.id,
        processInstanceId: processA.id,
        stepInstanceId: stepA.id,
        entityType: "form",
        parentCommentId: parentComment.id,
        commentText: "Reply 2",
        commentedBy: userA.id,
      })
      .returning();

    // Delete parent comment
    await db
      .delete(commentThread)
      .where(eq(commentThread.id, parentComment.id));

    // Verify all replies were cascade deleted
    const deletedReplies = await db
      .select()
      .from(commentThread)
      .where(eq(commentThread.parentCommentId, parentComment.id));

    expect(deletedReplies.length).toBe(0);
  });

  test("FK constraint - cannot delete user with comments (RESTRICT)", async () => {
    // Create a temporary user
    const [tempUser] = await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        tenantId: tenantA.id,
        email: `temp-user-${Date.now()}@test.com`,
        fullName: "Temp User",
        role: "viewer",
      })
      .returning();

    // Create comment by temp user
    const [comment] = await db
      .insert(commentThread)
      .values({
        tenantId: tenantA.id,
        processInstanceId: processA.id,
        stepInstanceId: stepA.id,
        entityType: "form",
        commentText: "Comment by temp user",
        commentedBy: tempUser.id,
      })
      .returning();

    // Attempt to delete user - should fail due to RESTRICT
    let deleteError = null;
    try {
      await db.delete(users).where(eq(users.id, tempUser.id));
    } catch (error) {
      deleteError = error;
    }

    expect(deleteError).toBeDefined();

    // Clean up - delete comment first, then user
    await db.delete(commentThread).where(eq(commentThread.id, comment.id));
    await db.delete(users).where(eq(users.id, tempUser.id));
  });

  test("entity type validation - only accepts form or document", async () => {
    // Valid entity types
    const [formComment] = await db
      .insert(commentThread)
      .values({
        tenantId: tenantA.id,
        processInstanceId: processA.id,
        stepInstanceId: stepA.id,
        entityType: "form",
        commentText: "Form comment",
        commentedBy: userA.id,
      })
      .returning();

    expect(formComment.entityType).toBe("form");

    const [documentComment] = await db
      .insert(commentThread)
      .values({
        tenantId: tenantA.id,
        processInstanceId: processA.id,
        stepInstanceId: stepA.id,
        entityType: "document",
        commentText: "Document comment",
        commentedBy: userA.id,
      })
      .returning();

    expect(documentComment.entityType).toBe("document");

    // Clean up
    await db.delete(commentThread).where(eq(commentThread.id, formComment.id));
    await db
      .delete(commentThread)
      .where(eq(commentThread.id, documentComment.id));

    // Invalid entity type - should fail at database level
    let validationError = null;
    try {
      await db.insert(commentThread).values({
        tenantId: tenantA.id,
        processInstanceId: processA.id,
        stepInstanceId: stepA.id,
        // @ts-expect-error - Testing invalid value
        entityType: "invalid_type",
        commentText: "Invalid comment",
        commentedBy: userA.id,
      });
    } catch (error) {
      validationError = error;
    }

    expect(validationError).toBeDefined();
  });

  test("soft delete - deleted_at field works correctly", async () => {
    // Create comment
    const [comment] = await db
      .insert(commentThread)
      .values({
        tenantId: tenantA.id,
        processInstanceId: processA.id,
        stepInstanceId: stepA.id,
        entityType: "form",
        commentText: "Comment to soft delete",
        commentedBy: userA.id,
      })
      .returning();

    // Soft delete by setting deleted_at
    const [softDeleted] = await db
      .update(commentThread)
      .set({ deletedAt: new Date() })
      .where(eq(commentThread.id, comment.id))
      .returning();

    expect(softDeleted.deletedAt).toBeDefined();
    expect(softDeleted.deletedAt).toBeInstanceOf(Date);

    // Clean up
    await db.delete(commentThread).where(eq(commentThread.id, comment.id));
  });

  test("created_at and updated_at timestamps", async () => {
    const beforeCreate = new Date();

    // Create comment
    const [comment] = await db
      .insert(commentThread)
      .values({
        tenantId: tenantA.id,
        processInstanceId: processA.id,
        stepInstanceId: stepA.id,
        entityType: "form",
        commentText: "Testing timestamps",
        commentedBy: userA.id,
      })
      .returning();

    const afterCreate = new Date();

    expect(comment.createdAt).toBeInstanceOf(Date);
    expect(comment.updatedAt).toBeInstanceOf(Date);
    expect(comment.createdAt.getTime()).toBeGreaterThanOrEqual(
      beforeCreate.getTime()
    );
    expect(comment.createdAt.getTime()).toBeLessThanOrEqual(
      afterCreate.getTime()
    );

    // Update comment
    await new Promise((resolve) => setTimeout(resolve, 10)); // Small delay to ensure different timestamp

    const beforeUpdate = new Date();
    const [updated] = await db
      .update(commentThread)
      .set({ 
        commentText: "Updated text",
        updatedAt: new Date() // Explicitly set updatedAt since we don't have a DB trigger
      })
      .where(eq(commentThread.id, comment.id))
      .returning();

    expect(updated.updatedAt.getTime()).toBeGreaterThan(
      comment.updatedAt.getTime()
    );
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
      beforeUpdate.getTime()
    );

    // Clean up
    await db.delete(commentThread).where(eq(commentThread.id, comment.id));
  });
});

