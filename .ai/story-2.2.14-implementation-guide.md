# Story 2.2.14: Implementation Progress & Remaining Work

## ✅ Completed Work (27 files)

### Phase 1: Database Schema & Migration - COMPLETE
- ✅ Migration SQL with rollback capability
- ✅ Data export TypeScript script
- ✅ All schema files updated (no more version tables)
- ✅ TypeScript types updated
- ✅ Form template test updated

### Phase 2: Backend API - 40% COMPLETE
- ✅ Deleted 5 version endpoints + directory
- ✅ Created 2 copy template endpoints (deep copy with transactions)
- ✅ Updated route index files
- ✅ Updated form-templates/create.ts

## 🔄 Remaining Work

### Phase 2: Backend API Remaining (Priority: HIGH)

#### A. Form Template Endpoints (12 files to update)

**Pattern to Follow:**
1. Remove `formTemplateVersion` imports
2. Change route params from `:templateId/versions/:versionId` to `:templateId`
3. Update FK references from `formTemplateVersionId` to `formTemplateId`
4. Remove version-related queries and joins
5. Add draft status validation where needed

**Files:**
1. `sections/create.ts` - Change to `/:templateId/sections` (no versionId)
2. `sections/update.ts` - Validate template is draft
3. `sections/delete.ts` - Validate template is draft
4. `sections/reorder.ts` - Change to `/:templateId/sections/reorder`
5. `fields/create.ts` - Validate template is draft via section
6. `fields/update.ts` - Validate template is draft via section
7. `fields/delete.ts` - Validate template is draft via section
8. `fields/reorder.ts` - Validate template is draft
9. `get.ts` - Join sections directly (no version table)
10. `list.ts` - Remove version data, show status/isActive
11. `publish.ts` - Simple status toggle (no version creation)
12. `get-published-by-tenant.ts` - Query published templates directly

#### B. Workflow Template Endpoints (6 files to update)

**Files:**
1. `create.ts` - Already has no version creation
2. `update.ts` - Verify no version logic
3. `get.ts` - Remove any version joins
4. `list.ts` - Remove version data
5. `steps/create.ts` - Change to reference `workflow_template_id`
6. `steps/list.ts` - Query by `workflow_template_id`

#### C. Workflow Instantiation (Task 8)
- `apps/api/src/routes/workflows/instantiate.ts`
- `apps/api/src/lib/workflow-engine/instantiate-workflow.ts`

**Changes:**
- Accept `workflowTemplateId` instead of `workflowTemplateVersionId`
- Query steps using `workflowTemplateId`

#### D. Form Submission (Task 9)
- `apps/api/src/routes/form-submissions/create-draft.ts`
- `apps/api/src/routes/form-submissions/submit.ts`
- `apps/api/src/routes/form-submissions/get.ts`

**Changes:**
- Accept `formTemplateId` instead of `formTemplateVersionId`
- Join with `form_template` not `form_template_version`

#### E. API Tests (Task 10)
Update all `__tests__` files to remove version references.

### Phase 3: Frontend UI (30+ files, Priority: MEDIUM)

#### Key Components to Update:
1. **Form Templates:**
   - `FormTemplateTable.tsx` - Remove version column, add Copy button
   - `FormTemplateBuilder.tsx` - Show status, remove version UI
   - `PublishConfirmModal.tsx` - Change to status toggle
   - `CopyTemplateDialog.tsx` - NEW (already planned in story)

2. **Workflow Templates:**
   - Remove `WorkflowVersionManager.tsx`
   - Update template tables to show status
   - Add Copy button to template lists
   - `CopyTemplateDialog.tsx` - NEW

3. **Form Runtime:**
   - `FormRenderer.tsx` - Accept `formTemplateId` prop
   - Update all form submission routes

4. **Workflow Instantiation:**
   - `InitiateWorkflowDialog.tsx` - Show templates not versions

### Phase 4: Documentation (Priority: LOW)
- Update architecture docs
- Update PRD references
- Final testing & validation

## 🎯 Recommended Next Steps

1. **Complete Phase 2 Backend** (Most critical)
   - Finish updating all form template CRUD endpoints
   - Update workflow template endpoints  
   - Update workflow instantiation
   - Update form submission

2. **Run Migration** (Before frontend work)
   - Export data: `bun run packages/db/scripts/migrate-template-versions.ts`
   - Run migration: `bun run packages/db/migrate`
   - Verify schema changes

3. **Frontend Updates** (After backend complete)
   - Update component props and API calls
   - Remove version-related UI elements
   - Add copy template functionality

4. **Testing & Documentation**
   - Update all tests
   - Update docs
   - Final validation

## 📝 Quick Reference: Common Changes

### Route Parameter Changes
```typescript
// BEFORE
POST /api/form-templates/:templateId/versions/:versionId/sections

// AFTER  
POST /api/form-templates/:templateId/sections
```

### Database Query Changes
```typescript
// BEFORE
const [section] = await db
  .select()
  .from(formSection)
  .where(eq(formSection.formTemplateVersionId, versionId));

// AFTER
const [section] = await db
  .select()
  .from(formSection)
  .where(eq(formSection.formTemplateId, templateId));
```

### Status Validation Pattern
```typescript
// Add to any mutation endpoint
const [template] = await db
  .select()
  .from(formTemplate)
  .where(
    and(
      eq(formTemplate.id, templateId),
      eq(formTemplate.tenantId, user.tenantId),
      eq(formTemplate.status, 'draft'), // Only allow changes to drafts
      isNull(formTemplate.deletedAt)
    )
  );

if (!template) {
  throw new Error("Template not found or not editable");
}
```

## 🔍 Files Already Updated

**Database:**
- migrations/0020_remove_template_versioning.sql
- scripts/migrate-template-versions.ts
- schema files (10 files)

**Types:**
- packages/types/src/models/* (3 files)

**API:**
- form-templates/copy.ts (NEW)
- form-templates/create.ts (UPDATED)
- workflow-templates/copy.ts (NEW)
- Both index files (UPDATED)

**Total Progress: 27 files / ~100 files = 27% complete**
