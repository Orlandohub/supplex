# Integration Tests - Story 2.2.3: Backoffice Form Builder UI

**Story:** 2.2.3 - Backoffice Form Builder UI (Tenant Scope)  
**Date Created:** 2026-01-21  
**Test Environment:** Local Development / Staging

---

## Test Scenario 1: Admin Creates New Form Template

**Objective:** Verify admin can create new form template and it appears in list

**Prerequisites:**
- User logged in with Admin role
- Access to Settings > Form Templates

**Steps:**
1. Navigate to Settings > Form Templates
2. Click "Create Template" button
3. Enter template name: "Test Supplier Qualification Form"
4. Click "Create Template"

**Expected Results:**
- ✅ Modal closes
- ✅ Redirects to edit page for new template
- ✅ Template appears in list with status "Draft"
- ✅ Initial version 1 created automatically
- ✅ Template is tenant-isolated (only visible to creating tenant)

**Status:** [ ] Pass [ ] Fail

---

## Test Scenario 2: Admin Adds Section to Draft Template

**Objective:** Verify admin can add sections to draft template

**Prerequisites:**
- Draft template exists
- User on template edit page

**Steps:**
1. Click "Add Section" button
2. Enter title: "Company Information"
3. Enter description: "Basic company details"
4. Click "Create Section"

**Expected Results:**
- ✅ Section appears in builder with title and description
- ✅ Section has order number 1
- ✅ "Add Field" button visible within section
- ✅ Section can be edited or deleted

**Status:** [ ] Pass [ ] Fail

---

## Test Scenario 3: Admin Adds Fields to Section

**Objective:** Verify admin can add fields to section

**Prerequisites:**
- Draft template with at least one section exists

**Steps:**
1. Click "Add Field" button within a section
2. Enter label: "Company Name"
3. Select field type: "Text (single line)"
4. Check "Mark as required field"
5. Enter placeholder: "Enter full legal company name"
6. Click "Create Field"

**Expected Results:**
- ✅ Field appears with correct label and type
- ✅ Required indicator (asterisk) displayed
- ✅ Field order starts at 1
- ✅ Field can be edited or deleted

**Status:** [ ] Pass [ ] Fail

---

## Test Scenario 4: Admin Marks Field as Required

**Objective:** Verify required flag is saved and displayed

**Prerequisites:**
- Field exists in draft template

**Steps:**
1. Click edit button on field
2. Check "Mark as required field" checkbox
3. Click "Save Changes"

**Expected Results:**
- ✅ Required flag saved successfully
- ✅ Asterisk icon displayed next to field label
- ✅ Changes persist after page refresh

**Status:** [ ] Pass [ ] Fail

---

## Test Scenario 5: Admin Configures Field Types

**Objective:** Verify all field types can be configured

**Prerequisites:**
- Draft template with section exists

**Steps:**
For each field type (text, textarea, number, date, dropdown, checkbox, multi_select):
1. Create new field with that type
2. Verify field appears with correct type badge

**Expected Results:**
- ✅ Text: Shows "text" badge
- ✅ Textarea: Shows "textarea" badge
- ✅ Number: Shows "number" badge
- ✅ Date: Shows "date" badge
- ✅ Dropdown: Shows "dropdown" badge
- ✅ Checkbox: Shows "checkbox" badge
- ✅ Multi Select: Shows "multi_select" badge

**Status:** [ ] Pass [ ] Fail

---

## Test Scenario 6: Admin Reorders Sections

**Objective:** Verify section reordering works correctly

**Prerequisites:**
- Draft template with at least 3 sections

**Steps:**
1. Click up arrow on section 2
2. Verify section 2 moves to position 1
3. Click down arrow on section 1 (now in position 2)
4. Verify section moves back down

**Expected Results:**
- ✅ Section order updates immediately
- ✅ Order numbers recalculate correctly
- ✅ Up arrow disabled on first section
- ✅ Down arrow disabled on last section
- ✅ Changes persist after page refresh

**Status:** [ ] Pass [ ] Fail

---

## Test Scenario 7: Admin Reorders Fields Within Section

**Objective:** Verify field reordering works correctly

**Prerequisites:**
- Section with at least 3 fields

**Steps:**
1. Click up arrow on field 2
2. Verify field 2 moves to position 1
3. Click down arrow on field 1 (now in position 2)
4. Verify field moves back down

