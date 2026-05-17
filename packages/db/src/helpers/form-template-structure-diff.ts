/**
 * SUP-29: Load canonical form template structure and compute key-based diffs
 * (section_key / field_key), aligned with GET structure signature in apps/api.
 */

import { eq, and, isNull, asc, inArray } from "drizzle-orm";
import type {
  FormTemplateFieldStructureSlice,
  FormTemplateSectionStructureSlice,
  FormTemplateStructureDiff,
  FormTemplateStructureDiffSummary,
} from "@supplex/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "../schema";
import { formSection } from "../schema/form-section";
import { formField } from "../schema/form-field";

type DbLike = PostgresJsDatabase<typeof schema>;

function fieldComparableJson(f: FormTemplateFieldStructureSlice): string {
  return JSON.stringify({
    fk: f.fieldKey,
    l: f.label,
    p: f.placeholder,
    ty: f.fieldType,
    r: f.required,
    v: f.validationRules,
    o: f.options,
  });
}

/**
 * JSON.stringify payload matching `formTemplateStructureSignature` in
 * apps/api/src/routes/form-templates/get.ts (for parity with hasUnpublishedDraftChanges).
 */
export function formTemplateStructureSignatureFromSlices(
  sections: FormTemplateSectionStructureSlice[]
): string {
  const sorted = [...sections].sort((a, b) =>
    a.sectionOrder !== b.sectionOrder
      ? a.sectionOrder - b.sectionOrder
      : a.sectionKey.localeCompare(b.sectionKey)
  );

  const payload = sorted.map((sec) => ({
    k: sec.sectionKey,
    t: sec.title,
    fields: [...sec.fields]
      .sort((a, b) =>
        a.fieldOrder !== b.fieldOrder
          ? a.fieldOrder - b.fieldOrder
          : a.fieldKey.localeCompare(b.fieldKey)
      )
      .map((f) => ({
        fk: f.fieldKey,
        l: f.label,
        p: f.placeholder,
        ty: f.fieldType,
        r: f.required,
        v: f.validationRules,
        o: f.options,
      })),
  }));

  return JSON.stringify(payload);
}

export async function loadFormTemplateStructureSnapshot(
  db: DbLike,
  params: {
    formTemplateId: string;
    tenantId: string;
    versionId: string;
  }
): Promise<FormTemplateSectionStructureSlice[]> {
  const { tenantId, versionId } = params;

  const sectionRowIds = await db
    .select({
      id: formSection.id,
      sectionKey: formSection.sectionKey,
      sectionOrder: formSection.sectionOrder,
      title: formSection.title,
    })
    .from(formSection)
    .where(
      and(
        eq(formSection.formTemplateVersionId, versionId),
        eq(formSection.tenantId, tenantId),
        isNull(formSection.deletedAt)
      )
    )
    .orderBy(asc(formSection.sectionOrder));

  const ids = sectionRowIds.map((r) => r.id);
  const fields =
    ids.length === 0
      ? []
      : await db
          .select({
            formSectionId: formField.formSectionId,
            fieldOrder: formField.fieldOrder,
            fieldKey: formField.fieldKey,
            label: formField.label,
            placeholder: formField.placeholder,
            fieldType: formField.fieldType,
            required: formField.required,
            validationRules: formField.validationRules,
            options: formField.options,
          })
          .from(formField)
          .where(
            and(
              eq(formField.formTemplateVersionId, versionId),
              eq(formField.tenantId, tenantId),
              inArray(formField.formSectionId, ids),
              isNull(formField.deletedAt)
            )
          );

  const fieldsBySection = new Map<string, typeof fields>();
  for (const sid of ids) {
    fieldsBySection.set(sid, []);
  }
  for (const f of fields) {
    fieldsBySection.get(f.formSectionId)?.push(f);
  }

  return sectionRowIds.map((sec) => ({
    sectionOrder: sec.sectionOrder,
    sectionKey: sec.sectionKey,
    title: sec.title,
    fields: (fieldsBySection.get(sec.id) ?? [])
      .sort((a, b) => a.fieldOrder - b.fieldOrder)
      .map(
        (f): FormTemplateFieldStructureSlice => ({
          fieldOrder: f.fieldOrder,
          fieldKey: f.fieldKey,
          label: f.label,
          placeholder: f.placeholder,
          fieldType: f.fieldType,
          required: f.required,
          validationRules: f.validationRules,
          options: f.options,
        })
      ),
  }));
}

