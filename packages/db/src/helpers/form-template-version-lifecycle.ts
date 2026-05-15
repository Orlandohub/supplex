import { eq, and, isNull, isNotNull, asc, desc, inArray } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "../schema";
import {
  formTemplate,
  formTemplateVersion,
  formSection,
  formField,
  FormTemplateStatus,
} from "../schema";
import { FormTemplateVersionStatus } from "../schema/form-template-version";
import { getDraftFormTemplateVersionForTemplate } from "./form-template-version";
import {
  insertFormTemplateAuditEvent,
  snapshotRow,
  FormTemplateAuditEventType,
  FormTemplateAuditSubject,
} from "./form-template-audit-event";

type DbLike = PostgresJsDatabase<typeof schema>;

/** Thrown when code attempts to mutate rows tied to a non-draft (immutable) version. */
export class ImmutableFormTemplateStructureError extends Error {
  readonly code = "IMMUTABLE_FORM_TEMPLATE_VERSION" as const;
  constructor() {
    super(
      "Cannot modify structure for a published or superseded form template version"
    );
    this.name = "ImmutableFormTemplateStructureError";
  }
}

export async function assertFormTemplateVersionIsDraftStructure(
  db: DbLike,
  params: { formTemplateVersionId: string; tenantId: string }
): Promise<void> {
  const [row] = await db
    .select({
      versionNumber: formTemplateVersion.versionNumber,
    })
    .from(formTemplateVersion)
    .where(
      and(
        eq(formTemplateVersion.id, params.formTemplateVersionId),
        eq(formTemplateVersion.tenantId, params.tenantId),
        isNull(formTemplateVersion.deletedAt)
      )
    )
    .limit(1);

  if (!row || row.versionNumber !== null) {
    throw new ImmutableFormTemplateStructureError();
  }
}

/**
 * Current published head (exactly one row with status `published` per container after SUP-26 publish).
 */
export async function getPublishedHeadFormTemplateVersion(
  db: DbLike,
  params: { formTemplateId: string; tenantId: string }
) {
  const [row] = await db
    .select()
    .from(formTemplateVersion)
    .where(
      and(
        eq(formTemplateVersion.formTemplateId, params.formTemplateId),
        eq(formTemplateVersion.tenantId, params.tenantId),
        eq(formTemplateVersion.status, FormTemplateVersionStatus.PUBLISHED),
        isNull(formTemplateVersion.deletedAt)
      )
    )
    .orderBy(desc(formTemplateVersion.versionNumber))
    .limit(1);

  return row ?? null;
}

/**
 * Latest immutable row (highest version_number) — useful when the container is archived
 * and all rows are superseded.
 */
export async function getLatestImmutableFormTemplateVersion(
  db: DbLike,
  params: { formTemplateId: string; tenantId: string }
) {
  const [row] = await db
    .select()
    .from(formTemplateVersion)
    .where(
      and(
        eq(formTemplateVersion.formTemplateId, params.formTemplateId),
        eq(formTemplateVersion.tenantId, params.tenantId),
        isNotNull(formTemplateVersion.versionNumber),
        isNull(formTemplateVersion.deletedAt)
      )
    )
    .orderBy(desc(formTemplateVersion.versionNumber))
    .limit(1);

  return row ?? null;
}

/** Version whose structure non-admin readers and workflow fills should use for a published container. */
export async function resolveStructureVersionIdForPublishedContainer(
  db: DbLike,
  params: { formTemplateId: string; tenantId: string }
): Promise<string> {
  const head = await getPublishedHeadFormTemplateVersion(db, params);
  if (head) return head.id;

  const [template] = await db
    .select({ status: formTemplate.status })
    .from(formTemplate)
    .where(
      and(
        eq(formTemplate.id, params.formTemplateId),
        eq(formTemplate.tenantId, params.tenantId),
        isNull(formTemplate.deletedAt)
      )
    )
    .limit(1);

  if (template?.status === FormTemplateStatus.ARCHIVED) {
    const latest = await getLatestImmutableFormTemplateVersion(db, params);
    if (latest) return latest.id;
  }

  throw new Error(
    `No published form_template_version for template ${params.formTemplateId}`
  );
}

export type PublishFormTemplateFromDraftResult = {
  publishedVersionId: string;
  draftVersionId: string;
  publishedVersionNumber: number;
  supersededVersionId: string | null;
  replacedDraftVersionId: string;
  publishAuditEventId: string;
};

