# Integration Test Scenarios - Story 2.7

**Story:** Stage 2 & 3 - Quality and Management Approval  
**Date:** October 25, 2025  
**Status:** Draft

---

## Overview

This document outlines the integration test scenarios for Story 2.7, covering the complete three-stage qualification workflow with Stage 2 (Quality Review) and Stage 3 (Management Approval).

## Test Environment Setup

**Prerequisites:**
- Test tenant with users assigned to each role:
  - Procurement Manager (for Stage 1)
  - Quality Manager (for Stage 2)
  - Admin (for Stage 3)
- Test supplier in "Prospect" status
- Required documents uploaded to workflow

---

## Scenario 1: Complete Qualification Flow (Stage 1 → 2 → 3 → Approved)

### Objective
Verify that a workflow can progress through all three stages successfully and result in an approved supplier.

### Test Steps

**1. Stage 1 Approval (Procurement Manager)**
- Login as Procurement Manager
- Navigate to My Tasks
- Select pending workflow for review
- Review supplier information and documents
- Add optional comments
- Click "Approve & Advance to Stage 2"
- **Expected Result:**
  - Toast notification: "Stage 1 approved successfully - The workflow will advance to Stage 2: Quality Review"
  - Workflow status updated to "Stage2"
  - Workflow current_stage updated to 2
  - Stage 1 record marked as "Approved"
  - Stage 2 record created with status "Pending"
  - Stage 2 assigned to Quality Manager
  - Email notification sent to Quality Manager (stub log)
  - Redirected to /tasks page

**2. Stage 2 Approval (Quality Manager)**
- Login as Quality Manager
- Navigate to My Tasks
- Select pending Stage 2 workflow
- Review supplier information and documents
- **Verify Quality Checklist displays:**
  - Checkbox: "Quality manual reviewed"
  - Checkbox: "Quality certifications verified"
  - Textarea: "Quality audit findings"
- Check both quality checkboxes
- Add quality audit findings notes
- Add optional review comments
- Click "Approve & Advance to Stage 3"
- **Expected Result:**
  - Toast notification: "Stage 2 approved successfully - The workflow will advance to Stage 3: Management Approval"
  - Workflow status updated to "Stage3"
  - Workflow current_stage updated to 3
  - Stage 2 record marked as "Approved"
  - Quality checklist data saved in Stage 2 attachments JSONB field
  - Stage 3 record created with status "Pending"
  - Stage 3 assigned to Admin
  - Email notification sent to Admin (stub log)
  - Redirected to /tasks page

**3. Stage 3 Final Approval (Admin)**
- Login as Admin
- Navigate to My Tasks
- Select pending Stage 3 workflow
- **Verify Workflow History Summary displays:**
  - Risk score
  - Document completion percentage
  - Workflow status
  - Stage 1 approval details (reviewer name, date, decision, comments)
  - Stage 2 approval details (reviewer name, date, decision, comments)
- Review complete workflow history
- Add optional review comments
- Click "Approve & Complete Qualification"
- **Expected Result:**
  - Toast notification: "Qualification complete! - Supplier approved. The workflow is now complete"
  - Workflow status updated to "Approved" (final state)
  - Workflow current_stage remains 3
  - Stage 3 record marked as "Approved"
  - Supplier status updated from "Qualified" → "Approved"
  - Congratulatory email sent to supplier (stub log)
  - Redirected to /tasks page

---

## Scenario 2: Rejection at Stage 2 Reverts to Draft

### Objective
Verify that rejecting a workflow at Stage 2 returns it to Draft and reverts supplier status.

### Test Steps

**1. Stage 1 Approval**
- Complete Stage 1 approval as Procurement Manager (see Scenario 1)

**2. Stage 2 Rejection (Quality Manager)**
- Login as Quality Manager
- Navigate to My Tasks
- Select pending Stage 2 workflow
- Review workflow details
- Click "Request Changes"
- Enter rejection comments (minimum 10 characters): "Quality certifications have expired. Please renew ISO certification before resubmitting."
- Click "Submit Rejection"
- **Expected Result:**
  - Toast notification: "Workflow rejected and returned to Draft status"
  - Workflow status updated to "Draft"
  - Workflow current_stage updated to 0
  - Stage 2 record marked as "Rejected" with comments
  - Supplier status reverted to "Prospect"
  - Email notification sent to workflow initiator with rejection comments (stub log)
  - Redirected to /tasks page

