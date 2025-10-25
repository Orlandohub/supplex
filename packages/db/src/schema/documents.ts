import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  bigint,
  text,
  date,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { tenants } from "./tenants";
import { suppliers } from "./suppliers";
import { users } from "./users";

/**
 * Documents Table
 * Metadata for files stored in Supabase Storage
 */
export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    filename: varchar("filename", { length: 255 }).notNull(),
    documentType: varchar("document_type", { length: 50 }).notNull(),
    storagePath: varchar("storage_path", { length: 500 }).notNull(),
    fileSize: bigint("file_size", { mode: "number" }).notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    description: text("description"),
    expiryDate: date("expiry_date", { mode: "date" }),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (table) => ({
    // Index for tenant-based document lookups
    tenantIdIdx: index("idx_documents_tenant_id").on(table.tenantId),
    // Index for supplier-based document lookups
    supplierIdIdx: index("idx_documents_supplier_id").on(table.supplierId),
  })
);

// Type for inserting/selecting documents
export type InsertDocument = typeof documents.$inferInsert;
export type SelectDocument = typeof documents.$inferSelect;

// Relations
export const documentsRelations = relations(documents, ({ one }) => ({
  uploadedByUser: one(users, {
    fields: [documents.uploadedBy],
    references: [users.id],
  }),
  supplier: one(suppliers, {
    fields: [documents.supplierId],
    references: [suppliers.id],
  }),
}));
