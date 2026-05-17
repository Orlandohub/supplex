import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { formTemplate, formTemplateAuditEvent, users } from "@supplex/db";
import type {
  FormTemplateAuditEventListItem,
  FormTemplateAuditEventTypeWire,
  FormTemplateAuditSubjectWire,
} from "@supplex/types";
import {
  eq,
  and,
  isNull,
  desc,
  lt,
  or,
  type SQL,
  ne,
  not,
  inArray,
  sql,
} from "drizzle-orm";
import { requireAdmin } from "../../lib/rbac/middleware";
import { authenticatedRoute } from "../../lib/route-plugins";
import { ApiError, Errors } from "../../lib/errors";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * Cursor is `<createdAtIso>|<id>` (opaque to clients). We could base64 it,
 * but keeping it readable matches the audit-log style elsewhere in the
 * repo and keeps logging straightforward.
 */
function encodeCursor(createdAt: Date, id: string): string {
  return `${createdAt.toISOString()}|${id}`;
}

function decodeCursor(
  cursor: string | undefined
): { createdAt: Date; id: string } | null {
  if (!cursor) return null;
  const idx = cursor.indexOf("|");
  if (idx <= 0) return null;
  const iso = cursor.slice(0, idx);
  const id = cursor.slice(idx + 1);
  const createdAt = new Date(iso);
  if (Number.isNaN(createdAt.getTime()) || id.length === 0) return null;
  return { createdAt, id };
}

/**
 * GET /api/form-templates/:id/audit-events
 * SUP-32: paginated form_template_audit_event timeline for the admin Changelog tab.
 *
 * Tenant: filters by `user.tenantId`. Returns 404 for cross-tenant ids
 * (consistent with sibling routes).
 * Auth: Admin only.
 *
 * Pagination: keyset over `(created_at DESC, id DESC)`. The cursor encodes
 * the createdAt+id of the last row returned; subsequent calls return rows
 * strictly older than that anchor. `limit` caps at MAX_LIMIT so a single
 * call cannot pull arbitrarily large audit history.
 *
 * Projection drops bulk `before` / `after` snapshots and free-form
 * `metadata`. The changelog UI renders `summary` + `eventType`; deep
 * snapshots can be added behind a per-event GET later if needed.
 *
 * System / publish-internals rows are omitted so the timeline reflects
 * meaningful admin actions: `draft_subtree_replaced_on_publish`, and legacy
 * publish-teardown `field_hard_deleted` / `section_hard_deleted` rows whose
 * summary mentions "replaced on publish".
 */
export const auditEventsRoute = new Elysia()
  .use(authenticatedRoute)
  .use(requireAdmin)
  .get(
    "/:id/audit-events",
    async ({ params, query, user, requestLogger }) => {
      try {
        const tenantId = user.tenantId;
        const templateId = params.id;

        const [template] = await db
          .select({ id: formTemplate.id })
          .from(formTemplate)
          .where(
            and(
              eq(formTemplate.id, templateId),
              eq(formTemplate.tenantId, tenantId),
              isNull(formTemplate.deletedAt)
            )
          )
          .limit(1);

        if (!template) {
          throw Errors.notFound(
            "Form template not found or you don't have access to it",
            "TEMPLATE_NOT_FOUND"
          );
        }

        const limitRaw = query.limit ?? DEFAULT_LIMIT;
        const limit = Math.min(Math.max(1, limitRaw), MAX_LIMIT);
        const cursor = decodeCursor(query.cursor);

        const cursorClause = cursor
          ? or(
              lt(formTemplateAuditEvent.createdAt, cursor.createdAt),
              and(
                eq(formTemplateAuditEvent.createdAt, cursor.createdAt),
                lt(formTemplateAuditEvent.id, cursor.id)
              )
            )
          : undefined;

        const baseConditions: Array<SQL | undefined> = [
          eq(formTemplateAuditEvent.tenantId, tenantId),
          eq(formTemplateAuditEvent.formTemplateId, templateId),
          cursorClause,
          ne(
            formTemplateAuditEvent.eventType,
            "draft_subtree_replaced_on_publish"
          ),
          or(
            not(
              inArray(formTemplateAuditEvent.eventType, [
                "field_hard_deleted",
                "section_hard_deleted",
              ])
            ),
            sql`COALESCE(${formTemplateAuditEvent.summary}, '') NOT ILIKE ${"%replaced on publish%"}`
          ),
        ];

        const whereClause = and(
          ...baseConditions.filter((c): c is SQL => c !== undefined)
        );

        // Fetch limit+1 so we know whether another page exists without a count(*).
        const rows = await db
          .select({
            id: formTemplateAuditEvent.id,
            eventType: formTemplateAuditEvent.eventType,
            subjectType: formTemplateAuditEvent.subjectType,
            subjectId: formTemplateAuditEvent.subjectId,
            formTemplateVersionId: formTemplateAuditEvent.formTemplateVersionId,
            summary: formTemplateAuditEvent.summary,
            createdAt: formTemplateAuditEvent.createdAt,
            actorId: users.id,
            actorEmail: users.email,
            actorFullName: users.fullName,
          })
          .from(formTemplateAuditEvent)
          .leftJoin(users, eq(formTemplateAuditEvent.actorUserId, users.id))
          .where(whereClause)
          .orderBy(
            desc(formTemplateAuditEvent.createdAt),
            desc(formTemplateAuditEvent.id)
          )
          .limit(limit + 1);

        const hasMore = rows.length > limit;
        const page = hasMore ? rows.slice(0, limit) : rows;

        const events: FormTemplateAuditEventListItem[] = page.map((r) => ({
          id: r.id,
          eventType: r.eventType as FormTemplateAuditEventTypeWire,
          subjectType: r.subjectType as FormTemplateAuditSubjectWire,
          subjectId: r.subjectId,
          formTemplateVersionId: r.formTemplateVersionId,
          summary: r.summary,
          createdAt: r.createdAt.toISOString(),
          actor:
            r.actorId && r.actorEmail && r.actorFullName
              ? {
                  id: r.actorId,
                  email: r.actorEmail,
                  fullName: r.actorFullName,
                }
              : null,
        }));

        const lastRow = hasMore ? page[page.length - 1] : null;
        const nextCursor = lastRow
          ? encodeCursor(lastRow.createdAt, lastRow.id)
          : null;

        return {
          success: true,
          data: { events, nextCursor },
        };
      } catch (error: unknown) {
        if (error instanceof ApiError) throw error;
        requestLogger.error(
          { err: error },
          "Error listing form template audit events"
        );
        throw Errors.internal("Failed to list form template audit events");
      }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      query: t.Object({
        limit: t.Optional(
          t.Number({ minimum: 1, maximum: MAX_LIMIT, default: DEFAULT_LIMIT })
        ),
        cursor: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
      }),
      detail: {
        summary: "List form template audit events",
        description:
          "Paginated changelog timeline for a form template. Keyset-paginated by created_at DESC, id DESC. Admin only.",
        tags: ["Form Templates"],
      },
    }
  );
