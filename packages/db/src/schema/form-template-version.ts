import type { FormTemplateCompiledJson } from "@supplex/types";
import {
  pgTable,
  uuid,
  integer,
  timestamp,
  jsonb,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { tenants } from "./tenants";
import { formTemplate } from "./form-template";

export const formTemplateVersionStatusEnum = pgEnum(
  "form_template_version_status",
  ["draft", "published", "superseded"]
);

export const FormTemplateVersionStatus = {
  DRAFT: "draft",
  PUBLISHED: "published",
  SUPERSEDED: "superseded",
} as const;

export type FormTemplateVersionStatusType =
  (typeof FormTemplateVersionStatus)[keyof typeof FormTemplateVersionStatus];

/**
 * Relational version row for a form template container.
 * Draft rows use version_number NULL; immutable lineage uses monotonic version_number.
 */
export const formTemplateVersion = pgTable(
  "form_template_version",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    formTemplateId: uuid("form_template_id")
      .notNull()
      .references(() => formTemplate.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number"),
    status: formTemplateVersionStatusEnum("status").notNull(),
    basedOnVersionId: uuid("based_on_version_id").references(
      (): AnyPgColumn => formTemplateVersion.id,
      { onDelete: "set null" }
    ),
    compiledJson: jsonb(
      "compiled_json"
    ).$type<FormTemplateCompiledJson | null>(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (table) => ({
    tenantTemplateIdx: index("idx_form_template_version_tenant_template")
      .on(table.tenantId, table.formTemplateId)
      .where(sql`${table.deletedAt} IS NULL`),
  })
);

export const formTemplateVersionRelations = relations(
  formTemplateVersion,
  ({ one }) => ({
    template: one(formTemplate, {
      fields: [formTemplateVersion.formTemplateId],
      references: [formTemplate.id],
    }),
    tenant: one(tenants, {
      fields: [formTemplateVersion.tenantId],
      references: [tenants.id],
    }),
  })
);

/** Attach `versions` relation without importing this file from `form-template.ts`. */
export const formTemplateVersionsRelation = relations(
  formTemplate,
  ({ many }) => ({
    versions: many(formTemplateVersion),
  })
);

export type InsertFormTemplateVersion = typeof formTemplateVersion.$inferInsert;
export type SelectFormTemplateVersion = typeof formTemplateVersion.$inferSelect;
