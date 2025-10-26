# Integration Test Scenarios - Story 2.9

**Story:** Qualification Workflow List & Filtering  
**Date:** October 26, 2025  
**Test Environment:** Staging/Production

---

## Overview

This document outlines integration test scenarios for the Qualifications page, which allows procurement managers to view, filter, sort, and export qualification workflows.

**Key Features:**
- Workflow list with filtering (status, stage, risk level, search)
- Sorting by date, days in progress, risk score
- Tab-based views (All, My Tasks, My Initiated)
- Pagination for large datasets
- CSV export functionality
- Responsive design (desktop table, mobile cards)

---

## Test Prerequisites

### Test Data Setup
- **Tenant:** Test Company (tenant-test-123)
- **Users:**
  - Procurement Manager: `pm@test.com` (initiates workflows, reviews Stage 1)
  - Quality Manager: `qm@test.com` (reviews Stage 2)
  - Admin: `admin@test.com` (reviews Stage 3)
- **Suppliers:**
  - Supplier A: "Acme Corp" (Stage1 workflow, 15 days old, risk score 4.5)
  - Supplier B: "TechSupply Inc" (Approved workflow, 30 days old, risk score 2.3)
  - Supplier C: "Global Materials" (Draft workflow, 2 days old, risk score 7.2)
  - Supplier D: "Precision Parts" (Stage2 workflow, 20 days old, risk score 5.8)
  - Supplier E: "Quality Components" (Rejected workflow, 10 days old, risk score 8.5)
  - (Additional 20+ suppliers with workflows for pagination testing)

### Test Environment
- Browser: Chrome (latest), Firefox (latest), Safari (latest)
- Devices: Desktop (1920x1080), Tablet (768x1024), Mobile (375x667)
- API: Backend running on staging server
- Database: Seeded with test data

---

## Scenario 1: Load Qualifications Page and View All Workflows

**AC:** 1, 2

**Preconditions:**
- User logged in as Procurement Manager
- Multiple workflows exist in tenant

**Steps:**
1. Navigate to `/qualifications` page
2. Verify page loads successfully
3. Check page title is "Qualifications"
4. Verify "All" tab is selected by default
5. Check table displays with 7 columns:
   - Supplier Name
   - Status (with colored badge)
   - Current Stage
   - Initiated By
   - Initiated Date (formatted)
   - Days In Progress
   - Risk Score (with colored badge)
6. Verify workflows are displayed (default 20 per page)
7. Verify sorting defaults to "Initiated Date DESC" (newest first)

**Expected Results:**
- Page loads without errors
- All workflows in tenant are displayed
- Table shows all required columns with correct data
- Status badges use correct colors (Draft=gray, Stage1-3=blue, Approved=green, Rejected=red)
- Risk badges use correct colors (Low=green <3.0, Medium=yellow 3.0-6.0, High=red >6.0)
- Days in progress calculated correctly from initiated date

**Test Data Validation:**
- Verify at least 5 workflows are visible
- Check supplier names match expected test data
- Confirm dates are formatted as "MMM DD, YYYY"

---

## Scenario 2: Filter Workflows by Status (Draft)

**AC:** 3

**Preconditions:**
- On Qualifications page with multiple workflows

**Steps:**
1. Click Status filter dropdown
2. Verify dropdown shows: All, Draft, InProgress, Stage1, Stage2, Stage3, Approved, Rejected
3. Select "Draft" from status dropdown
4. Wait for page to update
5. Verify URL updates to include `?status=Draft`
6. Verify only Draft workflows are displayed
7. Check table shows only workflows with "Draft" status badge
8. Verify pagination resets to page 1

**Expected Results:**
- Status filter updates correctly
- Table shows only Draft workflows
- URL reflects filter state (shareable/bookmarkable)
- Page count updates if fewer results
- "Clear Filters" button appears

**Test Data Validation:**
- At least one Draft workflow (Global Materials) is visible
- No workflows with other statuses are shown
- Total count reflects filtered results

---

## Scenario 3: Filter Workflows by Stage

**AC:** 4

**Preconditions:**
- On Qualifications page

**Steps:**
1. Click Stage filter dropdown
2. Verify dropdown shows: All, Stage 1, Stage 2, Stage 3
3. Select "Stage 2" from dropdown
4. Wait for page to update
5. Verify URL updates to include `?stage=2`
6. Verify only Stage 2 workflows are displayed
7. Check Current Stage column shows "Stage 2" for all rows