**3. Verify Initiator Can See Rejected Workflow**
- Login as workflow initiator
- Navigate to Suppliers → Select supplier → View workflow
- **Verify:**
  - Workflow status shows "Draft"
  - Stage 2 rejection comments are visible
  - Workflow can be re-edited and re-submitted

---

## Scenario 3: Rejection at Stage 3 Reverts to Draft

### Objective
Verify that rejecting a workflow at Stage 3 returns it to Draft and reverts supplier status.

### Test Steps

**1. Complete Stage 1 & 2 Approvals**
- Complete Stage 1 approval as Procurement Manager
- Complete Stage 2 approval as Quality Manager (see Scenario 1)

**2. Stage 3 Rejection (Admin)**
- Login as Admin
- Navigate to My Tasks
- Select pending Stage 3 workflow
- Review workflow history summary
- Click "Request Changes"
- Enter rejection comments (minimum 10 characters): "Financial documentation needs to be updated. Please provide current financial statements."
- Click "Submit Rejection"
- **Expected Result:**
  - Toast notification: "Workflow rejected and returned to Draft status"
  - Workflow status updated to "Draft"
  - Workflow current_stage updated to 0
  - Stage 3 record marked as "Rejected" with comments
  - Supplier status reverted to "Prospect"
  - Email notification sent to workflow initiator with rejection comments (stub log)
  - Redirected to /tasks page

---

## Scenario 4: Stage 3 Final Approval Updates Supplier Status

### Objective
Verify that final approval at Stage 3 correctly updates the supplier status to "Approved".

### Test Steps

**1. Complete Full Workflow**
- Complete Stages 1, 2, and 3 approvals (see Scenario 1)

**2. Verify Supplier Status**
- Navigate to Suppliers page
- Find the test supplier
- **Verify:**
  - Supplier status badge shows "Approved"
  - Supplier status field in database is "approved"

**3. Verify Workflow Status**
- Navigate to workflow details
- **Verify:**
  - Workflow status shows "Approved"
  - All three stages show "Approved" status
  - Timeline displays all approval events

---

## Scenario 5: Quality Checklist Fields Save Correctly

### Objective
Verify that Stage 2 quality checklist data is properly saved and retrievable.

### Test Steps

**1. Complete Stage 1 Approval**
- Complete Stage 1 approval as Procurement Manager

**2. Stage 2 Quality Review**
- Login as Quality Manager
- Navigate to My Tasks
- Select pending Stage 2 workflow
- Check "Quality manual reviewed" checkbox
- Check "Quality certifications verified" checkbox
- Enter quality audit findings: "All certifications are current. Minor observations noted in quality manual section 4.2."
- Approve Stage 2

**3. Verify Quality Checklist Data Saved**
- Query database: `SELECT attachments FROM qualification_stages WHERE stage_number = 2 AND workflow_id = :workflowId`
- **Verify JSONB field contains:**
  ```json
  {
    "qualityManualReviewed": true,
    "qualityCertificationsVerified": true,
    "qualityAuditFindings": "All certifications are current. Minor observations noted in quality manual section 4.2."
  }
  ```

---

## Scenario 6: Workflow History Displays All Previous Stages

### Objective
Verify that Stage 3 reviewers can see complete workflow history with all previous approvals.

### Test Steps

**1. Complete Stage 1 & 2 Approvals**
- Stage 1 approved by Procurement Manager with comment "Documents verified"
- Stage 2 approved by Quality Manager with comment "Quality assessment complete"

