import { eq, and, isNull, asc } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "../schema";
import {
  formField,
  formSection,
  formTemplateVersion,
  type SelectFormField,
  type SelectFormSection,
} from "../schema";
import {
  insertFormTemplateAuditEvent,
  snapshotRow,
  FormTemplateAuditEventType,
  FormTemplateAuditSubject,
} from "./form-template-audit-event";
import { ImmutableFormTemplateStructureError } from "./form-template-version-lifecycle";

type DbLike = PostgresJsDatabase<typeof schema>;

/** Thrown when a draft hard-delete cannot find its target row inside the tenant. */
export class FormTemplateRowNotFoundError extends Error {
  readonly code = "FORM_TEMPLATE_ROW_NOT_FOUND" as const;
  constructor(subject: "field" | "section", id: string) {
    super(`Form template ${subject} not found: ${id}`);
    this.name = "FormTemplateRowNotFoundError";
  }
}

type FieldRowWithVersion = {
  field: SelectFormField;
  formTemplateId: string;
  versionNumber: number | null;
};

type SectionRowWithVersion = {
  section: SelectFormSection;
  versionNumber: number | null;
  formTemplateId: string;
};

async function loadDraftField(
  tx: DbLike,
  params: { tenantId: string; fieldId: string }
): Promise<FieldRowWithVersion> {
  const [row] = await tx
    .select({
      field: formField,
      formTemplateId: formTemplateVersion.formTemplateId,
      versionNumber: formTemplateVersion.versionNumber,
    })
    .from(formField)
    .innerJoin(formSection, eq(formField.formSectionId, formSection.id))
    .innerJoin(
      formTemplateVersion,
      and(
        eq(formField.formTemplateVersionId, formTemplateVersion.id),
        eq(formTemplateVersion.tenantId, params.tenantId)
      )
    )
    .where(
      and(
        eq(formField.id, params.fieldId),
        eq(formField.tenantId, params.tenantId),
        isNull(formField.deletedAt)
      )
    )
    .limit(1);

  if (!row) {
    throw new FormTemplateRowNotFoundError("field", params.fieldId);
  }

  if (row.versionNumber !== null) {
    throw new ImmutableFormTemplateStructureError();
  }

  return row;
}

async function loadDraftSection(
  tx: DbLike,
  params: { tenantId: string; sectionId: string }
): Promise<SectionRowWithVersion> {
  const [row] = await tx
    .select({
      section: formSection,
      versionNumber: formTemplateVersion.versionNumber,
      formTemplateId: formTemplateVersion.formTemplateId,
    })
    .from(formSection)
    .innerJoin(
      formTemplateVersion,
      and(
        eq(formSection.formTemplateVersionId, formTemplateVersion.id),
        eq(formTemplateVersion.tenantId, params.tenantId)
      )
    )
    .where(
      and(
        eq(formSection.id, params.sectionId),
        eq(formSection.tenantId, params.tenantId),
        isNull(formSection.deletedAt)
      )
    )
    .limit(1);

  if (!row) {
    throw new FormTemplateRowNotFoundError("section", params.sectionId);
  }

  if (row.versionNumber !== null) {
    throw new ImmutableFormTemplateStructureError();
  }

  return row;
}

/**
 * Hard delete a draft form_field row inside a transaction, persisting a
 * complete `before` snapshot to form_template_audit_event first so that the
 * audit trail and the delete commit atomically.
 *
 * Caller must already hold a database transaction; the helper does not open one.
 */
export async function hardDeleteDraftFormField(
  tx: DbLike,
  params: { tenantId: string; fieldId: string; actorUserId: string }
): Promise<{ fieldId: string; auditEventId: string }> {
  const loaded = await loadDraftField(tx, params);

  const audit = await insertFormTemplateAuditEvent(tx, {
    tenantId: params.tenantId,
    formTemplateId: loaded.formTemplateId,
    formTemplateVersionId: loaded.field.formTemplateVersionId,
    actorUserId: params.actorUserId,
    eventType: FormTemplateAuditEventType.FIELD_HARD_DELETED,
    subjectType: FormTemplateAuditSubject.FIELD,
    subjectId: loaded.field.id,
    before: snapshotRow(loaded.field),
    summary: `Field "${loaded.field.label}" deleted from draft`,
  });

  await tx.delete(formField).where(eq(formField.id, loaded.field.id));

  return { fieldId: loaded.field.id, auditEventId: audit.id };
}

/**
 * Hard delete a draft form_section row (and its remaining draft fields) inside
 * a transaction, emitting one audit event per field followed by one for the
 * section itself. Soft-deleted children are left untouched.
 */
export async function hardDeleteDraftFormSection(
  tx: DbLike,
  params: { tenantId: string; sectionId: string; actorUserId: string }
): Promise<{
  sectionId: string;
  fieldAuditEventIds: string[];
  sectionAuditEventId: string;
}> {
  const loaded = await loadDraftSection(tx, params);

  const fields = await tx
    .select()
    .from(formField)
    .where(
      and(
        eq(formField.formSectionId, loaded.section.id),
        eq(formField.tenantId, params.tenantId),
        isNull(formField.deletedAt)
      )
    )
    .orderBy(asc(formField.fieldOrder));

  const fieldAuditEventIds: string[] = [];
  for (const field of fields) {
    const audit = await insertFormTemplateAuditEvent(tx, {
      tenantId: params.tenantId,
      formTemplateId: loaded.formTemplateId,
      formTemplateVersionId: field.formTemplateVersionId,
      actorUserId: params.actorUserId,
      eventType: FormTemplateAuditEventType.FIELD_HARD_DELETED,
      subjectType: FormTemplateAuditSubject.FIELD,
      subjectId: field.id,
      before: snapshotRow(field),
      summary: `Field "${field.label}" deleted via parent section`,
    });
    await tx.delete(formField).where(eq(formField.id, field.id));
    fieldAuditEventIds.push(audit.id);
  }

  const sectionAudit = await insertFormTemplateAuditEvent(tx, {
    tenantId: params.tenantId,
    formTemplateId: loaded.formTemplateId,
    formTemplateVersionId: loaded.section.formTemplateVersionId,
    actorUserId: params.actorUserId,
    eventType: FormTemplateAuditEventType.SECTION_HARD_DELETED,
    subjectType: FormTemplateAuditSubject.SECTION,
    subjectId: loaded.section.id,
    before: snapshotRow(loaded.section),
    summary: `Section "${loaded.section.title}" deleted from draft`,
  });

  await tx.delete(formSection).where(eq(formSection.id, loaded.section.id));

  return {
    sectionId: loaded.section.id,
    fieldAuditEventIds,
    sectionAuditEventId: sectionAudit.id,
  };
}