**Expected Results:**
- ✅ Field order updates immediately
- ✅ Order numbers recalculate correctly
- ✅ Up arrow disabled on first field
- ✅ Down arrow disabled on last field
- ✅ Changes persist after page refresh

**Status:** [ ] Pass [ ] Fail

---

## Test Scenario 8: Admin Publishes Template

**Objective:** Verify version becomes immutable after publishing

**Prerequisites:**
- Draft template with at least 1 section and 1 field

**Steps:**
1. Click "Publish Version" button
2. Review confirmation dialog showing section/field count
3. Click "Yes, Publish Version"

**Expected Results:**
- ✅ Version status changes to "published"
- ✅ Published badge displayed
- ✅ All edit buttons disabled/hidden
- ✅ "Add Section" and "Add Field" buttons disabled
- ✅ Version is immutable (confirmed in database: is_published=true)

**Status:** [ ] Pass [ ] Fail

---

## Test Scenario 9: Admin Tries to Edit Published Version

**Objective:** Verify edit operations return error for published versions

**Prerequisites:**
- Published template version exists

**Steps:**
1. Attempt to edit section via API (use dev tools network tab)
2. Attempt to add field via API
3. Attempt to delete section via API

**Expected Results:**
- ✅ All operations return 400 error
- ✅ Error message indicates version is published
- ✅ No changes applied to database
- ✅ UI prevents edit actions (buttons disabled)

**Status:** [ ] Pass [ ] Fail

---

## Test Scenario 10: Non-Admin User Tries to Access Form Builder

**Objective:** Verify access control for non-admin users

**Prerequisites:**
- User logged in with Procurement Manager or Quality Manager role

**Steps:**
1. Navigate to Settings
2. Verify "Form Templates" card is not visible
3. Try to navigate directly to /settings/form-templates
4. Try to navigate to /settings/form-templates/{id}/edit

**Expected Results:**
- ✅ Form Templates option not visible in settings
- ✅ Direct URL access redirects to homepage
- ✅ 403 status code returned from API
- ✅ No form template data exposed

**Status:** [ ] Pass [ ] Fail

---

## Test Scenario 11: Cross-Tenant Access Attempt

**Objective:** Verify tenant isolation is enforced

**Prerequisites:**
- Two tenants with templates (Tenant A, Tenant B)
- User logged in as Tenant A admin

**Steps:**
1. Get template ID from Tenant B (via database or logs)
2. Try to access /settings/form-templates/{tenantB-templateId}/edit
3. Try to call GET API directly with Tenant B template ID

**Expected Results:**
- ✅ 404 or 403 error returned
- ✅ No template data from other tenant visible
- ✅ Cannot edit other tenant's templates
- ✅ Database queries include tenant filter

**Status:** [ ] Pass [ ] Fail

---

## Test Scenario 12: Admin Deletes Draft Template

**Objective:** Verify template soft delete works correctly

**Prerequisites:**
- Draft template exists

**Steps:**
1. On templates list page, click delete button
2. Confirm deletion in dialog
3. Verify template removed from list
4. Check database: deleted_at timestamp set

**Expected Results:**
- ✅ Template removed from list immediately
- ✅ Success toast notification shown
- ✅ Template soft-deleted (deleted_at IS NOT NULL)
- ✅ Template can be restored by updating deleted_at to NULL

**Status:** [ ] Pass [ ] Fail

---

## Test Scenario 13: Mobile View Form Builder

**Objective:** Verify responsive layout works on mobile devices

**Prerequisites:**
- Access to mobile device or browser dev tools

**Steps:**
1. Open form builder on mobile viewport (375px width)
2. Verify all buttons accessible
3. Test section/field CRUD operations
4. Test modals display correctly

**Expected Results:**
- ✅ Layout adapts to mobile screen
- ✅ Buttons are touch-friendly (min 44px)
- ✅ Modals are responsive
- ✅ No horizontal scrolling required
- ✅ All functionality works on touch devices

**Status:** [ ] Pass [ ] Fail

---

## Test Scenario 14: Admin Creates Complete Form Structure

**Objective:** Verify complex form structure can be created

**Prerequisites:**
- New draft template

**Steps:**
1. Create 5 sections with descriptive titles
2. Add 3-5 fields to each section (mix of types)
3. Mark some fields as required
4. Reorder sections and fields
5. Publish the version

