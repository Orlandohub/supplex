/**
 * Tenant-Wide Audit Log API Route
 * Story: 2.2.12 - Immutable Audit Event Log
 *
 * GET /api/workflows/audit-log
 *
 * Returns all workflow events for the tenant (admin-only).
 * Paginated, with filters for event type, date range, and actor search.
 */

import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { workflowEvent } from "@supplex/db";
import { eq, and, gte, lte, ilike, desc, sql } from "drizzle-orm";
import { requireAdmin } from "../../lib/rbac/middleware";

export const auditLogRoute = new Elysia().use(requireAdmin).get(
  "/audit-log",
  async ({ query, user }: any) => {
    const limit = Math.min(Number(query.limit) || 50, 200);
    const offset = Number(query.offset) || 0;

    const conditions = [eq(workflowEvent.tenantId, user.tenantId)];

    if (query.eventType) {
      conditions.push(eq(workflowEvent.eventType, query.eventType));
    }

    if (query.dateFrom) {
      conditions.push(gte(workflowEvent.createdAt, new Date(query.dateFrom)));
    }

    if (query.dateTo) {
      conditions.push(lte(workflowEvent.createdAt, new Date(query.dateTo)));
    }

    if (query.actor) {
      conditions.push(ilike(workflowEvent.actorName, `%${query.actor}%`));
    }

    const whereClause = and(...conditions);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(workflowEvent)
      .where(whereClause);

    const events = await db
      .select({
        id: workflowEvent.id,
        processInstanceId: workflowEvent.processInstanceId,
        stepInstanceId: workflowEvent.stepInstanceId,
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
      .where(whereClause)
      .orderBy(desc(workflowEvent.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      success: true,
      data: {
        events,
        total: countResult?.count ?? 0,
        limit,
        offset,
      },
    };
  },
  {
    query: t.Object({
      limit: t.Optional(t.String()),
      offset: t.Optional(t.String()),
      eventType: t.Optional(t.String()),
      dateFrom: t.Optional(t.String()),
      dateTo: t.Optional(t.String()),
      actor: t.Optional(t.String()),
    }),
    detail: {
      summary: "Tenant Audit Log",
      description:
        "Returns all workflow events for the tenant with filtering and pagination (Admin only)",
      tags: ["Workflows"],
    },
  }
);
