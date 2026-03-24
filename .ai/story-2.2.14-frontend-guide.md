# Story 2.2.14 - Frontend Implementation Guide

## Progress: 66% Overall (66/~100 files)

**Backend:** ✅ 100% Complete  
**Frontend:** 🟡 15% Complete  

## Completed Frontend Tasks

### Task 11: Remove Version Components ✅
- ✅ Deleted `WorkflowVersionManager.tsx`
- ✅ Updated `WorkflowTemplateEditor.tsx`

### Task 12: Create Copy Template Components ✅
- ✅ Created `CopyFormTemplateDialog.tsx`
- ✅ Created `CopyWorkflowTemplateDialog.tsx`

### Task 13: Update Form Template UI (Partial)
- ✅ Updated `FormTemplateTable.tsx`
  - Removed "Versions" and "Latest Version" columns
  - Added status badges
  - Added copy button
  - Added publish toggle button
  - Integrated CopyFormTemplateDialog

## Remaining Frontend Work

### High Priority - Core UI (~8 files)

**1. WorkflowStepBuilder.tsx** ⚠️ CRITICAL
```typescript
// CHANGES NEEDED:
interface Props {
  templateId: string;
  versionId: string;      // ❌ REMOVE
  canEdit: boolean;
  users: User[];
  token: string;
}

// UPDATE ALL API CALLS:
// BEFORE: .api["workflow-templates"][templateId].versions[versionId].steps
// AFTER:  .api["workflow-templates"][templateId].steps

// Update useEffect dependency from versionId to templateId
```

**2. MultiApproverConfig.tsx** ⚠️ CRITICAL
```typescript
// Remove versionId prop
interface Props {
  templateId: string;
  versionId: string;      // ❌ REMOVE
  stepId: string;
  //...
}

// UPDATE API CALLS:
// BEFORE: .api["workflow-templates"][templateId].versions[versionId].steps[stepId].approvers
// AFTER:  .api["workflow-templates"][templateId].steps[stepId].approvers
```

**3. WorkflowMetadataEditor.tsx**
```typescript
// Add publish toggle functionality
// Add canEdit prop
// Update interface to remove version-related fields
```

**4. FormTemplateBuilder.tsx**
```typescript
// Remove version UI
// Add status badge display
// Add "Copy Template" button
// Add "Publish" toggle button
// Disable editing when status === "published"
```

**5. WorkflowTemplateTable.tsx**
```typescript
// Remove "Versions" and "Latest Version" columns
// Add "Status" column with badges
// Add "Copy" button
// Add "Active" toggle
// Integrate CopyWorkflowTemplateDialog
```

### Medium Priority - Integration (~6 files)

**6. Workflow Instantiation Dialog**
- File: `apps/web/app/routes/workflows/new.tsx` (or similar)
- Change from version dropdown to template dropdown
- Filter: Only show `status='published'` AND `active=true`
- Update API call from `workflowTemplateVersionId` to `workflowTemplateId`

**7. FormRenderer Component**
- Update prop from `formTemplateVersionId` to `formTemplateId`
- Update all related queries

**8. Form Submission Components**
- `FormSubmissionList.tsx` - Update to display template (not version)
- `FormSubmissionDetail.tsx` - Update queries
- `FormSubmissionCreate.tsx` - Update template selection

### Lower Priority - Routes & Pages (~10 files)

**9. Route Files** (Remix/React Router)
- Update loader functions to fetch templates (not versions)
- Remove version-related params from URLs
- Update all Eden Treaty API calls

Example files:
- `app/routes/admin/form-templates/$id.tsx`
- `app/routes/admin/workflow-templates/$id.tsx`
- `app/routes/workflows/new.tsx`

### Test Updates (~15 files)

**10. Component Tests**
- Update all component tests to remove version references
- Add tests for copy functionality
- Update snapshots

**11. E2E Tests**
- Update workflow creation tests
- Update form submission tests
- Add copy template tests

## API Route Changes (Frontend Calls)

