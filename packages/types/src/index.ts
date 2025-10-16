/**
 * Shared TypeScript types and Zod schemas for Supplex
 * This package is used by both frontend (Remix) and backend (ElysiaJS)
 */

import { z } from "zod";

/**
 * Common response types
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Health check response
 */
export const HealthCheckSchema = z.object({
  status: z.enum(["ok", "degraded", "down"]),
  timestamp: z.string(),
  version: z.string().optional(),
});

export type HealthCheck = z.infer<typeof HealthCheckSchema>;

/**
 * User role types (will be expanded in Story 1.3)
 */
export const UserRoleSchema = z.enum([
  "admin",
  "procurement",
  "quality",
  "viewer",
]);
export type UserRole = z.infer<typeof UserRoleSchema>;

/**
 * Placeholder types for future implementation
 */
export interface User {
  id: string;
  email: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Export all schemas for validation
 */
export const schemas = {
  HealthCheckSchema,
  UserRoleSchema,
};
