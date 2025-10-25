# Integration Test Scenarios - Story 2.6
# Stage 1 - Procurement Approval/Rejection

**Story:** 2.6 - Stage 1 Procurement Approval/Rejection  
**Test Type:** Integration/End-to-End  
**Purpose:** Validate complete user workflows from My Tasks through approval/rejection  
**Date Created:** October 25, 2025  
**Author:** Quinn (Test Architect)

---

## Test Environment Setup

### Prerequisites
- Test database with sample data
- User accounts with appropriate roles:
  - `test-initiator@company.com` (Procurement Manager)
  - `test-reviewer@company.com` (Procurement Manager)
  - `test-quality@company.com` (Quality Manager)
- At least 2 test workflows in Stage1 status:
  - One high-risk workflow (risk score >= 7)
  - One medium-risk workflow (risk score 4-6)
- Documents uploaded to workflows
- Email notification system configured (stub or real)

---

## Scenario 1: View My Tasks Queue

**AC Tested:** 1, 2  
**User Role:** Procurement Manager (Reviewer)  
**Priority:** P0 - Critical Path

### Steps:
1. Log in as `test-reviewer@company.com`
2. Click "My Tasks" in navigation sidebar
3. Observe task count badge in sidebar
4. Navigate to `/tasks` page

### Expected Results:
- Badge shows correct count of pending tasks
- Task list displays with columns: Supplier Name, Submitted By, Submitted Date, Risk Score, Days Pending, Action
- Tasks are sorted by oldest pending first
- High-risk tasks show red badge
- Tasks > 7 days show warning color and alert icon
- Each task has "Review" button
- Empty state message shown if no tasks

### Test Data:
- Task count badge: Should show 2
- Task 1: "ABC Supplier" - 7 days pending - Risk: 8.5
- Task 2: "XYZ Corp" - 2 days pending - Risk: 4.2

---

## Scenario 2: Filter High-Risk Tasks

**AC Tested:** 2  
**User Role:** Procurement Manager (Reviewer)  
**Priority:** P1 - Important

### Steps:
1. From My Tasks page with multiple tasks
2. Click "High Risk Only" filter button
3. Observe filtered list
4. Click "Show All" to reset filter

### Expected Results:
- Filter button toggles between "High Risk Only" and "Show All"
- Filtered list shows only tasks with risk score >= 7
- Task count updates to show filtered count
- "Show All" button restores full list

---

## Scenario 3: Navigate to Workflow Review Page

**AC Tested:** 3, 4  
**User Role:** Procurement Manager (Reviewer)  
**Priority:** P0 - Critical Path

### Steps:
1. From My Tasks page
2. Click "Review" button on first task
3. Navigate to `/workflows/:id/review`

### Expected Results:
- Successfully navigates to review page
- Page displays:
  - Supplier name in header
  - Status badge
  - Risk score badge
  - "Back to My Tasks" link
  - Workflow information section
  - Supplier information section
  - Risk assessment section
  - Document checklist section
  - Review comments textarea
  - "Request Changes" and "Approve & Advance to Stage 2" buttons

### Test Data:
- Workflow ID: Should be in URL
- Supplier: "ABC Supplier"
- Stage: "Stage 1: Procurement Review"

---

## Scenario 4: Review Workflow Details and Documents

**AC Tested:** 4, 5  
**User Role:** Procurement Manager (Reviewer)  
**Priority:** P0 - Critical Path

### Steps:
1. On workflow review page
2. Scroll through all sections:
   - Workflow information
   - Supplier information
   - Risk assessment
   - Document checklist
3. Click "View" on an uploaded document
4. Click "Download" on an uploaded document

### Expected Results:
- All sections display complete information
- Supplier information shows: name, tax ID, category, contact email, phone, address
- Document checklist shows all required items
- Uploaded documents show filename, upload date, uploader name
- "View" button opens document in new tab/inline viewer
- "Download" button downloads document
- Not uploaded items show "Not Uploaded" badge
- Required items show "Required" badge

### Test Data:
- Document 1: "iso-cert.pdf" - Uploaded by John Doe on Oct 15
- Document 2: "tax-id.pdf" - Not Uploaded

### Known Issues:
- Document view/download URLs are currently placeholders
- Need Supabase signed URL implementation

---

## Scenario 5: Add Review Comments and Approve Stage

**AC Tested:** 6, 7, 8  
**User Role:** Procurement Manager (Reviewer)  
**Priority:** P0 - Critical Path

### Steps:
1. On workflow review page
2. Type review comments in textarea: "All documents look good. Approved to proceed."
3. Observe character count
4. Click "Approve & Advance to Stage 2" button
5. Observe approval modal
6. Verify modal shows:
   - Supplier name
   - Risk score
   - Current stage
   - Confirmation message about Stage 2
   - Review comments
7. Click "Approve & Advance" button
8. Wait for API call to complete

