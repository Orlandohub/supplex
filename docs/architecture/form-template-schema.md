# Form Template Schema

> **Story**: 2.2.2 - Form Template Data Model and Versioning (Tenant-Isolated)  
> **Date**: January 21, 2026  
> **Status**: Implemented
>
> **⚠️ Stale References (Story 2.2.23):** This document still references `form_template_version`. Template versioning was removed in Story 2.2.14. Sections now reference `form_template_id` directly. The actual schema in `packages/db/src/schema/` is the source of truth.

## Overview

The form template schema provides a versioned, tenant-isolated data model for dynamic form templates. This system allows tenants to create reusable form templates that can be versioned, published, and executed safely within their isolated environment.

## Table of Contents

- [Tables](#tables)
- [Relationships](#relationships)
- [Versioning Strategy](#versioning-strategy)
- [Tenant Isolation](#tenant-isolation)
- [Indexes and Performance](#indexes-and-performance)
- [Field Types](#field-types)
- [Validation Rules](#validation-rules)
- [Immutability Rules](#immutability-rules)
- [CASCADE Delete Behavior](#cascade-delete-behavior)
- [Example Queries](#example-queries)
- [ERD Diagram](#erd-diagram)

---

## Tables

### form_template

Container for form templates. Each template can have multiple versions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique identifier |
| tenant_id | UUID | NOT NULL, FK → tenants(id) CASCADE | Tenant isolation |
| name | VARCHAR(255) | NOT NULL | Template name |
| status | VARCHAR(50) | NOT NULL, DEFAULT 'draft' | Template status (draft, published, archived) |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | Last update timestamp |
| deleted_at | TIMESTAMP WITH TIME ZONE | NULL | Soft delete timestamp |

**Indexes:**
- `idx_form_template_tenant_status` on (tenant_id, status) WHERE deleted_at IS NULL

---

### form_template_version

Immutable versions of form templates. Published versions cannot be edited.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique identifier |
| form_template_id | UUID | NOT NULL, FK → form_template(id) CASCADE | Parent template |
| tenant_id | UUID | NOT NULL, FK → tenants(id) CASCADE | Tenant isolation |
| version | INTEGER | NOT NULL | Version number (1, 2, 3, ...) |
| status | VARCHAR(50) | NOT NULL, DEFAULT 'draft' | Version status |
| is_published | BOOLEAN | NOT NULL, DEFAULT false | Published flag |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | Last update timestamp |
| deleted_at | TIMESTAMP WITH TIME ZONE | NULL | Soft delete timestamp |

**Constraints:**
- `UNIQUE (form_template_id, version)` - Prevents duplicate version numbers
- `CHECK (is_published = false OR (is_published = true AND status = 'published'))` - Ensures consistency

**Indexes:**
- `idx_form_template_version_tenant_template_version` on (tenant_id, form_template_id, version) WHERE deleted_at IS NULL
- `idx_form_template_version_tenant_status` on (tenant_id, status) WHERE deleted_at IS NULL

---

### form_section

Sections within a form template version. Provides logical grouping of form fields.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique identifier |
| form_template_version_id | UUID | NOT NULL, FK → form_template_version(id) CASCADE | Parent version |
| tenant_id | UUID | NOT NULL, FK → tenants(id) CASCADE | Tenant isolation |
| section_order | INTEGER | NOT NULL | Display order (1, 2, 3, ...) |
| title | VARCHAR(255) | NOT NULL | Section title |
| description | TEXT | NULL | Section description |
| metadata | JSONB | NOT NULL, DEFAULT '{}' | Extensible metadata (icons, conditional display) |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | Last update timestamp |
| deleted_at | TIMESTAMP WITH TIME ZONE | NULL | Soft delete timestamp |

**Indexes:**
- `idx_form_section_tenant_version_order` on (tenant_id, form_template_version_id, section_order) WHERE deleted_at IS NULL

---

### form_field

Individual fields within a form section. Supports multiple field types with flexible validation.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique identifier |
| form_section_id | UUID | NOT NULL, FK → form_section(id) CASCADE | Parent section |
| tenant_id | UUID | NOT NULL, FK → tenants(id) CASCADE | Tenant isolation |
| field_order | INTEGER | NOT NULL | Display order (1, 2, 3, ...) |
| field_type | VARCHAR(50) | NOT NULL | Field type (see Field Types section) |
| label | VARCHAR(255) | NOT NULL | Field label |
| placeholder | TEXT | NULL | Placeholder text |
| required | BOOLEAN | NOT NULL, DEFAULT false | Required flag |
| validation_rules | JSONB | NOT NULL, DEFAULT '{}' | Validation patterns (see Validation Rules section) |
| options | JSONB | NOT NULL, DEFAULT '{}' | Field options for dropdown/multi_select |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | Last update timestamp |
| deleted_at | TIMESTAMP WITH TIME ZONE | NULL | Soft delete timestamp |

**Indexes:**
- `idx_form_field_tenant_section_order` on (tenant_id, form_section_id, field_order) WHERE deleted_at IS NULL

---

## Relationships

```
tenant (1) ----< (N) form_template
               |
               +----< (N) form_template_version
                      |
                      +----< (N) form_section
                             |
                             +----< (N) form_field
```

**Relationship Summary:**
- One tenant has many form templates
- One form template has many versions
- One form template version has many sections
- One form section has many fields

**Foreign Key Cascade Rules:**
- `tenant_id` → CASCADE: Deleting tenant removes all form data
- `form_template_id` → CASCADE: Deleting template removes all versions, sections, fields
- `form_template_version_id` → CASCADE: Deleting version removes all sections and fields
- `form_section_id` → CASCADE: Deleting section removes all fields

---

## Versioning Strategy

### Version Numbers

- Version numbers are sequential integers: 1, 2, 3, ...
- Unique constraint on (form_template_id, version) prevents duplicates
- Each publish creates a new version with incremented version number

### Version Statuses

| Status | Description | Mutable? |
|--------|-------------|----------|
| `draft` | Work in progress | Yes |
| `published` | Immutable published version | No (enforced at application level) |
| `archived` | Deprecated version | No (enforced at application level) |

### Status Transitions

```
draft → published → archived
  ↓
delete
```

- `draft` → `published`: Creates new immutable version
- `published` → `archived`: Soft deprecation (no longer selectable)
- `draft` can be edited or deleted at any time
- `published` and `archived` are immutable (enforced at application level)

### is_published Flag

The `is_published` boolean flag provides a quick way to identify published versions without parsing the status string. A CHECK constraint ensures:

```sql
CHECK (is_published = false OR (is_published = true AND status = 'published'))
```

This means `is_published = true` can only exist when `status = 'published'`.

---

## Tenant Isolation

### Enforcement Strategy

**Database Level:**
- All tables include `tenant_id` foreign key with CASCADE delete
- All composite indexes start with `tenant_id` for query performance
- Foreign keys enforce referential integrity

**Application Level:**
- All queries MUST filter by `tenant_id`
- User authentication provides `tenant_id` context
- Middleware enforces tenant context on all operations

### Tenant Context Pattern

```typescript
// Good: Tenant-filtered query
const templates = await db
  .select()
  .from(formTemplate)
  .where(
    and(
      eq(formTemplate.tenantId, userTenantId),
      eq(formTemplate.deletedAt, null)
    )
  );

// Bad: Missing tenant filter (security risk)
const templates = await db
  .select()
  .from(formTemplate)
  .where(eq(formTemplate.deletedAt, null));
```

---

## Indexes and Performance

### Index Design Principles

1. **Tenant-First Indexing**: All composite indexes start with `tenant_id`
2. **Partial Indexes**: Use `WHERE deleted_at IS NULL` to exclude soft-deleted records
3. **Covering Indexes**: Include commonly queried columns in index

### Index List

| Index Name | Columns | Where Clause | Purpose |
|------------|---------|--------------|---------|
| idx_form_template_tenant_status | (tenant_id, status) | deleted_at IS NULL | Filter templates by status |
| idx_form_template_version_tenant_template_version | (tenant_id, form_template_id, version) | deleted_at IS NULL | Version lookups |
| idx_form_template_version_tenant_status | (tenant_id, status) | deleted_at IS NULL | Filter versions by status |
| idx_form_section_tenant_version_order | (tenant_id, form_template_version_id, section_order) | deleted_at IS NULL | Ordered section retrieval |
| idx_form_field_tenant_section_order | (tenant_id, form_section_id, field_order) | deleted_at IS NULL | Ordered field retrieval |

### Query Optimization Patterns

**Pattern 1: Get published templates for tenant**
```sql
SELECT * FROM form_template 
WHERE tenant_id = $1 AND status = 'published' AND deleted_at IS NULL;
-- Uses: idx_form_template_tenant_status
```

**Pattern 2: Get latest version**
```sql
SELECT * FROM form_template_version 
WHERE tenant_id = $1 AND form_template_id = $2 AND deleted_at IS NULL 
ORDER BY version DESC LIMIT 1;
-- Uses: idx_form_template_version_tenant_template_version
```

**Pattern 3: Get ordered sections**
```sql
SELECT * FROM form_section 
WHERE tenant_id = $1 AND form_template_version_id = $2 AND deleted_at IS NULL 
ORDER BY section_order ASC;
-- Uses: idx_form_section_tenant_version_order
```

---

## Field Types

The system supports seven field types:

| Field Type | Description | Requires Options JSONB? |
|------------|-------------|-------------------------|
| `text` | Single-line text input | No |
| `textarea` | Multi-line text input | No |
| `number` | Numeric input | No |
| `date` | Date picker | No |
| `dropdown` | Single-select dropdown | Yes |
| `checkbox` | Boolean checkbox | No |
| `multi_select` | Multi-select checkboxes | Yes |

### Field Type Usage Examples

```typescript
// Text field
{
  fieldType: "text",
  label: "Email Address",
  placeholder: "user@example.com",
  required: true
}

// Dropdown field
{
  fieldType: "dropdown",
  label: "Certification Type",
  required: true,
  options: {
    choices: [
      { value: "iso9001", label: "ISO 9001" },
      { value: "iso14001", label: "ISO 14001" }
    ]
  }
}

// Multi-select field
{
  fieldType: "multi_select",
  label: "Compliance Certifications",
  required: false,
  options: {
    choices: [
      { value: "rohs", label: "RoHS Compliant" },
      { value: "reach", label: "REACH Compliant" },
      { value: "ce", label: "CE Marking" }
    ]
  }
}
```

---

## Validation Rules

The `validation_rules` JSONB field supports flexible validation patterns:

### Validation Rules Structure

```typescript
interface ValidationRules {
  minLength?: number;      // Minimum string length
  maxLength?: number;      // Maximum string length
  pattern?: string;        // Regex pattern
  min?: number;           // Minimum numeric value
  max?: number;           // Maximum numeric value
  customMessage?: string; // Custom error message
}
```

### Validation Examples

**Example 1: Email validation**
```json
{
  "validation_rules": {
    "pattern": "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
    "customMessage": "Please enter a valid email address"
  }
}
```

**Example 2: Text length constraints**
```json
{
  "validation_rules": {
    "minLength": 10,
    "maxLength": 500,
    "customMessage": "Description must be between 10 and 500 characters"
  }
}
```

**Example 3: Numeric range**
```json
{
  "validation_rules": {
    "min": 0,
    "max": 100,
    "customMessage": "Score must be between 0 and 100"
  }
}
```

---

## Immutability Rules

### Database Level

The database schema does NOT enforce immutability. All fields can be updated at the database level. This provides flexibility for:
- Data corrections by administrators
- Migration operations
- Emergency fixes

### Application Level

**Application-level enforcement** (to be implemented in repository layer):

1. **Published Versions**: Once `is_published = true`, the version and its sections/fields cannot be edited
2. **Archived Versions**: Cannot be edited or deleted
3. **Draft Versions**: Can be freely edited or deleted

**Implementation Pattern (future stories):**
```typescript
// Repository layer check
if (version.isPublished || version.status === 'archived') {
  throw new Error('Cannot modify published or archived versions');
}
```

**Why Application-Level?**
- Allows administrative overrides when necessary
- Simplifies data migration and corrections
- Provides audit trail through database timestamps
- More flexible than database-level constraints

---

## CASCADE Delete Behavior

### Delete Tenant

**Cascades to:**
- All form_template records
- All form_template_version records
- All form_section records
- All form_field records

**SQL:**
```sql
DELETE FROM tenants WHERE id = $1;
-- Automatically removes all related form data
```

### Delete Form Template

**Cascades to:**
- All form_template_version records for this template
- All form_section records for these versions
- All form_field records for these sections

**SQL:**
```sql
DELETE FROM form_template WHERE id = $1;
-- Automatically removes all versions, sections, and fields
```

### Delete Form Template Version

**Cascades to:**
- All form_section records for this version
- All form_field records for these sections

**SQL:**
```sql
DELETE FROM form_template_version WHERE id = $1;
-- Automatically removes all sections and fields
```

### Delete Form Section

**Cascades to:**
- All form_field records for this section

**SQL:**
```sql
DELETE FROM form_section WHERE id = $1;
-- Automatically removes all fields
```

### Soft Delete Pattern

All tables support soft deletes via `deleted_at` timestamp:

```sql
-- Soft delete (preferred)
UPDATE form_template 
SET deleted_at = NOW() 
WHERE id = $1;

-- Hard delete (use with caution)
DELETE FROM form_template WHERE id = $1;
```

---

## Example Queries

### Query 1: Get all published templates for tenant

```sql
SELECT * FROM form_template 
WHERE tenant_id = 'xxx' 
  AND status = 'published' 
  AND deleted_at IS NULL
ORDER BY name ASC;
```

### Query 2: Get latest version of a template

```sql
SELECT * FROM form_template_version 
WHERE tenant_id = 'xxx' 
  AND form_template_id = 'yyy' 
  AND deleted_at IS NULL 
ORDER BY version DESC 
LIMIT 1;
```

### Query 3: Get complete form structure

```sql
SELECT 
  t.id as template_id,
  t.name as template_name,
  v.id as version_id,
  v.version,
  s.id as section_id,
  s.title as section_title,
  s.section_order,
  f.id as field_id,
  f.label as field_label,
  f.field_type,
  f.field_order
FROM form_template t
JOIN form_template_version v ON t.id = v.form_template_id
LEFT JOIN form_section s ON v.id = s.form_template_version_id
LEFT JOIN form_field f ON s.id = f.form_section_id
WHERE t.tenant_id = 'xxx' 
  AND v.id = 'yyy' 
  AND t.deleted_at IS NULL
  AND (s.deleted_at IS NULL OR s.id IS NULL)
  AND (f.deleted_at IS NULL OR f.id IS NULL)
ORDER BY s.section_order, f.field_order;
```

### Query 4: Count published versions per template

```sql
SELECT 
  form_template_id,
  COUNT(*) as version_count
FROM form_template_version
WHERE tenant_id = 'xxx' 
  AND is_published = true 
  AND deleted_at IS NULL
GROUP BY form_template_id;
```

### Query 5: Get all fields for a section (with validation)

```sql
SELECT 
  id,
  field_order,
  field_type,
  label,
  placeholder,
  required,
  validation_rules,
  options
FROM form_field
WHERE tenant_id = 'xxx'
  AND form_section_id = 'yyy'
  AND deleted_at IS NULL
ORDER BY field_order ASC;
```

---

## ERD Diagram

```
┌─────────────────┐
│    tenants      │
│─────────────────│
│ id (PK)         │
│ name            │
│ slug            │
└────────┬────────┘
         │
         │ 1:N (CASCADE)
         │
┌────────▼────────┐
│ form_template   │
│─────────────────│
│ id (PK)         │
│ tenant_id (FK)  │
│ name            │
│ status          │
│ created_at      │
│ updated_at      │
│ deleted_at      │
└────────┬────────┘
         │
         │ 1:N (CASCADE)
         │
┌────────▼─────────────────┐
│ form_template_version    │
│──────────────────────────│
│ id (PK)                  │
│ form_template_id (FK)    │
│ tenant_id (FK)           │
│ version                  │
│ status                   │
│ is_published             │
│ created_at               │
│ updated_at               │
│ deleted_at               │
│ UNIQUE(template_id, ver) │
└────────┬─────────────────┘
         │
         │ 1:N (CASCADE)
         │
┌────────▼─────────────────────┐
│ form_section                 │
│──────────────────────────────│
│ id (PK)                      │
│ form_template_version_id(FK) │
│ tenant_id (FK)               │
│ section_order                │
│ title                        │
│ description                  │
│ metadata (JSONB)             │
│ created_at                   │
│ updated_at                   │
│ deleted_at                   │
└────────┬─────────────────────┘
         │
         │ 1:N (CASCADE)
         │
┌────────▼────────────────┐
│ form_field              │
│─────────────────────────│
│ id (PK)                 │
│ form_section_id (FK)    │
│ tenant_id (FK)          │
│ field_order             │
│ field_type              │
│ label                   │
│ placeholder             │
│ required                │
│ validation_rules(JSONB) │
│ options (JSONB)         │
│ created_at              │
│ updated_at              │
│ deleted_at              │
└─────────────────────────┘
```

### Relationship Legend

- **PK**: Primary Key
- **FK**: Foreign Key
- **1:N**: One-to-Many relationship
- **CASCADE**: Foreign key with CASCADE delete

---

## Implementation Files

**Database Schema:**
- `packages/db/src/schema/form-template.ts`
- `packages/db/src/schema/form-template-version.ts`
- `packages/db/src/schema/form-section.ts`
- `packages/db/src/schema/form-field.ts`

**TypeScript Types:**
- `packages/types/src/models/form-template.ts`

**Migration:**
- `packages/db/migrations/0007_add_form_template_tables.sql`

**Tests:**
- `packages/db/src/schema/__tests__/form-template-tenant-isolation.test.ts`

---

## Next Steps

This schema provides the foundation for:

1. **Story 2.2.3**: Form Template Builder UI
2. **Story 2.2.4**: Form Instance Execution Engine
3. **Story 2.2.5**: Form Response Storage and Retrieval

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-01-21 | 1.0 | Initial documentation | James (Dev Agent) |

---