**2. Stage 3 Review**
- Login as Admin
- Navigate to My Tasks
- Select pending Stage 3 workflow
- **Verify "Previous Approval History" card displays:**
  - **Overall Stats:**
    - Risk Score: 5.2 (example)
    - Document Completion: 90%
    - Workflow Status: Stage3
  - **Stage 1 Details:**
    - Stage Number: 1
    - Stage Name: Procurement Review
    - Reviewer: [Procurement Manager Name]
    - Review Date: [Date Stage 1 was approved]
    - Decision Badge: "Approved" (green)
    - Comments: "Documents verified"
  - **Stage 2 Details:**
    - Stage Number: 2
    - Stage Name: Quality Review
    - Reviewer: [Quality Manager Name]
    - Review Date: [Date Stage 2 was approved]
    - Decision Badge: "Approved" (green)
    - Comments: "Quality assessment complete"

**3. Verify API Response**
- Call `GET /api/workflows/:workflowId/history`
- **Verify response contains:**
  - `workflowId`
  - `supplierId`
  - `supplierName`
  - `status`: "Stage3"
  - `riskScore`: number
  - `documentCompletionPercent`: number
  - `stages`: array with 2 items (Stage 1 & 2)
  - Each stage has: `stageNumber`, `stageName`, `reviewerName`, `reviewedDate`, `decision`, `comments`

---

## Scenario 7: Email Notification Sent on Final Approval

### Objective
Verify that supplier receives congratulatory email on final approval (stub verification).

### Test Steps

**1. Complete Full Workflow to Stage 3 Approval**
- Complete Stages 1, 2, and 3 approvals

**2. Check Console Logs**
- **Verify console log contains:**
  ```
  [EMAIL STUB] Supplier Approval Congratulations Email
  {
    to: "supplier@example.com",
    subject: "Congratulations! Your qualification has been approved",
    supplier: "Test Supplier Name",
    workflow_id: "uuid",
    timestamp: "2025-10-25T..."
  }
  ```

---

## Scenario 8: Role-Based Access - Quality Manager Can't Approve Stage 1 or 3

### Objective
Verify that Quality Managers can only approve Stage 2 workflows, not Stage 1 or 3.

### Test Steps

**1. Attempt Stage 1 Approval as Quality Manager**
- Login as Quality Manager
- Attempt to access workflow at Stage 1 for review
- **Expected Result:**
  - 403 Forbidden error
  - Error message: "Access denied. Procurement Manager or Admin role required for Stage 1."
  - Workflow not visible in Quality Manager's task list

**2. Attempt Stage 3 Approval as Quality Manager**
- Complete workflow to Stage 3
- Login as Quality Manager
- Attempt to access workflow at Stage 3 for review
- **Expected Result:**
  - 403 Forbidden error
  - Error message: "Access denied. Admin role required for Stage 3."
  - Workflow not visible in Quality Manager's task list

---

## Scenario 9: Role-Based Access - Admin Can Approve All Stages

### Objective
Verify that Admins have access to approve any stage (1, 2, or 3) if assigned.

### Test Steps

**1. Admin Approves Stage 1**
- Assign Stage 1 workflow to Admin user
- Login as Admin
- Review and approve Stage 1
- **Expected Result:** Approval successful, advances to Stage 2

**2. Admin Approves Stage 2**
- Assign Stage 2 workflow to Admin user
- Login as Admin
- Review and approve Stage 2
- **Expected Result:** Approval successful, advances to Stage 3

**3. Admin Approves Stage 3**
- Stage 3 is assigned to Admin by default
- Login as Admin
- Review and approve Stage 3
- **Expected Result:** Approval successful, workflow marked as Approved

---

## Test Data Requirements

### Test Users
- **Procurement Manager:** procurement@test.com
- **Quality Manager:** quality@test.com
- **Admin:** admin@test.com

### Test Supplier
- Name: "Test Supplier Co."
- Status: "prospect" (initial)
- Tax ID: "12-3456789"
- Category: "Raw Materials"
- Contact Email: "contact@testsupplier.com"

### Test Documents
- Business License (PDF)
- ISO 9001 Certificate (PDF)
- Quality Manual (PDF)

---

## Database Verification Queries

