import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { tenants } from "./tenants";
import { formTemplateVersion } from "./form-template-version";

/**
 * Form Section Table
 * Sections within a form template version
 *
 * Tenant Isolation:
 * - All queries must filter by tenant_id
 * - CASCADE delete when tenant is removed
 *
 * Ordering:
 * - section_order determines display order within a form
 *
 * Indexes:
 * - (tenant_id, form_template_version_id, section_order) - for ordered section retrieval
 */
export const formSection = pgTable(
  "form_section",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    formTemplateVersionId: uuid("form_template_version_id")
      .notNull()
      .references(() => formTemplateVersion.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    sectionOrder: integer("section_order").notNull(),
    sectionKey: varchar("section_key", { length: 64 }).notNull(),
    slugManuallyEdited: boolean("slug_manually_edited")
      .notNull()
      .default(false),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (table) => ({
    sectionIdVersionUnique: unique("uq_form_section_id_template_version").on(
      table.id,
      table.formTemplateVersionId
    ),
    tenantVersionOrderIdx: index("idx_form_section_tenant_version_order")
      .on(table.tenantId, table.formTemplateVersionId, table.sectionOrder)
      .where(sql`${table.deletedAt} IS NULL`),
    versionSectionKeyActiveUnique: uniqueIndex(
      "uq_form_section_version_key_active"
    )
      .on(table.formTemplateVersionId, table.sectionKey)
      .where(sql`${table.deletedAt} IS NULL`),
  })
);

/**
 * Form Section Relations
 */
export const formSectionRelations = relations(formSection, ({ one }) => ({
  formTemplateVersion: one(formTemplateVersion, {
    fields: [formSection.formTemplateVersionId],
    references: [formTemplateVersion.id],
  }),
  tenant: one(tenants, {
    fields: [formSection.tenantId],
    references: [tenants.id],
  }),
}));

export type InsertFormSection = typeof formSection.$inferInsert;
export type SelectFormSection = typeof formSection.$inferSelect;
