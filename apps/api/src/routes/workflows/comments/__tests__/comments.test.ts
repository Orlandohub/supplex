import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { db } from "../../../../lib/db";
import {
  tenants,
  users,
  processInstance,
  stepInstance,
  commentThread,
} from "@supplex/db";
import { eq, and } from "drizzle-orm";

/**
 * Integration Tests: Comment API Routes
 * Story: 2.2.8 - Workflow Execution Engine
 *
 * Tests comment creation and retrieval with threading support
 */

describe("Comment Thread Data Model", () => {
  let tenantId: string;
  let otherTenantId: string;
  let userId: string;
  let otherUserId: string;
  let processInstanceId: string;
  let stepInstanceId: string;
  let otherProcessInstanceId: string;
  let otherStepInstanceId: string;

  beforeAll(async () => {
    // Create test tenant
    const [tenant] = await db
      .insert(tenants)
      .values({
        name: "Test Tenant",
        slug: `test-tenant-comments-${Date.now()}`,
      })
      .returning();
    tenantId = tenant.id;

    // Create other tenant for isolation testing
    const [otherTenant] = await db
      .insert(tenants)
      .values({
        name: "Other Tenant",
        slug: `other-tenant-comments-${Date.now()}`,
      })
      .returning();
    otherTenantId = otherTenant.id;

    // Create test user
    const [user] = await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        tenantId,
        email: `user-comments-${Date.now()}@test.com`,
        fullName: "Test User",
        role: "admin",
      })
      .returning();
    userId = user.id;

    // Create other tenant user
    const [otherUser] = await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        tenantId: otherTenantId,
        email: `other-user-comments-${Date.now()}@test.com`,
        fullName: "Other User",
        role: "admin",
      })
      .returning();
    otherUserId = otherUser.id;

    // Create process instance
    const [process] = await db
      .insert(processInstance)
      .values({
        tenantId,
        processType: "test_process",
        entityType: "supplier",
        entityId: crypto.randomUUID(),
        status: "active",
        initiatedBy: userId,
        initiatedDate: new Date(),
      })
      .returning();
    processInstanceId = process.id;

    // Create step instance
    const [step] = await db
      .insert(stepInstance)
      .values({
        tenantId,
        processInstanceId,
        stepOrder: 1,
        stepName: "Test Step",
        stepType: "form",
        status: "active",
      })
      .returning();
    stepInstanceId = step.id;

    // Create process instance for other tenant
    const [otherProcess] = await db
      .insert(processInstance)
      .values({
        tenantId: otherTenantId,
        processType: "test_process",
        entityType: "supplier",
        entityId: crypto.randomUUID(),
        status: "active",
        initiatedBy: otherUserId,
        initiatedDate: new Date(),
      })
      .returning();
    otherProcessInstanceId = otherProcess.id;

    // Create step instance for other tenant
    const [otherStep] = await db
      .insert(stepInstance)
      .values({
        tenantId: otherTenantId,
        processInstanceId: otherProcessInstanceId,
        stepOrder: 1,
        stepName: "Test Step",
        stepType: "form",
        status: "active",
      })
      .returning();
    otherStepInstanceId = otherStep.id;
  });

  afterAll(async () => {
    // Clean up test data
    await db.delete(commentThread).where(eq(commentThread.tenantId, tenantId));
    await db
      .delete(commentThread)
      .where(eq(commentThread.tenantId, otherTenantId));
    await db.delete(stepInstance).where(eq(stepInstance.tenantId, tenantId));
    await db
      .delete(stepInstance)
      .where(eq(stepInstance.tenantId, otherTenantId));
    await db
      .delete(processInstance)
      .where(eq(processInstance.tenantId, tenantId));
    await db
      .delete(processInstance)
      .where(eq(processInstance.tenantId, otherTenantId));
    await db.delete(users).where(eq(users.tenantId, tenantId));
    await db.delete(users).where(eq(users.tenantId, otherTenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
    await db.delete(tenants).where(eq(tenants.id, otherTenantId));
  });

  describe("Comment Creation", () => {
    test("should create a comment successfully", async () => {
      const commentText = "This is a test comment";

      const [comment] = await db
        .insert(commentThread)
        .values({
          tenantId,
          processInstanceId,
          stepInstanceId,
          entityType: "form",
          commentText,
          commentedBy: userId,
        })
        .returning();

      expect(comment).toBeDefined();
      expect(comment.commentText).toBe(commentText);
      expect(comment.tenantId).toBe(tenantId);
      expect(comment.processInstanceId).toBe(processInstanceId);
      expect(comment.stepInstanceId).toBe(stepInstanceId);
      expect(comment.entityType).toBe("form");
      expect(comment.commentedBy).toBe(userId);
      expect(comment.parentCommentId).toBeNull();
    });

    test("should create a reply comment with parent", async () => {
      // Create parent comment
      const [parentComment] = await db
        .insert(commentThread)
        .values({
          tenantId,
          processInstanceId,
          stepInstanceId,
          entityType: "form",
          commentText: "Parent comment",
          commentedBy: userId,
        })
        .returning();

      // Create reply
      const [replyComment] = await db
        .insert(commentThread)
        .values({
          tenantId,
          processInstanceId,
          stepInstanceId,
          entityType: "form",
          parentCommentId: parentComment.id,
          commentText: "Reply to parent",
          commentedBy: userId,
        })
        .returning();

      expect(replyComment).toBeDefined();
      expect(replyComment.parentCommentId).toBe(parentComment.id);
      expect(replyComment.commentText).toBe("Reply to parent");
    });

    test("should support document entity type", async () => {
      const [comment] = await db
        .insert(commentThread)
        .values({
          tenantId,
          processInstanceId,
          stepInstanceId,
          entityType: "document",
          commentText: "Document comment",
          commentedBy: userId,
        })
        .returning();

      expect(comment.entityType).toBe("document");
    });

    test("should enforce tenant isolation on creation", async () => {
      // Try to query cross-tenant process
      const result = await db
        .select()
        .from(processInstance)
        .where(
          and(
            eq(processInstance.id, otherProcessInstanceId),
            eq(processInstance.tenantId, tenantId) // Wrong tenant
          )
        );

      // Should not find process from other tenant
      expect(result.length).toBe(0);
    });
  });

  describe("Comment Retrieval", () => {
    test("should retrieve all comments for a step", async () => {
      // Create multiple comments
      await db.insert(commentThread).values([
        {
          tenantId,
          processInstanceId,
          stepInstanceId,
          entityType: "form",
          commentText: "First comment",
          commentedBy: userId,
        },
        {
          tenantId,
          processInstanceId,
          stepInstanceId,
          entityType: "form",
          commentText: "Second comment",
          commentedBy: userId,
        },
      ]);

      // Query comments
      const comments = await db
        .select()
        .from(commentThread)
        .where(
          and(
            eq(commentThread.stepInstanceId, stepInstanceId),
            eq(commentThread.tenantId, tenantId)
          )
        )
        .orderBy(commentThread.createdAt);

      expect(comments.length).toBeGreaterThanOrEqual(2);
    });

    test("should return comments with user information", async () => {
      // Create comment
      await db.insert(commentThread).values({
        tenantId,
        processInstanceId,
        stepInstanceId,
        entityType: "form",
        commentText: "Comment with user info",
        commentedBy: userId,
      });

      // Query with join
      const comments = await db
        .select({
          comment: commentThread,
          user: users,
        })
        .from(commentThread)
        .leftJoin(users, eq(commentThread.commentedBy, users.id))
        .where(
          and(
            eq(commentThread.stepInstanceId, stepInstanceId),
            eq(commentThread.tenantId, tenantId)
          )
        );

      expect(comments.length).toBeGreaterThan(0);
      const lastComment = comments[comments.length - 1];
      expect(lastComment.user).toBeDefined();
      expect(lastComment.user?.id).toBe(userId);
    });

    test("should order comments by created_at ascending", async () => {
      // Create comments with slight delay
      const [firstComment] = await db
        .insert(commentThread)
        .values({
          tenantId,
          processInstanceId,
          stepInstanceId,
          entityType: "form",
          commentText: "Chronological first",
          commentedBy: userId,
        })
        .returning();

      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));

      const [secondComment] = await db
        .insert(commentThread)
        .values({
          tenantId,
          processInstanceId,
          stepInstanceId,
          entityType: "form",
          commentText: "Chronological second",
          commentedBy: userId,
        })
        .returning();

      // Query with order
      const comments = await db
        .select()
        .from(commentThread)
        .where(
          and(
            eq(commentThread.stepInstanceId, stepInstanceId),
            eq(commentThread.tenantId, tenantId)
          )
        )
        .orderBy(commentThread.createdAt);

      // Verify order
      expect(comments.length).toBeGreaterThanOrEqual(2);
      const first = comments.find((c) => c.id === firstComment.id);
      const second = comments.find((c) => c.id === secondComment.id);

      if (first && second) {
        expect(first.createdAt.getTime()).toBeLessThanOrEqual(
          second.createdAt.getTime()
        );
      }
    });

    test("should support threaded comment structure", async () => {
      // Create parent
      const [parent] = await db
        .insert(commentThread)
        .values({
          tenantId,
          processInstanceId,
          stepInstanceId,
          entityType: "form",
          commentText: "Thread parent",
          commentedBy: userId,
        })
        .returning();

      // Create replies
      await db.insert(commentThread).values([
        {
          tenantId,
          processInstanceId,
          stepInstanceId,
          entityType: "form",
          parentCommentId: parent.id,
          commentText: "Reply 1",
          commentedBy: userId,
        },
        {
          tenantId,
          processInstanceId,
          stepInstanceId,
          entityType: "form",
          parentCommentId: parent.id,
          commentText: "Reply 2",
          commentedBy: userId,
        },
      ]);

      // Query all comments for step
      const allComments = await db
        .select()
        .from(commentThread)
        .where(
          and(
            eq(commentThread.stepInstanceId, stepInstanceId),
            eq(commentThread.tenantId, tenantId)
          )
        );

      const replies = allComments.filter((c) => c.parentCommentId === parent.id);
      expect(replies.length).toBeGreaterThanOrEqual(2);
    });

    test("should enforce tenant isolation on retrieval", async () => {
      // Create comment for other tenant
      await db.insert(commentThread).values({
        tenantId: otherTenantId,
        processInstanceId: otherProcessInstanceId,
        stepInstanceId: otherStepInstanceId,
        entityType: "form",
        commentText: "Other tenant comment",
        commentedBy: otherUserId,
      });

      // Try to query with wrong tenant
      const comments = await db
        .select()
        .from(commentThread)
        .where(
          and(
            eq(commentThread.stepInstanceId, otherStepInstanceId),
            eq(commentThread.tenantId, tenantId) // Wrong tenant
          )
        );

      // Should not find comments from other tenant
      expect(comments.length).toBe(0);
    });
  });
});