**Expected Results:**
- Stage filter applies correctly
- Only workflows in Stage 2 are shown
- URL updates with stage parameter
- Filter persists on page reload

**Test Data Validation:**
- At least one Stage 2 workflow (Precision Parts) is visible
- Current Stage column shows "Stage 2" for all results

---

## Scenario 4: Filter Workflows by Risk Level

**AC:** 5

**Preconditions:**
- On Qualifications page

**Steps:**
1. Click Risk Level filter dropdown
2. Verify dropdown shows: All, Low, Medium, High
3. Select "High" from dropdown
4. Wait for page to update
5. Verify URL updates to include `?riskLevel=High`
6. Verify only high-risk workflows are displayed (risk score > 6.0)
7. Check Risk Score column shows red badges for all rows

**Expected Results:**
- Risk level filter applies correctly
- Only high-risk workflows (>6.0) are shown
- Risk badges are red/destructive for all results
- URL updates with riskLevel parameter

**Test Data Validation:**
- At least two high-risk workflows visible (Global Materials 7.2, Quality Components 8.5)
- All risk scores are > 6.0

---

## Scenario 5: Search Workflows by Supplier Name

**AC:** 6

**Preconditions:**
- On Qualifications page

**Steps:**
1. Locate search input with placeholder "Search by supplier name..."
2. Type "acme" in search box
3. Wait 300ms for debounce
4. Verify URL updates to include `?search=acme`
5. Verify only "Acme Corp" workflow is displayed
6. Type "tech" in search box (replacing previous search)
7. Wait 300ms for debounce
8. Verify only "TechSupply Inc" workflow is displayed
9. Clear search box
10. Verify all workflows are shown again

**Expected Results:**
- Search is case-insensitive
- Search filters by partial supplier name match
- Debounce prevents excessive API calls (300ms delay)
- URL updates with search parameter
- Search combines with other filters if active

**Test Data Validation:**
- Searching "acme" shows Acme Corp workflow
- Searching "supply" shows TechSupply Inc workflow
- Clearing search restores all workflows

---

## Scenario 6: Sort Workflows by Initiated Date

**AC:** 7

**Preconditions:**
- On Qualifications page with multiple workflows

**Steps:**
1. Locate "Initiated Date" column header
2. Verify column header shows sort icon (ArrowDown by default)
3. Note the order of workflows (newest first by default)
4. Click "Initiated Date" column header
5. Verify icon changes to ArrowUp
6. Verify URL updates to include `?sortBy=initiated_date&sortOrder=asc`
7. Check workflows are sorted oldest first
8. Click "Initiated Date" column header again
9. Verify icon changes back to ArrowDown
10. Check workflows are sorted newest first again

**Expected Results:**
- Sort toggle works correctly
- Icon indicates current sort direction
- Workflows reorder based on initiated date
- URL updates with sort parameters

**Test Data Validation:**
- Ascending sort: TechSupply Inc (Sep 20) → Global Materials (Oct 25)
- Descending sort: Global Materials (Oct 25) → TechSupply Inc (Sep 20)

---

## Scenario 7: Sort Workflows by Days in Progress

**AC:** 7

**Preconditions:**
- On Qualifications page

**Steps:**
1. Locate "Days In Progress" column header
2. Click column header
3. Verify icon changes to ArrowDown (desc = longest first)
4. Verify URL updates to include `?sortBy=days_in_progress&sortOrder=desc`
5. Check workflows are sorted by days in progress (longest first)
6. Verify workflow with most days is at top
7. Click column header again
8. Check workflows are sorted by days in progress (shortest first)

**Expected Results:**
- Sort applies to calculated days in progress field
- Longest-running workflows appear first when desc
- Shortest-running workflows appear first when asc
- URL reflects sort state

**Test Data Validation:**
- Descending: TechSupply Inc (36 days) at top
- Ascending: Global Materials (2 days) at top

---

## Scenario 8: Sort Workflows by Risk Score

**AC:** 7

**Preconditions:**
- On Qualifications page

**Steps:**
1. Locate "Risk Score" column header
2. Click column header
3. Verify icon changes to ArrowDown (desc = highest first)
4. Verify URL updates to include `?sortBy=risk_score&sortOrder=desc`
5. Check workflows are sorted by risk score (highest first)
6. Verify highest risk workflow is at top
7. Click column header again
8. Check workflows are sorted by risk score (lowest first)