### Workflow Progression
```sql
-- Check workflow status after each stage
SELECT id, status, current_stage, updated_at 
FROM qualification_workflows 
WHERE id = :workflowId;
```

### Stage Records
```sql
-- Check all stages for a workflow
SELECT stage_number, stage_name, status, reviewed_by, reviewed_date, comments
FROM qualification_stages
WHERE workflow_id = :workflowId
ORDER BY stage_number;
```

### Supplier Status
```sql
-- Check supplier status after final approval
SELECT id, name, status, updated_at
FROM suppliers
WHERE id = :supplierId;
```

### Quality Checklist Data
```sql
-- Verify quality checklist saved in Stage 2
SELECT attachments
FROM qualification_stages
WHERE workflow_id = :workflowId AND stage_number = 2;
```

---

## API Endpoint Testing

### Stage Approval
```bash
POST /api/workflows/:workflowId/stages/:stageId/approve
Authorization: Bearer <token>
Content-Type: application/json

{
  "comments": "Optional approval comments"
}
```

### Stage Rejection
```bash
POST /api/workflows/:workflowId/stages/:stageId/reject
Authorization: Bearer <token>
Content-Type: application/json

{
  "comments": "Required rejection comments (min 10 chars)"
}
```

### Workflow History
```bash
GET /api/workflows/:workflowId/history
Authorization: Bearer <token>
```

---

## Edge Cases & Error Scenarios

### 1. Concurrent Approval Attempts
- Two reviewers try to approve the same stage simultaneously
- **Expected:** Only first approval succeeds, second receives "Stage already reviewed" error

### 2. Missing Reviewer for Next Stage
- No Quality Manager exists in tenant
- Procurement Manager approves Stage 1
- **Expected:** Fallback to Admin as Stage 2 reviewer

### 3. Supplier Deleted During Workflow
- Supplier soft-deleted while workflow is in progress
- **Expected:** Workflow continues normally (data retained via workflow snapshot)

### 4. User Role Changed Mid-Review
- User assigned to Stage 2, then role changed from Quality Manager to Viewer
- User attempts to approve
- **Expected:** 403 Forbidden error due to current role check

---

## Performance Benchmarks

- Stage approval (including next stage creation): < 500ms
- Workflow history endpoint: < 300ms
- Rejection (including supplier status update): < 500ms
- Final approval (including supplier status update): < 500ms

---

## Acceptance Criteria Mapping

| AC # | Scenario(s) | Status |
|------|-------------|--------|
| AC 1 | Scenario 2, 3 | ✅ Covered |
| AC 2 | Scenario 5 | ✅ Covered |
| AC 3 | Scenario 1, 2 | ✅ Covered |
| AC 4 | Scenario 1 | ✅ Covered |
| AC 5 | Scenario 1, 3 | ✅ Covered |
| AC 6 | Scenario 6 | ✅ Covered |
| AC 7 | Scenario 6 | ✅ Covered |
| AC 8 | Scenario 1 | ✅ Covered |
| AC 9 | Scenario 4 | ✅ Covered |
| AC 10 | Scenario 7 | ✅ Covered |
| AC 11 | Scenario 2, 3 | ✅ Covered |
| AC 12 | Scenario 1 | ✅ Covered |
| AC 13 | Scenario 1, 6 | ✅ Covered |

---

## Test Execution Checklist

- [ ] Scenario 1: Complete qualification flow
- [ ] Scenario 2: Stage 2 rejection
- [ ] Scenario 3: Stage 3 rejection
- [ ] Scenario 4: Supplier status update
- [ ] Scenario 5: Quality checklist save
- [ ] Scenario 6: Workflow history display
- [ ] Scenario 7: Email notification (stub)
- [ ] Scenario 8: Quality Manager access control
- [ ] Scenario 9: Admin access to all stages
- [ ] Database verification queries
- [ ] API endpoint testing
- [ ] Edge cases testing
- [ ] Performance benchmarks

---

**Notes:**
- All email notifications are stubs in this story (Story 2.8 will implement)
- Audit trail logging is placeholder (Story 2.10 will implement)
- Test with realistic data that matches production constraints