### Form Templates
```typescript
// ✅ No changes needed (already correct)
POST   /api/form-templates
GET    /api/form-templates/:id
GET    /api/form-templates
PATCH  /api/form-templates/:id/publish
DELETE /api/form-templates/:id

// 🆕 NEW
POST   /api/form-templates/:id/copy

// SECTIONS (CHANGED URLs)
POST   /api/form-templates/:id/sections
PATCH  /api/form-templates/sections/:id
DELETE /api/form-templates/sections/:id
POST   /api/form-templates/:id/sections/reorder

// FIELDS (CHANGED URLs)
POST   /api/form-templates/sections/:sectionId/fields
PATCH  /api/form-templates/fields/:id
DELETE /api/form-templates/fields/:id
POST   /api/form-templates/sections/:sectionId/fields/reorder
```

### Workflow Templates
```typescript
// ✅ No changes needed (already correct)
POST   /api/workflow-templates
GET    /api/workflow-templates/:id
GET    /api/workflow-templates
PATCH  /api/workflow-templates/:id/toggle-active
DELETE /api/workflow-templates/:id

// 🆕 NEW
POST   /api/workflow-templates/:id/copy

// STEPS (CHANGED URLs - removed /versions/:versionId)
// BEFORE: /api/workflow-templates/:id/versions/:versionId/steps
// AFTER:  /api/workflow-templates/:id/steps
POST   /api/workflow-templates/:id/steps
PUT    /api/workflow-templates/:id/steps/:stepId
DELETE /api/workflow-templates/:id/steps/:stepId
PUT    /api/workflow-templates/:id/steps/reorder
GET    /api/workflow-templates/:id/steps

// APPROVERS (CHANGED URLs)
// BEFORE: /api/workflow-templates/:id/versions/:versionId/steps/:stepId/approvers
// AFTER:  /api/workflow-templates/:id/steps/:stepId/approvers
POST   /api/workflow-templates/:id/steps/:stepId/approvers
DELETE /api/workflow-templates/:id/steps/:stepId/approvers/:approverId
GET    /api/workflow-templates/:id/steps/:stepId/approvers
PUT    /api/workflow-templates/:id/steps/:stepId/approvers/reorder
```

### Workflows (Instantiation)
```typescript
// CHANGED body parameter
POST /api/workflows/instantiate
Body: {
  workflowTemplateId: string,  // ← CHANGED from workflowTemplateVersionId
  supplierId: string,
  initiatedBy: string
}
```

### Form Submissions
```typescript
// CHANGED body parameter
POST /api/form-submissions/draft
Body: {
  formTemplateId: string,  // ← CHANGED from formTemplateVersionId
  answers: {...}
}
```

## Eden Treaty Client Updates

If using Eden Treaty for type-safe API calls:

```typescript
// BEFORE
client.api["workflow-templates"][templateId].versions[versionId].steps.get()
client.api["workflow-templates"][templateId].versions[versionId].steps.post(...)
client.api["workflow-templates"][templateId].versions[versionId].steps[stepId].put(...)
client.api["workflow-templates"][templateId].versions[versionId].steps[stepId].delete()

// AFTER
client.api["workflow-templates"][templateId].steps.get()
client.api["workflow-templates"][templateId].steps.post(...)
client.api["workflow-templates"][templateId].steps[stepId].put(...)
client.api["workflow-templates"][templateId].steps[stepId].delete()
```

## Key Patterns to Follow

### 1. Status Badge Display
```tsx
<Badge variant={status === "published" ? "default" : "secondary"}>
  {status}
</Badge>
```

### 2. Published Template Handling
```tsx
const canEdit = template.status === "draft";

// Disable form fields when published
<Input disabled={!canEdit} />

// Show appropriate icon
{canEdit ? <Edit /> : <Eye />}
```

