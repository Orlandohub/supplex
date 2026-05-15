import { and, eq, isNull } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "../schema";
import { formField, formSection } from "../schema";

type DbLike = PostgresJsDatabase<typeof schema>;

/** Matches server rule: `^[a-z][a-z0-9_]{0,63}$` (max 64 chars). */
export const FORM_TEMPLATE_KEY_REGEX = /^[a-z][a-z0-9_]{0,63}$/;

export class InvalidFormTemplateKeyError extends Error {
  readonly code = "INVALID_FORM_TEMPLATE_KEY" as const;
  constructor(message = "Key must match ^[a-z][a-z0-9_]{0,63}$") {
    super(message);
    this.name = "InvalidFormTemplateKeyError";
  }
}

/**
 * Slugify display text (title / label) into a key; may require allocation for uniqueness.
 */
export function slugifyFormTemplateKeySource(raw: string): string {
  let s = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!s) s = "x";
  if (!/^[a-z]/.test(s)) s = `s_${s}`;
  s = s.slice(0, 64).replace(/_+$/g, "");
  if (!s || !/^[a-z]/.test(s)) return "x";
  if (!FORM_TEMPLATE_KEY_REGEX.test(s)) return "x";
  return s;
}

export function withKeyCollisionSuffix(
  base: string,
  n: number,
  maxLen = 64
): string {
  const suf = `_${n}`;
  const prefLen = Math.max(1, maxLen - suf.length);
  return base.slice(0, prefLen) + suf;
}

/**
 * Given a base slug, pick the first candidate `base`, `base_2`, … not in `isTaken`.
 */
export function allocateUniqueKeyFromBase(
  base: string,
  isTaken: (k: string) => boolean
): string {
  let candidate = slugifyFormTemplateKeySource(base);
  if (!isTaken(candidate)) return candidate;
  let n = 2;
  while (n < 100_000) {
    candidate = withKeyCollisionSuffix(base, n, 64);
    if (FORM_TEMPLATE_KEY_REGEX.test(candidate) && !isTaken(candidate)) {
      return candidate;
    }
    n += 1;
  }
  throw new Error("FORM_TEMPLATE_KEY_ALLOCATION_EXHAUSTED");
}

export function normalizeClientFormTemplateKeyOrThrow(raw: string): string {
  const k = raw.trim().toLowerCase();
  if (!FORM_TEMPLATE_KEY_REGEX.test(k)) {
    throw new InvalidFormTemplateKeyError();
  }
  return k;
}

export async function allocateSectionKey(
  tx: DbLike,
  params: {
    versionId: string;
    tenantId: string;
    desiredBase: string;
    excludeSectionId?: string;
  }
): Promise<string> {
  const base = slugifyFormTemplateKeySource(params.desiredBase);
  const rows = await tx
    .select({
      id: formSection.id,
      sectionKey: formSection.sectionKey,
    })
    .from(formSection)
    .where(
      and(
        eq(formSection.formTemplateVersionId, params.versionId),
        eq(formSection.tenantId, params.tenantId),
        isNull(formSection.deletedAt)
      )
    );

  const taken = new Set(
    rows
      .filter((r) => r.id !== params.excludeSectionId)
      .map((r) => r.sectionKey)
  );

  return allocateUniqueKeyFromBase(base, (k) => taken.has(k));
}

export async function allocateFieldKey(
  tx: DbLike,
  params: {
    versionId: string;
    tenantId: string;
    desiredBase: string;
    excludeFieldId?: string;
  }
): Promise<string> {
  const base = slugifyFormTemplateKeySource(params.desiredBase);
  const rows = await tx
    .select({ id: formField.id, fieldKey: formField.fieldKey })
    .from(formField)
    .where(
      and(
        eq(formField.formTemplateVersionId, params.versionId),
        eq(formField.tenantId, params.tenantId),
        isNull(formField.deletedAt)
      )
    );

  const taken = new Set(
    rows.filter((r) => r.id !== params.excludeFieldId).map((r) => r.fieldKey)
  );

  return allocateUniqueKeyFromBase(base, (k) => taken.has(k));
}

export async function assertSectionKeyAvailable(
  tx: DbLike,
  params: {
    versionId: string;
    tenantId: string;
    key: string;
    excludeSectionId?: string;
  }
): Promise<void> {
  const [hit] = await tx
    .select({ id: formSection.id })
    .from(formSection)
    .where(
      and(
        eq(formSection.formTemplateVersionId, params.versionId),
        eq(formSection.tenantId, params.tenantId),
        eq(formSection.sectionKey, params.key),
        isNull(formSection.deletedAt)
      )
    )
    .limit(1);

  if (hit && hit.id !== params.excludeSectionId) {
    throw new Error("FORM_TEMPLATE_SECTION_KEY_TAKEN");
  }
}

export async function assertFieldKeyAvailable(
  tx: DbLike,
  params: {
    versionId: string;
    tenantId: string;
    key: string;
    excludeFieldId?: string;
  }
): Promise<void> {
  const [hit] = await tx
    .select({ id: formField.id })
    .from(formField)
    .where(
      and(
        eq(formField.formTemplateVersionId, params.versionId),
        eq(formField.tenantId, params.tenantId),
        eq(formField.fieldKey, params.key),
        isNull(formField.deletedAt)
      )
    )
    .limit(1);

  if (hit && hit.id !== params.excludeFieldId) {
    throw new Error("FORM_TEMPLATE_FIELD_KEY_TAKEN");
  }
}