**Expected Results:**
- Sort applies to risk score field
- Highest-risk workflows appear first when desc
- Lowest-risk workflows appear first when asc
- URL reflects sort state

**Test Data Validation:**
- Descending: Quality Components (8.5) at top
- Ascending: TechSupply Inc (2.3) at top

---

## Scenario 9: Switch to "My Tasks" Tab

**AC:** 9

**Preconditions:**
- Logged in as Quality Manager
- Quality Manager is assigned as reviewer for Stage 2 workflows

**Steps:**
1. On Qualifications page
2. Click "My Tasks" tab
3. Verify URL updates to include `?tab=myTasks`
4. Verify page reloads with filtered workflows
5. Check only workflows assigned to current user are shown
6. Verify workflows are in pending state (not yet reviewed)
7. Verify workflows match current user's stage assignments

**Expected Results:**
- Tab switches correctly
- Only workflows assigned to current user are displayed
- URL updates with tab parameter
- Empty state shows if user has no assigned tasks
- Page resets to page 1

**Test Data Validation:**
- Quality Manager should see Precision Parts (Stage 2, assigned to them)
- Should NOT see Acme Corp (Stage 1, assigned to Procurement Manager)

---

## Scenario 10: Switch to "My Initiated" Tab

**AC:** 10

**Preconditions:**
- Logged in as Procurement Manager
- Procurement Manager has initiated multiple workflows

**Steps:**
1. On Qualifications page
2. Click "My Initiated" tab
3. Verify URL updates to include `?tab=myInitiated`
4. Verify page reloads with filtered workflows
5. Check only workflows initiated by current user are shown
6. Verify "Initiated By" column shows current user's name for all rows
7. Switch back to "All" tab
8. Verify all workflows are shown again

**Expected Results:**
- Tab switches correctly
- Only workflows initiated by current user are displayed
- URL updates with tab parameter
- Empty state shows if user has no initiated workflows
- Page resets to page 1

**Test Data Validation:**
- Procurement Manager should see workflows they initiated (Acme Corp, Precision Parts)
- Should NOT see workflows initiated by other users

---

## Scenario 11: Navigate Through Pagination

**AC:** 11

**Preconditions:**
- More than 20 workflows exist in tenant (for pagination)
- On Qualifications page

**Steps:**
1. Verify pagination controls appear at bottom of page
2. Check "Showing 1-20 of X workflows" text is displayed
3. Verify "Previous" button is disabled on page 1
4. Click "Next" button
5. Verify URL updates to include `?page=2`
6. Check "Showing 21-40 of X workflows" text updates
7. Verify "Previous" button is now enabled
8. Click "Previous" button
9. Verify URL updates to `?page=1`
10. Check "Showing 1-20 of X workflows" text restores
11. Click page number "3" (if exists)
12. Verify URL updates to `?page=3`
13. Verify "Next" button is disabled on last page

**Expected Results:**
- Pagination works correctly
- Page count and item range updates accurately
- Next/Previous buttons enable/disable appropriately
- URL reflects current page
- Filters and sorting persist across pages

**Test Data Validation:**
- Total workflow count matches database
- Each page shows up to 20 workflows
- Last page may have fewer than 20 workflows

---

## Scenario 12: Click Workflow Row to View Detail

**AC:** 8

**Preconditions:**
- On Qualifications page with workflows displayed

**Steps:**
1. Locate a workflow row in the table (e.g., "Acme Corp")
2. Hover over the row
3. Verify cursor changes to pointer
4. Verify row background changes on hover
5. Click anywhere on the workflow row
6. Verify navigation to workflow detail page
7. Check URL is `/workflows/{workflowId}`
8. Verify correct workflow detail page loads

**Expected Results:**
- Row hover shows visual feedback
- Clicking row navigates to detail page
- Correct workflow ID is passed in URL
- Detail page loads successfully

**Test Data Validation:**
- Clicking "Acme Corp" row navigates to `/workflows/workflow-1`
- Detail page shows correct supplier information

---

## Scenario 13: Export Workflows to CSV

**AC:** 14

**Preconditions:**
- On Qualifications page with workflows displayed
- Filters may be active (status, risk, search)

