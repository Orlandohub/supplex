/**
 * Comment Creation API Route
 * Story: 2.2.8 - Workflow Execution Engine
 * 
 * POST /api/workflows/comments
 * 
 * Creates a new comment or reply in a workflow step
 */

import { Elysia, t } from "elysia";
import { db } from "../../../lib/db";
import { commentThread, stepInstance, processInstance } from "@supplex/db";
import { eq, and } from "drizzle-orm";
import { authenticate } from "../../../lib/rbac/middleware";

export const createCommentRoute = new Elysia()
  .use(authenticate)
  .post(
    "/comments",
    async ({ body, user }) => {
      const {
        processInstanceId,
        stepInstanceId,
        entityType,
        parentCommentId,
        commentText,
      } = body;

      if (!user?.id || !user?.tenantId) {
        return {
          success: false,
          error: "Unauthorized",
        };
      }

      try {
        // Verify user has access to this process (tenant filter)
        const [process] = await db
          .select()
          .from(processInstance)
          .where(
            and(
              eq(processInstance.id, processInstanceId),
              eq(processInstance.tenantId, user.tenantId)
            )
          );

        if (!process) {
          return {
            success: false,
            error: "Process not found or access denied",
          };
        }

        // Verify step exists
        const [step] = await db
          .select()
          .from(stepInstance)
          .where(
            and(
              eq(stepInstance.id, stepInstanceId),
              eq(stepInstance.tenantId, user.tenantId)
            )
          );

        if (!step) {
          return {
            success: false,
            error: "Step not found or access denied",
          };
        }

        // Create comment
        const [comment] = await db
          .insert(commentThread)
          .values({
            tenantId: user.tenantId,
            processInstanceId,
            stepInstanceId,
            entityType,
            parentCommentId: parentCommentId || null,
            commentText,
            commentedBy: user.id,
          })
          .returning();

        return {
          success: true,
          data: comment,
        };
      } catch (error) {
        console.error("Error creating comment:", error);
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to create comment",
        };
      }
    },
    {
      body: t.Object({
        processInstanceId: t.String({ format: "uuid" }),
        stepInstanceId: t.String({ format: "uuid" }),
        entityType: t.Union([t.Literal("form"), t.Literal("document")]),
        parentCommentId: t.Optional(t.String({ format: "uuid" })),
        commentText: t.String({ minLength: 1 }),
      }),
      detail: {
        summary: "Create Comment",
        description: "Creates a comment or reply on a workflow step",
        tags: ["Workflows", "Comments"],
      },
    }
  );

