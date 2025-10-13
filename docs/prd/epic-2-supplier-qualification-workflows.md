# Epic 2: Supplier Qualification Workflows

**Epic Goal:** Enable procurement and quality teams to run structured, compliant supplier qualification processes with a 3-stage linear approval workflow, configurable document checklists, risk assessment, automated notifications, and complete audit trails. This epic reduces qualification time by 50% and ensures audit-ready documentation for ISO 9001 and other certifications.

## Story 2.1: Qualification Workflow Data Model & Foundation

As a **developer**,
I want the database schema for qualification workflows established,
so that we can track supplier qualification states and approvals.

**Acceptance Criteria:**

1. Drizzle schema defined for `qualification_workflows` table with fields: id, tenant_id, supplier_id, status (Draft, Stage1, Stage2, Stage3, Approved, Rejected), initiated_by, initiated_date, current_stage, risk_score
2. Schema defined for `qualification_stages` table: id, workflow_id, stage_number (1-3), stage_name, assigned_to, status (Pending, Approved, Rejected), reviewed_by, reviewed_date, comments, attachments
3. Schema defined for `document_checklists` table: id, tenant_id, template_name, required_documents (JSON array), is_default
4. Schema defined for `workflow_documents` table: id, workflow_id, checklist_item_id, document_id, status (Pending, Uploaded, Approved, Rejected)
5. Database migrations created and tested for all new tables
6. RLS policies applied to all workflow tables enforcing tenant isolation
7. Foreign key relationships established: workflow → supplier, stage → workflow, document → workflow
8. Indexes created for common queries: workflow by supplier_id, workflow by status, stage by assigned_to
9. Seed data includes default document checklist template (ISO 9001 certificate, W-9, Insurance certificate, Quality manual, etc.)
10. Automated tests verify tenant isolation for workflow data

## Story 2.2: Document Checklist Configuration

As a **tenant administrator**,
I want to configure document checklist templates for qualifications,
so that my team uses consistent requirements across all supplier qualifications.

**Acceptance Criteria:**

1. Settings page includes "Qualification Checklists" section
2. Admin can view list of existing checklist templates
3. "Create Template" button opens form to create new checklist template
4. Template form includes: Template name (required), Description, Required documents list (add/remove items)
5. Each checklist item has: Document name (required), Description, Is required (checkbox), Document type dropdown
6. Default template is pre-populated with standard items: ISO 9001 Certificate, Business License, Insurance Certificate, W-9 Tax Form, Quality Manual
7. Admin can mark one template as "Default" (used for new qualifications)
8. Admin can edit existing templates
9. Admin can delete templates (with confirmation, only if not in use by active workflows)
10. Template list shows: Name, # of required documents, Is default, Created date, Last modified
11. Changes to templates do not affect in-progress qualifications (snapshot template at workflow creation)
12. Mobile-responsive interface with touch-optimized controls

## Story 2.3: Initiate Qualification Workflow

As a **procurement manager**,
I want to initiate a qualification workflow for a supplier,
so that we can formally assess and approve them.

**Acceptance Criteria:**

1. Supplier detail page includes "Start Qualification" button (visible when supplier is in Prospect status)
2. Clicking "Start Qualification" opens workflow initiation modal
3. Modal displays: Supplier name, Selected checklist template dropdown (defaults to tenant default), Risk assessment section, Notes field
4. Risk assessment includes manual inputs: Geographic risk (Low/Medium/High), Financial risk, Quality risk, Delivery risk
5. Overall risk score calculated automatically from individual risk inputs (weighted average)
6. "Initiate Workflow" button creates workflow record in Draft status
7. Workflow creation associates default document checklist with workflow (snapshot, not reference)
8. Workflow displays on supplier detail page in new "Qualifications" tab
9. Workflow status badge shows current stage: Draft, Stage 1 (Pending), Stage 2 (Pending), Stage 3 (Pending), Approved, Rejected
10. Initiator receives confirmation toast: "Qualification workflow initiated for [Supplier Name]"
11. Audit log records workflow initiation with user, timestamp, and initial risk scores
12. Can only initiate one active qualification per supplier at a time (prevents duplicates)

## Story 2.4: Document Upload for Qualification