/**
 * Deep-copy draft → new immutable published row (new subtree UUIDs), supersede previous
 * published head, delete draft + subtree, then create a fresh draft copied from the new
 * published snapshot (new subtree UUIDs). Sets container status to `published`.
 *
 * SUP-27: Per-row audit events are emitted for every draft section/field row removed
 * during teardown, followed by a `version_published` summary event so the changelog
 * captures both the granular before-snapshots and the lifecycle transition.
 */
export async function publishFormTemplateFromDraft(
  tx: DbLike,
  params: {
    formTemplateId: string;
    tenantId: string;
    actorUserId: string;
  }
): Promise<PublishFormTemplateFromDraftResult> {
  const { formTemplateId, tenantId, actorUserId } = params;

  const [template] = await tx
    .select()
    .from(formTemplate)
    .where(
      and(
        eq(formTemplate.id, formTemplateId),
        eq(formTemplate.tenantId, tenantId),
        isNull(formTemplate.deletedAt)
      )
    )
    .limit(1);

  if (!template) {
    throw new Error("FORM_TEMPLATE_NOT_FOUND");
  }

  const draft = await getDraftFormTemplateVersionForTemplate(tx, {
    formTemplateId,
    tenantId,
  });

  if (!draft) {
    throw new Error("FORM_TEMPLATE_DRAFT_VERSION_MISSING");
  }

  const draftSections = await tx
    .select()
    .from(formSection)
    .where(
      and(
        eq(formSection.formTemplateId, formTemplateId),
        eq(formSection.formTemplateVersionId, draft.id),
        eq(formSection.tenantId, tenantId),
        isNull(formSection.deletedAt)
      )
    )
    .orderBy(asc(formSection.sectionOrder));

  if (draftSections.length === 0) {
    throw new Error("FORM_TEMPLATE_PUBLISH_NO_SECTIONS");
  }

  const draftSectionIds = draftSections.map((s) => s.id);
  const draftFieldsAll =
    draftSectionIds.length > 0
      ? await tx
          .select()
          .from(formField)
          .where(
            and(
              eq(formField.formTemplateVersionId, draft.id),
              eq(formField.tenantId, tenantId),
              inArray(formField.formSectionId, draftSectionIds),
              isNull(formField.deletedAt)
            )
          )
      : [];

  const fieldsBySection = new Map<string, typeof draftFieldsAll>();
  for (const sid of draftSectionIds) {
    fieldsBySection.set(sid, []);
  }
  for (const f of draftFieldsAll) {
    const list = fieldsBySection.get(f.formSectionId);
    if (list) list.push(f);
  }
  for (const sid of draftSectionIds) {
    const list = fieldsBySection.get(sid);
    if (list) {
      list.sort((a, b) => a.fieldOrder - b.fieldOrder);
    }
  }

  let hasField = false;
  for (const s of draftSections) {
    if ((fieldsBySection.get(s.id)?.length ?? 0) > 0) {
      hasField = true;
      break;
    }
  }
  if (!hasField) {
    throw new Error("FORM_TEMPLATE_PUBLISH_NO_FIELDS");
  }

  const oldHead = await getPublishedHeadFormTemplateVersion(tx, {
    formTemplateId,
    tenantId,
  });

  const nextNum = oldHead ? (oldHead.versionNumber ?? 0) + 1 : 1;

  const now = new Date();

  const [pubVer] = await tx
    .insert(formTemplateVersion)
    .values({
      formTemplateId,
      tenantId,
      versionNumber: nextNum,
      status: FormTemplateVersionStatus.PUBLISHED,
      basedOnVersionId: draft.id,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (!pubVer) {
    throw new Error("FORM_TEMPLATE_PUBLISH_VERSION_INSERT_FAILED");
  }

  const sectionIdMap = new Map<string, string>();

  for (const sec of draftSections) {
    const [newSection] = await tx
      .insert(formSection)
      .values({
        formTemplateId,
        formTemplateVersionId: pubVer.id,
        tenantId,
        sectionOrder: sec.sectionOrder,
        sectionKey: sec.sectionKey,
        slugManuallyEdited: sec.slugManuallyEdited,
        title: sec.title,
        description: sec.description,
        metadata: sec.metadata,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (!newSection) {
      throw new Error("FORM_TEMPLATE_PUBLISH_SECTION_INSERT_FAILED");
    }
    sectionIdMap.set(sec.id, newSection.id);
  }

  for (const sec of draftSections) {
    const newSid = sectionIdMap.get(sec.id);
    if (!newSid) continue;
    const fields = fieldsBySection.get(sec.id) ?? [];
    if (fields.length === 0) continue;

    await tx.insert(formField).values(
      fields.map((field) => ({
        formSectionId: newSid,
        formTemplateVersionId: pubVer.id,
        tenantId,
        fieldOrder: field.fieldOrder,
        fieldKey: field.fieldKey,
        slugManuallyEdited: field.slugManuallyEdited,
        fieldType: field.fieldType,
        label: field.label,
        placeholder: field.placeholder,
        required: field.required,
        validationRules: field.validationRules,
        options: field.options,
        createdAt: now,
        updatedAt: now,
      }))
    );
  }

  if (oldHead) {
    await tx
      .update(formTemplateVersion)
      .set({
        status: FormTemplateVersionStatus.SUPERSEDED,
        updatedAt: now,
      })
      .where(eq(formTemplateVersion.id, oldHead.id));
  }

  // SUP-27: Audit + hard-delete each draft field, then each draft section, before
  // removing the draft version row itself. Iterating the rows we already loaded
  // keeps ordering stable and lets cascade serve only as a safety net.
  for (const sec of draftSections) {
    const fields = fieldsBySection.get(sec.id) ?? [];
    for (const field of fields) {
      await insertFormTemplateAuditEvent(tx, {
        tenantId,
        formTemplateId,
        formTemplateVersionId: draft.id,
        actorUserId,
        eventType: FormTemplateAuditEventType.FIELD_HARD_DELETED,
        subjectType: FormTemplateAuditSubject.FIELD,
        subjectId: field.id,
        before: snapshotRow(field),
        summary: `Field "${field.label}" removed when draft was replaced on publish`,
      });
      await tx.delete(formField).where(eq(formField.id, field.id));
    }
  }

  for (const sec of draftSections) {
    await insertFormTemplateAuditEvent(tx, {
      tenantId,
      formTemplateId,
      formTemplateVersionId: draft.id,
      actorUserId,
      eventType: FormTemplateAuditEventType.SECTION_HARD_DELETED,
      subjectType: FormTemplateAuditSubject.SECTION,
      subjectId: sec.id,
      before: snapshotRow(sec),
      summary: `Section "${sec.title}" removed when draft was replaced on publish`,
    });
    await tx.delete(formSection).where(eq(formSection.id, sec.id));
  }

  await insertFormTemplateAuditEvent(tx, {
    tenantId,
    formTemplateId,
    formTemplateVersionId: draft.id,
    actorUserId,
    eventType: FormTemplateAuditEventType.DRAFT_SUBTREE_REPLACED_ON_PUBLISH,
    subjectType: FormTemplateAuditSubject.VERSION,
    subjectId: draft.id,
    before: snapshotRow(draft),
    metadata: {
      publishedVersionId: pubVer.id,
      publishedVersionNumber: nextNum,
    },
    summary: `Draft version replaced on publish (v${nextNum})`,
  });

  await tx
    .delete(formTemplateVersion)
    .where(eq(formTemplateVersion.id, draft.id));

  const [newDraft] = await tx
    .insert(formTemplateVersion)
    .values({
      formTemplateId,
      tenantId,
      versionNumber: null,
      status: FormTemplateVersionStatus.DRAFT,
      basedOnVersionId: pubVer.id,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (!newDraft) {
    throw new Error("FORM_TEMPLATE_PUBLISH_DRAFT_INSERT_FAILED");
  }

  const publishedSections = await tx
    .select()
    .from(formSection)
    .where(
      and(
        eq(formSection.formTemplateId, formTemplateId),
        eq(formSection.formTemplateVersionId, pubVer.id),
        eq(formSection.tenantId, tenantId),
        isNull(formSection.deletedAt)
      )
    )
    .orderBy(asc(formSection.sectionOrder));

  const pubSectionIds = publishedSections.map((s) => s.id);
  const publishedFieldsAll =
    pubSectionIds.length > 0
      ? await tx
          .select()
          .from(formField)
          .where(
            and(
              eq(formField.formTemplateVersionId, pubVer.id),
              eq(formField.tenantId, tenantId),
              inArray(formField.formSectionId, pubSectionIds),
              isNull(formField.deletedAt)
            )
          )
      : [];

  const pubFieldsBySection = new Map<string, typeof publishedFieldsAll>();
  for (const sid of pubSectionIds) {
    pubFieldsBySection.set(sid, []);
  }
  for (const f of publishedFieldsAll) {
    const list = pubFieldsBySection.get(f.formSectionId);
    if (list) list.push(f);
  }
  for (const sid of pubSectionIds) {
    const list = pubFieldsBySection.get(sid);
    if (list) {
      list.sort((a, b) => a.fieldOrder - b.fieldOrder);
    }
  }

  const pubSectionIdMap = new Map<string, string>();

  for (const sec of publishedSections) {
    const [newSection] = await tx
      .insert(formSection)
      .values({
        formTemplateId,
        formTemplateVersionId: newDraft.id,
        tenantId,
        sectionOrder: sec.sectionOrder,
        sectionKey: sec.sectionKey,
        slugManuallyEdited: sec.slugManuallyEdited,
        title: sec.title,
        description: sec.description,
        metadata: sec.metadata,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (!newSection) {
      throw new Error("FORM_TEMPLATE_PUBLISH_DRAFT_SECTION_INSERT_FAILED");
    }
    pubSectionIdMap.set(sec.id, newSection.id);
  }

  for (const sec of publishedSections) {
    const newSid = pubSectionIdMap.get(sec.id);
    if (!newSid) continue;
    const fields = pubFieldsBySection.get(sec.id) ?? [];
    if (fields.length === 0) continue;

    await tx.insert(formField).values(
      fields.map((field) => ({
        formSectionId: newSid,
        formTemplateVersionId: newDraft.id,
        tenantId,
        fieldOrder: field.fieldOrder,
        fieldKey: field.fieldKey,
        slugManuallyEdited: field.slugManuallyEdited,
        fieldType: field.fieldType,
        label: field.label,
        placeholder: field.placeholder,
        required: field.required,
        validationRules: field.validationRules,
        options: field.options,
        createdAt: now,
        updatedAt: now,
      }))
    );
  }

  await tx
    .update(formTemplate)
    .set({
      status: FormTemplateStatus.PUBLISHED,
      updatedAt: now,
    })
    .where(eq(formTemplate.id, formTemplateId));

  const publishAudit = await insertFormTemplateAuditEvent(tx, {
    tenantId,
    formTemplateId,
    formTemplateVersionId: pubVer.id,
    actorUserId,
    eventType: FormTemplateAuditEventType.VERSION_PUBLISHED,
    subjectType: FormTemplateAuditSubject.VERSION,
    subjectId: pubVer.id,
    after: snapshotRow(pubVer),
    metadata: {
      publishedVersionId: pubVer.id,
      publishedVersionNumber: nextNum,
      newDraftVersionId: newDraft.id,
      replacedDraftVersionId: draft.id,
      supersededVersionId: oldHead?.id ?? null,
    },
    summary: `Form template version v${nextNum} published`,
  });

  return {
    publishedVersionId: pubVer.id,
    draftVersionId: newDraft.id,
    publishedVersionNumber: nextNum,
    supersededVersionId: oldHead?.id ?? null,
    replacedDraftVersionId: draft.id,
    publishAuditEventId: publishAudit.id,
  };
}

/**
 * Runtime structure resolution for submissions and published fills.
 * Published/archived containers use the immutable published head; draft-only work uses the draft row.
 */
export async function resolveFormTemplateVersionIdForStructure(
  db: DbLike,
  params: { formTemplateId: string; tenantId: string }
): Promise<string> {
  const [template] = await db
    .select({ status: formTemplate.status })
    .from(formTemplate)
    .where(
      and(
        eq(formTemplate.id, params.formTemplateId),
        eq(formTemplate.tenantId, params.tenantId),
        isNull(formTemplate.deletedAt)
      )
    )
    .limit(1);

  if (!template) {
    throw new Error(`Form template not found: ${params.formTemplateId}`);
  }

  if (
    template.status === FormTemplateStatus.PUBLISHED ||
    template.status === FormTemplateStatus.ARCHIVED
  ) {
    return resolveStructureVersionIdForPublishedContainer(db, params);
  }

  const draft = await getDraftFormTemplateVersionForTemplate(db, params);
  if (draft) return draft.id;

  const latest = await getLatestImmutableFormTemplateVersion(db, params);
  if (latest) return latest.id;

  throw new Error(
    `No form_template_version row for template ${params.formTemplateId}`
  );
}

/** Pick the version row to deep-copy when duplicating a template container. */
export async function resolveSourceFormTemplateVersionIdForCopy(
  db: DbLike,
  params: {
    formTemplateId: string;
    tenantId: string;
    templateStatus: (typeof FormTemplateStatus)[keyof typeof FormTemplateStatus];
  }
): Promise<string> {
  if (params.templateStatus === FormTemplateStatus.DRAFT) {
    const draft = await getDraftFormTemplateVersionForTemplate(db, params);
    if (draft) return draft.id;
  } else {
    const published = await getPublishedHeadFormTemplateVersion(db, params);
    if (published) return published.id;
  }

  const latest = await getLatestImmutableFormTemplateVersion(db, params);
  if (!latest) {
    throw new Error(
      `No form_template_version to copy for template ${params.formTemplateId}`
    );
  }
  return latest.id;
}
