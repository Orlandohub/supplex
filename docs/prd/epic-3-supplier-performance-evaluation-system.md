# Epic 3: Supplier Performance Evaluation System

**Epic Goal:** Enable procurement and quality teams to systematically evaluate supplier performance across Quality, Delivery, Service, and Cost dimensions with quarterly scheduling, historical trending, and supplier scorecards. This epic provides data-driven insights to identify top performers, address underperformance, and make informed sourcing decisions.

## Story 3.1: Evaluation Data Model & Schema

As a **developer**,
I want the database schema for supplier evaluations established,
so that we can track performance data over time.

**Acceptance Criteria:**

1. Drizzle schema defined for `supplier_evaluations` table with fields: id, tenant_id, supplier_id, evaluation_period (Q1-Q4, Year), evaluation_date, evaluator_id, status (Draft, Submitted, Completed), overall_score (calculated)
2. Schema defined for `evaluation_dimensions` table: id, evaluation_id, dimension_type (Quality, Delivery, Service, Cost), score (1-5), weight (percentage), comments, evidence_documents
3. Schema defined for `evaluation_templates` table: id, tenant_id, template_name, dimensions (JSON: name, weight, criteria), is_default
4. Database migrations created and tested for all evaluation tables
5. RLS policies applied enforcing tenant isolation on all evaluation data
6. Foreign key relationships: evaluation → supplier, dimension → evaluation
7. Indexes created for common queries: evaluations by supplier_id, evaluations by period, evaluations by status
8. Seed data includes default evaluation template: Quality (40%), Delivery (30%), Service (20%), Cost (10%)
9. Check constraints ensure scores are 1-5, weights sum to 100%
10. Automated tests verify tenant isolation and data integrity (scores, weights)

## Story 3.2: Evaluation Template Configuration

As a **tenant administrator**,
I want to configure evaluation templates with custom dimensions and weights,
so that evaluations align with my organization's priorities.

**Acceptance Criteria:**

1. Settings page includes "Evaluation Templates" section
2. Admin can view list of existing evaluation templates
3. "Create Template" button opens template configuration form
4. Template form includes: Template name (required), Description
5. Dimension configuration allows: Add/remove dimensions, Set dimension name, Set weight (percentage), Define evaluation criteria/guidelines (text)
6. Default template pre-populated with: Quality (40%), Delivery (30%), Service (20%), Cost (10%)
7. Real-time validation ensures dimension weights sum to exactly 100%
8. Each dimension includes criteria guidance: e.g., Quality - "Defect rates, customer complaints, corrective actions"
9. Admin can mark one template as "Default" (used for new evaluations)
10. Admin can edit existing templates (changes apply to future evaluations only)
11. Admin can duplicate templates to create variations
12. Template list shows: Name, # of dimensions, Default badge, Created date, Last modified
13. Cannot delete template if used by any evaluation (show warning with count)
14. Mobile-responsive interface with drag-to-reorder dimensions

## Story 3.3: Schedule and Initiate Evaluation

As a **procurement manager**,
I want to schedule and initiate performance evaluations for suppliers,
so that we regularly assess supplier performance.

**Acceptance Criteria:**

1. Supplier detail page includes "Evaluations" tab showing evaluation history
2. "Start New Evaluation" button visible to Procurement Manager and Quality Manager roles
3. Clicking button opens evaluation creation modal
4. Modal displays: Supplier name, Evaluation period dropdown (Q1-Q4 2025, etc.), Template selector (defaults to tenant default), Assigned evaluator(s) dropdown
5. Period dropdown shows last 2 years and next year quarters
6. System warns if evaluation already exists for selected period: "Evaluation for Q3 2025 already exists. View or create new?"
7. "Create Evaluation" button creates evaluation record in Draft status
8. Evaluation record associates selected template (snapshot for consistency)
9. Evaluation appears in "Evaluations" tab with status badge: Draft (gray), In Progress (blue), Completed (green)
10. Assigned evaluator receives email notification: "Performance evaluation assigned for [Supplier] - [Period]"
11. Evaluation can be assigned to multiple evaluators for collaborative input (optional)
12. Audit log records evaluation creation with initiator, period, assigned evaluator(s)
13. Can create ad-hoc evaluations (outside quarterly schedule) for special assessments

## Story 3.4: Evaluation Scoring Form

As a **quality manager**,
I want to score supplier performance across multiple dimensions,
so that we capture comprehensive performance data.

**Acceptance Criteria:**

