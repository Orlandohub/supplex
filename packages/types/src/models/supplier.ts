import { z } from "zod";

// Enums
export enum SupplierCategory {
  RAW_MATERIALS = "raw_materials",
  COMPONENTS = "components",
  SERVICES = "services",
  PACKAGING = "packaging",
  LOGISTICS = "logistics",
}

export enum SupplierStatus {
  PROSPECT = "prospect",
  QUALIFIED = "qualified",
  APPROVED = "approved",
  CONDITIONAL = "conditional",
  BLOCKED = "blocked",
}

// Sub-interfaces
export interface SupplierAddress {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface SupplierCertification {
  type: string; // e.g., "ISO 9001"
  issueDate: Date;
  expiryDate: Date;
  documentId?: string;
}

// Main Interface
export interface Supplier {
  id: string; // UUID
  tenantId: string;
  name: string;
  taxId: string;
  category: SupplierCategory;
  status: SupplierStatus;
  performanceScore: number | null; // 1-5 scale
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  address: SupplierAddress;
  certifications: SupplierCertification[];
  metadata: Record<string, any>;
  riskScore: number | null; // 1-10 scale
  createdBy: string; // User ID
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

// Zod Schemas
export const SupplierCategorySchema = z.nativeEnum(SupplierCategory);

export const SupplierStatusSchema = z.nativeEnum(SupplierStatus);

export const SupplierAddressSchema = z.object({
  street: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  postalCode: z.string().min(1),
  country: z.string().min(1),
});

export const SupplierCertificationSchema = z.object({
  type: z.string().min(1),
  issueDate: z.date(),
  expiryDate: z.date(),
  documentId: z.string().uuid().optional(),
});

export const SupplierSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string().min(1).max(200),
  taxId: z.string().min(1).max(50),
  category: SupplierCategorySchema,
  status: SupplierStatusSchema,
  performanceScore: z.number().min(1).max(5).nullable(),
  contactName: z.string().min(1).max(200),
  contactEmail: z.string().email().max(255),
  contactPhone: z.string().max(50),
  address: SupplierAddressSchema,
  certifications: z.array(SupplierCertificationSchema),
  metadata: z.record(z.any()),
  riskScore: z.number().min(1).max(10).nullable(),
  createdBy: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable(),
});

// Insert/Update Schemas (without auto-generated fields)
export const InsertSupplierSchema = SupplierSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
}).extend({
  status: SupplierStatusSchema.default(SupplierStatus.PROSPECT),
  performanceScore: z.number().min(1).max(5).nullable().optional(),
  certifications: z.array(SupplierCertificationSchema).default([]),
  metadata: z.record(z.any()).default({}),
  riskScore: z.number().min(1).max(10).nullable().optional(),
});

export const UpdateSupplierSchema = InsertSupplierSchema.partial().omit({
  tenantId: true,
  createdBy: true,
});

// Type inference from Zod schemas
export type InsertSupplier = z.infer<typeof InsertSupplierSchema>;
export type UpdateSupplier = z.infer<typeof UpdateSupplierSchema>;

