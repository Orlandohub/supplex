/**
 * Process Events API Route
 * Story: 2.2.12 - Immutable Audit Event Log
 *
 * GET /api/workflows/processes/:processInstanceId/events
 *
 * Returns the immutable event log for a workflow process, ordered chronologically.
 * No joins needed — all display data is denormalized in the event row.
 */

import { Elysia, t } from "elysia";
import { db } from "../../../lib/db";
import { workflowEvent } from "@supplex/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { authenticate } from "../../../lib/rbac/middleware";

export const getProcessEventsRoute = new Elysia()
  .use(authenticate)
  .get(
    "/processes/:processInstanceId/events",
    async ({ params, query, user }) => {
      const { processInstanceId } = params;
      const limit = Math.min(Number(query.limit) || 100, 500);
      const offset = Number(query.offset) || 0;

      if (!user?.id || !user?.tenantId) {
        return { success: false, error: "Unauthorized" };
      }

      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(workflowEvent)
        .where(
          and(
            eq(workflowEvent.tenantId, user.tenantId),
            eq(workflowEvent.processInstanceId, processInstanceId)
          )
        );

      const events = await db
        .select({
          id: workflowEvent.id,
          processInstanceId: workflowEvent.processInstanceId,
          stepInstanceId: workflowEvent.stepInstanceId,
          taskInstanceId: workflowEvent.taskInstanceId,
          eventType: workflowEvent.eventType,
          eventDescription: workflowEvent.eventDescription,
          actorUserId: workflowEvent.actorUserId,
          actorName: workflowEvent.actorName,
          actorRole: workflowEvent.actorRole,
          entityType: workflowEvent.entityType,
          entityId: workflowEvent.entityId,
          comment: workflowEvent.comment,
          metadata: workflowEvent.metadata,
          createdAt: workflowEvent.createdAt,
        })
        .from(workflowEvent)
        .where(
          and(
            eq(workflowEvent.tenantId, user.tenantId),
            eq(workflowEvent.processInstanceId, processInstanceId)
          )
        )
        .orderBy(desc(workflowEvent.createdAt))
        .limit(limit)
        .offset(offset);

      return {
        success: true,
        data: {
          events,
          total: countResult?.count ?? 0,
        },
      };
    },
    {
      params: t.Object({
        processInstanceId: t.String({ format: "uuid" }),
      }),
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
      }),
      detail: {
        summary: "Get Process Events",
        description:
          "Returns the immutable event log for a workflow process, ordered chronologically",
        tags: ["Workflows"],
      },
    }
  );
