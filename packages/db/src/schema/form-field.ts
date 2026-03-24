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
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { tenants } from "./tenants";
import { formSection } from "./form-section";

/**
 * Field Type Enum
 * PostgreSQL ENUM type for database-level validation
 * Defines supported form field input types
 */
export const fieldTypeEnum = pgEnum("field_type", [
  "text",
  "textarea",
  "number",
  "date",
  "dropdown",
  "checkbox",
  "multi_select",
]);

/**
 * Field Type Constants
 * TypeScript constants for compile-time safety
 */
export const FieldType = {
  TEXT: "text",
  TEXTAREA: "textarea",
  NUMBER: "number",
  DATE: "date",
  DROPDOWN: "dropdown",
  CHECKBOX: "checkbox",
  MULTI_SELECT: "multi_select",
} as const;

export type FieldTypeType = (typeof FieldType)[keyof typeof FieldType];

/**
 * Form Field Table
 * Individual fields within a form section
 * Supports multiple field types with flexible validation
 *
 * Tenant Isolation:
 * - All queries must filter by tenant_id
 * - CASCADE delete when tenant or form_section is removed
 *
 * Ordering:
 * - field_order determines display order within a section
 *
 * JSONB Fields:
 * - validation_rules: Flexible validation patterns (minLength, maxLength, pattern, min, max, customMessage)
 * - options: For dropdown/multi_select fields (array of {value, label} objects)
 *
 * Indexes:
 * - (tenant_id, form_section_id, field_order) - for ordered field retrieval
 */
export const formField = pgTable(
  "form_field",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    formSectionId: uuid("form_section_id")
      .notNull()
      .references(() => formSection.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    fieldOrder: integer("field_order").notNull(),
    fieldType: fieldTypeEnum("field_type").notNull(),
    label: varchar("label", { length: 255 }).notNull(),
    placeholder: text("placeholder"),
    required: boolean("required").notNull().default(false),
    validationRules: jsonb("validation_rules").notNull().default({}),
    options: jsonb("options").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (table) => ({
    // Composite index on (tenant_id, form_section_id, field_order) for ordered retrieval
    tenantSectionOrderIdx: index("idx_form_field_tenant_section_order")
      .on(table.tenantId, table.formSectionId, table.fieldOrder)
      .where(sql`${table.deletedAt} IS NULL`),
  })
);

/**
 * Form Section Relations Update
 * Adds fields relationship to formSection
 */
export const formSectionRelationsUpdate = relations(
  formSection,
  ({ one, many }) => ({
    fields: many(formField),
  })
);

/**
 * Form Field Relations
 * Defines relationships with other tables for type-safe joins
 */
export const formFieldRelations = relations(formField, ({ one }) => ({
  formSection: one(formSection, {
    fields: [formField.formSectionId],
    references: [formSection.id],
  }),
  tenant: one(tenants, {
    fields: [formField.tenantId],
    references: [tenants.id],
  }),
}));

// Type for inserting/selecting form fields
export type InsertFormField = typeof formField.$inferInsert;
export type SelectFormField = typeof formField.$inferSelect;

