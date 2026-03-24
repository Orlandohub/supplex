# Integration Tests - Story 2.10: Audit Trail & History View

**Story**: [Story 2.10 - Audit Trail & History View](../stories/2.10.story.md)

**Test Date**: TBD  
**Tester**: TBD  
**Environment**: Dev/Staging  
**Status**: Pending

---

## Test Setup

### Prerequisites
1. Backend API running with database migrations applied
2. Frontend web application running
3. Test tenant with:
   - At least 2 users (Procurement Manager, Quality Manager)
   - At least 1 supplier with master data
   - Test documents available for upload

### Test Data
- **Tenant ID**: TBD
- **Supplier ID**: TBD (e.g., "Acme Corp")
- **User 1**: Procurement Manager (workflow initiator)
- **User 2**: Quality Manager (Stage 1 reviewer)

---

## Test Scenarios

### **Scenario 1: Workflow Initiation Event** (AC 1, 2)

**Objective**: Verify that initiating a new qualification workflow creates a "WORKFLOW_INITIATED" event in the audit trail.

**Steps**:
1. Log in as Procurement Manager
2. Navigate to Supplier Detail page
3. Click "Initiate Qualification Workflow" button
4. Confirm workflow initiation
5. Navigate to the newly created Workflow Detail page
6. Scroll down to "Audit Trail History" section

**Expected Results**:
- ✅ Audit trail displays one event: "WORKFLOW_INITIATED"
- ✅ Event description reads: "Workflow initiated" or similar
- ✅ Actor name displays: Procurement Manager's full name
- ✅ Actor role displays: "PROCUREMENT_MANAGER"
- ✅ Timestamp is present and shows current date/time in local timezone
- ✅ Hover over timestamp shows UTC time in tooltip

**AC Covered**: 1, 2

**Status**: [ ] Pass [ ] Fail [ ] Blocked

**Notes**:

---

### **Scenario 2: Document Upload Events** (AC 3, 4, 9)

**Objective**: Verify that uploading documents creates "DOCUMENT_UPLOADED" events with correct metadata.

**Steps**:
1. In the workflow from Scenario 1, upload 3 required documents:
   - Certificate of Incorporation (new file upload)
   - Quality Management Certificate (new file upload)
   - Financial Statement (link existing document)
2. Refresh the page or scroll to Audit Trail History

**Expected Results**:
- ✅ Audit trail now displays 4 events total (1 initiation + 3 uploads)
- ✅ Each upload event shows:
  - Event type: "DOCUMENT_UPLOADED"
  - Event description includes document name
  - Actor: Procurement Manager
  - Timestamp (descending order - newest first)
  - Document name visible in event details
- ✅ Linked document event has metadata indicating `linked: true`
- ✅ Events are ordered by timestamp (newest first)

**AC Covered**: 3, 4, 9

**Status**: [ ] Pass [ ] Fail [ ] Blocked

**Notes**:

---

### **Scenario 3: Document Removal Event** (AC 3, 4)

**Objective**: Verify that removing a document creates a "DOCUMENT_REMOVED" event.

**Steps**:
1. In the workflow, click "Remove" on the Financial Statement document
2. Confirm removal
3. Check audit trail

**Expected Results**:
- ✅ New event appears: "DOCUMENT_REMOVED"
- ✅ Event shows removed document name: "Financial Statement"
- ✅ Actor: Procurement Manager
- ✅ Timestamp is current
- ✅ Event is at the top of the timeline (newest)

**AC Covered**: 3, 4

**Status**: [ ] Pass [ ] Fail [ ] Blocked

**Notes**:

---

### **Scenario 4: Workflow Submission Event** (AC 5, 6)

**Objective**: Verify that submitting a workflow for review creates a "STAGE_SUBMITTED" event.

**Steps**:
1. Re-upload the Financial Statement (to meet requirements)
2. Click "Submit for Review" button
3. Confirm submission
4. Check audit trail

**Expected Results**:
- ✅ New event appears: "STAGE_SUBMITTED"
- ✅ Event description: "Submitted for Stage 1 review" or similar
- ✅ Actor: Procurement Manager
- ✅ Stage number: 1
- ✅ Reviewer name displayed (Quality Manager)
- ✅ Timestamp is current

**AC Covered**: 5, 6

**Status**: [ ] Pass [ ] Fail [ ] Blocked

**Notes**:

---

### **Scenario 5: Stage Approval Event** (AC 7, 8)

