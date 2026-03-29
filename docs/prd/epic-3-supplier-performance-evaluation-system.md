# Epic 3: Supplier Performance Evaluation & Improvement System

**Epic Goal:**  
Enable procurement, quality, and supplier management teams to run **structured, auditable, and actionable supplier performance evaluations** that combine weighted scorecards, workflow-driven collaboration, evidence collection, supplier responses, and corrective action follow-up.

This epic should support both:
1. **Standard recurring evaluations** for fast quarterly or ad-hoc supplier reviews  
2. **Workflow-backed evaluations** for complex, high-risk, disputed, or strategic supplier assessments requiring validations, document collection, approvals, and supplier collaboration

The system must provide:
- configurable scorecard templates
- historical trending and supplier scorecards
- optional workflow orchestration
- supplier-facing collaboration
- evidence and required document handling
- corrective action / improvement plans
- comparative analysis across suppliers
- secure multi-tenant isolation
- performant querying and reporting at scale

---

## Product Principles

1. **Scorecards remain the canonical evaluation record**  
   Evaluation scores, dimension values, status, trends, and comparisons must be stored in normalized evaluation tables, not inferred only from workflow state.

2. **Workflow is the execution layer, not the data model**  
   Workflow steps may collect forms, comments, approvals, and documents, but the final evaluation record must remain structured and queryable.

3. **Support both subjective and objective performance inputs**  
   Evaluations must support manual scoring and objective metric capture, with clear provenance of each score.

4. **Actionability is required**  
   Low performance, negative trends, or failed validations must be able to trigger corrective action workflows.

5. **Tenant isolation, auditability, and performance are non-negotiable**  
   All evaluation features must follow project best practices for RLS, query efficiency, async processing, and immutable historical snapshots.

---

# Story 3.1: Evaluation Domain Model, Schema, and Snapshots

As a **developer**,  
I want a robust and extensible schema for supplier evaluations,  
so that evaluations are historically consistent, queryable, and scalable.

**Acceptance Criteria:**

1. Drizzle schema is defined for `supplier_evaluations` with fields including:
   - id
   - tenant_id
   - supplier_id
   - template_id
   - template_snapshot_json
   - evaluation_type (`standard`, `workflow_backed`)
   - evaluation_period_type (`quarterly`, `annual`, `adhoc`, `custom`)
   - period_label
   - period_start_date
   - period_end_date
   - created_by
   - assigned_owner_id
   - status (`draft`, `in_progress`, `submitted`, `published`, `completed`, `cancelled`)
   - workflow_instance_id (nullable)
   - due_date
   - submitted_at
   - published_at
   - completed_at
   - overall_score
   - score_version
   - latest_action_plan_status
   - created_at / updated_at

2. Drizzle schema is defined for `evaluation_template_dimensions` with:
   - id
   - tenant_id
   - template_id
   - dimension_key
   - dimension_name
   - dimension_type (`subjective`, `objective`, `compliance`, `risk`)
   - weight
   - scoring_scale_json
   - criteria_guidance
   - ordering

3. Drizzle schema is defined for `evaluation_dimension_scores` with:
   - id
   - tenant_id
   - evaluation_id
   - dimension_key
   - dimension_name_snapshot
   - weight_snapshot
   - score
   - score_source (`manual`, `calculated`, `workflow_output`, `imported`)
   - score_formula_snapshot (nullable)
   - comments
   - trend_delta_from_previous
   - created_at / updated_at

4. Drizzle schema is defined for `evaluation_participants` with:
   - evaluation_id
   - user_id
   - role (`owner`, `evaluator`, `approver`, `viewer`, `supplier_contact`)
   - contribution_type (`internal`, `external`)
   - status

5. Drizzle schema is defined for `evaluation_evidence_documents` with:
   - evaluation_id
   - dimension_score_id (nullable)
   - storage_key
   - file_name
   - document_type
   - uploaded_by
   - source (`manual_upload`, `workflow_required_doc`, `generated`)
   - created_at

6. Drizzle schema is defined for `evaluation_comments` or references existing platform comment model with links to:
   - evaluation
   - dimension
   - workflow step
   - supplier-visible flag
   - internal-only flag

