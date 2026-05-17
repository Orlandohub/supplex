import { eq, and, isNull, inArray, asc } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "../schema";
import { formSection } from "../schema/form-section";
import { formField } from "../schema/form-field";
import { formTemplateVersion } from "../schema/form-template-version";
import type { SelectFormField, SelectFormSection } from "../index";
import {
  tryReadStructureFromCompiledJson,
  type FormCompiledFallbackReason,
} from "./form-template-compiled-json-parse";

type DbLike = PostgresJsDatabase<typeof schema>;

export type FormStructureLoadSource = "compiled_json" | "relational";

export interface FormStructureLoadResult {
  sections: SelectFormSection[];
  fields: SelectFormField[];
  source: FormStructureLoadSource;
  /**
   * Populated when compiled_json existed but was unusable (caller may want to log).
   * `null` when source === 'compiled_json' OR caller opted out / version is a draft.
   */
  fallbackReason: FormCompiledFallbackReason | null;
}

/**
 * SUP-38: load `{ sections, fields }` for a single form template version, preferring the
 * publish-time `compiled_json` cache when it carries a supported schemaVersion. Drafts
 * or any case where the cache is missing / malformed / unsupported transparently falls
 * back to the relational subtree query — matching the existing behavior pre-SUP-38.
 *
 * Caller responsibilities:
 *  - Tenant scoping is enforced by this helper.
 *  - Caller decides whether to attempt the fast path at all (e.g. drafts skip via
 *    `preferCompiled: false`).
 *  - Caller may pass a known compiled payload + version row instead of letting the
 *    helper re-fetch (`compiledJsonOverride`) — useful when the version row was
 *    already loaded for other reasons.
 */
export async function loadFormStructureForVersion(
  db: DbLike,
  params: {
    formTemplateId: string;
    formTemplateVersionId: string;
    tenantId: string;
    /** Default true. Pass false to force relational (e.g. draft versions). */
    preferCompiled?: boolean;
    /**
     * Pre-loaded `form_template_version.compiled_json` value. When provided we skip
     * the extra round-trip; pass `undefined` to let the helper SELECT it.
     */
    compiledJsonOverride?: unknown;
  }
): Promise<FormStructureLoadResult> {
  const {
    formTemplateVersionId,
    tenantId,
    preferCompiled = true,
    compiledJsonOverride,
  } = params;

  let fallbackReason: FormCompiledFallbackReason | null = null;

  if (preferCompiled) {
    let compiledRaw: unknown = compiledJsonOverride;

    if (compiledRaw === undefined) {
      const [row] = await db
        .select({ compiledJson: formTemplateVersion.compiledJson })
        .from(formTemplateVersion)
        .where(
          and(
            eq(formTemplateVersion.id, formTemplateVersionId),
            eq(formTemplateVersion.tenantId, tenantId),
            isNull(formTemplateVersion.deletedAt)
          )
        )
        .limit(1);
      compiledRaw = row?.compiledJson ?? null;
    }

    const fast = tryReadStructureFromCompiledJson(compiledRaw, {
      tenantId,
      formTemplateVersionId,
    });

    if (fast.structure) {
      return {
        sections: fast.structure.sections,
        fields: fast.structure.fields,
        source: "compiled_json",
        fallbackReason: null,
      };
    }
    fallbackReason = fast.reason;
  }

  const sections = await db
    .select()
    .from(formSection)
    .where(
      and(
        eq(formSection.formTemplateVersionId, formTemplateVersionId),
        eq(formSection.tenantId, tenantId),
        isNull(formSection.deletedAt)
      )
    )
    .orderBy(asc(formSection.sectionOrder));

  const sectionIds = sections.map((s) => s.id);

  const fields =
    sectionIds.length === 0
      ? []
      : await db
          .select()
          .from(formField)
          .where(
            and(
              eq(formField.formTemplateVersionId, formTemplateVersionId),
              eq(formField.tenantId, tenantId),
              inArray(formField.formSectionId, sectionIds),
              isNull(formField.deletedAt)
            )
          )
          .orderBy(asc(formField.fieldOrder));

  return {
    sections,
    fields,
    source: "relational",
    fallbackReason,
  };
}
