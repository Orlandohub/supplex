import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { tenants } from "./tenants";
import { formTemplate } from "./form-template";

/**
 * Form Section Table
 * Sections within a form template
 * Provides logical grouping of form fields
 *
 * Tenant Isolation:
 * - All queries must filter by tenant_id
 * - CASCADE delete when tenant or form_template is removed
 *
 * Ordering:
 * - section_order determines display order within a form
 *
 * Indexes:
 * - (tenant_id, form_template_id, section_order) - for ordered section retrieval
 */
export const formSection = pgTable(
  "form_section",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    formTemplateId: uuid("form_template_id")
      .notNull()
      .references(() => formTemplate.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    sectionOrder: integer("section_order").notNull(),
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
    // Composite index on (tenant_id, form_template_id, section_order) for ordered retrieval
    tenantTemplateOrderIdx: index("idx_form_section_tenant_template_order")
      .on(table.tenantId, table.formTemplateId, table.sectionOrder)
      .where(sql`${table.deletedAt} IS NULL`),
  })
);

/**
 * Form Template Relations Update
 * Adds sections relationship to formTemplate
 */
export const formTemplateRelationsUpdate = relations(
  formTemplate,
  ({ many }) => ({
    sections: many(formSection),
  })
);

/**
 * Form Section Relations
 * Defines relationships with other tables for type-safe joins
 */
export const formSectionRelations = relations(formSection, ({ one }) => ({
  formTemplate: one(formTemplate, {
    fields: [formSection.formTemplateId],
    references: [formTemplate.id],
  }),
  tenant: one(tenants, {
    fields: [formSection.tenantId],
    references: [tenants.id],
  }),
  // fields will be imported from form-field
}));

// Type for inserting/selecting form sections
export type InsertFormSection = typeof formSection.$inferInsert;
export type SelectFormSection = typeof formSection.$inferSelect;
