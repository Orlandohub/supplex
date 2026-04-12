import { z } from "zod";

// Enums
export enum DocumentType {
  CERTIFICATE = "certificate",
  CONTRACT = "contract",
  INSURANCE = "insurance",
  AUDIT_REPORT = "audit_report",
  WORKFLOW_DOCUMENT = "workflow_document",
  OTHER = "other",
}

// TypeScript Interface
export interface Document {
  id: string; // UUID
  tenantId: string;
  supplierId: string;
  filename: string;
  documentType: DocumentType;
  storagePath: string;
  fileSize: number; // Bytes
  mimeType: string;
  description: string | null;
  expiryDate: Date | null;
  uploadedBy: string; // User ID
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

// Zod Schemas
export const DocumentTypeSchema = z.nativeEnum(DocumentType);

export const DocumentSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  supplierId: z.string().uuid(),
  filename: z.string().min(1).max(255),
  documentType: DocumentTypeSchema,
  storagePath: z.string().max(500),
  fileSize: z.number().int().positive(),
  mimeType: z.string().max(100),
  description: z.string().nullable(),
  expiryDate: z.date().nullable(),
  uploadedBy: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable(),
});

// Insert/Update Schemas (without auto-generated fields)
export const InsertDocumentSchema = DocumentSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});

export const UpdateDocumentSchema = InsertDocumentSchema.partial().omit({
  tenantId: true,
  supplierId: true,
  uploadedBy: true,
});

// Type inference from Zod schemas
export type InsertDocument = z.infer<typeof InsertDocumentSchema>;
export type UpdateDocument = z.infer<typeof UpdateDocumentSchema>;

