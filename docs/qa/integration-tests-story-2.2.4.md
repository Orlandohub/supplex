# Integration Tests - Story 2.2.4: Form Runtime Execution with Save Draft

**Story**: 2.2.4  
**Feature**: Form Runtime Execution with Save Draft  
**Date Created**: January 22, 2026  
**Status**: Ready for Manual Testing

---

## Overview

This document outlines integration test scenarios for the Form Runtime Execution feature, including draft saving, form submission, validation, and tenant isolation.

---

## Test Prerequisites

### Required Test Data

1. **Test Tenant**: Tenant with ID and name
2. **Test Users**:
   - Admin user (for template creation)
   - Supplier user (for form submission)
3. **Test Form Template**:
   - Status: Published
   - Version: 1+
   - Sections: At least 2 sections
   - Fields: Mix of field types (text, number, dropdown, required/optional)

### Test Environment Setup

```bash
# Ensure database is up and running
cd packages/db
bun run db:migrate

# Start API server
cd apps/api
bun run dev

# Start web app
cd apps/web
bun run dev
```

---

## Test Scenarios

### Test 1: Create Draft Submission with Partial Answers

**Objective**: Verify that users can save drafts without completing required fields (AC: 2)

**API Endpoint**: `POST /api/form-submissions/draft`

**Request**:
```json
{
  "formTemplateVersionId": "uuid-of-published-version",
  "processInstanceId": null,
  "answers": [
    {
      "formFieldId": "uuid-of-text-field",
      "answerValue": "Partial answer"
    },
    {
      "formFieldId": "uuid-of-number-field",
      "answerValue": "42"
    }
  ]
}
```

**Expected Response**: 201 Created
```json
{
  "success": true,
  "data": {
    "submission": {
      "id": "uuid",
      "status": "draft",
      "submittedAt": null,
      "answers": [...]
    }
  }
}
```

**Verification**:
- Submission record created with status='draft'
- Answers saved in form_answer table
- Required fields NOT validated
- submitted_at is NULL

---

### Test 2: Edit Draft Submission (Update Answers)

**Objective**: Verify that draft submissions can be edited (AC: 3)

**API Endpoint**: `POST /api/form-submissions/draft`

**Request**: Same as Test 1 (with same formTemplateVersionId + user)

**Expected Response**: 200 OK (existing draft updated)

**Verification**:
- Existing submission updated (not duplicated)
- Answers upserted (existing answers updated, new answers added)
- updated_at timestamp changed
- Status remains 'draft'

---

### Test 3: Submit Form with All Required Fields

**Objective**: Verify that forms can be submitted when all required fields are filled (AC: 4)

**API Endpoint**: `POST /api/form-submissions/{submissionId}/submit`

**Prerequisites**: Draft submission with all required fields filled

**Expected Response**: 200 OK
```json
{
  "success": true,
  "data": {
    "submission": {
      "id": "uuid",
      "status": "submitted",
      "submittedAt": "2026-01-22T10:30:00Z",
      "answers": [...]
    }
  }
}
```

**Verification**:
- Status changed to 'submitted'
- submitted_at timestamp set
- All required fields have valid answers
- Form becomes immutable

---

### Test 4: Attempt to Submit Form Missing Required Field

**Objective**: Verify that submission fails if required fields are missing (AC: 4)

**API Endpoint**: `POST /api/form-submissions/{submissionId}/submit`

**Prerequisites**: Draft submission with at least one required field empty

**Expected Response**: 400 Bad Request
```json
{
  "success": false,
  "error": {
    "code": "REQUIRED_FIELD_MISSING",
    "message": "Missing required fields: Email Address, Phone Number",
    "details": {
      "missingFields": ["Email Address", "Phone Number"]
    },
    "timestamp": "2026-01-22T10:30:00Z"
  }
}
```

**Verification**:
- Submission status remains 'draft'
- Error includes specific field labels
- submitted_at remains NULL

---

### Test 5: Attempt to Edit Submitted Form

**Objective**: Verify that submitted forms are read-only (AC: 5)

**API Endpoint**: `POST /api/form-submissions/{submissionId}/submit`

**Prerequisites**: Already submitted form

