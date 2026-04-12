import { z } from "zod";

/**
 * Audit Action Types
 * Defines all trackable actions in the system
 */
export enum AuditAction {
  // User Management Actions
  USER_INVITED = "USER_INVITED",
  ROLE_CHANGED = "ROLE_CHANGED",
  USER_DEACTIVATED = "USER_DEACTIVATED",
  USER_REACTIVATED = "USER_REACTIVATED",
  USER_DELETED = "USER_DELETED",

  // Supplier Management Actions
  SUPPLIER_CREATED = "SUPPLIER_CREATED",
  SUPPLIER_UPDATED = "SUPPLIER_UPDATED",
  SUPPLIER_DELETED = "SUPPLIER_DELETED",
  SUPPLIER_CONTACT_ADDED = "SUPPLIER_CONTACT_ADDED",
  SUPPLIER_CONTACT_UPDATED = "SUPPLIER_CONTACT_UPDATED",

  // Document Actions
  DOCUMENT_UPLOADED = "DOCUMENT_UPLOADED",
  DOCUMENT_DELETED = "DOCUMENT_DELETED",

  // Evaluation Actions
  EVALUATION_CREATED = "EVALUATION_CREATED",
  EVALUATION_SUBMITTED = "EVALUATION_SUBMITTED",

  // Complaint Actions
  COMPLAINT_FILED = "COMPLAINT_FILED",
  CAPA_CREATED = "CAPA_CREATED",

  // Workflow Actions
  WORKFLOW_INITIATED = "WORKFLOW_INITIATED",
  WORKFLOW_TEMPLATE_DELETED = "WORKFLOW_TEMPLATE_DELETED",

  // Settings Actions
  TENANT_SETTINGS_UPDATED = "TENANT_SETTINGS_UPDATED",
}

/**
 * Audit Log Interface
 */
export interface AuditLog {
  id: string;
  tenantId: string;
  userId: string; // Who performed the action
  targetUserId: string | null; // Who was affected (for user management)
  action: AuditAction;
  details: Record<string, unknown>; // Action-specific context
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

/**
 * Zod Schemas
 */
export const AuditActionSchema = z.nativeEnum(AuditAction);

export const AuditLogSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  targetUserId: z.string().uuid().nullable(),
  action: AuditActionSchema,
  details: z.record(z.any()),
  ipAddress: z.string().max(50).nullable(),
  userAgent: z.string().max(500).nullable(),
  createdAt: z.date(),
});

export const InsertAuditLogSchema = AuditLogSchema.omit({
  id: true,
  createdAt: true,
});

export type InsertAuditLog = z.infer<typeof InsertAuditLogSchema>;

/**
 * Audit Detail Types
 * Type-safe structures for common audit event details
 */
export interface RoleChangedDetails {
  old_role: string;
  new_role: string;
}

export interface UserInvitedDetails {
  email: string;
  role: string;
  invited_by: string;
}

export interface UserStatusChangedDetails {
  old_status: boolean;
  new_status: boolean;
  reason?: string;
}

export interface SupplierActionDetails {
  supplier_id: string;
  supplier_name: string;
  changes?: Record<string, unknown>;
}
