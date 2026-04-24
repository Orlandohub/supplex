import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { tenants } from "./tenants";

/**
 * Form Template Status Enum
 * PostgreSQL ENUM type for database-level validation
 * Defines the lifecycle status of a form template
 */
export const formTemplateStatusEnum = pgEnum("form_template_status", [
  "draft",
  "published",
  "archived",
]);

/**
 * Form Template Status Constants
 * TypeScript constants for compile-time safety
 */
export const FormTemplateStatus = {
  DRAFT: "draft",
  PUBLISHED: "published",
  ARCHIVED: "archived",
} as const;

export type FormTemplateStatusType =
  (typeof FormTemplateStatus)[keyof typeof FormTemplateStatus];

/**
 * Form Template Table
 * Directly holds form template definitions without versioning
 * Templates can be copied to create new drafts for editing
 *
 * Tenant Isolation:
 * - All queries must filter by tenant_id
 * - CASCADE delete when tenant is removed
 *
 * Template Management:
 * - status: 'draft' = editable, 'published' = immutable (copy to edit), 'archived' = hidden
 * - isActive: Whether template is available for use (can be toggled without status change)
 *
 * Indexes:
 * - (tenant_id, status) - for filtering templates by status
 * - (tenant_id, is_active) - for filtering active templates
 */
export const formTemplate = pgTable(
  "form_template",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    status: formTemplateStatusEnum("status")
      .notNull()
      .default(FormTemplateStatus.DRAFT),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (table) => ({
    // Composite index on (tenant_id, status) for filtering templates
    tenantStatusIdx: index("idx_form_template_tenant_status")
      .on(table.tenantId, table.status)
      .where(sql`${table.deletedAt} IS NULL`),
    // Composite index on (tenant_id, is_active) for filtering active templates
    tenantActiveIdx: index("idx_form_template_tenant_active")
      .on(table.tenantId, table.isActive)
      .where(sql`${table.deletedAt} IS NULL`),
  })
);

/**
 * Form Template Relations
 * Defines relationships for form_template
 */
export const formTemplateRelations = relations(formTemplate, ({ one }) => ({
  tenant: one(tenants, {
    fields: [formTemplate.tenantId],
    references: [tenants.id],
  }),
  // sections relationship will be imported from form-section.ts
}));

// Type for inserting/selecting form templates
export type InsertFormTemplate = typeof formTemplate.$inferInsert;
export type SelectFormTemplate = typeof formTemplate.$inferSelect;