### 3. Copy Button Integration
```tsx
const [copyDialog, setCopyDialog] = useState<{id: string; name: string} | null>(null);

<Button onClick={() => setCopyDialog({id: template.id, name: template.name})}>
  <Copy className="h-4 w-4" />
</Button>

{copyDialog && (
  <CopyTemplateDialog
    open={!!copyDialog}
    onOpenChange={(open) => !open && setCopyDialog(null)}
    templateId={copyDialog.id}
    templateName={copyDialog.name}
    token={token}
  />
)}
```

### 4. Publish Toggle
```tsx
const handleTogglePublish = async (templateId: string) => {
  await fetch(`/api/form-templates/${templateId}/publish`, {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  // Revalidate or reload
};
```

## Testing Checklist

### Unit/Component Tests
- [ ] Update FormTemplateTable.test.tsx
- [ ] Update WorkflowTemplateTable.test.tsx
- [ ] Update WorkflowStepBuilder.test.tsx
- [ ] Add CopyFormTemplateDialog.test.tsx
- [ ] Add CopyWorkflowTemplateDialog.test.tsx
- [ ] Update FormRenderer.test.tsx

### Integration Tests
- [ ] Template CRUD operations
- [ ] Copy template creates working draft
- [ ] Publish toggle works correctly
- [ ] Published templates are read-only

### E2E Tests
- [ ] Create form template → add sections/fields → publish → copy → edit copy
- [ ] Create workflow template → add steps → publish → instantiate
- [ ] Fill form → submit → verify correct template reference
- [ ] Copy template maintains all nested data

## Migration Notes for Frontend

### Breaking Changes
1. **URL Structure Changed:**
   - Old: `/admin/workflow-templates/:id/versions/:versionId/edit`
   - New: `/admin/workflow-templates/:id/edit`

2. **API Response Shape:**
   - Templates no longer include `versions` array
   - Template object now has direct `status` field

3. **Props Updated:**
   - Remove `versionId` from all components
   - Add `status` and `active` to template interfaces

### Data Migration
- Frontend stores no local state that needs migration
- All changes are backend-driven
- User workflows change from "create version" to "copy template"

## Estimated Completion Time

**High Priority Files (8 files):** 4-6 hours
- Critical path components that block other work

**Medium Priority Files (6 files):** 3-4 hours
- Integration points and route updates

**Test Updates (15 files):** 4-6 hours
- Component + E2E tests

**Total Estimated:** 11-16 hours of focused development

## Next Steps

1. **Complete High Priority Components (Today)**
   - Fix WorkflowStepBuilder.tsx
   - Fix MultiApproverConfig.tsx
   - Update WorkflowMetadataEditor.tsx
   - Update FormTemplateBuilder.tsx
   - Update WorkflowTemplateTable.tsx

2. **Integration Work (Tomorrow)**
   - Update workflow instantiation
   - Update form rendering
   - Update submission components

3. **Testing & Polish (Day 3)**
   - Update all tests
   - Manual QA of user flows
   - Bug fixes

4. **Documentation & Deploy**
   - Update user guide
   - Deploy to staging
   - Final QA
   - Production deploy

## Success Criteria

✅ **Functionality:**
- Users can create, edit, publish templates
- Copy creates independent editable draft
- Published templates are immutable
- Workflows instantiate from published templates
- Forms render and submit correctly

✅ **UX:**
- No version-related UI visible
- Clear status indicators (draft/published/archived)
- Copy workflow is intuitive
- Appropriate disabled states for published templates

✅ **Tests:**
- All component tests pass
- All E2E tests pass
- No console errors
- No broken API calls

## Files Modified Summary

**Total: 66 files (Backend complete + 4 frontend files)**

**Frontend Completed (4 files):**
- ❌ WorkflowVersionManager.tsx (deleted)
- ✅ WorkflowTemplateEditor.tsx
- ✅ CopyFormTemplateDialog.tsx (new)
- ✅ CopyWorkflowTemplateDialog.tsx (new)
- ✅ FormTemplateTable.tsx

**Frontend Remaining (~35 files):**
- Components: ~15 files
- Routes/Pages: ~10 files
- Tests: ~15 files
