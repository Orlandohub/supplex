# Sprint Change Proposal

**Date:** January 26, 2026  
**Proposal ID:** SCP-2026-01-26-001  
**Epic:** 2.2 - Dynamic Forms and Workflow Template Builder  
**Trigger:** Story 2.2.7.2 (Document Template Dropdown Implementation)  
**Status:** ✅ APPROVED

---

## Executive Summary

**Issue:** When selecting a step in the workflow as document type, the document template dropdown should use the existing `qualification_templates` table in the database, as it already provides the necessary functionality for defining required documents to be uploaded.

**Impact:** Low (enhancement/optimization)  
**Effort:** Low (1-2 hours)  
**Risk:** Minimal (additive changes only)

**Recommendation:** Implement direct adjustment by adding `status` field to `qualification_templates` and connecting it to the workflow builder's document template dropdown.

**Approval:** ✅ Approved by user on January 26, 2026

---

## Analysis Summary

### Change Context

Story 2.2.7.2 successfully implemented tenant-scoped dropdowns for form and document templates. However, the document template endpoint was implemented as a placeholder returning an empty array because document templates weren't yet built. 

**Key Discovery:** The `qualification_templates` table (existing legacy table) already contains the exact functionality needed:
- ✅ Tenant-isolated (`tenant_id` column)
- ✅ Template name for display
- ✅ Required documents definition (JSONB array)
- ✅ Soft delete support (`deleted_at`)
- ❌ Missing: `status` field (draft/published/archived) for lifecycle management

### Epic Impact

**Current Epic (2.2):** Can be completed with this enhancement
- Story 2.2.8 (Workflow Execution) benefits from simplified implementation
- Story 2.2.9 (Supplier Qualification Integration) becomes more natural
- No stories need to be abandoned or fundamentally changed

**Future Epics:** No impact

### Artifact Impact

**Database Schema:** Requires migration to add `status` field and FK constraint  
**API:** Update placeholder endpoint to query `qualification_templates`  
**UI:** Already implemented correctly (dropdown will automatically populate)  
**Documentation:** Update architecture docs and PRD to reflect implementation

### Rationale for Chosen Path

1. **Reuse over Rebuild:** `qualification_templates` already exists with proper tenant isolation
2. **Accelerates Delivery:** No need to build new document template system from scratch
3. **Simplifies Architecture:** One less table/system to maintain
4. **Backwards Compatible:** Existing qualification templates continue to work
5. **Future-Proof:** Adding `status` field enables proper lifecycle management

---

## Specific Proposed Edits

### 1. Database Migration

**Action:** Create new migration file

**File:** `packages/db/migrations/0013_add_status_to_qualification_templates.sql`

**Content:**

```sql
-- Migration: Add status field to qualification_templates
-- Story: 2.2.7.2 Extension - Connect Document Templates to Qualification Templates
-- Date: 2026-01-26

-- Add status column to qualification_templates
ALTER TABLE qualification_templates
ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'published';

-- Set existing records to 'published' status
UPDATE qualification_templates
SET status = 'published'
WHERE deleted_at IS NULL;

-- Create index for (tenant_id, status) filtering
CREATE INDEX idx_qualification_templates_tenant_status
ON qualification_templates(tenant_id, status)
WHERE deleted_at IS NULL;

-- Add foreign key constraint from workflow_step_template to qualification_templates
ALTER TABLE workflow_step_template
ADD CONSTRAINT fk_workflow_step_document_template
FOREIGN KEY (document_template_id)
REFERENCES qualification_templates(id)
ON DELETE RESTRICT;

-- Add index for document_template_id usage tracking
CREATE INDEX idx_workflow_step_template_document_template
ON workflow_step_template(document_template_id)
WHERE deleted_at IS NULL AND document_template_id IS NOT NULL;

-- Add comment to document_template_id column
COMMENT ON COLUMN workflow_step_template.document_template_id IS 
'FK to qualification_templates.id - defines required documents for this step';
```