**Objective**: Verify that approving a workflow stage creates a "STAGE_APPROVED" event with comments.

**Steps**:
1. Log out and log back in as Quality Manager
2. Navigate to "My Tasks"
3. Click on the workflow
4. Review the workflow
5. Click "Approve" button
6. Enter approval comments: "All documents verified. Approved for next stage."
7. Confirm approval
8. Check audit trail

**Expected Results**:
- ✅ New event appears: "STAGE_APPROVED"
- ✅ Event description: "Stage 1 approved" or similar
- ✅ Actor: Quality Manager (full name)
- ✅ Actor role: "QUALITY_MANAGER"
- ✅ Stage number: 1
- ✅ Comments are present but initially hidden
- ✅ Click "Show Comments" button to expand
- ✅ Comments display correctly: "All documents verified. Approved for next stage."
- ✅ Click "Hide Comments" to collapse
- ✅ Timestamp is current

**AC Covered**: 7, 8

**Status**: [ ] Pass [ ] Fail [ ] Blocked

**Notes**:

---

### **Scenario 6: Stage Rejection Event** (AC 7, 8)

**Objective**: Verify that rejecting a workflow stage creates a "STAGE_REJECTED" event with rejection comments.

**Prerequisite**: Create a second workflow and submit it for Stage 1 review.

**Steps**:
1. Log in as Quality Manager
2. Navigate to the second workflow (submitted for Stage 1)
3. Click "Reject" button
4. Enter rejection comments: "Financial statement is incomplete. Please resubmit with full documentation."
5. Confirm rejection
6. Check audit trail

**Expected Results**:
- ✅ New event appears: "STAGE_REJECTED"
- ✅ Event description: "Stage 1 rejected" or similar
- ✅ Actor: Quality Manager
- ✅ Stage number: 1
- ✅ Comments are expandable
- ✅ Comments display correctly with rejection reason
- ✅ Workflow status reverts to "Draft"
- ✅ Rejection banner appears on workflow detail page referencing this event

**AC Covered**: 7, 8

**Status**: [ ] Pass [ ] Fail [ ] Blocked

**Notes**:

---

### **Scenario 7: Timeline Filtering - All Events** (AC 10)

**Objective**: Verify that the "All Events" filter displays all timeline events.

**Steps**:
1. Navigate to any workflow with multiple event types (e.g., Scenario 5 workflow)
2. Locate the "Filter Events" dropdown above the audit trail
3. Select "All Events" (should be default)

**Expected Results**:
- ✅ All events are visible in the timeline
- ✅ Events of different types are displayed: WORKFLOW_INITIATED, DOCUMENT_UPLOADED, DOCUMENT_REMOVED, STAGE_SUBMITTED, STAGE_APPROVED

**AC Covered**: 10

**Status**: [ ] Pass [ ] Fail [ ] Blocked

**Notes**:

---

### **Scenario 8: Timeline Filtering - Approvals Only** (AC 10)

**Objective**: Verify that the "Approvals" filter shows only STAGE_APPROVED events.

**Steps**:
1. In the same workflow, select "Approvals" from the filter dropdown

**Expected Results**:
- ✅ Only STAGE_APPROVED events are visible
- ✅ All other event types are hidden (DOCUMENT_UPLOADED, STAGE_SUBMITTED, etc.)
- ✅ If no approvals exist, display message: "No audit trail events found"

**AC Covered**: 10

**Status**: [ ] Pass [ ] Fail [ ] Blocked

**Notes**:

---

### **Scenario 9: Timeline Filtering - Rejections Only** (AC 10)

**Objective**: Verify that the "Rejections" filter shows only STAGE_REJECTED events.

**Steps**:
1. Navigate to the workflow from Scenario 6 (with rejection)
2. Select "Rejections" from the filter dropdown

**Expected Results**:
- ✅ Only STAGE_REJECTED events are visible
- ✅ All other event types are hidden
- ✅ Rejection comments are still expandable

**AC Covered**: 10

**Status**: [ ] Pass [ ] Fail [ ] Blocked

**Notes**:

---

### **Scenario 10: Timeline Filtering - Documents Only** (AC 10)

**Objective**: Verify that the "Documents" filter shows only DOCUMENT_UPLOADED and DOCUMENT_REMOVED events.

**Steps**:
1. Select "Documents" from the filter dropdown

**Expected Results**:
- ✅ Only DOCUMENT_UPLOADED and DOCUMENT_REMOVED events are visible
- ✅ Each event shows the document name
- ✅ All non-document events are hidden

