/**
 * Comment Query API Route
 * Story: 2.2.8 - Workflow Execution Engine
 * 
 * GET /api/workflows/comments/step/:stepInstanceId
 * 
 * Returns all comments for a workflow step with user information
 */

import { Elysia, t } from "elysia";
import { db } from "../../../lib/db";
import { commentThread, users } from "@supplex/db";
import { eq, and } from "drizzle-orm";
import { authenticate } from "../../../lib/rbac/middleware";
import { verifyStepProcessAccess } from "../../../lib/rbac/entity-authorization";
import { ApiError, Errors } from "../../../lib/errors";

export const getCommentsByStepRoute = new Elysia()
  .use(authenticate)
  .get(
    "/comments/step/:stepInstanceId",
    async ({ params, user, requestLogger }: any) => {
      const { stepInstanceId } = params;

      if (!user?.id || !user?.tenantId) {
        throw Errors.unauthorized("Unauthorized");
      }

      const access = await verifyStepProcessAccess(user, stepInstanceId, db);
      if (!access.allowed) {
        throw Errors.forbidden("Access denied");
      }

      try {
        // Query comments with user information
        const comments = await db
          .select({
            comment: commentThread,
            user: {
              id: users.id,
              fullName: users.fullName,
              email: users.email,
            },
          })
          .from(commentThread)
          .leftJoin(users, eq(commentThread.commentedBy, users.id))
          .where(
            and(
              eq(commentThread.stepInstanceId, stepInstanceId),
              eq(commentThread.tenantId, user.tenantId)
            )
          )
          .orderBy(commentThread.createdAt);

        // Transform to include user data
        const threaded = comments.map((c) => ({
          ...c.comment,
          commentedByUser: c.user,
        }));

        return {
          success: true,
          data: threaded,
        };
      } catch (error) {
        if (error instanceof ApiError) throw error;
        requestLogger.error({ err: error }, "error fetching comments");
        throw Errors.internal("Failed to fetch comments");
      }
    },
    {
      params: t.Object({
        stepInstanceId: t.String({ format: "uuid" }),
      }),
      detail: {
        summary: "Get Step Comments",
        description:
          "Returns all comments for a step including user information",
        tags: ["Workflows", "Comments"],
      },
    }
  );