7. Drizzle schema is defined for `supplier_action_plans` with:
   - evaluation_id
   - supplier_id
   - triggered_by_rule
   - owner_id
   - title
   - root_cause
   - corrective_actions
   - due_date
   - status
   - completion_notes
   - verified_at

8. Template snapshots are stored immutably on evaluation creation so future template edits do not change historical evaluations.

9. Check constraints ensure:
   - score ranges are valid
   - weights are non-negative
   - template dimension weights total 100
   - published/completed evaluations cannot exist without required scores

10. Foreign keys, cascade behavior, and soft-delete strategy are defined explicitly and tested.

11. RLS policies enforce tenant isolation for all evaluation-related tables.

12. Indexes are created for common access patterns:
   - evaluations by tenant + supplier
   - evaluations by tenant + status
   - evaluations by tenant + period dates
   - dimension scores by evaluation
   - action plans by evaluation / status
   - comments by evaluation
   - due evaluations by due_date

13. Automated tests verify:
   - tenant isolation
   - template snapshot immutability
   - score integrity
   - status transition rules
   - referential integrity

14. Schema design avoids unbounded JSON for query-critical reporting fields; JSON is used only for snapshotting or non-relational metadata.

---

# Story 3.2: Evaluation Template Configuration

As a **tenant administrator**,  
I want to configure reusable evaluation templates with weighted dimensions and scoring guidance,  
so that evaluations reflect our organization’s priorities and remain comparable.

**Acceptance Criteria:**

1. Settings page includes an "Evaluation Templates" section.

2. Admin can create templates with:
   - template name
   - description
   - category / supplier segment applicability
   - cadence recommendation
   - default workflow mode (`none`, `recommended`, `required`)

3. Admin can define dimensions with:
   - name
   - dimension key
   - weight
   - type (`subjective`, `objective`, `compliance`, `risk`)
   - criteria guidance
   - optional score formula definition for future calculated metrics
   - required evidence toggle
   - supplier response allowed toggle

4. Default template is pre-populated with:
   - Quality (40%)
   - Delivery (30%)
   - Service (20%)
   - Cost (10%)

5. Admin can add optional modern dimensions such as:
   - Compliance
   - Risk
   - Sustainability / ESG
   - Innovation
   - Responsiveness

6. Real-time validation ensures weights total 100%.

7. Admin can reorder dimensions with drag-and-drop.

8. Admin can duplicate existing templates.

9. Admin can mark one template as default per supplier segment or globally.

10. Editing a template affects future evaluations only.

11. Template list shows:
   - name
   - default badge
   - segment/category
   - number of dimensions
   - workflow mode
   - created / modified dates

12. Template deletion is blocked if already referenced by evaluations; archive is allowed instead.

13. Template version history is stored for traceability.

14. Mobile and tablet layouts remain usable for template editing.

---

# Story 3.3: Start Evaluation and Attach Optional Workflow

As a **procurement manager or quality manager**,  
I want to create an evaluation and optionally attach a workflow,  
so that simple evaluations stay fast and complex ones use structured collaboration.

**Acceptance Criteria:**

1. Supplier detail page includes an "Evaluations" tab.

2. Authorized users can start a new evaluation from:
   - supplier detail page
   - evaluations list page
   - scorecard page

3. Evaluation creation modal includes:
   - supplier
   - template
   - evaluation type (`standard`, `workflow-backed`)
   - period type
   - period label
   - period start / end
   - assigned owner
   - evaluator(s)
   - approver(s) optional
   - supplier participant(s) optional
   - due date
   - workflow selector if workflow-backed

4. Period selection supports:
   - quarter
   - year
   - ad hoc
   - custom date range

5. System warns if overlapping or duplicate evaluations exist for same supplier and period.

6. On create, system stores immutable template snapshot.

7. Standard evaluations start in `draft` or `in_progress`.

8. Workflow-backed evaluations create and link a workflow instance.

9. Workflow-backed evaluations can require:
   - dynamic forms
   - validation steps
   - comment exchanges
   - required document templates
   - approval gates
   - supplier response steps

10. Audit log records who created the evaluation, selected template, selected workflow, and assigned participants.

11. Assigned users receive notification with direct link.

12. Evaluation record always exists independently of workflow state.

---

# Story 3.4: Evaluation Scoring, Evidence, and Provenance