export function diffFormTemplateStructureSnapshots(
  baseline: FormTemplateSectionStructureSlice[],
  draft: FormTemplateSectionStructureSlice[]
): FormTemplateStructureDiff {
  const baseMap = new Map(baseline.map((s) => [s.sectionKey, s]));
  const draftMap = new Map(draft.map((s) => [s.sectionKey, s]));

  const addedSections: FormTemplateSectionStructureSlice[] = [];
  const removedSections: FormTemplateStructureDiff["removedSections"] = [];
  const modifiedSections: FormTemplateStructureDiff["modifiedSections"] = [];

  for (const [key, dsec] of draftMap) {
    const bsec = baseMap.get(key);
    if (!bsec) {
      addedSections.push(dsec);
      continue;
    }

    const bfields = new Map(bsec.fields.map((f) => [f.fieldKey, f]));
    const dfields = new Map(dsec.fields.map((f) => [f.fieldKey, f]));

    const addedFields: FormTemplateFieldStructureSlice[] = [];
    const removedFields: FormTemplateStructureDiff["modifiedSections"][number]["removedFields"] =
      [];
    const modifiedFields: FormTemplateStructureDiff["modifiedSections"][number]["modifiedFields"] =
      [];

    for (const [, df] of dfields) {
      const bf = bfields.get(df.fieldKey);
      if (!bf) {
        addedFields.push(df);
      } else if (fieldComparableJson(bf) !== fieldComparableJson(df)) {
        modifiedFields.push({
          fieldKey: df.fieldKey,
          before: bf,
          after: df,
        });
      }
    }

    for (const [fk, bf] of bfields) {
      if (!dfields.has(fk)) {
        removedFields.push({ fieldKey: fk, label: bf.label });
      }
    }

    const titleChanged = bsec.title !== dsec.title;
    if (
      titleChanged ||
      addedFields.length > 0 ||
      removedFields.length > 0 ||
      modifiedFields.length > 0
    ) {
      modifiedSections.push({
        sectionKey: key,
        titleBefore: bsec.title,
        titleAfter: dsec.title,
        addedFields,
        removedFields,
        modifiedFields,
      });
    }
  }

  for (const [key, bsec] of baseMap) {
    if (!draftMap.has(key)) {
      removedSections.push({ sectionKey: key, title: bsec.title });
    }
  }

  return { addedSections, removedSections, modifiedSections };
}

export function summarizeFormTemplateStructureDiffAccurate(
  diff: FormTemplateStructureDiff,
  baseline: FormTemplateSectionStructureSlice[]
): FormTemplateStructureDiffSummary {
  const baseByKey = new Map(baseline.map((s) => [s.sectionKey, s]));
  let removedFieldCount = 0;
  for (const rm of diff.removedSections) {
    removedFieldCount += baseByKey.get(rm.sectionKey)?.fields.length ?? 0;
  }
  for (const sec of diff.modifiedSections) {
    removedFieldCount += sec.removedFields.length;
  }

  let addedFieldCount = 0;
  for (const sec of diff.addedSections) {
    addedFieldCount += sec.fields.length;
  }
  for (const sec of diff.modifiedSections) {
    addedFieldCount += sec.addedFields.length;
  }

  const modifiedFieldCount = diff.modifiedSections.reduce(
    (n, s) => n + s.modifiedFields.length,
    0
  );

  return {
    addedSectionCount: diff.addedSections.length,
    removedSectionCount: diff.removedSections.length,
    modifiedSectionCount: diff.modifiedSections.length,
    addedFieldCount,
    removedFieldCount,
    modifiedFieldCount,
  };
}

export function structureChangedFromDiff(
  diff: FormTemplateStructureDiff
): boolean {
  return (
    diff.addedSections.length > 0 ||
    diff.removedSections.length > 0 ||
    diff.modifiedSections.length > 0
  );
}