As a **procurement manager**,
I want to upload required documents during qualification,
so that we collect all necessary documentation before approval.

**Acceptance Criteria:**

1. Qualification workflow detail page displays document checklist section
2. Checklist displays all required documents with status indicators: Not uploaded (gray), Uploaded (blue), Approved (green), Rejected (red)
3. Each checklist item shows: Document name, Description, Required badge, Upload status, Upload button
4. Clicking "Upload" opens file picker and document metadata form
5. User can upload file and map it to checklist item (links existing supplier document OR uploads new document)
6. Progress bar shows upload progress for each document
7. After upload, checklist item status updates to "Uploaded (Pending Review)"
8. Document list shows all uploaded documents with: Filename, Uploaded by, Upload date, Status
9. Can upload multiple documents per checklist item if needed
10. Can remove uploaded document and re-upload (Admin/Procurement Manager only)
11. Checklist completion percentage displayed: "5 of 8 documents uploaded (63%)"
12. Cannot submit workflow for Stage 1 approval until all required documents are uploaded
13. Mobile-responsive with touch-optimized file upload interface

## Story 2.5: Stage 1 - Submit for Procurement Review

As a **procurement manager**,
I want to submit a qualification workflow for stage 1 approval,
so that it can be reviewed by procurement leadership.

**Acceptance Criteria:**

1. "Submit for Review" button displayed when workflow is in Draft status and all required documents uploaded
2. Clicking button opens confirmation modal: "Submit to Stage 1: Procurement Review?"
3. Modal displays summary: Supplier name, Risk score, # of documents uploaded, Reviewer (auto-assigned based on tenant config)
4. Submission changes workflow status from Draft → Stage 1 (Pending)
5. Stage 1 record created with status Pending, assigned to configured procurement reviewer
6. Email notification sent to assigned reviewer with: Supplier name, Initiated by, Risk score, Direct link to workflow
7. Supplier status automatically updated from Prospect → Qualified (in-progress qualification)
8. Timeline/history widget on workflow page shows: "Submitted for Stage 1 review by [User] on [Date/Time]"
9. Initiator can no longer edit workflow or documents (read-only unless rejected)
10. "Pending Review" badge displayed prominently on workflow page
11. Workflow appears in reviewer's "My Tasks" queue with "Action Required" indicator
12. Audit log records submission with user, timestamp, and assigned reviewer

## Story 2.6: Stage 1 - Procurement Approval/Rejection

As a **procurement manager (reviewer)**,
I want to review and approve or reject stage 1 qualifications,
so that only suitable suppliers proceed to quality review.

**Acceptance Criteria:**

1. "My Tasks" queue in navigation shows count of pending workflow reviews assigned to user
2. Task queue displays list of workflows awaiting approval with: Supplier name, Submitted by, Submitted date, Risk score, Days pending
3. Clicking workflow opens qualification review page with full details
4. Review page displays: Supplier information, Risk assessment, Document checklist with all uploaded documents, Notes from previous stages
5. Documents can be viewed inline (PDFs) or downloaded
6. Reviewer can add review comments in text area
7. "Approve" and "Request Changes" buttons displayed at bottom
8. "Approve" button opens confirmation modal, updates stage status to Approved, advances workflow to Stage 2 (Pending)
9. "Request Changes" button opens modal with required comment field, changes stage status to Rejected, returns workflow to Draft status
10. Email notification sent to initiator: "Qualification for [Supplier] approved/rejected by [Reviewer]"
11. If rejected, notification includes reviewer comments and link to workflow
12. Timeline updated with approval/rejection action, reviewer name, timestamp, comments
13. If approved, Stage 2 record auto-created and assigned to quality manager (based on tenant config)
14. Audit log records approval/rejection decision with comments

## Story 2.7: Stage 2 & 3 - Quality and Management Approval

As a **quality manager**,
I want to review qualifications from a quality perspective,
so that we ensure suppliers meet our quality standards before final approval.

**Acceptance Criteria:**

