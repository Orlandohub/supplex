/**
 * SUP-33: Derived snapshot stored on immutable published `form_template_version.compiled_json`.
 * Source of truth remains relational rows (sections / fields).
 */

/** Version of the serialized bundle; bump only on breaking structural changes to this object. */
export type FormTemplateCompiledJsonSchemaVersion = 1;

/**
 * Per-field entry keyed by stable `fieldKey` (globally unique within a template version row).
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

export interface FormTemplateCompiledJson {
  schemaVersion: FormTemplateCompiledJsonSchemaVersion;
  fieldByKey: Record<string, FormTemplateCompiledFieldByKeyEntry>;
  orderedWalk: FormTemplateCompiledOrderedWalkSection[];
  validationPlan: FormTemplateCompiledValidationPlaceholder;
}