As an **evaluator**,  
I want to score each supplier dimension with evidence and comments,  
so that evaluations are complete, explainable, and defensible.

**Acceptance Criteria:**

1. Evaluation detail page displays all dimensions from template snapshot.

2. Each dimension shows:
   - name
   - type
   - weight
   - scoring guidance
   - score input
   - comments
   - evidence section
   - source/provenance indicator

3. Subjective dimensions use configurable scoring scale with default 1–5.

4. Objective dimensions support:
   - manual metric input
   - future calculated/imported score source
   - optional formula display
   - explicit score provenance

5. Compliance or risk dimensions may support pass/fail, weighted score, or threshold-based rules.

6. Evaluator can save draft without completing.

7. Overall score recalculates in real time.

8. Calculation logic uses server-side canonical calculation to prevent client-side drift.

9. UI clearly shows when a low-scoring dimension triggered a threshold rule.

10. Evidence supports:
   - multiple uploads per dimension
   - file validation
   - secure object storage references
   - metadata capture
   - preview/download permissions per role

11. If dimension requires evidence, evaluation cannot be submitted until evidence is present.

12. Comments support internal-only and supplier-visible modes where permitted.

13. Supplier-visible comments are only shown if workflow/template allows external collaboration.

14. Completed or published evaluations are read-only except through controlled reopen/version flow.

15. Every score change is audit-logged with actor, previous value, new value, and timestamp.

---

# Story 3.5: Workflow-Backed Collaboration and Supplier Response

As a **procurement or quality team**,  
I want evaluations to use existing platform workflows when more structure is needed,  
so that suppliers and internal stakeholders can collaborate through governed steps.

**Acceptance Criteria:**

1. Workflow-backed evaluations can attach a workflow definition at creation time.

2. Workflow steps may include:
   - evaluator input form
   - supplier response form
   - internal review
   - evidence request
   - required document template submission
   - validation / approval gate
   - publish step

3. Workflow comments are visible in evaluation context and linked by step.

4. Supplier participants can only access allowed steps, comments, and documents.

5. Workflow outputs can map into evaluation fields or dimension evidence.

6. Validation failures block workflow progression and evaluation publication.

7. Required document templates can be enforced per workflow step.

8. Supplier can provide rebuttal, clarification, or supporting evidence where enabled.

9. Internal users can mark certain steps or comments as internal-only.

10. Workflow step completion updates evaluation timeline and activity log.

11. Workflow state changes do not overwrite immutable published scores unless a controlled re-evaluation/review action is initiated.

12. Workflow configuration supports both qualification and evaluation reuse without duplicating platform primitives.

---

# Story 3.6: Review, Approval, Publish, and Versioning

As an **evaluation approver**,  
I want a formal review and publish process,  
so that evaluations are calibrated and safe to use in supplier decisions.

**Acceptance Criteria:**

1. Evaluations support status transitions:
   - draft
   - in_progress
   - submitted
   - under_review
   - published
   - completed

2. Optional approval workflow can be required by template or tenant policy.

3. Submitted evaluations can be reviewed by approvers before publication.

4. Approvers can:
   - approve
   - request changes
   - reject
   - reopen

5. Published evaluations become the official scorecard record used by dashboards and comparisons.

6. If reopened after publication, system creates a new score version or revision trail.

7. Revision history shows:
   - status changes
   - score changes
   - approver decisions
   - publication timestamps

8. System prevents destructive editing of previously published historical data.

9. Permission model clearly separates evaluator, approver, admin, and supplier access.

10. Audit trail is exportable for compliance review.

---

# Story 3.7: Historical Trends, Scorecards, and Performance Signals

As a **procurement manager**,  
I want to analyze supplier performance over time,  
so that I can identify trends, strengths, weaknesses, and recent changes.

**Acceptance Criteria:**

1. Supplier "Evaluations" tab lists historical evaluations with:
   - period
   - type
   - status
   - overall score
   - published date
   - owner/evaluator
   - linked action plan status

2. Historical trend chart shows overall score over time.

3. Dimension trend chart shows dimension-level score trends.

4. User can filter trends by:
   - time range
   - evaluation type
   - published only
   - selected dimensions