**Rollback:**

```sql
-- Rollback: Remove status field and FK constraint
-- Migration: 0013_add_status_to_qualification_templates.sql

-- Drop index
DROP INDEX IF EXISTS idx_workflow_step_template_document_template;

-- Drop FK constraint
ALTER TABLE workflow_step_template
DROP CONSTRAINT IF EXISTS fk_workflow_step_document_template;

-- Drop index on qualification_templates
DROP INDEX IF EXISTS idx_qualification_templates_tenant_status;

-- Drop status column
ALTER TABLE qualification_templates
DROP COLUMN IF EXISTS status;
```

---

### 2. Drizzle Schema Updates

#### 2.1 Update `qualification-templates.ts`

**File:** `packages/db/src/schema/qualification-templates.ts`

**Change:** Add `status` field to schema

**From (Line 35-60):**

```typescript
export const qualificationTemplates = pgTable(
  "qualification_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    templateName: varchar("template_name", { length: 200 }).notNull(),
    requiredDocuments: jsonb("required_documents").notNull().default([]),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (table) => ({
    // Composite index on (tenant_id, is_default) for default template lookups
    tenantDefaultIdx: index("idx_qualification_templates_tenant_default").on(
      table.tenantId,
      table.isDefault
    ),
  })
);
```

**To:**

```typescript
export const qualificationTemplates = pgTable(
  "qualification_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    templateName: varchar("template_name", { length: 200 }).notNull(),
    requiredDocuments: jsonb("required_documents").notNull().default([]),
    isDefault: boolean("is_default").notNull().default(false),
    status: varchar("status", { length: 50 }).notNull().default("published"), // Added: 'draft', 'published', 'archived'
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (table) => ({
    // Composite index on (tenant_id, is_default) for default template lookups
    tenantDefaultIdx: index("idx_qualification_templates_tenant_default").on(
      table.tenantId,
      table.isDefault
    ),
    // Composite index on (tenant_id, status) for filtering by status
    tenantStatusIdx: index("idx_qualification_templates_tenant_status")
      .on(table.tenantId, table.status)
      .where(sql`${table.deletedAt} IS NULL`),
  })
);
```

**Additional Change:** Update file header comment (Lines 12-34):

Add after line 33:
```typescript
 *
 * Status Field (added 2026-01-26):
 * - 'draft': Template is being edited, not available for workflow selection
 * - 'published': Template is available for use in workflows
 * - 'archived': Template is deprecated, not available for new workflows
 * - Default: 'published' (for backwards compatibility with existing records)
```

#### 2.2 Update `workflow-step-template.ts`

**File:** `packages/db/src/schema/workflow-step-template.ts`

**Change 1:** Add import for qualificationTemplates (Line 17, after formTemplateVersion import):

**From:**
```typescript
import { formTemplateVersion } from "./form-template-version";
```

**To:**
```typescript
import { formTemplateVersion } from "./form-template-version";
import { qualificationTemplates } from "./qualification-templates";
```

**Change 2:** Update documentTemplateId field with FK constraint (Line 134):

**From:**
```typescript
    // Document integration
    documentTemplateId: uuid("document_template_id"), // Not yet implemented
    documentActionMode: documentActionModeEnum("document_action_mode"),
```

**To:**
```typescript
    // Document integration
    documentTemplateId: uuid("document_template_id").references(
      () => qualificationTemplates.id,
      { onDelete: "restrict" }
    ),
    documentActionMode: documentActionModeEnum("document_action_mode"),
```

**Change 3:** Update comment (Line 79-83):

**From:**
```typescript
 * Document Integration:
 * - document_template_id: Reference to document template (not yet implemented)
 * - document_action_mode:
 *   - 'upload': User uploads required documents
 *   - 'validate': User reviews documents and approves/declines
```

