/**
 * SUP-33: Derived snapshot stored on immutable published `form_template_version.compiled_json`.
 * SUP-38: v2 extends with full per-row payload so structure GETs / submission readers can
 * materialize the same DTOs without joining `form_section` / `form_field` tables again.
 *
 * Source of truth remains relational rows (sections / fields). Compiled cache is opt-in:
 * v1 readers must always fall back to the relational subtree.
 */

/**
 * Bundle schema versions:
 *  - 1: SUP-33 publish-time write only (no read consumers). Lookup-friendly subset.
 *  - 2: SUP-38 read path. Adds full section/field rehydration payloads matching the
 *       Drizzle `SelectFormSection` / `SelectFormField` shape (minus per-row tenant /
 *       template / version IDs and `deletedAt`, which the materializer fills from
 *       caller context — those are constant for every row in a given immutable version).
 */
export type FormTemplateCompiledJsonSchemaVersion = 1 | 2;

/**
 * Per-field entry keyed by stable `fieldKey` (globally unique within a template version row).
 * Present in v1 + v2 for fast `O(1)` lookups by key.
 */
export interface FormTemplateCompiledFieldByKeyEntry {
  /** Published `form_field.id` UUID. */
  id: string;
  sectionKey: string;
  /** Published `form_section.id` UUID. */
  sectionId: string;
  fieldOrder: number;
  label: string;
  placeholder: string | null;
  fieldType: string;
  required: boolean;
  validationRules: unknown;
  options: unknown;
}

/**
 * Deterministic display order: outer array by `sectionOrder`, each section lists fields by `fieldOrder`.
 * Present in v1 + v2.
 */
export interface FormTemplateCompiledOrderedWalkSection {
  sectionOrder: number;
  sectionKey: string;
  sectionId: string;
  title: string;
  fields: FormTemplateCompiledOrderedWalkField[];
}

export interface FormTemplateCompiledOrderedWalkField {
  fieldKey: string;
  fieldId: string;
  fieldOrder: number;
}

/** Reserved for follow-up validation phases; semantics not implemented yet. */
export interface FormTemplateCompiledValidationPlaceholder {
  placeholder: true;
}

/**
 * v2-only: section payload mirroring `SelectFormSection` minus context columns
 * (`tenantId`, `formTemplateId`, `formTemplateVersionId`, `deletedAt`).
 *
 * `createdAt` / `updatedAt` are ISO-8601 strings because JSONB persistence loses Date types.
 * Materializers convert them back to `Date` to match Drizzle row outputs.
 */
export interface FormTemplateCompiledSectionV2 {
  id: string;
  sectionOrder: number;
  sectionKey: string;
  slugManuallyEdited: boolean;
  title: string;
  description: string | null;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
  fields: FormTemplateCompiledFieldV2[];
}

/**
 * v2-only: field payload mirroring `SelectFormField` minus context columns.
 * `createdAt` / `updatedAt` ISO-8601 (see section note above).
 */
export interface FormTemplateCompiledFieldV2 {
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
  createdAt: string;
  updatedAt: string;
}

/** SUP-33 shape (no read consumers). */
export interface FormTemplateCompiledJsonV1 {
  schemaVersion: 1;
  fieldByKey: Record<string, FormTemplateCompiledFieldByKeyEntry>;
  orderedWalk: FormTemplateCompiledOrderedWalkSection[];
  validationPlan: FormTemplateCompiledValidationPlaceholder;
}

/** SUP-38 shape: adds `sections` (full rehydratable rows). */
export interface FormTemplateCompiledJsonV2 {
  schemaVersion: 2;
  fieldByKey: Record<string, FormTemplateCompiledFieldByKeyEntry>;
  orderedWalk: FormTemplateCompiledOrderedWalkSection[];
  /**
   * Sections in display order, each carrying every column the API GET endpoints
   * embed today (`{ ...section, fields: [...] }`). Sufficient to satisfy structure
   * reads without the `form_section` / `form_field` SELECTs.
   */
  sections: FormTemplateCompiledSectionV2[];
  validationPlan: FormTemplateCompiledValidationPlaceholder;
}

export type FormTemplateCompiledJson =
  | FormTemplateCompiledJsonV1
  | FormTemplateCompiledJsonV2;

/** Latest schema version a writer should emit. */
export const FORM_TEMPLATE_COMPILED_JSON_LATEST_SCHEMA_VERSION = 2 as const;
