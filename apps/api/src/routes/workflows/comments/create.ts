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
import { authenticatedRoute } from "../../../lib/route-plugins";
import { verifyProcessAccess } from "../../../lib/rbac/entity-authorization";
import { ApiError, Errors } from "../../../lib/errors";

export const createCommentRoute = new Elysia().use(authenticatedRoute).post(
  "/comments",
  async ({ body, user, requestLogger }) => {
    const {
      processInstanceId,
      stepInstanceId,
      entityType,
      parentCommentId,
      commentText,
    } = body;

    if (!user?.id || !user?.tenantId) {
      throw Errors.unauthorized("Unauthorized");
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
        throw Errors.notFound("Process not found or access denied");
      }

      const access = await verifyProcessAccess(user, process, db);
      if (!access.allowed) {
        throw Errors.forbidden("Access denied");
      }

      // Verify step exists and belongs to the specified process
      const [step] = await db
        .select()
        .from(stepInstance)
        .where(
          and(
            eq(stepInstance.id, stepInstanceId),
            eq(stepInstance.tenantId, user.tenantId),
            eq(stepInstance.processInstanceId, processInstanceId)
          )
        );

      if (!step) {
        throw Errors.notFound("Step not found or access denied");
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
      if (error instanceof ApiError) throw error;
      requestLogger.error({ err: error }, "error creating comment");
      throw Errors.internal("Failed to create comment");
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