**Expected Results:**
- ✅ All sections created successfully
- ✅ All fields created with correct types
- ✅ Required flags saved correctly
- ✅ Custom ordering maintained
- ✅ Version published successfully
- ✅ Complete structure visible in published version
- ✅ Database structure matches UI (verify with SQL query)

**Status:** [ ] Pass [ ] Fail

---

## Test Scenario 15: Create Dropdown Field with Options

**Objective:** Verify dropdown field can be created with options configuration

**Prerequisites:**
- Draft template with at least one section exists

**Steps:**
1. Click "Add Field" button within a section
2. Enter label: "Certification Type"
3. Select field type: "Dropdown"
4. Verify "Options" section appears below Required checkbox
5. Click "Add Option" button
6. Enter first option: value="iso9001", label="ISO 9001"
7. Click "Add Option" button again
8. Enter second option: value="iso14001", label="ISO 14001"
9. Click "Add Option" button again
10. Enter third option: value="iso45001", label="ISO 45001"
11. Click "Create Field"

**Expected Results:**
- ✅ Options section appears when Dropdown is selected
- ✅ Can add multiple options with value and label inputs
- ✅ Field created successfully with options
- ✅ Field displays in builder with "dropdown" badge
- ✅ Database: form_field.options JSONB contains {"choices": [{"value": "iso9001", "label": "ISO 9001"}, ...]}
- ✅ GET /form-templates/:id returns field with options.choices array

**Status:** [ ] Pass [ ] Fail

---

## Test Scenario 16: Edit Dropdown Field Options

**Objective:** Verify existing dropdown field options can be modified

**Prerequisites:**
- Dropdown field with 3 options exists in draft template

**Steps:**
1. Click edit button on dropdown field
2. Verify existing options are pre-populated in Options section
3. Remove second option (click trash icon)
4. Edit first option label to "ISO 9001:2015"
5. Click "Add Option" button
6. Enter new option: value="iso27001", label="ISO 27001"
7. Click "Save Changes"

**Expected Results:**
- ✅ Existing options appear in editor with correct values/labels
- ✅ Can remove option successfully
- ✅ Can edit existing option value/label
- ✅ Can add new option
- ✅ Field updated successfully
- ✅ Database reflects changes (2 original + 1 new - 1 removed = 3 total)
- ✅ Changes persist after page refresh

**Status:** [ ] Pass [ ] Fail

---

## Test Scenario 17: Validation - Dropdown Requires Options

**Objective:** Verify validation prevents creating dropdown without options

**Prerequisites:**
- Draft template with section exists

**Steps:**
1. Click "Add Field" button
2. Enter label: "Invalid Dropdown"
3. Select field type: "Dropdown"
4. Verify "Options" section appears with message "Add at least one option"
5. Do NOT add any options
6. Attempt to click "Create Field" button

**Expected Results:**
- ✅ "Create Field" button is disabled when options.length === 0
- ✅ Validation message displayed: "Add at least one option"
- ✅ Cannot save field without at least one option
- ✅ After adding one option, button becomes enabled
- ✅ Field creation succeeds after adding option

**Status:** [ ] Pass [ ] Fail

---

## Test Scenario 18: Multi-Select Field with Options

**Objective:** Verify multi-select field type supports options configuration

**Prerequisites:**
- Draft template with section exists

**Steps:**
1. Click "Add Field" button
2. Enter label: "Product Categories"
3. Select field type: "Multi Select"
4. Verify "Options" section appears
5. Add 4 options:
   - value="electronics", label="Electronics"
   - value="industrial", label="Industrial Equipment"
   - value="chemicals", label="Chemicals"
   - value="textiles", label="Textiles"
6. Click "Create Field"

**Expected Results:**
- ✅ Options section appears for multi_select field type
- ✅ Can add multiple options
- ✅ Field created successfully
- ✅ Field displays with "multi_select" badge
- ✅ Database: field_type = "multi_select" AND options.choices contains 4 items
- ✅ Options structure identical to dropdown (same schema)

**Status:** [ ] Pass [ ] Fail

---

## Summary

**Total Scenarios:** 18  
**Passed:** ___ / 18  
**Failed:** ___ / 18  
**Pass Rate:** ___%

**Critical Issues Found:**
- _List any blocking issues here_

**Non-Critical Issues Found:**
- _List any minor issues here_

**Recommendations:**
- _List any improvements or additional tests needed_

---

**Test Completed By:** _________________  
**Date:** _________________  
**Environment:** _________________  
**Story Status:** [ ] Ready for Review [ ] Changes Needed

