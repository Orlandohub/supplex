import type {
  FieldOptions,
  FormTemplateCompiledJson,
  FormTemplateCompiledJsonV1,
  FormTemplateCompiledJsonV2,
  FormTemplateCompiledSectionV2,
  FormTemplateCompiledFieldV2,
  ValidationRules,
} from "@supplex/types";
import type { SelectFormField, SelectFormSection } from "../index";

/**
 * SUP-38: runtime parsing + materialization for compiled form-template structure.
 *
 * Source of truth remains the relational `form_section` / `form_field` tables. Callers
 * MUST be able to fall back to those tables when this helper returns a non-supported
 * payload (`null` from `tryReadStructureFromCompiledJson`).
 *
 * The compiled cache is opt-in per schema version:
 *  - v1 (SUP-33): write-only; readers fall back to relational.
 *  - v2 (SUP-38): full row payload sufficient to satisfy GET / submission structure reads.
 */

export interface MaterializedFormStructure {
  sections: SelectFormSection[];
  fields: SelectFormField[];
}

/** Reason the fast path bailed out — surfaced to callers for observability. */
export type FormCompiledFallbackReason =
  | "compiled_json_missing"
  | "compiled_json_malformed"
  | "compiled_json_unsupported_schema_version";

export interface TryReadStructureFromCompiledJsonResult {
  /** Materialized structure when the compiled payload was usable. */
  structure: MaterializedFormStructure | null;
  reason: FormCompiledFallbackReason | null;
  schemaVersion: number | null;
}

interface MaterializeContext {
  tenantId: string;
  formTemplateVersionId: string;
}

