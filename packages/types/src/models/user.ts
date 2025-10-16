import { z } from "zod";

// Enums
export enum UserRole {
  ADMIN = "admin",
  PROCUREMENT_MANAGER = "procurement_manager",
  QUALITY_MANAGER = "quality_manager",
  VIEWER = "viewer",
}

// TypeScript Interface
export interface User {
  id: string; // UUID (synced with Supabase auth.users.id)
  tenantId: string;
  email: string;
  fullName: string;
  role: UserRole;
  avatarUrl: string | null;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// Zod Schemas
export const UserRoleSchema = z.nativeEnum(UserRole);

export const UserSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  email: z.string().email().max(255),
  fullName: z.string().min(1).max(200),
  role: UserRoleSchema,
  avatarUrl: z.string().url().max(500).nullable(),
  isActive: z.boolean(),
  lastLoginAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Insert/Update Schemas (without auto-generated fields)
export const InsertUserSchema = UserSchema.omit({
  createdAt: true,
  updatedAt: true,
}).extend({
  isActive: z.boolean().default(true),
  lastLoginAt: z.date().nullable().optional(),
});

export const UpdateUserSchema = InsertUserSchema.partial().omit({
  id: true,
  tenantId: true,
});

// Type inference from Zod schemas
export type InsertUser = z.infer<typeof InsertUserSchema>;
export type UpdateUser = z.infer<typeof UpdateUserSchema>;