### Expected Results:
- Comments textarea accepts multi-line input
- Character count displays below textarea
- Approval modal opens with all information
- Modal shows green confirmation styling
- Modal mentions "quality manager will be notified"
- Loading spinner shown during API call
- Success toast: "Stage 1 approved successfully"
- Navigate back to /tasks
- Task removed from "My Tasks" list
- Task count badge decremented

### Database Validation:
- `qualification_stages` (Stage 1):
  - `status` = "Approved"
  - `reviewed_by` = reviewer user ID
  - `reviewed_date` = current timestamp
  - `comments` = entered comments
- `qualification_workflows`:
  - `status` = "Stage2"
  - `current_stage` = 2
- `qualification_stages` (Stage 2):
  - New record created
  - `stage_number` = 2
  - `stage_name` = "Quality Review"
  - `assigned_to` = quality manager ID (from tenant config or fallback)
  - `status` = "Pending"

### Email Validation (Stub):
- Console log shows email notification to initiator
- Subject: "{Supplier} Qualification - Stage 1 Approved"
- Includes reviewer name and next stage

---

## Scenario 6: Reject Stage with Invalid Comments

**AC Tested:** 7, 9  
**User Role:** Procurement Manager (Reviewer)  
**Priority:** P0 - Critical Path

### Steps:
1. On workflow review page
2. Click "Request Changes" button
3. Observe rejection modal
4. Type short comments: "Too short"
5. Observe validation message
6. Try to click "Request Changes" button

### Expected Results:
- Rejection modal opens
- Modal shows warning message about returning to Draft
- Comments field is required
- Character count shows below field
- Validation message: "Minimum 10 characters required"
- Comment field border turns red
- "Request Changes" button is disabled
- Cannot submit until validation passes

---

## Scenario 7: Reject Stage Successfully

**AC Tested:** 9, 11, 12, 14  
**User Role:** Procurement Manager (Reviewer)  
**Priority:** P0 - Critical Path

### Steps:
1. On workflow review page (different workflow)
2. Click "Request Changes" button
3. Type valid rejection comments (>= 10 chars): "Documents are incomplete. Please provide updated ISO certificate and tax registration documents."
4. Observe character count and validation
5. Click "Request Changes" button
6. Wait for API call to complete

### Expected Results:
- Comments >= 10 characters shows green check mark
- Character count displays correctly
- "Request Changes" button enabled
- Loading spinner shown during API call
- Success toast: "Changes requested successfully"
- Description: "The workflow has been returned to the initiator for revisions."
- Navigate back to /tasks
- Task removed from "My Tasks" list
- Task count badge decremented

### Database Validation:
- `qualification_stages` (Stage 1):
  - `status` = "Rejected"
  - `reviewed_by` = reviewer user ID
  - `reviewed_date` = current timestamp
  - `comments` = rejection comments
- `qualification_workflows`:
  - `status` = "Draft"
  - `current_stage` = 0
- `suppliers`:
  - `status` = "prospect" (reverted from "qualified")

### Email Validation (Stub):
- Console log shows email notification to initiator
- Subject: "{Supplier} Qualification - Changes Requested"
- Includes reviewer name and rejection comments
- Includes link to workflow

---

## Scenario 8: View Rejected Workflow as Initiator

**AC Tested:** 9, 12  
**User Role:** Procurement Manager (Initiator)  
**Priority:** P1 - Important

### Steps:
1. Log in as `test-initiator@company.com` (workflow initiator)
2. Navigate to rejected workflow detail page
3. Observe rejection alert banner

### Expected Results:
- Alert banner displayed with warning styling
- Message: "This workflow was returned for changes by [Reviewer Name] on [Date]"
- Rejection comments displayed in alert
- Workflow is editable again (status = Draft)
- Can make changes and resubmit

---

## Scenario 9: Unauthorized Access Attempt

**AC Tested:** Authorization checks  
**User Role:** Quality Manager (not assigned to stage)  
**Priority:** P0 - Security

### Steps:
1. Log in as `test-quality@company.com` (Quality Manager)
2. Attempt to access `/workflows/:id/review` for Stage 1 workflow
3. Observe error/redirect

### Expected Results:
- Redirected to /tasks with error message
- Toast error: "You are not assigned to review this workflow"
- OR 403 error page
- Cannot approve/reject workflow

---

## Scenario 10: Role-Based Access Control

**AC Tested:** Role checks  
**User Role:** Viewer (no approval permissions)  
**Priority:** P0 - Security

### Steps:
1. Log in as viewer role user
2. Navigate to My Tasks
3. Attempt to approve/reject (if possible to access)

### Expected Results:
- My Tasks may show empty (no assignments)
- If viewer somehow accesses review page, approval/rejection returns 403
- Error message: "Access denied. Procurement Manager or Admin role required."

---

## Scenario 11: Concurrent Review Attempt