**Expected Response**: 400 Bad Request
```json
{
  "success": false,
  "error": {
    "code": "ALREADY_SUBMITTED",
    "message": "This form has already been submitted and cannot be modified",
    "timestamp": "2026-01-22T10:30:00Z"
  }
}
```

**Verification**:
- Cannot re-submit
- UI shows read-only mode
- All input fields disabled
- Save Draft and Submit buttons hidden

---

### Test 6: Attempt to Access Another Tenant's Submission

**Objective**: Verify tenant isolation (AC: 7)

**API Endpoint**: `GET /api/form-submissions/{submissionId}`

**Prerequisites**: 
- Submission from Tenant A
- User authenticated as Tenant B

**Expected Response**: 404 Not Found
```json
{
  "success": false,
  "error": {
    "code": "SUBMISSION_NOT_FOUND",
    "message": "Submission not found or you don't have access to it",
    "timestamp": "2026-01-22T10:30:00Z"
  }
}
```

**Verification**:
- No data leaked
- Tenant isolation enforced in database query
- Error message doesn't reveal existence

---

### Test 7: Create Submission Linked to Process Instance

**Objective**: Verify UNIQUE constraint for workflow integration

**API Endpoint**: `POST /api/form-submissions/draft`

**Request**:
```json
{
  "formTemplateVersionId": "uuid-of-version",
  "processInstanceId": "uuid-of-process",
  "answers": [...]
}
```

**Expected Response**: 201 Created (first submission)

**Second Request**: Same data (duplicate)

**Expected Response**: 200 OK (existing submission updated)

**Verification**:
- Only one submission exists for (formTemplateVersionId + processInstanceId)
- UNIQUE constraint prevents duplicates
- Second request updates existing submission

---

### Test 8: Render Form Dynamically from Form Template Version

**Objective**: Verify dynamic form rendering (AC: 1)

**UI Route**: `/forms/new?formTemplateVersionId={uuid}`

**Steps**:
1. Navigate to form creation page
2. Form should render with all sections in order
3. Each section should display fields in order
4. Field types should render correctly:
   - Text → Input
   - Textarea → Textarea
   - Number → Input type="number"
   - Date → DatePicker
   - Dropdown → Select
   - Checkbox → Checkbox
   - Multi-select → Multiple checkboxes

**Expected Result**:
- All sections visible in correct order
- All fields visible in correct order within sections
- Required fields marked with asterisk (*)
- Placeholders displayed
- Validation rules applied

**Screenshot**: Capture full form with all field types

---

### Test 9: Validate Number Field with Min/Max

**Objective**: Verify field type validation

**API Endpoint**: `POST /api/form-submissions/draft`

**Request** (with invalid number):
```json
{
  "formTemplateVersionId": "uuid",
  "answers": [
    {
      "formFieldId": "uuid-of-number-field-with-min-10-max-100",
      "answerValue": "5"
    }
  ]
}
```

**Expected Response**: 400 Bad Request
```json
{
  "success": false,
  "error": {
    "code": "INVALID_ANSWER_FORMAT",
    "message": "Age: Must be at least 10",
    "timestamp": "2026-01-22T10:30:00Z"
  }
}
```

**Verification**:
- Validation rules enforced
- Error message includes field label and rule
- Client-side validation also triggers

---

### Test 10: Validate Dropdown Selection

**Objective**: Verify dropdown value validation

**API Endpoint**: `POST /api/form-submissions/draft`

**Request** (with invalid dropdown value):
```json
{
  "formTemplateVersionId": "uuid",
  "answers": [
    {
      "formFieldId": "uuid-of-dropdown-field",
      "answerValue": "invalid-value-not-in-choices"
    }
  ]
}
```

**Expected Response**: 400 Bad Request
```json
{
  "success": false,
  "error": {
    "code": "INVALID_ANSWER_FORMAT",
    "message": "Certification Type: Must be one of: iso9001, iso14001, iso45001",
    "timestamp": "2026-01-22T10:30:00Z"
  }
}
```

**Verification**:
- Only valid option values accepted
- Dropdown options from field.options.choices
- Server-side validation matches client-side

---

## UI Test Steps

### Form Execution Flow (E2E)