**To:**
```typescript
 * Document Integration:
 * - document_template_id: FK to qualification_templates.id (defines required documents)
 * - document_action_mode:
 *   - 'upload': User uploads required documents defined in qualification template
 *   - 'validate': User reviews uploaded documents and approves/declines
```

**Change 4:** Add index (Line 169, after formVersionIdx):

**Add:**
```typescript
    // Index on document_template_id for document usage tracking
    documentTemplateIdx: index("idx_workflow_step_template_document_template")
      .on(table.documentTemplateId)
      .where(
        sql`${table.deletedAt} IS NULL AND ${table.documentTemplateId} IS NOT NULL`
      ),
```

---

### 3. TypeScript Types Update

**File:** `packages/types/src/models/qualification-template.ts`

**Change:** Add `status` field to interface (after `isDefault` field):

**From (Lines 37-46):**
```typescript
export interface QualificationTemplate {
  id: string;
  tenantId: string;
  templateName: string;
  requiredDocuments: RequiredDocumentItem[];
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
```

**To:**
```typescript
export interface QualificationTemplate {
  id: string;
  tenantId: string;
  templateName: string;
  requiredDocuments: RequiredDocumentItem[];
  isDefault: boolean;
  status: 'draft' | 'published' | 'archived'; // Added: Template lifecycle status
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
```

---

### 4. API Endpoint Implementation

**File:** `apps/api/src/routes/document-templates/get-published-by-tenant.ts`

**Change:** Replace placeholder with real implementation

**From (Current placeholder):**
```typescript
import type { Request, Response } from "express";
import { authenticateToken } from "../../middleware/auth";

/**
 * GET /api/document-templates/published
 * Returns published document templates for current user's tenant
 * 
 * Placeholder: Document templates not yet implemented
 * Returns empty array until document template system is built
 */
export const getPublishedDocumentTemplates = [
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      // Placeholder: Return empty array
      return res.json([]);
    } catch (error) {
      console.error("Error fetching document templates:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },
];
```

**To:**
```typescript
import type { Request, Response } from "express";
import { authenticateToken } from "../../middleware/auth";
import { db } from "@supplex/db";
import { qualificationTemplates } from "@supplex/db/schema";
import { eq, and, isNull, asc } from "drizzle-orm";

/**
 * GET /api/document-templates/published
 * Returns published document templates (qualification templates) for current user's tenant
 * 
 * Query filters:
 * - tenant_id = current_user.tenant_id (tenant isolation)
 * - status = 'published' (only published templates)
 * - deleted_at IS NULL (exclude soft-deleted)
 * 
 * Response format: [{ id: uuid, label: string }]
 * Label format: Template name (e.g., "ISO Certification Documents")
 */
export const getPublishedDocumentTemplates = [
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      const tenantId = req.user?.tenantId;

      if (!userId || !tenantId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Query published qualification templates for tenant
      const templates = await db
        .select({
          id: qualificationTemplates.id,
          label: qualificationTemplates.templateName,
        })
        .from(qualificationTemplates)
        .where(
          and(
            eq(qualificationTemplates.tenantId, tenantId),
            eq(qualificationTemplates.status, "published"),
            isNull(qualificationTemplates.deletedAt)
          )
        )
        .orderBy(asc(qualificationTemplates.templateName));

      return res.json(templates);
    } catch (error) {
      console.error("Error fetching document templates:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },
];
```

---

### 5. API Validation Update

**File:** `apps/api/src/routes/workflow-templates/steps/create.ts`

**Change:** Add validation for `document_template_id` (similar to existing form validation)

**Location:** After form_template_version_id validation (around line 80-100)

