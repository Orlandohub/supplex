import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  jsonb,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

/**
 * Document Checklists Table
 * Templates defining required documents for supplier qualification
 *
 * required_documents JSONB Structure:
 * [
 *   {
 *     name: "ISO 9001 Certificate",
 *     description: "Current ISO certification",
 *     required: true,
 *     type: "certification"
 *   },
 *   {
 *     name: "W-9 Tax Form",
 *     description: "IRS W-9 form",
 *     required: true,
 *     type: "tax"
 *   }
 * ]
 *
 * Indexes:
 * - (tenant_id, is_default) - for quickly finding default templates
 */
export const documentChecklists = pgTable(
  "document_checklists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    templateName: varchar("template_name", { length: 200 }).notNull(),
    requiredDocuments: jsonb("required_documents").notNull().default([]),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (table) => ({
    // Composite index on (tenant_id, is_default) for default template lookups
    tenantDefaultIdx: index("idx_document_checklists_tenant_default").on(
      table.tenantId,
      table.isDefault
    ),
  })
);

// Type for inserting/selecting document checklists
export type InsertDocumentChecklist = typeof documentChecklists.$inferInsert;
export type SelectDocumentChecklist = typeof documentChecklists.$inferSelect;