**AC Tested:** Already reviewed validation  
**User Role:** Procurement Manager (Reviewer)  
**Priority:** P1 - Important

### Steps:
1. User A approves a workflow
2. User B (with same workflow in their tasks) attempts to approve same stage
3. Observe error

### Expected Results:
- User B receives 400 error
- Error message: "This stage has already been reviewed"
- Toast error displayed
- Modal does not close
- User can cancel and return to tasks

---

## Scenario 12: Stage 2 Reviewer Assignment - Tenant Config

**AC Tested:** 13  
**User Role:** System/Admin  
**Priority:** P0 - Critical Path

### Setup:
- Tenant has `settings.workflowReviewers.stage2` set to specific user ID

### Steps:
1. Approve Stage 1 workflow
2. Check database for Stage 2 record

### Expected Results:
- Stage 2 created with `assigned_to` = tenant-configured user ID
- If configured user is inactive, falls back to first quality_manager
- If no quality_manager, falls back to admin
- If no reviewers available, returns 500 error

---

## Scenario 13: Mobile Responsive Layout

**AC Tested:** Responsive design  
**User Role:** Procurement Manager (Reviewer)  
**Priority:** P2 - Nice to Have

### Steps:
1. Access My Tasks page on mobile device/narrow viewport
2. Observe layout changes
3. Navigate to review page on mobile
4. Interact with approve/reject modals

### Expected Results:
- My Tasks: Table converts to card layout on mobile
- Review page: Single column layout
- Action buttons: Full width on mobile, sticky at bottom
- Modals: Full screen on mobile
- All functionality works on touch devices

---

## Scenario 14: Task Count Badge Updates

**AC Tested:** 1  
**User Role:** Procurement Manager (Reviewer)  
**Priority:** P1 - Important

### Steps:
1. Note initial task count badge in sidebar
2. Approve or reject a workflow
3. Observe badge after navigation back to tasks or other page

### Expected Results:
- Badge count decrements by 1 after approval/rejection
- Badge shows "0" or hidden when no tasks
- Count updates without page refresh (revalidation)

---

## Scenario 15: Error Handling - Network Failure

**AC Tested:** Error handling  
**User Role:** Procurement Manager (Reviewer)  
**Priority:** P1 - Important

### Steps:
1. Simulate network failure or API error
2. Attempt to approve workflow
3. Observe error handling

### Expected Results:
- Toast error: "Failed to approve stage"
- Descriptive error message shown
- Modal does not close
- User can retry or cancel
- No partial database updates (transaction rollback)

---

## Test Data Cleanup

After each test run:
1. Soft-delete test workflows
2. Remove created Stage 2 records
3. Reset supplier statuses
4. Clear audit logs (if implemented)

---

## Automated Test Considerations

These scenarios should ideally be automated using:
- **E2E Framework:** Playwright or Cypress
- **API Testing:** Supertest or Bun test with real HTTP calls
- **Test Isolation:** Each test uses fresh database state
- **Parallel Execution:** Tests should be independent

---

## Manual Testing Checklist

- [ ] Scenario 1: View My Tasks Queue
- [ ] Scenario 2: Filter High-Risk Tasks
- [ ] Scenario 3: Navigate to Workflow Review Page
- [ ] Scenario 4: Review Workflow Details and Documents
- [ ] Scenario 5: Add Review Comments and Approve Stage
- [ ] Scenario 6: Reject Stage with Invalid Comments
- [ ] Scenario 7: Reject Stage Successfully
- [ ] Scenario 8: View Rejected Workflow as Initiator
- [ ] Scenario 9: Unauthorized Access Attempt
- [ ] Scenario 10: Role-Based Access Control
- [ ] Scenario 11: Concurrent Review Attempt
- [ ] Scenario 12: Stage 2 Reviewer Assignment - Tenant Config
- [ ] Scenario 13: Mobile Responsive Layout
- [ ] Scenario 14: Task Count Badge Updates
- [ ] Scenario 15: Error Handling - Network Failure

---

## Test Execution Notes

### Browser Compatibility:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile Safari (iOS)
- Mobile Chrome (Android)

### Performance Benchmarks:
- My Tasks page load: < 500ms
- Review page load: < 1s
- Approve/Reject API: < 300ms
- Task count badge update: < 200ms

### Accessibility Testing:
- Screen reader navigation
- Keyboard-only navigation
- Focus management in modals
- ARIA labels validation

---

## Related Documentation

- **Story 2.6:** docs/stories/2.6.story.md
- **Quality Gate:** docs/qa/gates/2.6-stage-1-procurement-approval-rejection.yml
- **API Specification:** docs/architecture/api-specification.md
- **Testing Strategy:** docs/architecture/testing-strategy.md

---

**Prepared by:** Quinn (Test Architect)  
**Review Status:** Ready for execution  
**Last Updated:** October 25, 2025

