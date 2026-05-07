import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { eq, and, isNull } from "drizzle-orm";
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
