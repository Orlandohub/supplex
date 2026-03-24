# Data Models

This section defines the core data models that form the foundation of Supplex. These models are shared between frontend and backend through the `packages/types` workspace, ensuring type safety across the entire stack. All models include audit fields (created_at, updated_at, created_by) for compliance tracking.

**Design Principles:**

- **Normalized schema** for data integrity, denormalized views for performance
- **UUID primary keys** for distributed systems and security (no sequential ID guessing)
- **Soft deletes** for audit trail preservation (deleted_at timestamp)
- **JSONB fields** for flexible metadata and future extensibility
- **Enum types** for status fields (enforced at database level)
- **Foreign key constraints** with CASCADE/RESTRICT based on business rules

## Model 1: Tenant

**Purpose:** Represents a customer organization in the multi-tenant system. All other entities are scoped to a tenant for complete data isolation.

**Key Attributes:**

- `id`: UUID - Unique tenant identifier
- `name`: string - Organization name (e.g., "Acme Manufacturing GmbH")
- `slug`: string - URL-friendly identifier (e.g., "acme-manufacturing")
- `status`: enum - Active, Suspended, Cancelled
- `plan`: enum - Starter, Professional, Enterprise
- `settings`: JSONB - Tenant-specific configuration (evaluation schedules, notification preferences, custom fields)
- `subscription_ends_at`: timestamp - Subscription expiration for billing
- `created_at`: timestamp
- `updated_at`: timestamp

### TypeScript Interface

```typescript
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
```

### Relationships

- **One-to-Many** with User (a tenant has many users)
- **One-to-Many** with Supplier (a tenant has many suppliers)
- **One-to-Many** with Qualification (a tenant has many qualification workflows)
- **One-to-Many** with Evaluation (a tenant has many evaluations)
- **One-to-Many** with Complaint (a tenant has many complaints)

## Model 2: User

**Purpose:** Represents authenticated users within a tenant with role-based permissions. Users belong to exactly one tenant and have one primary role.

**Key Attributes:**

- `id`: UUID - Unique user identifier (matches Supabase auth.users.id)
- `tenant_id`: UUID - Foreign key to Tenant
- `email`: string - User email (unique within tenant)
- `full_name`: string - Display name
- `role`: enum - Admin, ProcurementManager, QualityManager, Viewer
- `avatar_url`: string | null - Profile picture URL
- `is_active`: boolean - Account enabled/disabled
- `last_login_at`: timestamp - Last authentication time
- `created_at`: timestamp
- `updated_at`: timestamp

### TypeScript Interface

```typescript
export enum UserRole {
  ADMIN = "admin",
  PROCUREMENT_MANAGER = "procurement_manager",
  QUALITY_MANAGER = "quality_manager",
  VIEWER = "viewer",
  SUPPLIER_USER = "supplier_user", // Added in Story 2.1.4
}

export interface User {
  id: string; // UUID (synced with Supabase auth.users.id)
  tenantId: string;
  email: string;
  fullName: string;
  role: UserRole; // Supports supplier_user role (Story 2.1.4)
  avatarUrl: string | null;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// Derived type for authenticated user context (used in loaders/actions)
export interface AuthenticatedUser extends User {
  tenant: Pick<Tenant, "id" | "name" | "plan" | "status">;
  permissions: string[]; // Computed from role
}
```

### Relationships

- **Many-to-One** with Tenant (each user belongs to one tenant)
- **One-to-One** with Supplier (supplier_user may be linked to one supplier as contact - Story 2.1.5)
- **One-to-Many** with Qualification (user creates qualifications)
- **One-to-Many** with Evaluation (user conducts evaluations)
- **One-to-Many** with Complaint (user files/owns complaints)
- **One-to-Many** with ActivityLog (user generates audit trail entries)

## Model 3: Supplier

**Purpose:** Core entity representing a supplier/vendor company. Contains master data, status tracking, and performance metrics.

**Key Attributes:**

- `id`: UUID - Unique supplier identifier
- `tenant_id`: UUID - Foreign key to Tenant
- `name`: string - Supplier company name
- `tax_id`: string - VAT/Tax identification number
- `category`: enum - RawMaterials, Components, Services, Packaging, Logistics
- `status`: enum - Prospect, Qualified, Approved, Conditional, Blocked
- `performance_score`: number - Overall score 1-5 (calculated from evaluations)
- `contact_name`: string - Primary contact person
- `contact_email`: string
- `contact_phone`: string
- `address`: JSONB - Full address structure
- `certifications`: JSONB - Array of certifications with expiration dates
- `metadata`: JSONB - Flexible field for custom tenant data
- `risk_score`: number - Manual or calculated risk assessment (1-10)
- `created_by`: UUID - User who created the supplier
- `created_at`: timestamp
- `updated_at`: timestamp
- `deleted_at`: timestamp | null - Soft delete

### TypeScript Interface

```typescript
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

export interface SupplierAddress {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface SupplierCertification {
  type: string; // e.g., "ISO 9001", "ISO 14001"
  issueDate: Date;
  expiryDate: Date;
  documentId?: string; // Reference to Document model
}

export interface Supplier {
  id: string; // UUID
  tenantId: string;
  name: string;
  taxId: string;
  category: SupplierCategory;
  status: SupplierStatus;
  performanceScore: number | null; // 1-5 scale, null if no evaluations yet
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  address: SupplierAddress;
  certifications: SupplierCertification[];
  metadata: Record<string, any>; // Tenant-specific custom fields
  riskScore: number | null; // 1-10 scale
  supplierUserId: string | null; // User ID of supplier contact (Story 2.1.5)
  createdBy: string; // User ID
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
```

### Relationships

- **Many-to-One** with Tenant (supplier belongs to one tenant)
- **Many-to-One** with User (supplier may have one contact user with platform access - Story 2.1.5)
- **One-to-Many** with Qualification (supplier has qualification history)
- **One-to-Many** with Evaluation (supplier receives periodic evaluations)
- **One-to-Many** with Complaint (complaints filed against supplier)
- **One-to-Many** with Document (supplier has document repository)

_(Additional models for Qualification, Evaluation, Complaint, Document, and ActivityLog follow the same detailed structure...)_

---
