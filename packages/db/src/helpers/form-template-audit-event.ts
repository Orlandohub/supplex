import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "../schema";
import {
  formTemplateAuditEvent,
  FormTemplateAuditEventType,
  FormTemplateAuditSubject,
  type FormTemplateAuditEventTypeValue,
  type FormTemplateAuditSubjectValue,
  type SelectFormTemplateAuditEvent,
} from "../schema/form-template-audit-event";

type DbLike = PostgresJsDatabase<typeof schema>;

/**
 * JSON-safe shape produced when serializing a Drizzle row for storage in
 * `form_template_audit_event.before` / `.after`. Dates are converted to ISO
 * strings so the snapshot survives JSONB round-tripping with stable ordering.
 */
export type AuditableRowSnapshot = Record<
  string,
  string | number | boolean | null | Record<string, unknown> | Array<unknown>
>;

export type FormTemplateAuditEventInput = {
  tenantId: string;
  formTemplateId: string;
  formTemplateVersionId?: string | null;
  actorUserId: string;
  eventType: FormTemplateAuditEventTypeValue;
  subjectType: FormTemplateAuditSubjectValue;
  subjectId?: string | null;
  before?: AuditableRowSnapshot | null;
  after?: AuditableRowSnapshot | null;
  metadata?: Record<string, unknown>;
  summary?: string | null;
};

/**
 * Insert one form_template_audit_event row inside the caller's transaction.
 *
 * Callers are expected to have already validated draft / immutable invariants
 * and loaded any `before` snapshot from the row about to be modified or deleted.
 * Returns the inserted event row so callers can assert ordering in tests.
 */
export async function insertFormTemplateAuditEvent(
  tx: DbLike,
  input: FormTemplateAuditEventInput
): Promise<SelectFormTemplateAuditEvent> {
  const [row] = await tx
    .insert(formTemplateAuditEvent)
    .values({
      tenantId: input.tenantId,
      formTemplateId: input.formTemplateId,
      formTemplateVersionId: input.formTemplateVersionId ?? null,
      actorUserId: input.actorUserId,
      eventType: input.eventType,
      subjectType: input.subjectType,
      subjectId: input.subjectId ?? null,
      before: input.before ?? null,
      after: input.after ?? null,
      metadata: input.metadata ?? {},
      summary: input.summary ?? null,
    })
    .returning();

  if (!row) {
    throw new Error("Failed to insert form_template_audit_event");
  }

  return row;
}

/**
 * Convert a Drizzle row (with Date objects) into a JSON-safe snapshot suitable
 * for the `before` / `after` JSONB columns. Dates become ISO strings; all other
 * primitives, plain objects, and arrays pass through unchanged.
 */
export function snapshotRow(
  row: Record<string, unknown>
): AuditableRowSnapshot {
  const out: AuditableRowSnapshot = {};
  for (const [key, value] of Object.entries(row)) {
    if (value instanceof Date) {
      out[key] = value.toISOString();
    } else if (value === undefined) {
      out[key] = null;
    } else {
      out[key] = value as AuditableRowSnapshot[string];
    }
  }
  return out;
}

/**
 * Compare two snapshots and return true if any of the tracked keys differ.
 * Used by route handlers to skip noise events when an update PATCH resolved
 * to a no-op against the persisted columns.
 */
export function snapshotsDifferOnTrackedKeys(
  before: AuditableRowSnapshot,
  after: AuditableRowSnapshot,
  keys: ReadonlyArray<string>
): boolean {
  for (const key of keys) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      return true;
    }
  }
  return false;
}

export {
  FormTemplateAuditEventType,
  FormTemplateAuditSubject,
  type FormTemplateAuditEventTypeValue,
  type FormTemplateAuditSubjectValue,
};