1. Evaluation detail page displays scoring form with all dimensions from template
2. Each dimension section shows: Dimension name, Weight (%), Scoring criteria/guidance, Score input (1-5 scale), Comments textarea, Attach evidence button
3. Score input uses visual rating component: 1 star = Poor, 2 = Below Average, 3 = Average, 4 = Good, 5 = Excellent
4. Hovering over stars shows descriptive labels
5. Comments field allows evaluator to provide detailed feedback and examples
6. "Attach Evidence" allows uploading supporting documents (defect reports, delivery logs, invoices)
7. Each dimension can have multiple document attachments
8. Overall score calculated automatically as weighted average of dimension scores (displayed prominently)
9. Overall score updates in real-time as dimension scores are entered
10. Form validation requires all dimension scores before submission
11. "Save Draft" button saves progress without completing evaluation
12. "Submit Evaluation" button validates completeness and changes status to Completed
13. Completed evaluations are read-only (can view but not edit)
14. Evaluation timestamp records submission date and evaluator
15. Mobile-responsive with touch-optimized star rating and expandable sections

## Story 3.5: Historical Performance Tracking

As a **procurement manager**,
I want to view historical evaluation trends for each supplier,
so that I can identify performance improvements or declines over time.

**Acceptance Criteria:**

1. Supplier detail page "Evaluations" tab displays historical evaluations table
2. Table columns: Period, Evaluation Date, Overall Score (with badge), Evaluator, Status, Actions (View)
3. Overall score badge color-coded: 4.0-5.0 = green (High), 3.0-3.9 = yellow (Medium), 1.0-2.9 = red (Low)
4. Table sorted by evaluation date (newest first) with option to sort by score
5. Line chart displays overall score trend over time (x-axis: period, y-axis: score 1-5)
6. Chart includes trend line showing performance trajectory (improving/declining/stable)
7. Chart tooltips show: Period, Overall score, Evaluator, Click to view details
8. Dimension breakdown chart shows score trends for each dimension (multi-line chart)
9. Chart toggle allows switching between: Overall score only, All dimensions, Selected dimensions
10. Performance alerts displayed if: Score drops >0.5 points from previous eval, Score falls below 3.0 (underperforming)
11. Historical data table paginated if more than 8 evaluations
12. "Export to PDF" button generates performance report with charts and all evaluation data
13. Empty state displays "No evaluations yet" with "Start First Evaluation" CTA
14. Charts are mobile-responsive (convert to simpler view on small screens)

## Story 3.6: Supplier Scorecard View

As a **procurement manager**,
I want to see a comprehensive scorecard for each supplier,
so that I can quickly assess current and historical performance.

**Acceptance Criteria:**

1. Supplier detail page includes "Scorecard" tab as primary view
2. Scorecard header displays: Overall current score (large, prominent), Performance tier badge (High/Medium/Low), Total evaluations count, Last evaluation date
3. Performance tier automatically assigned: High (avg >4.0), Medium (avg 3.0-4.0), Low (avg <3.0)
4. Current evaluation section shows latest evaluation with all dimension scores in card layout
5. Each dimension card displays: Dimension name, Current score (stars), Weight, Trend indicator (↑ improving, ↓ declining, → stable)
6. Trend indicator compares current score vs. previous evaluation (3 period moving average)
7. Historical summary section displays: Average score across all evaluations, Best score (with period), Worst score (with period), Trend direction
8. Dimension performance breakdown shows average score per dimension across all evaluations (bar chart)
9. Recent comments section displays latest evaluator comments from last 3 evaluations
10. Performance alerts section highlights: Recent score drops, Consistently low dimensions, Missing recent evaluations
11. Scorecard is printable with "Print Scorecard" button (PDF generation)
12. Scorecard displays "Insufficient Data" message if fewer than 2 evaluations exist
13. Mobile-responsive with cards stacking vertically and collapsible sections

## Story 3.7: Evaluation Notifications & Reminders

As a **procurement manager**,
I want to receive notifications about evaluation assignments and upcoming evaluations,
so that I don't miss scheduled assessments.

**Acceptance Criteria:**

1. Email notification sent when evaluation is assigned: "You've been assigned to evaluate [Supplier] for [Period]"
2. Email includes: Supplier name, Evaluation period, Due date (30 days from creation), Direct link to evaluation form
3. Reminder email sent when evaluation is in draft status for 14 days: "Evaluation for [Supplier] is in progress - Please complete"
4. Reminder email sent when evaluation is 7 days overdue: "Overdue: Evaluation for [Supplier] needs completion"
5. Notification sent when evaluation is completed: "Evaluation for [Supplier] completed by [Evaluator]"
6. Procurement managers receive weekly digest email: "Pending evaluations summary" with list of drafts and overdue evals
7. Notifications respect user preferences (can opt-out of reminders but not assignments)
8. In-app notification center shows evaluation-related notifications with count badge
9. Background job (BullMQ) checks daily for evaluation reminders and due dates
10. Admin dashboard shows evaluation completion metrics: On-time %, Overdue count, Average completion time
11. Supplier performance alerts trigger notifications: "Supplier [Name] score dropped below 3.0"
12. Can configure tenant-wide due date window: 30, 60, or 90 days from creation (default 30)

