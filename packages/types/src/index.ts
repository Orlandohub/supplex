/**
 * Shared TypeScript types and Zod schemas for Supplex
 * This package is used by both frontend (Remix) and backend (ElysiaJS)
 */

import { z } from "zod";

/**
 * Discriminated union for API response envelopes.
 *
 * The runtime shape matches what `apps/api/src/lib/test-utils.ts:handleTestError`
 * produces and what every successful route under `apps/api/src/routes/**`
 * returns. Use this type at the HTTP boundary (loaders, test response narrowing)
 * so that `result.success` correctly narrows access to `result.data` versus
 * `result.error`.
 *
 * The success branch's `data` is optional because void operations (e.g. DELETE
 * routes) return `{ success: true }` without a `data` field.
 */
export type ApiResult<T = unknown> =
  | { success: true; data?: T }
  | { success: false; error: { code: string; message: string } };

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
 * Database Models (Story 1.2)
 * Export all entity types, enums, and Zod schemas
 */

// Tenant
export * from "./models/tenant";

// User
export * from "./models/user";
export * from "./models/user-helpers";

// Supplier
export * from "./models/supplier";

// Contact
export * from "./models/contact";

// Document
export * from "./models/document";

// Permissions
export * from "./models/permissions";

// Audit Logs
export * from "./models/audit-log";

// Legacy qualification system removed as per SCP-2026-01-31-001
// export * from "./models/qualification-workflow";
// export * from "./models/qualification-stage";
// export * from "./models/qualification-template";
// export * from "./models/workflow-document";
// export * from "./models/workflow-list";

// Email Notifications (Story 2.8)
export * from "./models/email-notification";
export * from "./models/notification-preferences";

// Workflow Events (Story 2.10)
export * from "./workflow-events";

// Workflow Engine (Story 2.2.1)
export * from "./models/workflow-engine";

// Form Templates (Story 2.2.2, 2.2.3)
export * from "./models/form-template";
export * from "./models/form-template-ui";

// Form Submissions (Story 2.2.4)
export * from "./models/form-submission";

// Task Template Library (Story 2.2.5)
export * from "./models/task";

// Workflow Templates (Story 2.2.6)
export * from "./models/workflow-template";

// Comment Threads (Story 2.2.8)
export * from "./models/comment-thread";

// Document Templates (Story 2.2.11)
export * from "./models/document-template";

// Shared Validation (Story 2.2.23)
export * from "./validation/form-field-validation";

// Utilities
// export * from "./utils/risk-calculator"; // REMOVED - Legacy qualification system utility

/**
 * Supabase Database Type Definition
 * Maps our models to Supabase's expected schema format
 */
export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string;
          name: string;
          slug: string;
          settings: Record<string, unknown>;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          settings?: Record<string, unknown>;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          settings?: Record<string, unknown>;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      users: {
        Row: {
          id: string;
          tenant_id: string;
          email: string;
          full_name: string;
          role: string;
          avatar_url: string | null;
          is_active: boolean;
          last_login_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          tenant_id: string;
          email: string;
          full_name: string;
          role: string;
          avatar_url?: string | null;
          is_active?: boolean;
          last_login_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          email?: string;
          full_name?: string;
          role?: string;
          avatar_url?: string | null;
          is_active?: boolean;
          last_login_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      suppliers: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          legal_name: string;
          registration_number: string | null;
          tax_number: string | null;
          website: string | null;
          industry: string | null;
          size: string | null;
          status: string;
          risk_level: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          legal_name: string;
          registration_number?: string | null;
          tax_number?: string | null;
          website?: string | null;
          industry?: string | null;
          size?: string | null;
          status?: string;
          risk_level?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          name?: string;
          legal_name?: string;
          registration_number?: string | null;
          tax_number?: string | null;
          website?: string | null;
          industry?: string | null;
          size?: string | null;
          status?: string;
          risk_level?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      contacts: {
        Row: {
          id: string;
          tenant_id: string;
          supplier_id: string | null;
          name: string;
          email: string;
          phone: string | null;
          role: string | null;
          is_primary: boolean;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          supplier_id?: string | null;
          name: string;
          email: string;
          phone?: string | null;
          role?: string | null;
          is_primary?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          supplier_id?: string | null;
          name?: string;
          email?: string;
          phone?: string | null;
          role?: string | null;
          is_primary?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      documents: {
        Row: {
          id: string;
          tenant_id: string;
          supplier_id: string | null;
          name: string;
          type: string;
          category: string;
          file_path: string;
          file_size: number;
          mime_type: string;
          version: number;
          status: string;
          expires_at: string | null;
          metadata: Record<string, unknown>;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          supplier_id?: string | null;
          name: string;
          type: string;
          category: string;
          file_path: string;
          file_size: number;
          mime_type: string;
          version?: number;
          status?: string;
          expires_at?: string | null;
          metadata?: Record<string, unknown>;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          supplier_id?: string | null;
          name?: string;
          type?: string;
          category?: string;
          file_path?: string;
          file_size?: number;
          mime_type?: string;
          version?: number;
          status?: string;
          expires_at?: string | null;
          metadata?: Record<string, unknown>;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      user_role: "admin" | "procurement_manager" | "quality_manager" | "viewer";
      supplier_status: "active" | "inactive" | "pending" | "suspended";
      supplier_risk_level: "low" | "medium" | "high" | "critical";
      supplier_size: "small" | "medium" | "large" | "enterprise";
      document_status:
        | "draft"
        | "pending_review"
        | "approved"
        | "rejected"
        | "expired";
      document_type:
        | "certificate"
        | "contract"
        | "compliance"
        | "financial"
        | "quality"
        | "other";
      document_category:
        | "iso_certificate"
        | "business_license"
        | "insurance"
        | "quality_manual"
        | "audit_report"
        | "other";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

/**
 * Export all schemas for validation
 */
export const schemas = {
  HealthCheckSchema,
};