**Add:**
```typescript
      // Validate document_template_id if provided
      if (document_template_id) {
        const documentTemplate = await db
          .select({ id: qualificationTemplates.id, status: qualificationTemplates.status })
          .from(qualificationTemplates)
          .where(
            and(
              eq(qualificationTemplates.id, document_template_id),
              eq(qualificationTemplates.tenantId, tenantId),
              isNull(qualificationTemplates.deletedAt)
            )
          )
          .limit(1);

        if (!documentTemplate || documentTemplate.length === 0) {
          return res.status(400).json({
            error: "Invalid document_template_id: Template not found or does not belong to your tenant",
          });
        }

        if (documentTemplate[0].status !== "published") {
          return res.status(400).json({
            error: "Invalid document_template_id: Template must be published",
          });
        }
      }
```

**File:** `apps/api/src/routes/workflow-templates/steps/update.ts`

**Change:** Add same validation as above (document_template_id validation)

---

### 6. Documentation Updates

#### 6.1 Update Architecture Document

**File:** `docs/architecture/workflow-template-schema.md`

**Change 1:** Update ERD diagram (Line 36):

**Add after line 36:**
```mermaid
    WORKFLOW_STEP_TEMPLATE }o--o| QUALIFICATION_TEMPLATES : "uses_documents"
```

**Change 2:** Update document integration section (Lines 193-195):

**From:**
```markdown
4. **Document Integration:**
   - `document_template_id`: Reference to document template (not yet implemented)
   - `document_action_mode`: 'upload' or 'validate'
```

**To:**
```markdown
4. **Document Integration:**
   - `document_template_id`: FK to `qualification_templates.id` (defines required documents)
   - `document_action_mode`: 'upload' or 'validate'
   - Note: Reuses existing `qualification_templates` table for document requirements
```

**Change 3:** Update Document Action Modes section (Lines 419-442):

**Add after line 442:**
```markdown

### Document Template Structure

Document templates are defined using the `qualification_templates` table, which specifies required documents in JSONB format:

```json
{
  "required_documents": [
    {
      "name": "ISO 9001 Certificate",
      "description": "Current ISO 9001 certification",
      "required": true,
      "type": "certification"
    },
    {
      "name": "W-9 Tax Form",
      "description": "IRS W-9 form",
      "required": true,
      "type": "tax"
    }
  ]
}
```

**Query Example:**
```sql
-- Get published document templates for tenant
SELECT id, template_name, required_documents
FROM qualification_templates
WHERE tenant_id = $1
  AND status = 'published'
  AND deleted_at IS NULL
ORDER BY template_name ASC;
```
```

#### 6.2 Update PRD - Story 2.2.7.2

**File:** `docs/prd/epic-2.2-dynamic-workflows.md`

**Change:** Update Story 2.2.7.2 Acceptance Criteria (Lines 330-352)

**From (Line 344-346):**
```markdown
When adding a workflow step with document integration, document template selection is a dropdown

The document template dropdown shows only document templates where tenant_id = current_user.tenant_id AND status = 'published'
```

**To:**
```markdown
When adding a workflow step with document integration, document template selection is a dropdown

The document template dropdown shows only qualification templates where tenant_id = current_user.tenant_id AND status = 'published'

Document template data comes from the qualification_templates table (reused for workflow document requirements)
```

#### 6.3 Update PRD - Story 2.2.8

**File:** `docs/prd/epic-2.2-dynamic-workflows.md`

**Change:** Update Story 2.2.8 Document Behavior section (Lines 398-418)

**From (Line 399-401):**
```markdown
Document behavior:

If document_action_mode = upload:

The assigned user must upload required documents and submit
```

**To:**
```markdown
Document behavior:

Document requirements are defined in the qualification_templates table referenced by document_template_id

If document_action_mode = upload:

The assigned user sees the list of required documents from qualification_templates.required_documents

The assigned user must upload required documents and submit
```

---

### 7. Testing Requirements

#### 7.1 Unit Tests - API Endpoint

**File:** `apps/api/src/routes/document-templates/__tests__/get-published-by-tenant.test.ts`

**Action:** Update tests to query real data instead of expecting empty array

