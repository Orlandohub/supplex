# Epic 4: Complaints & CAPA Management

**Epic Goal:** Enable quality teams to systematically register, track, and resolve supplier quality issues through structured complaint management and basic CAPA (Corrective and Preventive Action) workflows. This epic improves supplier quality accountability, reduces repeat defects, and provides compliance documentation for quality audits.

## Story 4.1: Complaint Data Model & Schema

As a **developer**,
I want the database schema for complaints and CAPA established,
so that we can track supplier issues and corrective actions.

**Acceptance Criteria:**

1. Drizzle schema defined for `complaints` table with fields: id, tenant_id, supplier_id, complaint_number (auto-generated), title, description, severity (Critical, High, Medium, Low), category, status (Open, In Progress, Resolved, Closed), reported_by, reported_date, due_date, assigned_to, closed_date
2. Schema defined for `complaint_categories` table: id, tenant_id, category_name, description, is_default
3. Schema defined for `capa_actions` table: id, complaint_id, action_type (Corrective, Preventive), root_cause, action_description, responsible_party, target_date, completion_date, status (Pending, In Progress, Completed, Verified), verification_notes
4. Schema defined for `complaint_impacts` table: id, complaint_id, impact_type (Financial, Operational, Customer, Regulatory), impact_description, estimated_cost
5. Database migrations created and tested for all complaint tables
6. RLS policies applied enforcing tenant isolation on all complaint data
7. Foreign key relationships: complaint → supplier, capa → complaint, impact → complaint
8. Indexes created: complaints by supplier_id, complaints by status, complaints by severity, complaints by assigned_to
9. Seed data includes default complaint categories: Defective Material, Late Delivery, Non-Conformance, Documentation Issue, Communication Issue
10. Complaint number auto-generation pattern: `COMP-{YEAR}-{SEQUENCE}` (e.g., COMP-2025-0001)
11. Automated tests verify tenant isolation and cascading relationships

## Story 4.2: Complaint Category Configuration

As a **tenant administrator**,
I want to configure complaint categories,
so that complaints are consistently classified across my organization.

**Acceptance Criteria:**

1. Settings page includes "Complaint Categories" section
2. Admin can view list of existing complaint categories
3. "Add Category" button opens category creation form
4. Category form includes: Category name (required), Description, Color (for badges), Icon selection
5. Default categories pre-populated: Defective Material (red), Late Delivery (orange), Non-Conformance (yellow), Documentation Issue (blue), Communication Issue (gray)
6. Admin can edit existing categories (name, description, color, icon)
7. Admin can mark categories as "Archived" (hidden from new complaints but preserved for historical data)
8. Cannot delete categories in use by existing complaints (show count and archive option)
9. Category list shows: Name, Description, # of complaints using category, Created date
10. Categories used in dropdown selection throughout complaint forms
11. Mobile-responsive interface with color picker and icon selector

## Story 4.3: Register New Complaint

As a **quality manager**,
I want to register a complaint against a supplier,
so that we can formally document and track quality issues.

**Acceptance Criteria:**

1. Supplier detail page includes "Complaints" tab with "Register Complaint" button
2. "Complaints" page includes global "Register Complaint" button with supplier selector
3. Complaint registration form includes: Supplier (dropdown or pre-selected), Title (required), Description (rich text), Severity (Critical/High/Medium/Low dropdown), Category (dropdown), Reported date (default today, editable), Due date (auto-calculated based on severity), Assigned to (user dropdown)
4. Severity affects due date: Critical = 3 days, High = 7 days, Medium = 14 days, Low = 30 days
5. Due date editable by user after auto-calculation
6. Description field supports rich text formatting (bold, italic, bullets, numbered lists)
7. "Attach Files" section allows uploading evidence (photos, documents, defect reports) with max 10MB per file
8. Multiple file uploads with progress indicator
9. Optional impact assessment section: Impact type checkboxes (Financial, Operational, Customer, Regulatory), Impact description, Estimated cost (dollar amount)
10. "Save Draft" saves complaint with status Open but doesn't send notifications
11. "Submit" saves complaint with status Open and sends notification to assigned user and supplier contact (optional)
12. Complaint number auto-generated on submission: COMP-2025-0001
13. Success message displays: "Complaint COMP-2025-0001 registered for [Supplier Name]"
14. Audit log records complaint creation with reporter, timestamp, initial details
15. Mobile-responsive form with appropriate input types

## Story 4.4: Complaint Detail View & Status Management

As a **quality manager**,
I want to view complaint details and update status,
so that I can track resolution progress.

**Acceptance Criteria:**