1. **Create Draft**:
   - Navigate to `/forms/new?formTemplateVersionId={uuid}`
   - Fill in some fields (not all required)
   - Click "Save Draft"
   - Verify success toast: "Draft saved successfully"
   - Verify redirect to `/forms/{submissionId}`

2. **Edit Draft**:
   - Navigate to `/forms/{submissionId}` (draft status)
   - Form pre-populated with saved answers
   - Fill in more fields
   - Click "Save Draft"
   - Verify success toast

3. **Submit Form**:
   - Complete all required fields
   - "Submit Form" button becomes enabled
   - Click "Submit Form"
   - Verify confirmation modal (if implemented)
   - Confirm submission
   - Verify success toast: "Form submitted successfully"
   - Verify redirect to read-only view

4. **View Submitted Form**:
   - Navigate to `/forms/{submissionId}` (submitted status)
   - All fields displayed but disabled
   - Banner: "This form has been submitted and is now read-only"
   - No Save Draft or Submit buttons
   - Answers displayed correctly

---

## Test Data Examples

### Test Form Template

```sql
-- Form Template
INSERT INTO form_template (id, tenant_id, name, status) VALUES
('test-template-id', 'test-tenant-id', 'Supplier Qualification Form', 'published');

-- Form Template Version
INSERT INTO form_template_version (id, form_template_id, tenant_id, version, status, is_published) VALUES
('test-version-id', 'test-template-id', 'test-tenant-id', 1, 'published', true);

-- Section 1: Company Information
INSERT INTO form_section (id, form_template_version_id, tenant_id, section_order, title, description) VALUES
('section-1-id', 'test-version-id', 'test-tenant-id', 1, 'Company Information', 'Basic company details');

-- Field 1.1: Company Name (text, required)
INSERT INTO form_field (id, form_section_id, tenant_id, field_order, field_type, label, required) VALUES
('field-1-1-id', 'section-1-id', 'test-tenant-id', 1, 'text', 'Company Name', true);

-- Field 1.2: Number of Employees (number, min: 1, max: 10000)
INSERT INTO form_field (id, form_section_id, tenant_id, field_order, field_type, label, required, validation_rules) VALUES
('field-1-2-id', 'section-1-id', 'test-tenant-id', 2, 'number', 'Number of Employees', false, '{"min": 1, "max": 10000}');

-- Field 1.3: Certification Type (dropdown, required)
INSERT INTO form_field (id, form_section_id, tenant_id, field_order, field_type, label, required, options) VALUES
('field-1-3-id', 'section-1-id', 'test-tenant-id', 3, 'dropdown', 'Certification Type', true, '{"choices": [{"value": "iso9001", "label": "ISO 9001"}, {"value": "iso14001", "label": "ISO 14001"}]}');
```

---

## Expected Test Results Summary

| Test | Expected Result | Pass/Fail | Notes |
|------|----------------|-----------|-------|
| 1 | Draft created without required fields | ☐ | |
| 2 | Draft updated on re-save | ☐ | |
| 3 | Form submitted when all required fields filled | ☐ | |
| 4 | Validation error when required field missing | ☐ | |
| 5 | Cannot edit submitted form | ☐ | |
| 6 | Tenant isolation enforced | ☐ | |
| 7 | UNIQUE constraint works for process_instance_id | ☐ | |
| 8 | Form renders dynamically with all field types | ☐ | |
| 9 | Number field validation works | ☐ | |
| 10 | Dropdown validation works | ☐ | |

---

## Test Execution Checklist

- [ ] Database migration applied successfully
- [ ] Test data seeded
- [ ] API server running
- [ ] Web app running
- [ ] All 10 integration tests executed
- [ ] UI flow tested end-to-end
- [ ] All tests passed
- [ ] Screenshots captured
- [ ] Issues logged (if any)

---

## Notes

- Manual testing required for MVP (automated E2E tests in Phase 2)
- Use Postman or similar tool for API testing
- Use browser DevTools Network tab to inspect requests/responses
- Test with different user roles and tenants
- Verify database state after each test

---

**Test Execution Date**: _________________  
**Tester**: _________________  
**Overall Status**: ☐ Pass ☐ Fail ☐ Partial

**Issues Found**: _________________

---