5. Scorecard view shows:
   - latest published score
   - performance tier
   - prior score delta
   - dimension breakdown
   - evidence count
   - open action plans
   - latest comments summary

6. Trend indicators use consistent server-side logic.

7. Alerts are generated for:
   - score drop beyond configurable threshold
   - score below threshold
   - repeated low dimension score
   - missing recent evaluation
   - overdue action plan

8. Scorecards display "insufficient data" when trend comparisons are statistically weak or too sparse.

9. Charts load efficiently using pre-aggregated or optimized queries.

10. PDF export uses async job generation for large reports.

---

# Story 3.8: Corrective Action and Improvement Plans

As a **procurement or quality manager**,  
I want poor evaluation outcomes to trigger action plans,  
so that supplier underperformance leads to measurable improvement activity.

**Acceptance Criteria:**

1. Low score conditions can trigger action plans manually or automatically.

2. Trigger rules can include:
   - overall score below threshold
   - dimension score below threshold
   - score drop from prior evaluation
   - failed compliance/risk dimension
   - workflow validation failure

3. Action plan includes:
   - title
   - linked evaluation
   - linked supplier
   - issue summary
   - root cause
   - corrective actions
   - owner
   - supplier contact
   - due date
   - status
   - completion evidence
   - verification step

4. Action plan can optionally use existing workflow engine.

5. Action plan comments and documents are visible in supplier context where allowed.

6. Open action plans are surfaced prominently on supplier scorecard and evaluation detail.

7. Evaluation comparison and dashboards can filter suppliers with open action plans.

8. Closing an action plan requires completion notes and optional verification evidence.

9. Follow-up evaluation can be scheduled from an action plan.

10. Notifications are sent for overdue action plans.

---

# Story 3.9: Notifications, Reminders, and Background Jobs

As a **user**,  
I want timely notifications for evaluations and action plans,  
so that work progresses without manual chasing.

**Acceptance Criteria:**

1. Notifications are sent for:
   - new evaluation assignment
   - workflow step assignment
   - supplier response requested
   - approval requested
   - evaluation overdue
   - evaluation published
   - action plan created
   - action plan overdue
   - threshold breach / low score alert

2. Email notifications include direct links and concise context.

3. In-app notification center shows unread counts and state transitions.

4. Reminder cadence is configurable by tenant.

5. Background processing is idempotent and safe to retry.

6. Scheduled checks query due items efficiently using indexed fields.

7. Processing payloads store lightweight identifiers, not large object blobs.

8. Notification sending failures are logged and retried with backoff.

9. Duplicate reminders are prevented by deduplication keys or send logs.

10. Admin dashboard shows notification and completion metrics.

---

# Story 3.10: Evaluation List, Search, Filtering, and Bulk Operations

As a **quality manager or procurement manager**,  
I want to quickly find and manage evaluations across suppliers,  
so that I can monitor completion and performance at scale.

**Acceptance Criteria:**

1. Evaluations page lists evaluations for current tenant only.

2. Table supports filters for:
   - supplier
   - status
   - period
   - date range
   - evaluation type
   - template
   - score range
   - action plan status
   - workflow-backed only
   - published only

3. "My Evaluations" view shows assigned items only.

4. "Needs Review" and "Overdue" views are available.

5. Search supports supplier name and evaluation identifier.

6. Bulk actions support:
   - send reminder
   - assign owner
   - export filtered list
   - schedule follow-up
   - start action plan for selected evaluations where allowed

7. Large result sets use server-side pagination and indexed sorting.

8. API responses return only required columns for list views.

9. CSV export is streamed or generated asynchronously for large datasets.

10. Mobile view degrades to compact cards without losing critical status information.

---

# Story 3.11: Comparative Supplier Analysis

As a **procurement manager**,  
I want to compare suppliers using published evaluations,  
so that I can make better sourcing and supplier development decisions.

**Acceptance Criteria:**

1. Users can select 2–10 suppliers for comparison.

2. Comparison uses only published evaluations by default.

3. Comparison filters include:
   - time range
   - template
   - evaluation type
   - supplier segment
   - selected dimensions

4. View shows:
   - average overall score
   - latest score
   - trend delta
   - evaluation count
   - open action plans
   - latest evaluation date

5. Dimension-level comparison table shows normalized values.