1. Complaint detail page displays header: Complaint number (prominent), Supplier name (linked), Status badge, Severity badge, Reported date, Due date, Days open/overdue
2. Overdue complaints display red "OVERDUE" badge with days overdue
3. Main content sections: Description, Category, Assigned to, Impact assessment, Attachments, Activity timeline
4. Description displayed with rich text formatting preserved
5. Status update dropdown allows: Open → In Progress → Resolved → Closed
6. Status change requires comment explaining the change
7. Status change from Resolved → Closed requires final verification notes
8. Cannot reopen Closed complaints (Admin override only)
9. Severity can be updated (requires comment explaining why)
10. Can reassign complaint to different user (sends notification to new assignee)
11. Can edit due date (requires comment, records audit trail)
12. Activity timeline shows all status changes, reassignments, comments, CAPA actions with timestamp and user
13. "Add Comment" button allows adding notes/updates to complaint
14. Comments display with user avatar, name, timestamp, and text
15. Email notification sent on status changes to: Assigned user, Reporter, Watchers (if configured)
16. Mobile-responsive with collapsible sections

## Story 4.5: CAPA Workflow - Root Cause Analysis

As a **quality manager**,
I want to document root cause analysis for complaints,
so that we understand why issues occurred.

**Acceptance Criteria:**

1. Complaint detail page includes "CAPA" tab for Corrective and Preventive Action tracking
2. "Add Root Cause Analysis" button opens root cause form
3. Root cause form includes: Problem statement (auto-populated from complaint description, editable), Root cause description (textarea), Contributing factors (bullet list), Analysis method used (dropdown: 5 Whys, Fishbone, Other, None - basic for MVP)
4. Analysis method dropdown is informational only (no guided workflow in MVP)
5. Supporting evidence section allows uploading documents (investigation reports, test results)
6. "Save Root Cause" button saves analysis and enables CAPA action creation
7. Root cause analysis displayed in CAPA tab with: Problem, Root cause, Contributing factors, Evidence links
8. Can edit root cause analysis until CAPA actions are marked complete
9. Root cause is required before creating corrective actions (validation)
10. Timeline records root cause entry with user and timestamp
11. Mobile-responsive with expandable text areas

## Story 4.6: CAPA Workflow - Corrective Actions

As a **quality manager**,
I want to define and track corrective actions,
so that we ensure issues are resolved and won't recur.

**Acceptance Criteria:**

1. CAPA tab includes "Add Corrective Action" button (enabled after root cause documented)
2. Corrective action form includes: Action description (required), Responsible party (supplier contact or internal user), Target completion date, Status (Pending, In Progress, Completed, Verified), Verification method (description of how action will be verified)
3. Can add multiple corrective actions for single complaint
4. Each action displays as card: Description, Responsible party, Target date, Status badge, Days until due/overdue
5. Status update modal allows changing status with comments
6. Completing action requires evidence: Completion date, Completion notes, Attach evidence documents
7. Verification step separate from completion: Verifier (different user), Verification date, Verification result (Pass/Fail), Verification notes
8. Failed verification returns action to In Progress status
9. Email notification sent to responsible party when action assigned
10. Reminder email sent when action is 3 days from target date and status is Pending/In Progress
11. Overdue actions highlighted in red with "OVERDUE" badge
12. Cannot close complaint until all corrective actions are Completed and Verified
13. Timeline records all action creation, updates, completions, verifications
14. Mobile-responsive action cards with swipe-to-update on mobile

## Story 4.7: CAPA Workflow - Preventive Actions

As a **quality manager**,
I want to define preventive actions,
so that we prevent similar issues from occurring in the future.

**Acceptance Criteria:**

1. CAPA tab includes "Add Preventive Action" button
2. Preventive action form identical to corrective action form: Description, Responsible party, Target date, Status, Verification method
3. Preventive actions displayed separately from corrective actions (different section or tab)
4. Preventive action description prompts: "What will be done to prevent recurrence?" with example text
5. Preventive actions can be added even without root cause (proactive measures)
6. Status workflow identical to corrective actions: Pending → In Progress → Completed → Verified
7. Preventive actions not required to close complaint (nice-to-have, not mandatory)
8. Email notifications follow same pattern as corrective actions
9. Timeline distinguishes between corrective and preventive actions with icons/labels
10. Can convert corrective action to preventive action or vice versa (status resets)
11. Summary view shows: Total CAPA actions, # Corrective, # Preventive, # Completed, # Overdue
12. Mobile-responsive with clear visual distinction between corrective vs. preventive

## Story 4.8: Complaint List View & Filtering

As a **quality manager**,
I want to view and filter all complaints,
so that I can prioritize and track resolution efforts.

**Acceptance Criteria:**