**Key Test Cases:**
1. ✅ Returns published qualification templates for tenant
2. ✅ Excludes draft templates
3. ✅ Excludes archived templates
4. ✅ Excludes deleted templates
5. ✅ Tenant isolation (Tenant A cannot see Tenant B templates)
6. ✅ Templates sorted alphabetically
7. ✅ Unauthenticated requests rejected
8. ✅ Response format: `[{ id: uuid, label: string }]`

#### 7.2 Integration Tests

**File:** Create `apps/api/src/routes/workflow-templates/__tests__/document-template-integration.test.ts`

**Test Cases:**
1. Create qualification template → Set status to published → Appears in dropdown
2. Create workflow step with document_template_id → FK constraint validated
3. Attempt to use draft qualification template → Validation error
4. Attempt to use another tenant's template → Validation error
5. Delete qualification template → FK constraint prevents deletion (RESTRICT)

#### 7.3 Schema Tests

**File:** `packages/db/src/schema/__tests__/qualification-templates.test.ts`

**Test Cases:**
1. New qualification templates default to 'published' status
2. Status field accepts only valid values ('draft', 'published', 'archived')
3. Index on (tenant_id, status) improves query performance

---

## PRD MVP Impact

**MVP Scope:** ✅ No changes

This modification actually **accelerates** MVP delivery by:
1. Eliminating need to build new document template system
2. Reusing proven, tenant-isolated infrastructure
3. Simplifying Story 2.2.8 (Workflow Execution) implementation

---

## High-Level Action Plan

### Phase 1: Database & Schema (30 min)
1. Create migration `0013_add_status_to_qualification_templates.sql`
2. Run migration on development database
3. Update Drizzle schemas (`qualification-templates.ts`, `workflow-step-template.ts`)
4. Update TypeScript types (`qualification-template.ts`)
5. Verify schema changes with `npm run db:push`

### Phase 2: API Implementation (45 min)
1. Update `get-published-by-tenant.ts` endpoint implementation
2. Add validation to `steps/create.ts` and `steps/update.ts`
3. Write unit tests for endpoint
4. Write integration tests for FK constraints
5. Run test suite: `npm run test`

### Phase 3: Documentation (15 min)
1. Update `workflow-template-schema.md`
2. Update Epic 2.2 PRD (Stories 2.2.7.2 and 2.2.8)
3. Add inline code comments

### Phase 4: Verification (15 min)
1. Manual test: Create qualification template with status='published'
2. Manual test: Open workflow builder, verify template appears in dropdown
3. Manual test: Create workflow step with document template selected
4. Manual test: Verify FK constraint (attempt to delete used template)
5. Verify tenant isolation (switch tenants, verify dropdown filters correctly)

**Total Estimated Time:** 1-2 hours

---

## Agent Handoff Plan

**Development Agent (Priority: High, Next Action):**
- Implement all database, schema, and API changes
- Run test suite and verify all tests pass
- Perform manual verification in development environment

**QA Agent (Priority: Normal, After Dev Complete):**
- Verify tenant isolation in document template dropdown
- Test FK constraint behavior
- Test status field filtering (draft/published/archived)
- Verify backward compatibility with existing qualification templates

**Documentation Agent (Priority: Low, After QA):**
- Review and approve documentation changes
- Ensure consistency across architecture docs

---

## Success Criteria

**Definition of Done:**
- ✅ Migration applied successfully (status field added, FK constraint created)
- ✅ Document template dropdown shows published qualification templates for tenant
- ✅ Workflow steps can be created with document_template_id referencing qualification_templates
- ✅ Validation prevents using draft/archived/other-tenant templates
- ✅ All unit tests pass (100% coverage on new code)
- ✅ Integration tests verify FK constraints work correctly
- ✅ Documentation updated to reflect implementation
- ✅ Manual testing confirms end-to-end functionality

---

## Approval Record

**Date:** January 26, 2026  
**Approved By:** User  
**Status:** ✅ APPROVED - Ready for Implementation

**Next Action:** Handoff to Development Agent