**Steps:**
1. Locate "Export CSV" button in page header
2. Apply filters (e.g., status=Stage1, riskLevel=High)
3. Click "Export CSV" button
4. Verify button shows "Exporting..." state
5. Wait for export to complete
6. Check browser downloads CSV file
7. Verify filename format: `qualifications-YYYY-MM-DD.csv`
8. Open CSV file
9. Verify headers: Supplier Name, Status, Current Stage, Initiated By, Initiated Date, Days In Progress, Risk Score
10. Verify data matches filtered view on page
11. Check supplier names are quoted (for comma handling)
12. Check dates are formatted as YYYY-MM-DD
13. Check risk scores are formatted to 2 decimal places
14. Verify toast notification shows "Export Complete"

**Expected Results:**
- Export button triggers download
- CSV file is generated with correct format
- CSV respects current filters
- CSV includes all matching workflows (no pagination)
- Headers are correct
- Data is properly formatted and escaped
- Toast notification confirms success

**Test Data Validation:**
- If filtered by Stage1 and High risk, CSV should only include matching workflows
- CSV should have correct column count (7 columns)
- Supplier names with commas should be quoted

**Error Scenarios:**
- Network failure: Toast shows "Export Failed"
- Server error: Toast shows error message

---

## Scenario 14: View Empty State When No Workflows

**AC:** 12

**Preconditions:**
- New tenant with no workflows OR filters applied that match no workflows

**Steps:**
1. Navigate to Qualifications page
2. (OR apply filters that match nothing, e.g., search for "nonexistent")
3. Verify table is hidden
4. Check empty state component is displayed
5. Verify empty state shows:
   - Icon (FileQuestion or similar)
   - Message: "No qualifications found"
   - Subtext: "Try adjusting your filters or start a new qualification workflow for a supplier"
   - CTA Button: "Start New Qualification"
6. Click "Start New Qualification" button
7. Verify navigation to `/suppliers` page

**Expected Results:**
- Empty state displays when no workflows match
- Message is helpful and actionable
- CTA button navigates to suppliers page
- Empty state is visually clear and centered

**Test Data Validation:**
- Searching for "nonexistent" triggers empty state
- Clicking CTA navigates to suppliers page

---

## Scenario 15: Mobile View Displays Card Layout

**AC:** 13

**Preconditions:**
- On Qualifications page
- Mobile device or responsive mode (< 768px width)

**Steps:**
1. Resize browser to mobile width (e.g., 375px)
2. Verify table is hidden
3. Check card layout is displayed
4. Verify each workflow is shown as a card
5. Check each card displays:
   - Supplier Name (title)
   - Status badge
   - Current Stage
   - Initiated By
   - Initiated Date
   - Days In Progress
   - Risk Score badge
6. Tap a card
7. Verify navigation to workflow detail page
8. Resize browser to desktop width (>= 768px)
9. Verify table is shown and cards are hidden

**Expected Results:**
- Mobile view uses card layout instead of table
- Cards show all required information
- Cards are tappable and navigate correctly
- Responsive breakpoint at 768px works correctly
- Layout switches automatically on resize

**Test Data Validation:**
- All workflow data is visible in mobile cards
- Card tap navigates to correct workflow detail
- Status and risk badges are visible and colored correctly

**Devices to Test:**
- iPhone (375x667)
- iPad (768x1024)
- Android phone (360x640)

---

## Scenario 16: Combined Filters (Multiple Active)

**AC:** 3, 4, 5, 6 (Combined)

**Preconditions:**
- On Qualifications page with diverse workflow data

**Steps:**
1. Apply Status filter: "InProgress"
2. Apply Risk Level filter: "High"
3. Verify only in-progress workflows with high risk are shown
4. Add search: "global"
5. Verify results are further filtered to match all criteria
6. Check URL contains all filter parameters: `?status=InProgress&riskLevel=High&search=global`
7. Click "Clear Filters" button
8. Verify all filters reset
9. Check URL returns to base: `/qualifications`
10. Verify all workflows are shown again

**Expected Results:**
- Multiple filters apply simultaneously (AND logic)
- Results match all filter criteria
- URL reflects all active filters
- Clear Filters resets everything
- Page resets to page 1 on filter changes

**Test Data Validation:**
- Combining InProgress + High risk should show specific workflows
- Adding search should narrow results further
- Clearing filters restores full list

---