**AC Covered**: 10

**Status**: [ ] Pass [ ] Fail [ ] Blocked

**Notes**:

---

### **Scenario 11: Timeline Filtering - Comments Only** (AC 10)

**Objective**: Verify that the "Comments" filter shows only COMMENTS_ADDED events.

**Steps**:
1. Select "Comments" from the filter dropdown

**Expected Results**:
- ✅ Only COMMENTS_ADDED events are visible (if any exist)
- ✅ If no comment events exist, display "No audit trail events found"

**Note**: COMMENTS_ADDED events are not implemented in the current workflow actions (approve/reject have comments but are different event types). This test may show no events.

**AC Covered**: 10

**Status**: [ ] Pass [ ] Fail [ ] Blocked

**Notes**:

---

### **Scenario 12: PDF Export - Download Audit Trail** (AC 11, 12)

**Objective**: Verify that clicking "Print Audit Trail" button downloads a PDF with complete timeline.

**Steps**:
1. Navigate to a workflow with multiple events (e.g., Scenario 5)
2. Click "Print Audit Trail" button (with Printer icon)
3. Wait for PDF generation
4. Check browser downloads

**Expected Results**:
- ✅ Button shows "Generating PDF..." loading text while processing
- ✅ Button is disabled during generation
- ✅ Browser downloads a file named `audit-trail-{workflowId}.pdf`
- ✅ PDF file opens successfully
- ✅ PDF contains:
  - Header: "AUDIT TRAIL REPORT" or similar
  - Supplier Name (e.g., "Acme Corp")
  - Workflow ID (UUID)
  - Print Date (current date/time)
  - Workflow Status
  - Complete timeline with all events (oldest to newest in PDF)
  - Each event shows: Date/Time, Event Type, Description, Actor Name/Role
  - Comments (if applicable) for approval/rejection events
- ✅ Button returns to "Print Audit Trail" text after completion
- ✅ Button is re-enabled after completion

**AC Covered**: 11, 12

**Status**: [ ] Pass [ ] Fail [ ] Blocked

**Notes**:

---

### **Scenario 13: PDF Export - Error Handling** (AC 11, 12)

**Objective**: Verify error handling when PDF generation fails.

**Steps**:
1. Temporarily disable the backend API or use an invalid workflow ID
2. Click "Print Audit Trail" button
3. Observe error handling

**Expected Results**:
- ✅ Button shows loading state briefly
- ✅ Error message appears: "Failed to export audit trail. Please try again." (or similar)
- ✅ Button returns to enabled state
- ✅ No file is downloaded

**AC Covered**: 11, 12

**Status**: [ ] Pass [ ] Fail [ ] Blocked

**Notes**:

---

### **Scenario 14: Mobile Responsiveness** (AC 14)

**Objective**: Verify that the audit trail timeline is mobile-responsive.

**Steps**:
1. Open the workflow detail page on a mobile device (or use browser DevTools responsive mode)
2. Navigate to the Audit Trail History section
3. Interact with timeline events

**Expected Results**:
- ✅ Timeline stacks vertically
- ✅ Event nodes are touch-friendly (adequate spacing)
- ✅ Icons are clearly visible
- ✅ Text is readable (appropriate font sizes)
- ✅ Filter dropdown is full-width on mobile
- ✅ "Print Audit Trail" button is full-width on mobile
- ✅ Comments expand/collapse smoothly with touch
- ✅ Timestamps are readable and don't overflow

**AC Covered**: 14

**Status**: [ ] Pass [ ] Fail [ ] Blocked

**Notes**:

---

### **Scenario 15: Timestamp Display and UTC Tooltip** (AC 2, 9)

**Objective**: Verify that timestamps display in local timezone with UTC tooltip.

**Steps**:
1. Navigate to any workflow with events
2. Hover over a timestamp in the timeline

**Expected Results**:
- ✅ Timestamp displays in user's local timezone (e.g., "Oct 26, 2025, 10:30 AM")
- ✅ Recent events (< 24 hours) show relative time: "5 minutes ago", "2 hours ago"
- ✅ Older events show absolute date: "Oct 25, 2025, 3:45 PM"
- ✅ Hovering over timestamp shows tooltip with UTC time

**AC Covered**: 2, 9

**Status**: [ ] Pass [ ] Fail [ ] Blocked

**Notes**:

---

### **Scenario 16: Empty State** (AC 1)

**Objective**: Verify that a workflow with no events (edge case) displays appropriate empty state.