6. Comparison insights include:
   - top performer
   - most improved
   - highest risk
   - most overdue action plans
   - most consistent performer

7. System clearly indicates when suppliers are not directly comparable because of different templates or insufficient data.

8. Comparison queries are optimized for multi-supplier reporting.

9. PDF export is async for large result sets.

---

# Story 3.12: Evaluation Metrics and Coverage Dashboard

As an **admin**,  
I want to track evaluation compliance and supplier coverage,  
so that I can ensure the process is being executed consistently.

**Acceptance Criteria:**

1. Admin dashboard includes:
   - evaluations created
   - evaluations published
   - completion rate
   - average score
   - on-time completion %
   - open action plan count
   - overdue action plan count
   - suppliers evaluated in last 6 / 12 months
   - percentage of active suppliers with current evaluation

2. Dashboard shows completion trend over time.

3. Dashboard shows evaluator throughput and cycle time.

4. Dashboard shows average score by dimension across tenant.

5. Dashboard shows score distribution across tiers.

6. Dashboard shows workflow-backed evaluation adoption rate.

7. Expected evaluation calculation is configurable by cadence policy, not hard-coded only to quarterly.

8. Drill-down links open filtered evaluation or supplier lists.

9. Dashboard reads from optimized aggregate queries or materialized reporting paths where appropriate.

10. Auto-refresh is rate-limited and does not degrade primary transactional workloads.

---

# Story 3.13: Security, Compliance, and Auditability

As a **platform owner**,  
I want evaluations to be secure, auditable, and compliant with multi-tenant SaaS best practices,  
so that enterprise customers can trust the process.

**Acceptance Criteria:**

1. All evaluation tables enforce tenant isolation via RLS.

2. APIs never trust client-supplied tenant identifiers.

3. Object storage access for evidence/documents uses signed URLs or equivalent controlled access.

4. Supplier-visible and internal-only comments/documents are permission-checked server-side.

5. Audit trail records:
   - status changes
   - score changes
   - publication
   - approvals
   - document uploads/deletes
   - supplier submissions
   - action plan events

6. Published evaluations are immutable except through controlled versioning.

7. Sensitive documents can be redacted or access-restricted by role.

8. Retention/deletion behavior follows tenant policy and legal requirements.

9. All critical actions are covered by authorization tests.

10. Security tests verify cross-tenant access is impossible through direct object reference, list queries, and document access paths.

---

# Story 3.14: Performance, Scalability, and Technical Best Practices

As a **developer**,  
I want the evaluation system to follow project best practices for performance and maintainability,  
so that it scales without degrading the platform.

**Acceptance Criteria:**

1. All list and dashboard endpoints use server-side filtering, sorting, and pagination.

2. N+1 query patterns are avoided for:
   - evaluations list
   - supplier scorecards
   - comparison views
   - dashboard summaries

3. Query plans are reviewed for the highest-volume endpoints.

4. Heavy report generation, CSV/PDF exports, and notification fan-out run asynchronously.

5. Aggregated reporting paths are introduced where repeated expensive joins would otherwise be required.

6. API contracts distinguish between summary DTOs and detail DTOs.

7. Template snapshots and score calculations are performed transactionally.

8. Status transitions that modify multiple related records are wrapped in safe transactions.

9. Background jobs are idempotent and observable.

10. File uploads do not block main request threads longer than necessary; metadata save and post-processing are separated where appropriate.

11. Comments, documents, and evaluation history load incrementally in the UI.

12. Caching strategy is defined for low-volatility reads such as template metadata and published scorecards where appropriate.

13. Observability includes:
   - endpoint latency
   - processing failures
   - export failures
   - notification delivery failures
   - document upload failures

14. Test coverage includes:
   - unit tests for score calculations and thresholds
   - integration tests for DB + RLS behavior
   - workflow/evaluation mapping tests
   - background processing tests
   - end-to-end happy path for standard and workflow-backed evaluations

---

# Recommended Default Evaluation Lifecycle

1. **Create evaluation**
2. **Attach template snapshot**
3. **Optionally attach workflow**
4. **Assign participants**
5. **Collect scores / evidence / comments**
6. **Run validations**
7. **Submit for review**
8. **Approve and publish**
9. **Trigger action plan if thresholds fail**
10. **Track follow-up and historical trend**