## Story 3.8: Evaluation List View & Filtering

As a **quality manager**,
I want to view and filter all evaluations across suppliers,
so that I can track evaluation completion and identify performance patterns.

**Acceptance Criteria:**

1. "Evaluations" page displays list of all evaluations in tenant
2. Table columns: Supplier Name, Period, Overall Score (badge), Status, Evaluator, Evaluation Date, Days Since Completed
3. Status filter: All, Draft, Completed
4. Period filter: All, Current quarter, Last quarter, Custom range (date picker)
5. Score filter: All, High (4.0-5.0), Medium (3.0-3.9), Low (1.0-2.9)
6. Supplier search bar filters by supplier name
7. Sort by: Evaluation date (newest/oldest), Overall score (high/low), Supplier name (A-Z)
8. "My Evaluations" tab shows only evaluations assigned to current user
9. "Draft" tab shows only incomplete evaluations with "Days in Draft" column
10. "Overdue" tab shows evaluations past due date with days overdue highlighted in red
11. Clicking evaluation row navigates to evaluation detail/form page
12. Bulk actions: Select multiple draft evaluations, "Send Reminder" button sends reminder to assigned evaluators
13. Empty state displays "No evaluations found" with "Create Evaluation" CTA
14. Export to CSV button exports current filtered view with all dimension scores
15. Mobile view converts to card layout with key info: Supplier, Score, Status, Period

## Story 3.9: Comparative Supplier Analysis

As a **procurement manager**,
I want to compare performance across multiple suppliers,
so that I can identify top performers and make sourcing decisions.

**Acceptance Criteria:**

1. "Suppliers" page includes "Compare" mode toggle
2. Compare mode allows selecting 2-10 suppliers via checkboxes
3. "Compare Selected" button opens comparison view
4. Comparison view displays side-by-side scorecard for each selected supplier
5. Each supplier column shows: Name, Overall avg score, Performance tier, Latest evaluation date, Evaluation count
6. Dimension comparison table shows average scores per dimension for each supplier
7. Dimension rows color-coded: Highest score = green, Lowest score = red, Others = neutral
8. Overall score column sortable to rank suppliers
9. Chart view toggles comparison to bar chart: Suppliers on x-axis, Scores on y-axis, Dimensions grouped
10. Filter allows selecting which dimensions to compare (default: all)
11. Filter allows selecting time range: All time, Last 4 quarters, Last year, Custom
12. Comparison view includes summary insights: Best performer, Most improved, Needs attention
13. "Export Comparison" button generates PDF report with all comparison data and charts
14. Comparison view is printable
15. Mobile view shows suppliers in vertically stacked cards instead of side-by-side

## Story 3.10: Evaluation Performance Metrics Dashboard

As an **admin**,
I want to see metrics on evaluation completion and compliance,
so that I can ensure my team is regularly assessing suppliers.

**Acceptance Criteria:**

1. Admin dashboard includes "Evaluation Metrics" section
2. Key metrics displayed: Total evaluations completed (current quarter), Completion rate (%), Average score across all suppliers, On-time completion %
3. Chart shows evaluation completion trend over time (past 8 quarters)
4. Completion rate calculated: (Completed evaluations / Expected evaluations) × 100%
5. Expected evaluations calculated: # of Approved suppliers × # of quarters elapsed in current year
6. Overdue evaluations widget shows count and list of overdue evaluations with days overdue
7. Evaluator performance table shows: Evaluator name, Assigned count, Completed count, Completion rate, Avg time to complete
8. Supplier coverage metrics: % of suppliers with at least 1 evaluation, % with evaluations in last 6 months
9. Dimension analysis shows average scores across all evaluations per dimension (identifies systemic issues)
10. Performance tier distribution: Pie chart showing % of suppliers in High/Medium/Low tiers
11. All metrics filterable by date range: Current quarter, Last quarter, Year-to-date, All time
12. Drill-down links from metrics to detailed views (e.g., click overdue count → see overdue list)
13. "Export Metrics" button generates PDF report with all dashboard data
14. Dashboard auto-refreshes data every 5 minutes (or manual refresh button)
