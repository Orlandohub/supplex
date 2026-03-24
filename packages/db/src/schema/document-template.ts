import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tenants } from "./tenants";

/**
 * Document Template Table
 * Reusable document checklist templates for workflow steps
 * 
 * Purpose:
 * - Define required documents for workflow document steps
 * - Support both upload and validation document actions
 * - Enable reusability across multiple workflow templates
 * 
 * Document Structure:
 * required_documents JSONB format:
 * [
 *   {
 *     "name": "ISO 9001 Certificate",
 *     "description": "Current ISO certification",
 *     "required": true,
 *     "type": "certification"
 *   }
 * ]
 * 
 * Status Values:
 * - draft: Template is being created/edited
 * - published: Template is available for use in workflows
 * - archived: Template is deprecated but preserved for audit
 * 
 * Tenant Isolation:
 * - All queries must filter by tenant_id
 * - CASCADE delete when tenant is removed
 * - RESTRICT delete when referenced by workflow_step_template
 * 
 * Indexes:
 * - (tenant_id, status) - for published template filtering
 * - (tenant_id, is_default) - for default template lookup
 */
export const documentTemplate = pgTable(
  "document_template",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    templateName: varchar("template_name", { length: 200 }).notNull(),
    requiredDocuments: jsonb("required_documents").notNull().default([]),
    isDefault: boolean("is_default").notNull().default(false),
    status: varchar("status", { length: 50 }).notNull().default("published"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (table) => ({
    // Composite index on (tenant_id, status) for published template filtering
    tenantStatusIdx: index("idx_document_template_tenant_status")
      .on(table.tenantId, table.status)
      .where(sql`${table.deletedAt} IS NULL`),
    // Index on (tenant_id, is_default) for default template lookup
    tenantDefaultIdx: index("idx_document_template_tenant_default").on(
      table.tenantId,
      table.isDefault
    ),
  })
);

// Types for inserting/selecting document templates
export type InsertDocumentTemplate = typeof documentTemplate.$inferInsert;
export type SelectDocumentTemplate = typeof documentTemplate.$inferSelect;