**Steps**:
1. Manually create a workflow in the database without triggering event logging (or use a test utility)
2. Navigate to the workflow detail page

**Expected Results**:
- ✅ Audit Trail History section is visible
- ✅ Empty state message displays: "No audit trail events found"
- ✅ Filter dropdown and Print button are still present

**AC Covered**: 1

**Status**: [ ] Pass [ ] Fail [ ] Blocked

**Notes**:

---

### **Scenario 17: Tenant Isolation** (AC 13)

**Objective**: Verify that users cannot access audit trail data from other tenants.

**Steps**:
1. Create a workflow in Tenant A
2. Log in as a user in Tenant B
3. Attempt to access the workflow detail page using the Tenant A workflow ID (direct URL)

**Expected Results**:
- ✅ API returns 404 Not Found or 403 Forbidden
- ✅ Workflow detail page displays error message
- ✅ No audit trail data is leaked to Tenant B user

**AC Covered**: 13

**Status**: [ ] Pass [ ] Fail [ ] Blocked

**Notes**:

---

### **Scenario 18: Immutability of Audit Trail** (AC 1, 9)

**Objective**: Verify that audit trail events are immutable and actor names are denormalized.

**Steps**:
1. Note the actor name for a STAGE_APPROVED event (e.g., "Jane Smith - Quality Manager")
2. Update the user's name in the database (e.g., change "Jane Smith" to "Jane Doe")
3. Refresh the workflow detail page
4. Check the audit trail event

**Expected Results**:
- ✅ Event still displays original actor name: "Jane Smith"
- ✅ Actor role remains: "QUALITY_MANAGER"
- ✅ Historical accuracy is preserved (denormalized data)

**AC Covered**: 1, 9

**Status**: [ ] Pass [ ] Fail [ ] Blocked

**Notes**:

---

### **Scenario 19: Chronological Order** (AC 9)

**Objective**: Verify that timeline events are displayed in reverse chronological order (newest first).

**Steps**:
1. Navigate to a workflow with at least 5 events
2. Check the order of events in the timeline

**Expected Results**:
- ✅ Events are listed from newest to oldest
- ✅ Most recent event appears at the top
- ✅ Timestamps confirm descending order

**AC Covered**: 9

**Status**: [ ] Pass [ ] Fail [ ] Blocked

**Notes**:

---

### **Scenario 20: Multiple Stages - Full Workflow Lifecycle** (AC 1-12)

**Objective**: Verify complete audit trail across multi-stage workflow lifecycle.

**Steps**:
1. Initiate a new qualification workflow (WORKFLOW_INITIATED)
2. Upload all required documents (multiple DOCUMENT_UPLOADED events)
3. Submit for Stage 1 review (STAGE_SUBMITTED)
4. Approve Stage 1 with comments (STAGE_APPROVED)
5. Submit for Stage 2 review (STAGE_SUBMITTED)
6. Approve Stage 2 (STAGE_APPROVED)
7. Submit for Stage 3 review (STAGE_SUBMITTED)
8. Approve Stage 3 - Final Approval (STAGE_APPROVED, workflow status → Approved)
9. Navigate to Audit Trail History
10. Export PDF

**Expected Results**:
- ✅ Timeline shows complete lifecycle (10+ events)
- ✅ Each stage submission and approval is recorded
- ✅ Correct stage numbers and reviewer names for each stage
- ✅ Filter by "Approvals" shows 3 approval events
- ✅ PDF export includes all events in chronological order
- ✅ Timeline provides complete audit trail for compliance

**AC Covered**: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12

**Status**: [ ] Pass [ ] Fail [ ] Blocked

**Notes**:

---

## Summary

**Total Scenarios**: 20  
**Passed**: TBD  
**Failed**: TBD  
**Blocked**: TBD  
**Overall Status**: Pending

---

## Issues Found

| Issue ID | Scenario | Description | Severity | Status |
|----------|----------|-------------|----------|--------|
| TBD | TBD | TBD | TBD | TBD |

---

## Notes & Recommendations

- All tests should be executed in a staging environment with realistic data
- PDF content should be manually verified for formatting and completeness
- Performance testing: Timeline with 100+ events should load in < 2 seconds
- Accessibility testing: Ensure timeline is keyboard-navigable and screen-reader friendly
- Browser compatibility: Test in Chrome, Firefox, Safari, Edge

---

## Sign-off

**Tester**: ___________________  
**Date**: ___________________  
**Approved By**: ___________________  
**Date**: ___________________