## Scenario 17: Filter Persistence on Page Reload

**AC:** URL-based state

**Preconditions:**
- On Qualifications page

**Steps:**
1. Apply multiple filters (status, risk, search)
2. Sort by risk score DESC
3. Navigate to page 2
4. Note the full URL with all parameters
5. Copy the URL
6. Open a new browser tab
7. Paste and navigate to the copied URL
8. Verify all filters are applied
9. Verify sorting is correct
10. Verify correct page is displayed
11. Share URL with another user (different session)
12. Verify they see the same filtered view

**Expected Results:**
- URL captures all state (filters, sorting, pagination, tabs)
- Pasting URL reproduces exact view
- URLs are shareable and bookmarkable
- Filters persist across sessions

**Test Data Validation:**
- Shared URL shows same workflows and filters for other users (within same tenant)

---

## Scenario 18: Performance with Large Dataset

**AC:** Performance (500+ workflows)

**Preconditions:**
- Tenant has 500+ workflows seeded

**Steps:**
1. Navigate to Qualifications page
2. Measure page load time (should be < 2s)
3. Apply filters
4. Measure filter response time (should be < 500ms)
5. Sort by different columns
6. Measure sort response time (should be < 500ms)
7. Navigate through multiple pages
8. Verify smooth pagination
9. Export to CSV (all 500+ workflows)
10. Measure export time (should be < 5s)
11. Check CSV file size and completeness

**Expected Results:**
- Page loads quickly even with large dataset
- Pagination keeps queries efficient
- Filters and sorting are responsive
- CSV export handles large datasets
- No browser freezing or lag

**Performance Targets:**
- Initial page load: < 2s
- Filter/sort: < 500ms
- Pagination: < 300ms
- CSV export: < 5s for 1000 workflows

---

## Scenario 19: Error Handling - API Failure

**AC:** Error handling

**Preconditions:**
- On Qualifications page
- Ability to simulate API failure

**Steps:**
1. Simulate network error or API failure
2. Attempt to load Qualifications page
3. Verify error message is displayed
4. Check user is not shown empty state (different from no results)
5. Verify error message is helpful (e.g., "Failed to load workflows. Please try again.")
6. Try to export CSV with API down
7. Verify toast shows "Export Failed"

**Expected Results:**
- API errors are caught gracefully
- User sees helpful error messages
- Page doesn't crash or show white screen
- Export errors show toast notification

---

## Scenario 20: Security - Tenant Isolation

**AC:** Tenant isolation

**Preconditions:**
- Two tenants with separate workflows
- User logged in to Tenant A

**Steps:**
1. Log in as user from Tenant A
2. Navigate to Qualifications page
3. Note workflows visible (only from Tenant A)
4. Log out
5. Log in as user from Tenant B
6. Navigate to Qualifications page
7. Verify different workflows are shown (only from Tenant B)
8. Verify Tenant A workflows are NOT visible
9. Attempt to access workflow detail from Tenant A using direct URL
10. Verify access is denied (404 or 403)

**Expected Results:**
- Users only see workflows from their tenant
- Cross-tenant data access is prevented
- Direct URL access to other tenant's workflows is blocked
- API enforces tenant isolation

**Security Validation:**
- Database queries include tenant_id filter
- API endpoints validate tenant ownership

---

## Regression Tests

### Critical Paths to Test After Changes:
1. Basic workflow list loading
2. Filter functionality (all filters)
3. Sorting (all columns)
4. Pagination
5. CSV export
6. Mobile responsive view
7. Tab switching
8. Row click navigation
9. Empty state
10. Tenant isolation

---

## Test Execution Checklist

- [ ] All 20 scenarios executed
- [ ] Tests run on Chrome, Firefox, Safari
- [ ] Mobile/tablet testing completed
- [ ] Performance validated with large dataset
- [ ] Security tests passed (tenant isolation)
- [ ] CSV export validated
- [ ] Accessibility checked (keyboard navigation, screen readers)
- [ ] Error scenarios tested
- [ ] Regression tests passed
- [ ] Test data cleaned up

---

## Known Issues & Limitations

_To be filled during testing_

---

## Sign-Off

**Tester:** ___________________  
**Date:** ___________________  
**Status:** ☐ Pass ☐ Fail ☐ Blocked

**Notes:**
_______________________________________

---

**End of Integration Test Scenarios - Story 2.9**

