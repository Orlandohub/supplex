import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { eq, and, asc, isNull } from "drizzle-orm";
import {
  db,
  tenants,
  users,
  formTemplate,
  formSection,
  formField,
  formTemplateAuditEvent,
  FormTemplateStatus,
  FormTemplateAuditEventType,
  FormTemplateAuditSubject,
  FieldType,
  insertDraftFormTemplateVersion,
  publishFormTemplateFromDraft,
  hardDeleteDraftFormField,
  hardDeleteDraftFormSection,
  insertFormTemplateAuditEvent,
  snapshotRow,
  ImmutableFormTemplateStructureError,
} from "../../index";

/**
 * Integration: SUP-27 form template audit events.
 * Covers hard-delete `before` snapshots, publish-time per-row audits with summary,
 * transactional ordering (rollback drops the event), and update-diff guard.
 *
 * Requires migration 0043 + DATABASE_URL (same harness as form-template-version-lifecycle).
 */
describe("form template audit events (SUP-27)", () => {
  let tenantId: string;
  let actorUserId: string;

  beforeAll(async () => {
    const [t] = await db
      .insert(tenants)
      .values({
        name: "Audit Test Tenant",
        slug: `audit-tenant-${Date.now()}`,
      })
      .returning();
    if (!t) throw new Error("failed to insert tenant");
    tenantId = t.id;

    const [u] = await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        tenantId,
        email: `audit-${Date.now()}@test.com`,
        fullName: "Audit Test User",
        role: "admin",
      })
      .returning();
    if (!u) throw new Error("failed to insert user");
    actorUserId = u.id;
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  async function seedDraftTemplate(name: string) {
    const [tpl] = await db
      .insert(formTemplate)
      .values({
        tenantId,
        name,
        status: FormTemplateStatus.DRAFT,
      })
      .returning();
    if (!tpl) throw new Error("failed to insert template");

    const draft = await insertDraftFormTemplateVersion(db, {
      formTemplateId: tpl.id,
      tenantId,
    });

    const [section] = await db
      .insert(formSection)
      .values({
        formTemplateId: tpl.id,
        formTemplateVersionId: draft.id,
        tenantId,
        sectionOrder: 1,
        title: "Section A",
      })
      .returning();
    if (!section) throw new Error("failed to insert section");

    const [field] = await db
      .insert(formField)
      .values({
        formSectionId: section.id,
        formTemplateVersionId: draft.id,
        tenantId,
        fieldOrder: 1,
        fieldType: FieldType.TEXT,
        label: "Field 1",
      })
      .returning();
    if (!field) throw new Error("failed to insert field");

    return { tpl, draft, section, field };
  }

  async function listAuditEventsForTemplate(formTemplateId: string) {
    return db
      .select()
      .from(formTemplateAuditEvent)
      .where(
        and(
          eq(formTemplateAuditEvent.tenantId, tenantId),
          eq(formTemplateAuditEvent.formTemplateId, formTemplateId)
        )
      )
      .orderBy(
        asc(formTemplateAuditEvent.createdAt),
        asc(formTemplateAuditEvent.id)
      );
  }

  test("hardDeleteDraftFormField records before snapshot then deletes the row", async () => {
    const seeded = await seedDraftTemplate(
      `Audit hard-delete field ${Date.now()}`
    );

    await db.transaction(async (tx) => {
      await hardDeleteDraftFormField(tx, {
        tenantId,
        fieldId: seeded.field.id,
        actorUserId,
      });
    });

    const remaining = await db
      .select()
      .from(formField)
      .where(eq(formField.id, seeded.field.id));
    expect(remaining.length).toBe(0);

    const events = await listAuditEventsForTemplate(seeded.tpl.id);
    expect(events.length).toBe(1);
    const ev = events[0];
    if (!ev) throw new Error("expected audit event");
    expect(ev.eventType).toBe(FormTemplateAuditEventType.FIELD_HARD_DELETED);
    expect(ev.subjectType).toBe(FormTemplateAuditSubject.FIELD);
    expect(ev.subjectId).toBe(seeded.field.id);
    expect(ev.actorUserId).toBe(actorUserId);
    expect(ev.formTemplateVersionId).toBe(seeded.draft.id);

    const before = ev.before as Record<string, unknown>;
    expect(before.id).toBe(seeded.field.id);
    expect(before.label).toBe("Field 1");
    expect(before.fieldType).toBe(FieldType.TEXT);
    expect(before.formTemplateVersionId).toBe(seeded.draft.id);
  });

  test("hardDeleteDraftFormSection emits one event per field then one for the section", async () => {
    const seeded = await seedDraftTemplate(
      `Audit hard-delete section ${Date.now()}`
    );

    const [secondField] = await db
      .insert(formField)
      .values({
        formSectionId: seeded.section.id,
        formTemplateVersionId: seeded.draft.id,
        tenantId,
        fieldOrder: 2,
        fieldType: FieldType.TEXT,
        label: "Field 2",
      })
      .returning();
    if (!secondField) throw new Error("failed to insert second field");

    await db.transaction(async (tx) => {
      await hardDeleteDraftFormSection(tx, {
        tenantId,
        sectionId: seeded.section.id,
        actorUserId,
      });
    });

    const remainingSection = await db
      .select()
      .from(formSection)
      .where(eq(formSection.id, seeded.section.id));
    expect(remainingSection.length).toBe(0);

    const events = await listAuditEventsForTemplate(seeded.tpl.id);
    expect(events.length).toBe(3);
    expect(events[0]?.eventType).toBe(
      FormTemplateAuditEventType.FIELD_HARD_DELETED
    );
    expect(events[1]?.eventType).toBe(
      FormTemplateAuditEventType.FIELD_HARD_DELETED
    );
    expect(events[2]?.eventType).toBe(
      FormTemplateAuditEventType.SECTION_HARD_DELETED
    );

    const sectionEvent = events[2];
    if (!sectionEvent) throw new Error("expected section event");
    expect(sectionEvent.subjectId).toBe(seeded.section.id);
    expect((sectionEvent.before as { title?: string }).title).toBe("Section A");
  });

  test("hard delete refuses immutable (published) field rows", async () => {
    const seeded = await seedDraftTemplate(
      `Audit immutable guard ${Date.now()}`
    );

    await db.transaction(async (tx) => {
      await publishFormTemplateFromDraft(tx, {
        formTemplateId: seeded.tpl.id,
        tenantId,
        actorUserId,
      });
    });

    const [publishedField] = await db
      .select()
      .from(formField)
      .where(
        and(
          eq(formField.tenantId, tenantId),
          eq(formField.formSectionId, seeded.section.id),
          isNull(formField.deletedAt)
        )
      );

    // After publish the original section/field were torn down with the draft;
    // grab any field tied to the published version instead.
    const allFields = publishedField
      ? [publishedField]
      : await db
          .select()
          .from(formField)
          .where(eq(formField.tenantId, tenantId));
    const targetField = allFields.find((f) => f.label === "Field 1");
    if (!targetField) throw new Error("expected at least one published field");

    if (targetField.id === seeded.field.id) {
      // Sanity: with hard delete on draft, the original UUID should not survive.
      throw new Error("expected published field to have a fresh UUID");
    }

    await expect(
      db.transaction(async (tx) => {
        await hardDeleteDraftFormField(tx, {
          tenantId,
          fieldId: targetField.id,
          actorUserId,
        });
      })
    ).rejects.toBeInstanceOf(ImmutableFormTemplateStructureError);
  });

  test("publish emits per-row drafts deletes plus DRAFT_SUBTREE_REPLACED + VERSION_PUBLISHED", async () => {
    const seeded = await seedDraftTemplate(`Audit publish ${Date.now()}`);

    await db.transaction(async (tx) => {
      await publishFormTemplateFromDraft(tx, {
        formTemplateId: seeded.tpl.id,
        tenantId,
        actorUserId,
      });
    });

    const events = await listAuditEventsForTemplate(seeded.tpl.id);

    // 1 field delete + 1 section delete + 1 draft replaced + 1 version published
    expect(events.length).toBe(4);
    expect(events[0]?.eventType).toBe(
      FormTemplateAuditEventType.FIELD_HARD_DELETED
    );
    expect(events[1]?.eventType).toBe(
      FormTemplateAuditEventType.SECTION_HARD_DELETED
    );
    expect(events[2]?.eventType).toBe(
      FormTemplateAuditEventType.DRAFT_SUBTREE_REPLACED_ON_PUBLISH
    );
    expect(events[3]?.eventType).toBe(
      FormTemplateAuditEventType.VERSION_PUBLISHED
    );

    const summary = events[3];
    if (!summary) throw new Error("expected publish summary event");
    const meta = summary.metadata as Record<string, unknown>;
    expect(meta.publishedVersionNumber).toBe(1);
    expect(meta.replacedDraftVersionId).toBe(seeded.draft.id);
    expect(meta.supersededVersionId).toBeNull();
    expect(typeof meta.publishedVersionId).toBe("string");
    expect(typeof meta.newDraftVersionId).toBe("string");
  });

  test("audit insert is rolled back when its enclosing transaction throws", async () => {
    const seeded = await seedDraftTemplate(`Audit rollback ${Date.now()}`);

    const sentinel = new Error("intentional rollback");
    await expect(
      db.transaction(async (tx) => {
        await insertFormTemplateAuditEvent(tx, {
          tenantId,
          formTemplateId: seeded.tpl.id,
          formTemplateVersionId: seeded.draft.id,
          actorUserId,
          eventType: FormTemplateAuditEventType.FIELD_UPDATED,
          subjectType: FormTemplateAuditSubject.FIELD,
          subjectId: seeded.field.id,
          before: snapshotRow(seeded.field),
          after: snapshotRow({ ...seeded.field, label: "Renamed" }),
          summary: "should be rolled back",
        });
        throw sentinel;
      })
    ).rejects.toBe(sentinel);

    const events = await listAuditEventsForTemplate(seeded.tpl.id);
    expect(events.length).toBe(0);
  });
});