1. "Complaints" page displays list of all complaints in tenant
2. Table columns: Complaint #, Supplier Name, Title, Severity (badge), Category, Status (badge), Assigned To, Reported Date, Due Date, Days Open
3. Severity badges color-coded: Critical (red), High (orange), Medium (yellow), Low (blue)
4. Status filter: All, Open, In Progress, Resolved, Closed
5. Severity filter: All, Critical, High, Medium, Low
6. Category filter: Multi-select dropdown with all categories
7. Supplier filter: Multi-select dropdown with all suppliers
8. Date range filter: Reported date range, Due date range
9. Overdue toggle: Show only overdue complaints
10. Search bar filters by complaint number or title
11. Sort by: Reported date, Due date, Severity, Status, Supplier name
12. "My Complaints" tab shows only complaints assigned to current user
13. "Open Issues" tab shows only Open and In Progress complaints
14. "Overdue" tab shows only overdue complaints with days overdue prominently displayed
15. Clicking complaint row navigates to complaint detail page
16. Bulk actions: Select multiple complaints, "Reassign" to different user
17. Export to CSV includes all fields plus CAPA action count
18. Empty state displays "No complaints" with "Register Complaint" CTA
19. Mobile view converts to card layout with key info highlighted

## Story 4.9: Supplier Complaint History & Tracking

As a **procurement manager**,
I want to see all complaints filed against each supplier,
so that I can identify recurring issues and trends.

**Acceptance Criteria:**

1. Supplier detail page "Complaints" tab displays all complaints for that supplier
2. Tab shows summary metrics: Total complaints, Open complaints, Critical/High complaints, Average resolution time
3. Complaints table with columns: Complaint #, Title, Severity, Status, Reported Date, Resolution Date, Days to Resolve
4. Status filter: All, Open, In Progress, Resolved, Closed
5. Severity filter: All, Critical, High, Medium, Low
6. Complaints sorted by reported date (newest first) with option to sort by severity or status
7. Visual indicator for repeat issues: "Similar issues: 3" if same category/title pattern detected
8. Chart shows complaints over time (past 12 months): Bars = complaint count by month, Color-coded by severity
9. Category breakdown chart: Pie chart showing distribution of complaint categories for this supplier
10. Trend analysis section: "Most common issue: Defective Material (45%)", "Average resolution time: 12 days"
11. Performance impact link: If evaluations exist, show correlation between complaints and evaluation scores
12. Alert displayed if multiple critical complaints in last 90 days: "Quality Alert: 3 critical issues"
13. "Export Complaint History" button generates PDF report with all complaints and charts
14. Empty state displays "No complaints registered" (positive message)
15. Mobile-responsive with charts converting to simplified view

## Story 4.10: Complaint Notifications & Escalations

As a **quality manager**,
I want to receive notifications about complaint assignments and escalations,
so that I respond promptly to quality issues.

**Acceptance Criteria:**

1. Email notification sent when complaint is assigned: "New complaint assigned: COMP-2025-0001 for [Supplier]"
2. Email includes: Complaint number, Supplier, Title, Severity, Due date, Direct link to complaint
3. Email notification sent when complaint reassigned: "Complaint COMP-2025-0001 reassigned to you"
4. Reminder email sent when complaint is 50% through due date window (based on severity)
5. Urgent reminder email sent when complaint is 1 day from due date
6. Escalation email sent to quality manager + admin when complaint becomes overdue
7. Email notification sent when CAPA action assigned to responsible party
8. Reminder for CAPA action sent 3 days before target date
9. Notification sent when complaint status changes to Resolved or Closed
10. Notification sent to reporter when their complaint is resolved/closed
11. In-app notification center shows complaint-related notifications with count badge
12. User preferences allow opting out of reminders but not assignment notifications
13. Background job (BullMQ) checks daily for complaint due dates and CAPA action due dates
14. Admin dashboard shows complaint response metrics: Avg time to first response, Overdue count, Resolution rate
15. Escalation rules configurable per tenant: Auto-escalate critical complaints after X days

## Story 4.11: Complaint Impact Analysis & Reporting

As a **quality manager**,
I want to analyze complaint impacts and generate reports,
so that I can quantify costs and demonstrate improvement to leadership.

**Acceptance Criteria:**

1. Complaint detail page displays "Impact" section showing all recorded impacts
2. Impact section shows: Financial impact (total cost), Operational impact (description), Customer impact, Regulatory impact
3. Can add multiple impacts per complaint with "Add Impact" button
4. Impact form: Type (Financial/Operational/Customer/Regulatory), Description, Estimated cost (if financial)
5. Financial impacts aggregated: Show total cost across all impacts for the complaint
6. Supplier detail "Complaints" tab shows total financial impact: "Total cost of quality issues: $45,000"
7. Complaints list view includes "Impact" column showing financial impact if recorded
8. "Reports" section in Complaints page includes complaint analytics dashboard
9. Dashboard metrics: Total complaints (period), Resolution rate (%), Avg resolution time, Total financial impact
10. Trend chart shows complaint volume over time with trend line
11. Supplier ranking table: Suppliers sorted by complaint count, avg severity, total impact
12. Category analysis shows most frequent categories with cost breakdown
13. Time-to-resolution histogram: Distribution of resolution times by severity
14. Filter all reports by date range, supplier, category, severity
15. "Generate Executive Report" button creates PDF with all analytics, charts, and key insights
16. Report includes: Period summary, Top issues, Supplier performance, Cost analysis, Improvement trends
17. Mobile-responsive dashboard with scrollable charts
