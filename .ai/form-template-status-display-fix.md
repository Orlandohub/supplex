# Form Template Status Display Fix

## Issue
The form template list was showing incorrect status information:
1. **Status column showed "draft"** for templates with published versions
2. **Edit icon was shown** even when the latest version was published (read-only)

## Root Cause

Form templates have a two-level status system:

### Template Level Status (`formTemplate.status`)
- Parent container status: draft/published/archived
- Less relevant for UI - mainly for organizational purposes

### Version Level Status (`formTemplateVersion.isPublished`, `formTemplateVersion.status`)
- Individual version status that determines if it's editable
- **This is what users care about**: Is the current version published (read-only) or draft (editable)?

The UI was incorrectly displaying the **template status** instead of the **latest version status**.

## Solution

### Modified File: `apps/web/app/components/form-templates/FormTemplateTable.tsx`

#### Changes Made:

1. **Import Eye icon for view-only state**
```tsx
import { Edit, Trash2, FileText, Eye } from "lucide-react";
```

2. **Updated status badge logic**
```tsx
const getStatusBadgeVariant = (isPublished: boolean, status: string) => {
  if (isPublished) {
    return "default"; // Published version
  }
  switch (status) {
    case "draft":
      return "secondary";
    case "archived":
      return "outline";
    default:
      return "secondary";
  }
};
```

3. **Display latest version status instead of template status**
```tsx
// Determine if latest version is published (read-only)
const isPublished = template.latestVersion?.isPublished ?? false;

// Show latest version status, not template status
const displayStatus = template.latestVersion 
  ? (template.latestVersion.isPublished ? "published" : template.latestVersion.status)
  : "draft";
```

4. **Conditional icon based on version status**
```tsx
<Button
  variant="ghost"
  size="sm"
  onClick={() => handleEdit(template.id)}
  title={isPublished ? "View template (read-only)" : "Edit template"}
>
  {isPublished ? (
    <Eye className="h-4 w-4" />
  ) : (
    <Edit className="h-4 w-4" />
  )}
</Button>
```

## Result

### Before:
- ❌ Template with published version showed "draft" status
- ❌ Edit icon suggested the template could be edited
- ❌ Confusing mismatch between list and detail views

### After:
- ✅ Status column shows the **latest version status** (published/draft)
- ✅ Eye icon (👁️) indicates read-only published templates
- ✅ Edit icon (✏️) indicates editable draft templates  
- ✅ Tooltip clarifies the action: "View template (read-only)" or "Edit template"
- ✅ Consistent status display between list and detail views

## Data Model Reference

### FormTemplateListItem (from API)
```typescript
{
  id: string;
  name: string;
  status: FormTemplateStatus;        // ← Template status (less relevant)
  versionCount: number;
  latestVersion: {
    id: string;
    version: number;
    status: string;                  // ← Version status
    isPublished: boolean;            // ← Key field for UI
  } | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}
```

## Testing

✅ Templates with published versions now show "published" status
✅ Eye icon appears for published templates
✅ Edit icon appears for draft templates
✅ Tooltips provide clear action descriptions
✅ No linter errors introduced