1. Stage 2 approval workflow identical to Stage 1 but assigned to Quality Manager role
2. Stage 2 review includes quality-specific checklist items: Quality manual reviewed, Quality certifications verified, Quality audit findings
3. Quality manager can add quality-specific comments separate from procurement comments
4. Approving Stage 2 advances workflow to Stage 3 (Management approval)
5. Stage 3 assigned to Admin or designated approver (configurable per tenant)
6. Stage 3 review shows summary of all previous stages: Stage 1 approval (user, date), Stage 2 approval (user, date), Risk score, Document completion
7. Management approver sees complete history and all previous reviewer comments
8. Approving Stage 3 marks workflow as Approved (final state)
9. Final approval automatically updates supplier status from Qualified → Approved
10. Final approval triggers congratulatory email to supplier primary contact (if enabled in settings)
11. Rejection at any stage returns workflow to Draft and reverts supplier status to Prospect
12. All three stages recorded in timeline with full audit trail
13. Each stage completion records: Reviewer name, Review date/time, Decision, Comments, Attachments (if any)

## Story 2.8: Email Notification System

As a **developer**,
I want an email notification system for workflow events,
so that users are notified of actions requiring their attention.

**Acceptance Criteria:**

1. Email service integrated (Resend.com) with API key configured
2. Email templates created for workflow events: Workflow submitted, Approval needed, Workflow approved, Workflow rejected, Stage advanced
3. Email template uses Supplex branding with logo, consistent styling
4. Notification preferences configured at tenant level: Enable/disable email notifications per event type
5. User preferences page allows individual users to opt-in/out of specific notification types
6. Emails include: Actionable subject line, Recipient name, Summary of action, Direct deep link to workflow, Sender/actor name
7. Background job worker (BullMQ) processes email sending asynchronously
8. Failed emails are retried up to 3 times with exponential backoff
9. Email send status tracked in database: Pending, Sent, Failed, Bounced
10. Email logs accessible to admins for debugging (last 30 days)
11. Rate limiting prevents email spam (max 10 emails per user per hour)
12. Unsubscribe link included in all emails (compliance with CAN-SPAM)
13. Email deliverability monitored (bounce rate, open rate) in admin dashboard (Phase 2: just log for now)

## Story 2.9: Qualification Workflow List & Filtering

As a **procurement manager**,
I want to see all qualification workflows with filtering,
so that I can track progress and identify bottlenecks.

**Acceptance Criteria:**

1. "Qualifications" page displays list of all workflows in tenant
2. Table columns: Supplier Name, Status (badge with color), Current Stage, Initiated By, Initiated Date, Days In Progress, Risk Score
3. Status filter dropdown: All, Draft, In Progress (Stage 1-3), Approved, Rejected
4. Stage filter: All, Stage 1, Stage 2, Stage 3
5. Risk filter: All, Low, Medium, High
6. Search bar filters by supplier name
7. Sort by: Initiated date (newest/oldest), Days in progress (longest/shortest), Risk score (high/low)
8. Clicking workflow row navigates to workflow detail page
9. "My Tasks" tab shows only workflows assigned to current user for review
10. "My Initiated" tab shows only workflows initiated by current user
11. Pagination for lists over 20 workflows
12. Empty state displays "No qualifications found" with "Start New Qualification" CTA
13. Mobile view converts to card layout with swipe actions
14. Export to CSV button exports current filtered view

## Story 2.10: Audit Trail & History View

As a **compliance officer**,
I want to view complete audit history for qualifications,
so that we can demonstrate compliance during audits.

**Acceptance Criteria:**

1. Workflow detail page includes "History" tab showing complete audit trail
2. Timeline view displays all events in reverse chronological order (newest first)
3. Each event displays: Event type icon, Event description, Actor (user), Timestamp, Comments/notes
4. Event types tracked: Workflow initiated, Document uploaded, Document removed, Stage submitted, Stage approved, Stage rejected, Risk score changed, Comments added
5. Document events show document name and type
6. Stage events show reviewer name and decision
7. Each event is immutable (cannot be edited or deleted)
8. Events display user's full name and role at time of action
9. Timestamps display in user's local timezone with UTC timestamp on hover
10. Can filter timeline by event type: All events, Approvals, Rejections, Documents, Comments
11. Timeline is printable with "Print Audit Trail" button generating PDF
12. PDF includes: Supplier name, Workflow ID, Print date, Complete timeline with all events
13. Database audit trail table indexed for fast queries (workflow_id, timestamp)
14. Mobile-responsive timeline with touch-friendly expand/collapse for event details
