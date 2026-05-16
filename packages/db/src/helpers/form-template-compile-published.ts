import { eq, and, isNull, asc, inArray } from "drizzle-orm";
import {
  FORM_TEMPLATE_COMPILED_JSON_LATEST_SCHEMA_VERSION,
  type FormTemplateCompiledFieldByKeyEntry,
  type FormTemplateCompiledFieldV2,
  type FormTemplateCompiledJson,
  type FormTemplateCompiledJsonV2,
  type FormTemplateCompiledSectionV2,
} from "@supplex/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "../schema";
import { formSection } from "../schema/form-section";
import { formField } from "../schema/form-field";

type DbLike = PostgresJsDatabase<typeof schema>;

/** Stable `Error.message` for API mapping (`mapPublishDraftError`). */
export const FORM_TEMPLATE_COMPILE_FAILED = "FORM_TEMPLATE_COMPILE_FAILED";

/**
 * Section slice used by `buildFormTemplateCompiledJsonFromRelationalSubtree`.
 * SUP-38: extended with all `SelectFormSection` columns required to materialize
 * GET responses (minus context columns the caller already knows).
 */
export interface FormCompileSectionInput {
  id: string;
  sectionOrder: number;
  sectionKey: string;
  slugManuallyEdited: boolean;
  title: string;
  description: string | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Field slice used by `buildFormTemplateCompiledJsonFromRelationalSubtree`.
 * SUP-38: extended with all `SelectFormField` columns required to materialize
 * GET responses (minus context columns the caller already knows).
 */
export interface FormCompileFieldInput {
  id: string;
  formSectionId: string;
  fieldOrder: number;
  fieldKey: string;
  slugManuallyEdited: boolean;
  fieldType: string;
  label: string;
  placeholder: string | null;
  required: boolean;
  validationRules: unknown;
  options: unknown;
  createdAt: Date;
  updatedAt: Date;
}

function compileFail(details: string, cause?: unknown): never {
  const err = new Error(FORM_TEMPLATE_COMPILE_FAILED);
  err.cause = cause ?? details;
  throw err;
}

/**
 * Pure builder for tests (duplicate keys / invariants); production uses DB loader + this.
 *
 * Sections must already be sorted by sectionOrder; callers pass fields grouped per section
 * sorted by fieldOrder. Emits the latest supported schema version (currently 2 — SUP-38).
 */
export function buildFormTemplateCompiledJsonFromRelationalSubtree(
  sectionsInOrder: FormCompileSectionInput[],
  fieldsForSectionOrdered: Map<string, FormCompileFieldInput[]>
): FormTemplateCompiledJson {
  const fieldByKey: Record<string, FormTemplateCompiledFieldByKeyEntry> = {};
  const orderedWalk: FormTemplateCompiledJsonV2["orderedWalk"] = [];
  const sections: FormTemplateCompiledSectionV2[] = [];

  let fieldCount = 0;

  for (const sec of sectionsInOrder) {
    const bucket = [...(fieldsForSectionOrdered.get(sec.id) ?? [])].sort(
      (a, b) => a.fieldOrder - b.fieldOrder
    );

    orderedWalk.push({
      sectionOrder: sec.sectionOrder,
      sectionKey: sec.sectionKey,
      sectionId: sec.id,
      title: sec.title,
      fields: bucket.map((f) => ({
        fieldKey: f.fieldKey,
        fieldId: f.id,
        fieldOrder: f.fieldOrder,
      })),
    });

    const fieldRowsForSection: FormTemplateCompiledFieldV2[] = [];

    for (const f of bucket) {
      if (Object.hasOwn(fieldByKey, f.fieldKey)) {
        compileFail(
          `duplicate fieldKey in compiled view: "${f.fieldKey}"`,
          new Error(`duplicate_field_key:${f.fieldKey}`)
        );
      }

      fieldByKey[f.fieldKey] = {
        id: f.id,
        sectionKey: sec.sectionKey,
        sectionId: sec.id,
        fieldOrder: f.fieldOrder,
        label: f.label,
        placeholder: f.placeholder,
        fieldType: f.fieldType,
        required: f.required,
        validationRules: f.validationRules,
        options: f.options,
      };

      fieldRowsForSection.push({
        id: f.id,
        formSectionId: sec.id,
        fieldOrder: f.fieldOrder,
        fieldKey: f.fieldKey,
        slugManuallyEdited: f.slugManuallyEdited,
        fieldType: f.fieldType,
        label: f.label,
        placeholder: f.placeholder,
        required: f.required,
        validationRules: f.validationRules,
        options: f.options,
        createdAt: f.createdAt.toISOString(),
        updatedAt: f.updatedAt.toISOString(),
      });

      fieldCount += 1;
    }

    sections.push({
      id: sec.id,
      sectionOrder: sec.sectionOrder,
      sectionKey: sec.sectionKey,
      slugManuallyEdited: sec.slugManuallyEdited,
      title: sec.title,
      description: sec.description,
      metadata: sec.metadata,
      createdAt: sec.createdAt.toISOString(),
      updatedAt: sec.updatedAt.toISOString(),
      fields: fieldRowsForSection,
    });
  }

  if (fieldCount === 0) {
    compileFail("compiled form template requires at least one field");
  }

  const artifact: FormTemplateCompiledJsonV2 = {
    schemaVersion: FORM_TEMPLATE_COMPILED_JSON_LATEST_SCHEMA_VERSION,
    fieldByKey,
    orderedWalk,
    sections,
    validationPlan: { placeholder: true },
  };

  try {
    JSON.stringify(artifact);
  } catch (e: unknown) {
    compileFail("compiled form template artifact is not JSON-serializable", e);
  }

  return artifact;
}

/**
 * Load ordered relational subtree for a published version row and derive `compiled_json`.
 * SUP-38: selects all columns required to emit a self-contained v2 payload.
 */
export async function compilePublishedFormTemplateVersion(
  db: DbLike,
  params: {
    formTemplateId: string;
    tenantId: string;
    versionId: string;
  }
): Promise<FormTemplateCompiledJson> {
  const { formTemplateId, tenantId, versionId } = params;

  const sectionRows = await db
    .select({
      id: formSection.id,
      sectionOrder: formSection.sectionOrder,
      sectionKey: formSection.sectionKey,
      slugManuallyEdited: formSection.slugManuallyEdited,
      title: formSection.title,
      description: formSection.description,
      metadata: formSection.metadata,
      createdAt: formSection.createdAt,
      updatedAt: formSection.updatedAt,
    })
    .from(formSection)
    .where(
      and(
        eq(formSection.formTemplateId, formTemplateId),
        eq(formSection.formTemplateVersionId, versionId),
        eq(formSection.tenantId, tenantId),
        isNull(formSection.deletedAt)
      )
    )
    .orderBy(asc(formSection.sectionOrder));

  const ids = sectionRows.map((s) => s.id);
  const rawFields =
    ids.length === 0
      ? []
      : await db
          .select({
            id: formField.id,
            formSectionId: formField.formSectionId,
            fieldOrder: formField.fieldOrder,
            fieldKey: formField.fieldKey,
            slugManuallyEdited: formField.slugManuallyEdited,
            fieldType: formField.fieldType,
            label: formField.label,
            placeholder: formField.placeholder,
            required: formField.required,
            validationRules: formField.validationRules,
            options: formField.options,
            createdAt: formField.createdAt,
            updatedAt: formField.updatedAt,
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

  const bySection = new Map<string, FormCompileFieldInput[]>();
  for (const sid of ids) {
    bySection.set(sid, []);
  }
  for (const f of rawFields) {
    bySection.get(f.formSectionId)?.push({
      ...f,
    });
  }

  try {
    return buildFormTemplateCompiledJsonFromRelationalSubtree(
      sectionRows,
      bySection
    );
  } catch (e: unknown) {
    if (e instanceof Error && e.message === FORM_TEMPLATE_COMPILE_FAILED) {
      throw e;
    }
    compileFail("unexpected compile error", e);
  }
}
