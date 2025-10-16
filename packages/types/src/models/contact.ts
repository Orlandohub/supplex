import { z } from "zod";

// TypeScript Interface
export interface Contact {
  id: string; // UUID
  tenantId: string;
  supplierId: string;
  name: string;
  title: string | null;
  email: string;
  phone: string | null;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Zod Schemas
export const ContactSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  supplierId: z.string().uuid(),
  name: z.string().min(1).max(200),
  title: z.string().max(100).nullable(),
  email: z.string().email().max(255),
  phone: z.string().max(50).nullable(),
  isPrimary: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Insert/Update Schemas (without auto-generated fields)
export const InsertContactSchema = ContactSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  isPrimary: z.boolean().default(false),
});

export const UpdateContactSchema = InsertContactSchema.partial().omit({
  tenantId: true,
  supplierId: true,
});

// Type inference from Zod schemas
export type InsertContact = z.infer<typeof InsertContactSchema>;
export type UpdateContact = z.infer<typeof UpdateContactSchema>;

