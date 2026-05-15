import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { eq, and, isNull } from "drizzle-orm";
import {
  db,
  tenants,
  users,
  formTemplate,
  formSection,
  formField,
  formTemplateVersion,
  FormTemplateStatus,
  FormTemplateVersionStatus,
  FieldType,
  insertDraftFormTemplateVersion,
  publishFormTemplateFromDraft,
  getPublishedHeadFormTemplateVersion,
  getDraftFormTemplateVersionForTemplate,
  resolveFormTemplateVersionIdForStructure,
  assertFormTemplateVersionIsDraftStructure,
  ImmutableFormTemplateStructureError,
} from "../../index";

/**
 * Integration: SUP-26 copy-on-publish, supersede, draft reset, immutable guard.
 * Requires migration 0042 + DATABASE_URL (same as form-template tenant tests).
 */
describe("form template version lifecycle (SUP-26)", () => {
  let tenantId: string;
  let actorUserId: string;

  beforeAll(async () => {
    const [t] = await db
      .insert(tenants)
      .values({
        name: "Lifecycle Test Tenant",
        slug: `lifecycle-tenant-${Date.now()}`,
      })
      .returning();
    if (!t) throw new Error("failed to insert tenant");
    tenantId = t.id;

    const [u] = await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        tenantId,
        email: `lifecycle-${Date.now()}@test.com`,
        fullName: "Lifecycle Test User",
        role: "admin",
      })
      .returning();
    if (!u) throw new Error("failed to insert user");
    actorUserId = u.id;
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  test("publish deep-copies draft, supersedes prior head, resets draft subtree", async () => {
    const [tpl] = await db
      .insert(formTemplate)
      .values({
        tenantId,
        name: `Lifecycle template ${Date.now()}`,
        status: FormTemplateStatus.DRAFT,
      })
      .returning();

    if (!tpl) throw new Error("failed to insert template");

    const draftV = await insertDraftFormTemplateVersion(db, {
      formTemplateId: tpl.id,
      tenantId,
    });

    const [sec] = await db
      .insert(formSection)
      .values({
        formTemplateId: tpl.id,
        formTemplateVersionId: draftV.id,
        tenantId,
        sectionOrder: 1,
        sectionKey: "section_a",
        slugManuallyEdited: true,
        title: "Section A",
      })
      .returning();

    if (!sec) throw new Error("failed to insert section");

    await db.insert(formField).values({
      formSectionId: sec.id,
      formTemplateVersionId: draftV.id,
      tenantId,
      fieldOrder: 1,
      fieldKey: "field_one",
      slugManuallyEdited: false,
      fieldType: FieldType.TEXT,
      label: "Field 1",
    });

    const oldDraftId = draftV.id;
    const oldSectionId = sec.id;

    await db.transaction(async (tx) => {
      await publishFormTemplateFromDraft(tx, {
        formTemplateId: tpl.id,
        tenantId,
        actorUserId,
      });
    });

    const [updatedTpl] = await db
      .select()
      .from(formTemplate)
      .where(eq(formTemplate.id, tpl.id));
    expect(updatedTpl?.status).toBe(FormTemplateStatus.PUBLISHED);

    const pub = await getPublishedHeadFormTemplateVersion(db, {
      formTemplateId: tpl.id,
      tenantId,
    });
    expect(pub).not.toBeNull();
    if (!pub) throw new Error("missing published head");
    expect(pub.versionNumber).toBe(1);
    expect(pub.status).toBe(FormTemplateVersionStatus.PUBLISHED);

    const newDraft = await getDraftFormTemplateVersionForTemplate(db, {
      formTemplateId: tpl.id,
      tenantId,
    });
    expect(newDraft).not.toBeNull();
    if (!newDraft) throw new Error("missing draft after publish");
    expect(newDraft.versionNumber).toBeNull();
    expect(newDraft.id).not.toBe(oldDraftId);
    expect(newDraft.basedOnVersionId).toBe(pub.id);

    const pubSections = await db
      .select()
      .from(formSection)
      .where(
        and(
          eq(formSection.formTemplateVersionId, pub.id),
          isNull(formSection.deletedAt)
        )
      );
    expect(pubSections.length).toBe(1);
    const firstPubSection = pubSections[0];
    expect(firstPubSection).toBeDefined();
    if (!firstPubSection) throw new Error("missing published section");
    expect(firstPubSection.id).not.toBe(oldSectionId);
    expect(firstPubSection.sectionKey).toBe("section_a");
    expect(firstPubSection.slugManuallyEdited).toBe(true);

    const [pubFieldRow] = await db
      .select()
      .from(formField)
      .where(
        and(
          eq(formField.formTemplateVersionId, pub.id),
          isNull(formField.deletedAt)
        )
      );
    expect(pubFieldRow?.fieldKey).toBe("field_one");
    expect(pubFieldRow?.slugManuallyEdited).toBe(false);

    const draftSections = await db
      .select()
      .from(formSection)
      .where(
        and(
          eq(formSection.formTemplateVersionId, newDraft.id),
          isNull(formSection.deletedAt)
        )
      );
    expect(draftSections.length).toBe(1);
    expect(draftSections[0]?.sectionKey).toBe("section_a");
    const [draftFieldRow] = await db
      .select()
      .from(formField)
      .where(
        and(
          eq(formField.formTemplateVersionId, newDraft.id),
          isNull(formField.deletedAt)
        )
      );
    expect(draftFieldRow?.fieldKey).toBe("field_one");

    const resolved = await resolveFormTemplateVersionIdForStructure(db, {
      formTemplateId: tpl.id,
      tenantId,
    });
    expect(resolved).toBe(pub.id);

    await expect(
      assertFormTemplateVersionIsDraftStructure(db, {
        formTemplateVersionId: pub.id,
        tenantId,
      })
    ).rejects.toBeInstanceOf(ImmutableFormTemplateStructureError);

    await db.transaction(async (tx) => {
      await publishFormTemplateFromDraft(tx, {
        formTemplateId: tpl.id,
        tenantId,
        actorUserId,
      });
    });

    const pub2 = await getPublishedHeadFormTemplateVersion(db, {
      formTemplateId: tpl.id,
      tenantId,
    });
    expect(pub2).not.toBeNull();
    if (!pub2) throw new Error("missing published head after republish");
    expect(pub2.versionNumber).toBe(2);

    const [v1] = await db
      .select()
      .from(formTemplateVersion)
      .where(
        and(
          eq(formTemplateVersion.formTemplateId, tpl.id),
          eq(formTemplateVersion.versionNumber, 1),
          isNull(formTemplateVersion.deletedAt)
        )
      );
    expect(v1?.status).toBe(FormTemplateVersionStatus.SUPERSEDED);
  });
});
