import { z } from "zod";

// Enums
export enum TenantStatus {
  ACTIVE = "active",
  SUSPENDED = "suspended",
  CANCELLED = "cancelled",
}

export enum TenantPlan {
  STARTER = "starter",
  PROFESSIONAL = "professional",
  ENTERPRISE = "enterprise",
}

// TypeScript Interface
export interface Tenant {
  id: string; // UUID
  name: string;
  slug: string;
  status: TenantStatus;
  plan: TenantPlan;
  settings: {
    evaluationFrequency?: "monthly" | "quarterly" | "annually";
    notificationEmail?: string;
    customFields?: Record<string, any>;
    qualificationRequirements?: string[];
  };
  subscriptionEndsAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// Zod Schemas
export const TenantStatusSchema = z.nativeEnum(TenantStatus);

export const TenantPlanSchema = z.nativeEnum(TenantPlan);

export const TenantSettingsSchema = z.object({
  evaluationFrequency: z.enum(["monthly", "quarterly", "annually"]).optional(),
  notificationEmail: z.string().email().optional(),
  customFields: z.record(z.any()).optional(),
  qualificationRequirements: z.array(z.string()).optional(),
});

export const TenantSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  status: TenantStatusSchema,
  plan: TenantPlanSchema,
  settings: TenantSettingsSchema,
  subscriptionEndsAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Insert/Update Schemas (without auto-generated fields)
export const InsertTenantSchema = TenantSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const UpdateTenantSchema = InsertTenantSchema.partial();

// Type inference from Zod schemas
export type InsertTenant = z.infer<typeof InsertTenantSchema>;
export type UpdateTenant = z.infer<typeof UpdateTenantSchema>;

