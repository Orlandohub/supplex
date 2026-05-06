import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { eq, and, isNull, desc, isNotNull } from "drizzle-orm";
import type * as schema from "../schema";
import {
  formTemplateVersion,
  FormTemplateVersionStatus,
} from "../schema/form-template-version";

type DbLike = PostgresJsDatabase<typeof schema>;

export async function insertDraftFormTemplateVersion(
  db: DbLike,
  params: { formTemplateId: string; tenantId: string }
) {
  const [row] = await db
    .insert(formTemplateVersion)
    .values({
      formTemplateId: params.formTemplateId,
      tenantId: params.tenantId,
      versionNumber: null,
      status: FormTemplateVersionStatus.DRAFT,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  if (!row) throw new Error("Failed to insert draft form_template_version");
  return row;
}

export async function getDraftFormTemplateVersionForTemplate(
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
        isNull(formTemplateVersion.versionNumber),
        isNull(formTemplateVersion.deletedAt)
      )
    )
    .limit(1);

  return row ?? null;
}

/**
 * Draft templates read/write the mutable draft row; published/archived containers use the latest immutable version_number.
 */
export async function resolveFormTemplateVersionIdForStructure(
  db: DbLike,
  params: { formTemplateId: string; tenantId: string }
): Promise<string> {
  const draft = await getDraftFormTemplateVersionForTemplate(db, params);
  if (draft) return draft.id;

  const [row] = await db
    .select({ id: formTemplateVersion.id })
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

  if (!row) {
    throw new Error(
      `No form_template_version row for template ${params.formTemplateId}`
    );
  }

  return row.id;
}