const SUPPORTED_SCHEMA_VERSIONS_FOR_READ = new Set<number>([2]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function isObjectLike(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Best-effort runtime guard. Drizzle types `compiledJson` as the union but jsonb is
 * still untrusted at the byte boundary, so we re-check the discriminant + array shapes
 * before trusting any field. Returns `null` when the payload can't be classified.
 */
export function parseFormTemplateCompiledJson(raw: unknown):
  | { ok: true; payload: FormTemplateCompiledJsonV1; schemaVersion: 1 }
  | { ok: true; payload: FormTemplateCompiledJsonV2; schemaVersion: 2 }
  | {
      ok: false;
      reason: FormCompiledFallbackReason;
      schemaVersion: number | null;
    } {
  if (raw === null || raw === undefined) {
    return { ok: false, reason: "compiled_json_missing", schemaVersion: null };
  }
  if (!isObjectLike(raw)) {
    return {
      ok: false,
      reason: "compiled_json_malformed",
      schemaVersion: null,
    };
  }

  const schemaVersion = raw.schemaVersion;
  if (typeof schemaVersion !== "number") {
    return {
      ok: false,
      reason: "compiled_json_malformed",
      schemaVersion: null,
    };
  }

  if (schemaVersion === 1) {
    if (
      !isObjectLike(raw.fieldByKey) ||
      !Array.isArray(raw.orderedWalk) ||
      !isObjectLike(raw.validationPlan)
    ) {
      return {
        ok: false,
        reason: "compiled_json_malformed",
        schemaVersion: 1,
      };
    }
    return {
      ok: true,
      payload: raw as unknown as FormTemplateCompiledJsonV1,
      schemaVersion: 1,
    };
  }

  if (schemaVersion === 2) {
    if (
      !isObjectLike(raw.fieldByKey) ||
      !Array.isArray(raw.orderedWalk) ||
      !Array.isArray(raw.sections) ||
      !isObjectLike(raw.validationPlan)
    ) {
      return {
        ok: false,
        reason: "compiled_json_malformed",
        schemaVersion: 2,
      };
    }
    return {
      ok: true,
      payload: raw as unknown as FormTemplateCompiledJsonV2,
      schemaVersion: 2,
    };
  }

  return {
    ok: false,
    reason: "compiled_json_unsupported_schema_version",
    schemaVersion,
  };
}

function isCompiledFieldV2(
  value: unknown
): value is FormTemplateCompiledFieldV2 {
  if (!isObjectLike(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.formSectionId === "string" &&
    typeof value.fieldOrder === "number" &&
    typeof value.fieldKey === "string" &&
    typeof value.slugManuallyEdited === "boolean" &&
    typeof value.fieldType === "string" &&
    typeof value.label === "string" &&
    (value.placeholder === null || typeof value.placeholder === "string") &&
    typeof value.required === "boolean" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  );
}

function isCompiledSectionV2(
  value: unknown
): value is FormTemplateCompiledSectionV2 {
  if (!isObjectLike(value)) return false;
  if (!Array.isArray(value.fields)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.sectionOrder === "number" &&
    typeof value.sectionKey === "string" &&
    typeof value.slugManuallyEdited === "boolean" &&
    typeof value.title === "string" &&
    (value.description === null || typeof value.description === "string") &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string" &&
    value.fields.every(isCompiledFieldV2)
  );
}

/**
 * Fully materialize a v2 compiled payload into the same shape Drizzle returns for
 * `formSection` / `formField` (`SelectFormSection` / `SelectFormField`). Context columns
 * (`tenantId`, `formTemplateVersionId`, `deletedAt`) are constant for
 * a published version and are filled from the caller — they're intentionally excluded
 * from the cache to keep it small and avoid stale duplication.
 */
export function materializeRelationalSubtreeFromCompiledV2(
  payload: FormTemplateCompiledJsonV2,
  ctx: MaterializeContext
): MaterializedFormStructure {
  const sections: SelectFormSection[] = [];
  const fields: SelectFormField[] = [];

  const sortedSections = [...payload.sections].sort(
    (a, b) => a.sectionOrder - b.sectionOrder
  );

  for (const sec of sortedSections) {
    sections.push({
      id: sec.id,
      formTemplateVersionId: ctx.formTemplateVersionId,
      tenantId: ctx.tenantId,
      sectionOrder: sec.sectionOrder,
      sectionKey: sec.sectionKey,
      slugManuallyEdited: sec.slugManuallyEdited,
      title: sec.title,
      description: sec.description,
      metadata: (sec.metadata ?? {}) as SelectFormSection["metadata"],
      createdAt: new Date(sec.createdAt),
      updatedAt: new Date(sec.updatedAt),
      deletedAt: null,
    });

    const sortedFields = [...sec.fields].sort(
      (a, b) => a.fieldOrder - b.fieldOrder
    );
    for (const f of sortedFields) {
      fields.push({
        id: f.id,
        formSectionId: f.formSectionId,
        formTemplateVersionId: ctx.formTemplateVersionId,
        tenantId: ctx.tenantId,
        fieldOrder: f.fieldOrder,
        fieldKey: f.fieldKey,
        slugManuallyEdited: f.slugManuallyEdited,
        fieldType: f.fieldType as SelectFormField["fieldType"],
        label: f.label,
        placeholder: f.placeholder,
        required: f.required,
        validationRules: (isPlainObject(f.validationRules)
          ? f.validationRules
          : {}) as unknown as ValidationRules,
        options: (isPlainObject(f.options) ? f.options : {}) as unknown as
          | FieldOptions
          | Record<string, never>,
        createdAt: new Date(f.createdAt),
        updatedAt: new Date(f.updatedAt),
        deletedAt: null,
      });
    }
  }

  return { sections, fields };
}

/**
 * High-level entry point used by API routes: parses the persisted blob, validates the
 * v2 contract, and materializes relational rows. Returns `{ structure: null, reason }`
 * for any unsupported payload — callers MUST fall back to relational queries.
 */
export function tryReadStructureFromCompiledJson(
  raw: unknown,
  ctx: MaterializeContext
): TryReadStructureFromCompiledJsonResult {
  const parsed = parseFormTemplateCompiledJson(raw);

  if (!parsed.ok) {
    return {
      structure: null,
      reason: parsed.reason,
      schemaVersion: parsed.schemaVersion,
    };
  }

  if (!SUPPORTED_SCHEMA_VERSIONS_FOR_READ.has(parsed.schemaVersion)) {
    return {
      structure: null,
      reason: "compiled_json_unsupported_schema_version",
      schemaVersion: parsed.schemaVersion,
    };
  }

  if (parsed.schemaVersion !== 2) {
    return {
      structure: null,
      reason: "compiled_json_unsupported_schema_version",
      schemaVersion: parsed.schemaVersion,
    };
  }

  if (!parsed.payload.sections.every(isCompiledSectionV2)) {
    return {
      structure: null,
      reason: "compiled_json_malformed",
      schemaVersion: parsed.schemaVersion,
    };
  }

  const structure = materializeRelationalSubtreeFromCompiledV2(
    parsed.payload,
    ctx
  );

  return { structure, reason: null, schemaVersion: 2 };
}

export type { FormTemplateCompiledJson };
