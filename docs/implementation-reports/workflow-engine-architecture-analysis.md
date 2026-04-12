# Workflow Engine Architecture Analysis

> **Type:** Deep Architecture Review — Story-Planning-Ready Version  
> **Date:** 2026-04-08  
> **Scope:** Full workflow implementation — engine, routes, services, DB schema, form/document coupling  
> **Goal:** Identify every architectural weakness, coupling risk, transaction gap, latency hotspot, and fragility across all workflow mutation paths so that hardening stories can be scoped with precision.  
> **Status:** Analysis only — no fixes implemented.  
> **Audience:** Scrum Master, tech lead — structured for direct translation into implementation stories.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Planning Guardrails](#2-planning-guardrails)
3. [Workflow Action Inventory](#3-workflow-action-inventory)
4. [End-to-End Execution Paths](#4-end-to-end-execution-paths)
5. [Transaction Boundary Review](#5-transaction-boundary-review)
6. [Query / Round-Trip Hotspots](#6-query--round-trip-hotspots)
7. [Dynamic Form / Workflow Coupling Review](#7-dynamic-form--workflow-coupling-review)
8. [Document / Validation / Workflow Coupling Review](#8-document--validation--workflow-coupling-review)
9. [Idempotency and Recovery Analysis](#9-idempotency-and-recovery-analysis)
10. [User-Facing Latency Risk Review](#10-user-facing-latency-risk-review)
11. [Architectural Weaknesses — Correctness & Integrity](#11-architectural-weaknesses--correctness--integrity)
12. [Architectural Weaknesses — Performance & Efficiency](#12-architectural-weaknesses--performance--efficiency)
13. [Story-Planning Principles](#13-story-planning-principles)
14. [High-Level Target Architecture Direction](#14-high-level-target-architecture-direction)
15. [Recommended Story Sequencing Guidance](#15-recommended-story-sequencing-guidance)

---

## 1. Executive Summary

The Supplex workflow engine is a linear step-based execution engine built on Drizzle ORM + PostgreSQL (via Supabase). It supports four step types (`form`, `document`, `approval`, `task`) with optional multi-role validation, supplier-status transition on completion, and email notifications via BullMQ/Redis.

**The engine works. The workflow model is conceptually sound.** The linear step progression model, the step-type abstraction, the validation layer, and the task assignment mechanism are appropriate for the product. CAS (compare-and-swap) patterns prevent the most dangerous concurrency bugs in the approval path. Idempotency guards on task and document seeding are present and correct.

**The product does not need a workflow redesign.** It needs the existing engine hardened so that every mutation path is as safe as the best path already is (`complete.ts`).

**However, the engine has accumulated structural debt that creates real risk as the product scales.** The problems are not theoretical — they are visible in the code and grounded in the current execution paths. The debt is concentrated in two areas:

1. **Correctness / Integrity gaps** — missing transactions, duplicated state-machine logic in routes, missing CAS guards, and unrecoverable partial-failure states. These are the urgent findings.
2. **Performance / Efficiency overhead** — excessive DB round trips for event logging, N+1 update patterns, and redundant reads inside transitions. These are real but non-urgent.

### Critical findings at a glance

**Correctness / Integrity (fix first):**

| Category | Severity | Summary |
|---|---|---|
| **Missing transaction on document review** | **Critical** | `review.ts` performs 8-12 writes across 4 tables with NO transaction. A crash mid-review leaves inconsistent state. |
| **`transitionToNextStep` called outside transaction in review.ts** | **Critical** | On document all-approved path, `transitionToNextStep(db, ...)` receives the raw `db` handle, meaning the supplier-status update on process completion is not atomic with the step transition. |
| **Form submit / step complete split** | **High** | `submit.ts` marks the form as `submitted` then calls `completeStep(db, ...)` outside a transaction. The `completeStep` call uses `db` (not a transaction handle), so each internal write is also non-atomic. |
| **Document review duplicates engine logic** | **High** | `review.ts` re-implements the decline, task-close, step-reset, and transition-to-next-step pattern inline instead of using the engine. This creates two parallel implementation paths for the same state transitions. |
| **No recovery mechanism for partial failures** | **Medium** | If a step completes but the next-step activation fails (network/timeout), there is no retry or reconciliation path. The `workflow-health` diagnostic endpoint detects these, but nothing auto-repairs them. |
| **Supplier status can be overridden manually** | **Medium** | `PATCH /suppliers/:id/status` bypasses the workflow engine entirely, with no guard against active processes. |

**Performance / Efficiency (fix later):**

| Category | Severity | Summary |
|---|---|---|
| **Event logging query overhead** | **Medium** | After each mutation, the route re-reads 3-5 tables outside the transaction just to populate event log fields. This adds 3-8 extra DB round trips per request. |
| **`instantiateWorkflow` ignores `outerDb` param** | **Low** | Accepts `DbOrTx` but always opens its own `db.transaction()`. Dead parameter — callers cannot compose it into a larger transaction. A valid composability cleanup, not a correctness risk. |

---

## 2. Planning Guardrails

This section defines the boundaries for story generation from this report. Every implementation story derived from this analysis **must** respect these constraints.

### 2.1 This Is Not a Workflow Redesign

The purpose of the upcoming work is to **harden and unify the current linear workflow engine**, not to redesign the product into BPM software, event sourcing, microservices, or parallel-branch workflow architecture.

**Explicitly out of scope for stories derived from this report:**
- Replacing the linear step model with a graph/DAG-based model
- Introducing event sourcing or CQRS patterns
- Moving the workflow engine to a separate service or microservice
- Adding parallel branches, conditional routing, or subprocess embedding
- Replacing the direct-mutation model with an event-driven state machine
- Building a generic "workflow DSL" or BPMN interpreter

**In scope:**
- Making every existing mutation path transactionally correct
- Centralizing all state-machine logic in the engine (eliminating route-owned transitions)
- Adding CAS guards to every state transition
- Building a recovery path for known partial-failure states
- Reducing unnecessary DB round trips where the savings are clear
- Adding workflow-aware guards to domain operations (supplier status, supplier delete)

### 2.2 Correctness Before Performance

Stories must clearly separate **correctness / integrity work** from **performance / efficiency work**. A story should never mix the two unless the performance fix is a trivial side effect of a correctness fix (e.g., eliminating the double-write on document decline while fixing the transaction).

**Rule:** If a story addresses a correctness gap (missing transaction, missing CAS, duplicated logic), it should not also be scoped to include query optimization, batch update refactoring, or event logging improvements — unless those are trivially co-located changes.

### 2.3 Synchronous-First

The first wave of stories should keep all user-visible workflow progression **synchronous**. The "smaller atomic transaction with deferred follow-up" pattern described in Section 14 is a valid future architecture direction, but it is **not the first implementation target**.

**First priority:** Make the existing synchronous mutation paths correct and consistent.  
**Later priority:** Split critical-phase and follow-up-phase for latency optimization.

This avoids introducing async complexity before the current synchronous paths are trustworthy.

### 2.4 Thin Route, Rich Engine

All implementation stories should move the codebase toward this structural principle:

- **Route handlers** own: input validation, authentication, authorization, response formatting
- **Engine functions** own: all workflow state mutation orchestration, all CAS guards, all transition logic
- **One engine path per operation** — no route should implement workflow state transitions inline

This principle should be reflected in story acceptance criteria. For example: *"After this story, document review approve/decline transitions are executed by an engine function, not by inline writes in the route handler."*

### 2.5 Recovery: Manual First, Automation Later

Recovery stories should be scoped in two phases:
1. **First story:** Safe manual/admin-triggered repair for known partial-failure states (see Section 9.3). This means an admin endpoint or CLI command, not a background reconciliation loop.
2. **Later story:** Automated periodic reconciliation or background repair, if the manual path proves insufficient.

This prevents over-scoping the first recovery story into a background job system.

---

## 3. Workflow Action Inventory

Every action that mutates workflow state or triggers workflow-related side effects, classified by entry point.

### 3.1 Primary Workflow Mutations

| # | Action | Entry Point | Engine Function(s) | Tables Mutated |
|---|--------|------------|-------------------|----------------|
| 1 | **Instantiate workflow** | `POST /api/workflows/instantiate` → `instantiateWorkflow()` | `instantiateWorkflow`, `createTasksForStep`, `seedStepDocuments` | `processInstance` (insert+update), `stepInstance` (batch insert), `taskInstance` (insert), `workflowStepDocument` (insert) |
| 2 | **Submit step (form)** | `POST /api/workflows/steps/:id/complete` (action=submit) | `completeStep`, `transitionToNextStep`, `createTasksForStep`, `seedStepDocuments`, `createValidationTasks` | `stepInstance`, `taskInstance`, `processInstance`, `commentThread`, `workflowStepDocument`, `suppliers` |
| 3 | **Approve validation** | `POST /api/workflows/steps/:id/complete` (action=approve) | `approveValidationTask`, `transitionToNextStep`, `createTasksForStep`, `seedStepDocuments` | `taskInstance`, `stepInstance`, `processInstance`, `workflowStepDocument`, `suppliers` |
| 4 | **Decline validation** | `POST /api/workflows/steps/:id/complete` (action=decline) | `createTasksForStep` | `taskInstance`, `stepInstance`, `processInstance`, `commentThread`, `formSubmission` |
| 5 | **Submit dynamic form** | `POST /api/form-submissions/:id/submit` → `completeStep()` | `completeStep`, `transitionToNextStep`, `createTasksForStep`, `seedStepDocuments`, `createValidationTasks` | `formSubmission`, `stepInstance`, `taskInstance`, `processInstance`, `commentThread`, `workflowStepDocument`, `suppliers` |
| 6 | **Review documents (all approve)** | `POST /api/workflows/steps/:id/documents/review` | `transitionToNextStep` (inline writes for rest) | `workflowStepDocument`, `taskInstance`, `stepInstance`, `processInstance`, `suppliers` |
| 7 | **Review documents (any decline)** | `POST /api/workflows/steps/:id/documents/review` | `createTasksForStep` (inline writes for rest) | `workflowStepDocument`, `taskInstance`, `stepInstance`, `processInstance` |
| 8 | **Upload workflow document** | `POST /api/workflows/steps/:id/documents/:name/upload` | None | `documents` (insert), `workflowStepDocument` (update) |

### 3.2 Secondary / Indirect Workflow Mutations

| # | Action | Entry Point | Effect on Workflow State |
|---|--------|------------|------------------------|
| 9 | **Save form draft** | `POST /api/form-submissions/draft` | Creates `formSubmission` row linked to `processInstanceId` + `stepInstanceId`. No workflow state mutation. |
| 10 | **Create workflow comment** | `POST /api/workflows/comments` | Inserts into `commentThread`. No progression effect. |
| 11 | **Send reminder** | `POST /api/workflows/processes/:id/send-reminder` | Inserts `emailNotifications` row + queues email. No state mutation. |
| 12 | **Manual supplier status change** | `PATCH /api/suppliers/:id/status` | Directly writes `suppliers.status` — bypasses workflow engine. |
| 13 | **Soft-delete supplier** | `DELETE /api/suppliers/:id` | Sets `suppliers.deletedAt` without checking for active processes. |

### 3.3 Administrative Workflow Configuration

| # | Action | Entry Point | Risk |
|---|--------|------------|------|
| 14 | **Update workflow type → supplier status mapping** | `PATCH /api/admin/workflow-types/:id` | Changes the target supplier status for workflow completions. No cascade to running processes. |
| 15 | **Delete supplier status** | `DELETE /api/admin/supplier-statuses/:id` | Does not check `workflowType.supplierStatusId` references. Could break completion logic. |
| 16 | **Update document template** | `PUT /api/document-templates/:id` | Changes `requiredDocuments` list. In-flight workflows use already-seeded `workflowStepDocument` rows. New instantiations will use the updated template. |

### 3.4 Workflow Event Logging (Side Effect)

| Caller | Event Types Logged |
|--------|-------------------|
| `instantiate.ts` route | `PROCESS_INSTANTIATED`, `STEP_ACTIVATED` |
| `complete.ts` route (submit) | `FORM_SUBMITTED` / `FORM_RESUBMITTED` / `DOCUMENT_UPLOADED`, `PROCESS_COMPLETED`, `STEP_ACTIVATED` |
| `complete.ts` route (approve) | `VALIDATION_APPROVED` / `STEP_VALIDATED`, `PROCESS_COMPLETED`, `STEP_ACTIVATED` |
| `complete.ts` route (decline) | `VALIDATION_DECLINED` |
| `submit.ts` route (form) | `FORM_SUBMITTED` / `FORM_RESUBMITTED`, `PROCESS_COMPLETED`, `STEP_ACTIVATED` |
| `review.ts` route (docs) | `DOCUMENT_APPROVED` / `DOCUMENT_DECLINED`, `PROCESS_COMPLETED`, `STEP_ACTIVATED` |

All event logging is fire-and-forget via `logWorkflowEvent()` which uses its own DB connection and swallows all errors.

---

## 4. End-to-End Execution Paths

### 4.1 Instantiate Workflow

```
Route: POST /api/workflows/instantiate
  │
  ├─ Auth: requirePermission(CREATE_QUALIFICATIONS)
  ├─ DB read: workflowTemplate (name only, for logging)
  │
  ├─ instantiateWorkflow(db, params) — OPENS OWN TRANSACTION
  │   └─ tx.begin
  │       ├─ tx.select workflowTemplate (full row, tenant+id+deletedAt)
  │       ├─ tx.insert processInstance → returning
  │       ├─ tx.select workflowStepTemplate (all steps, ordered)
  │       ├─ tx.insert stepInstance (batch, all steps)
  │       ├─ createTasksForStep(tx, firstStep)
  │       │   ├─ tx.select workflowStepTemplate (by id)
  │       │   ├─ tx.select taskInstance (idempotency check)
  │       │   ├─ [if supplier_user] resolveSupplierUser(tx)
  │       │   │   ├─ tx.select processInstance+suppliers+users (3-way join)
  │       │   │   └─ tx.select users (procurement_manager fallback, raw SQL)
  │       │   └─ tx.insert taskInstance (onConflictDoNothing)
  │       ├─ [if document step] seedStepDocuments(tx, firstStep)
  │       │   ├─ tx.select workflowStepTemplate
  │       │   ├─ tx.select documentTemplate
  │       │   ├─ tx.select workflowStepDocument (idempotency check)
  │       │   └─ tx.insert workflowStepDocument (batch)
  │       └─ tx.update processInstance (currentStepInstanceId, totalSteps)
  │   └─ tx.commit
  │
  ├─ [fire-and-forget] logWorkflowEvent(PROCESS_INSTANTIATED)
  ├─ [fire-and-forget] logWorkflowEvent(STEP_ACTIVATED)
  │
  └─ Response: { processInstanceId, firstStepId, status, totalSteps }
```

**DB round trips inside transaction:** 7-12 (depending on step type and assignee type)  
**DB round trips outside transaction:** 1 (template name read) + 2 (event logs)  
**Transaction scope:** Well-bounded. Contains only the essential state creation.

### 4.2 Submit Step (via complete.ts, action=submit)

```
Route: POST /api/workflows/steps/:stepInstanceId/complete (action=submit)
  │
  ├─ Auth: authenticate
  ├─ verifyTaskAssignment(user, stepId, ["action","resubmission"], db) — 1 DB read
  │
  ├─ db.transaction(tx =>
  │   └─ completeStep(tx, { outcome: "completed" })
  │       ├─ tx.update stepInstance SET status='completed' WHERE status='active' (CAS)
  │       ├─ tx.insert commentThread (if comments provided)
  │       ├─ tx.update taskInstance SET status='completed' (all tasks for step)
  │       ├─ [if requiresValidation]
  │       │   ├─ tx.update stepInstance SET status='awaiting_validation'
  │       │   ├─ tx.update processInstance SET status='pending_validation'
  │       │   └─ createValidationTasks(tx)
  │       │       ├─ tx.select taskInstance (idempotency check)
  │       │       └─ tx.insert taskInstance (batch, one per role)
  │       └─ [if no validation] transitionToNextStep(tx)
  │           ├─ tx.select stepInstance (current)
  │           ├─ tx.select stepInstance (all steps in process)
  │           ├─ tx.update stepInstance SET status='active' (next step)
  │           ├─ tx.update processInstance (currentStepId, completedSteps++)
  │           ├─ tx.select processInstance (re-read for workflowTemplateId)
  │           ├─ tx.select workflowStepTemplate (for next step)
  │           ├─ createTasksForStep(tx, nextStep)
  │           ├─ [if document step] seedStepDocuments(tx, nextStep)
  │           └─ [if last step — process completion]
  │               ├─ tx.update processInstance SET status='complete'
  │               ├─ tx.select processInstance+workflowTemplate+workflowType+supplierStatus (4-way join)
  │               └─ tx.update suppliers SET status (if supplier entity)
  │   )
  │
  ├─ [OUTSIDE TX] db.select stepInstance (for logging)
  ├─ [OUTSIDE TX] db.select processInstance (for logging)
  ├─ [OUTSIDE TX] db.select stepInstance (re-read for logging)
  ├─ [OUTSIDE TX] db.select processInstance (re-read for logging)
  ├─ [OUTSIDE TX] db.select workflowStepTemplate (for step type detection)
  ├─ [OUTSIDE TX] logWorkflowEvent (fire-and-forget)
  ├─ [OUTSIDE TX, conditional] db.select stepInstance (next step name)
  ├─ [OUTSIDE TX, conditional] logWorkflowEvent (STEP_ACTIVATED or PROCESS_COMPLETED)
  │
  └─ Response: { action, stepCompleted, nextStepActivated }
```

**DB round trips inside transaction:** 6-15 (varies with validation, step type, completion)  
**DB round trips outside transaction:** 5-8 (event logging context)  
**Total round trips:** 11-23  
**Transaction scope:** The critical state change is properly wrapped. Event logging overhead is excessive but is a **performance issue, not a correctness issue**.

### 4.3 Approve Validation (via complete.ts, action=approve)

```
Route: POST /api/workflows/steps/:stepInstanceId/complete (action=approve)
  │
  ├─ Auth: authenticate
  │
  ├─ db.transaction(tx =>
  │   ├─ tx.select taskInstance (find user's pending validation task)
  │   └─ approveValidationTask(tx, { taskInstanceId, userId })
  │       ├─ tx.update taskInstance SET status='completed' WHERE status='pending' (CAS)
  │       ├─ tx.select taskInstance (count remaining pending validation tasks)
  │       ├─ [if all complete]
  │       │   ├─ tx.update stepInstance SET status='validated' WHERE status='awaiting_validation' (CAS)
  │       │   ├─ tx.select processInstance
  │       │   └─ transitionToNextStep(tx, ...) [same subtree as 4.2]
  │   )
  │
  ├─ [OUTSIDE TX] 2-4 DB reads for logging context
  ├─ [OUTSIDE TX] logWorkflowEvent (1-2 events)
  │
  └─ Response: { action, stepCompleted, nextStepActivated, message }
```

**DB round trips inside transaction:** 4-15 (varies with whether all validations are complete)  
**DB round trips outside transaction:** 3-6  
**Transaction scope:** Properly wrapped. Two-phase CAS is correct.

### 4.4 Decline Validation (via complete.ts, action=decline)

```
Route: POST /api/workflows/steps/:stepInstanceId/complete (action=decline)
  │
  ├─ Auth: authenticate
  │
  ├─ db.transaction(tx =>
  │   ├─ tx.select taskInstance (find user's pending validation task)
  │   ├─ tx.select stepInstance
  │   ├─ tx.select processInstance
  │   ├─ tx.select workflowStepTemplate
  │   ├─ tx.insert commentThread (decline comment)
  │   ├─ tx.update taskInstance SET status='completed', outcome='declined' (CAS)
  │   ├─ tx.update taskInstance SET status='completed', outcome='auto_closed' (all other pending)
  │   ├─ tx.update stepInstance SET status='active' WHERE status='awaiting_validation' (CAS)
  │   ├─ tx.update formSubmission SET status='draft'
  │   ├─ tx.update processInstance SET status='declined_resubmit'
  │   └─ createTasksForStep(tx, stepId, stepTemplateId)
  │       ├─ tx.select workflowStepTemplate
  │       ├─ tx.select taskInstance (idempotency check)
  │       └─ tx.insert taskInstance
  │   )
  │
  ├─ [OUTSIDE TX] logWorkflowEvent(VALIDATION_DECLINED)
  │
  └─ Response: { action, commentCreated, targetStepActivated, targetStepId }
```

**DB round trips inside transaction:** 11-13  
**DB round trips outside transaction:** 1  
**Transaction scope:** Properly wrapped. The largest transaction in the system — 11+ writes in a single transaction. This is heavy but correct since all writes are interdependent.

### 4.5 Submit Dynamic Form (via form-submissions/submit.ts)

```
Route: POST /api/form-submissions/:submissionId/submit
  │
  ├─ Auth: authenticate (must be original submitter)
  │
  ├─ db.select formSubmission
  ├─ db.select formField + formSection (all fields)
  ├─ db.select formAnswer (all answers)
  ├─ Validation: required fields + format validation
  ├─ db.update formSubmission SET status='submitted'  ← COMMITTED INDEPENDENTLY
  │
  ├─ [try/catch — errors swallowed]
  │   ├─ db.select stepInstance (for logging)
  │   ├─ completeStep(db, { outcome: "completed" })   ← NO TRANSACTION
  │   │   [same subtree as 4.2 but with db, not tx]
  │   ├─ logWorkflowEvent (fire-and-forget)
  │   └─ [conditional] logWorkflowEvent (STEP_ACTIVATED or PROCESS_COMPLETED)
  │
  └─ Response: { submission, processInstanceId, stepCompleted }
```

**DB round trips (form validation):** 3  
**DB round trips (form status update):** 1  
**DB round trips (completeStep, no tx):** 6-15  
**DB round trips (event logging):** 2-4  
**Total round trips:** 12-23  

**CORRECTNESS ISSUE:** The form status update and `completeStep()` are NOT in a transaction. `completeStep` receives `db` (not `tx`), so its internal writes are also independent. A failure partway through leaves the form as `submitted` but the step may be stuck in any intermediate state.

### 4.6 Document Review — All Approved Path (via review.ts)

```
Route: POST /api/workflows/steps/:stepInstanceId/documents/review
  │
  ├─ Auth: authenticate + verifyTaskAssignment("validation")
  │
  ├─ db.select stepInstance
  ├─ db.select workflowStepDocument (all docs for step)
  │
  ├─ [for each decision] db.update workflowStepDocument SET status='approved'  ← NO TX
  │
  ├─ db.update taskInstance SET status='completed'                              ← NO TX
  ├─ db.update stepInstance SET status='validated'                              ← NO TX
  ├─ transitionToNextStep(db, ...)                                              ← NO TX
  │   [all internal writes also use db, not tx]
  │   includes: suppliers.status update on process completion
  │
  ├─ logWorkflowEvent(DOCUMENT_APPROVED) (fire-and-forget)
  ├─ [conditional] logWorkflowEvent(PROCESS_COMPLETED or STEP_ACTIVATED)
  │
  └─ Response: { action, approvedCount, stepCompleted, nextStepActivated, processCompleted }
```

**DB round trips:** 8-20+ (depending on number of documents and whether process completes)  
**Transaction:** NONE  
**CORRECTNESS ISSUE:** This is the most dangerous mutation path in the system. Every write is independent. A crash after `stepInstance SET status='validated'` but before `transitionToNextStep` leaves the step validated but no next step activated. The `workflow-health` endpoint would flag this as a stuck process, but there is no auto-recovery.

### 4.7 Document Review — Decline Path (via review.ts)

```
Route: POST /api/workflows/steps/:stepInstanceId/documents/review
  │
  ├─ [same auth and initial reads as 4.6]
  │
  ├─ [for each decision]
  │   ├─ db.update workflowStepDocument SET status='approved' or 'declined'     ← NO TX
  │
  ├─ [for each declined doc]
  │   ├─ db.update workflowStepDocument SET status='pending', documentId=null   ← NO TX (double write)
  │
  ├─ db.update stepInstance SET status='active'                                 ← NO TX
  ├─ db.update taskInstance SET status='completed'                              ← NO TX
  ├─ db.update processInstance SET status='declined_resubmit'                   ← NO TX
  ├─ db.select processInstance (for workflowTemplateId)
  ├─ db.select workflowStepTemplate
  ├─ createTasksForStep(db, ...)                                                ← NO TX
  │
  ├─ logWorkflowEvent(DOCUMENT_DECLINED)
  │
  └─ Response: { action, declinedCount, approvedCount }
```

**DB round trips:** 10-20+ (depends on number of documents)  
**Transaction:** NONE  
**Note:** Declined documents are first written as `status='declined'` then immediately overwritten to `status='pending'` — a wasteful double-write.

---

## 5. Transaction Boundary Review

### 5.1 Current Transaction Map

| Mutation Path | Has Transaction? | Scope | Assessment |
|---|---|---|---|
| `instantiateWorkflow()` | **Yes** (own `db.transaction()`) | All inserts: process, steps, first task, docs | **Good** — well-bounded. Minor issue: ignores `outerDb` param (composability cleanup, not correctness). |
| `complete.ts` → submit | **Yes** (`db.transaction(tx => completeStep(tx, ...))`) | All step/task/process mutations + validation tasks + transition + supplier status | **Good** — comprehensive. Can be heavy (11-15 writes for last-step completion with validation). |
| `complete.ts` → approve | **Yes** (`db.transaction(tx => approveValidationTask(tx, ...))`) | Task CAS + step CAS + transition + supplier status | **Good** — correct two-phase CAS. |
| `complete.ts` → decline | **Yes** (`db.transaction(tx => { ... })`) | Task CAS + close other tasks + reset step + reset form + update process + create tasks | **Good** — heaviest single transaction (11-13 writes) but all writes are interdependent. |
| `submit.ts` → form submit | **No** | Form update is separate from `completeStep()`. `completeStep` called with `db` not `tx`. | **BROKEN — correctness issue.** Form and workflow state can diverge. |
| `review.ts` → all approved | **No** | Each document update, task update, step update, and transition are independent writes. | **BROKEN — correctness issue.** Most dangerous path. 8-20 independent writes with no atomicity. |
| `review.ts` → any decline | **No** | All document updates, step reset, task close, process update, task creation — all independent. | **BROKEN — correctness issue.** Same severity as approve path. |
| `upload.ts` → document upload | **No** | Storage upload + document insert + workflowStepDocument update are independent. | **Medium risk** — file orphaning possible but not a state corruption risk. |

### 5.2 Transactions That Are Too Large

The decline path in `complete.ts` is the largest transaction at 11-13 writes. While all writes are interdependent (correct), the transaction holds row locks on:
- `taskInstance` (multiple rows)
- `stepInstance` (1 row)
- `processInstance` (1 row)
- `formSubmission` (1+ rows)
- `commentThread` (1 row insert)

Under concurrent load, this could cause lock contention, especially if multiple validators attempt to decline the same step simultaneously. The CAS pattern prevents data corruption, but the transaction duration may cause timeouts on Supabase (default 60s statement timeout, connection-level).

> **Planning note:** This is not an immediate action item. The transaction is correct. Only revisit if monitoring shows actual timeout issues under production load.

### 5.3 Transactions That Are Missing or Too Small

| Path | What's Missing | Risk | Category |
|---|---|---|---|
| `review.ts` (both paths) | Entire mutation chain has no transaction | Partial state: docs approved but step not transitioned; step validated but process not updated; process completed but supplier not updated | **Correctness** |
| `submit.ts` | Form status update is separate from `completeStep()` | Form marked `submitted` but step stuck in `active`. CAS in `completeStep` prevents double-completion but doesn't prevent the inconsistency. | **Correctness** |
| `upload.ts` | `documents` INSERT and `workflowStepDocument` UPDATE are separate | Orphaned document row if second write fails. Low severity — no state corruption. | Performance |
| `create-draft.ts` | Answer upsert loop is not in a transaction | Partial answer save on crash. Low severity — draft state is inherently partial. | Performance |
| `send-reminder.ts` | Email notification INSERT and `queueEmailJob` are separate | Orphaned `emailNotifications` row with status PENDING and no BullMQ job. | Performance |

### 5.4 Where Transaction Scope Includes Too Much Downstream Work

The approve path (`complete.ts` → `approveValidationTask`) can, in the worst case, include:
1. Task CAS (critical)
2. Remaining validation count check (critical)
3. Step CAS (critical)
4. `transitionToNextStep` which includes:
   - Next step activation (critical)
   - Process status update (critical)
   - Process re-read (could be eliminated — **performance**)
   - Step template lookup (read — could be done before tx — **performance**)
   - `createTasksForStep` including `resolveSupplierUser` which does a 3-way join + raw SQL subquery (follow-up work)
   - `seedStepDocuments` including template lookups and batch insert (follow-up work)
   - Supplier status update on completion (debatable — critical for UX, but could be eventual)

Items 4e-4g are **follow-up work** that could theoretically be split out of the transaction. However, the current design keeps everything atomic, which is safer at the cost of transaction duration.

> **Planning note:** Do not split these out in the first wave of stories. The current atomic approach is correct. Splitting into critical-phase + follow-up-phase is a Wave 3+ optimization that should only be considered after all correctness issues are resolved and if latency becomes a measured problem.

---

## 6. Query / Round-Trip Hotspots

> **Planning note:** Everything in this section is a **performance / efficiency** concern, not a correctness concern. Stories for these items should be sequenced after all correctness work is complete unless a fix is trivially co-located with a correctness story.

### 6.1 Event Logging Overhead (All Mutation Routes)

After the core mutation completes, every route re-reads multiple tables to populate event log fields:

**`complete.ts` → submit path, after transaction:**
1. `SELECT stepInstance` (stepOrder, stepName, completedDate)
2. `SELECT processInstance` (by currentStepInstanceId — complex fallback)
3. `SELECT stepInstance` (full re-read)
4. `SELECT processInstance` (full re-read by processInstanceId)
5. `SELECT workflowStepTemplate` (for step type detection)
6. [conditional] `SELECT stepInstance` (next step name)

**That's 5-6 extra queries after the transaction, purely for event logging.** The same data was available inside the transaction or could be returned from `completeStep()`.

**Estimated wasted round trips per mutation:** 3-8 queries  
**Estimated wasted latency:** 15-60ms (assuming 5-8ms per Supabase query round trip)

### 6.2 `transitionToNextStep` Internal Round Trips

Inside a single call to `transitionToNextStep()`:
1. `SELECT stepInstance` (current step by ID)
2. `SELECT stepInstance` (ALL steps in process, ordered)
3. `UPDATE stepInstance` (activate next)
4. `UPDATE processInstance` (update current step + completed count)
5. `SELECT processInstance` (re-read to get `workflowTemplateId` — **this was just written**)
6. `SELECT workflowStepTemplate` (for next step)
7. `createTasksForStep()` — 2-4 more queries
8. [if document step] `seedStepDocuments()` — 3-4 more queries
9. [if last step] `UPDATE processInstance` (complete)
10. [if last step + supplier] `SELECT` 4-table join for status mapping
11. [if last step + supplier] `UPDATE suppliers`

**Total: 8-14 sequential queries within `transitionToNextStep` alone.**

**Optimization opportunities:**
- Query 5 re-reads `processInstance` immediately after query 4 wrote it. The `workflowTemplateId` does not change — it could be passed as a parameter.
- Queries 1 and 2 could potentially be combined (the current step is already one of the "all steps").
- The step template lookup (query 6) is always the same pattern: `workflowTemplateId + tenantId + stepOrder`.

### 6.3 `completeStep` Internal Round Trips

For a document step with required documents:
1. `UPDATE stepInstance` (CAS)
2. `SELECT workflowStepDocument` (all docs for step)
3. `SELECT processInstance` (for template ID)
4. `SELECT workflowStepTemplate` (for document template link)
5. `SELECT documentTemplate` (for required docs list)
6. Document completeness check
7. `UPDATE taskInstance` (mark tasks completed)
8. [if validation] `UPDATE stepInstance` + `UPDATE processInstance` + `createValidationTasks()`
9. [if no validation] `transitionToNextStep()` — 8-14 more queries

**Total: 10-22 sequential queries for a document step with transition.**

### 6.4 `review.ts` N+1 Pattern

The document review route has an N+1-like pattern:
```
for (const decision of decisions) {
  await db.update(workflowStepDocument).set(...).where(eq(id, doc.id));
}
```

For a step with 5 required documents, this is 5 sequential UPDATE statements. On the decline path, declined documents get a second UPDATE (reset to pending), making it 5+N where N is the number of declined docs.

**Could be reduced to 2 batch updates** (one for approved, one for declined) using `inArray`.

### 6.5 `resolveSupplierUser` Raw SQL Subquery

```typescript
// Inside createTasksForStep → resolveSupplierUser
const fallbackResult = await tx.execute(
  sql`SELECT id, full_name, email FROM users WHERE tenant_id = ${tenantId} AND role = 'procurement_manager' AND is_active = true LIMIT 1`
);
```

This raw SQL query runs for every task creation where the assignee is a `supplier_user`. It could be consolidated with the initial 3-way join or cached at process level.

### 6.6 Summary: Worst-Case Round Trips Per Action

| Action | Inside TX | Outside TX | Total | Acceptable? |
|---|---|---|---|---|
| Instantiate | 7-12 | 3 | 10-15 | Yes |
| Submit step (no validation, not last) | 10-14 | 5-8 | 15-22 | Borderline |
| Submit step (last step + supplier) | 14-18 | 5-8 | 19-26 | Heavy |
| Approve (not last approval) | 3 | 3-4 | 6-7 | Good |
| Approve (last approval + transition) | 12-18 | 5-8 | 17-26 | Heavy |
| Decline | 11-13 | 1 | 12-14 | Acceptable (transaction is heavy but necessary) |
| Form submit + step complete | 3 (form) + 10-18 (step) | 3-6 | 16-27 | Heavy — and not transactional |
| Doc review (all approve) | N/A (no tx) | 8-20+ | 8-20+ | Unacceptable — no tx and heavy |
| Doc review (decline) | N/A (no tx) | 10-20+ | 10-20+ | Unacceptable — no tx and heavy |

---

## 7. Dynamic Form / Workflow Coupling Review

### 7.1 Coupling Points

The form-workflow coupling occurs at exactly two points:

**Point 1: Draft Creation — Loose coupling**
- `create-draft.ts` stores `processInstanceId` and `stepInstanceId` on the `formSubmission` row.
- This is a FK-level link only. No workflow state is read or written.
- **Assessment:** Clean. No coupling issue.

**Point 2: Form Submission — Tight coupling**
- `submit.ts` changes `formSubmission.status` to `submitted` then calls `completeStep(db, ...)`.
- **This is the only place where a form status change triggers workflow progression.**
- **Assessment:** The coupling itself is correct (form submission should advance the step). The problem is the implementation: no transaction wraps both operations.

### 7.2 Form Status Lifecycle

```
draft ──→ submitted (immutable)
  ↑            │
  │            ↓
  └── [on validation decline, complete.ts resets form to draft]
```

The decline path in `complete.ts` (action=decline) includes:
```typescript
await tx.update(formSubmission)
  .set({ status: "draft", updatedAt: new Date() })
  .where(and(
    eq(formSubmission.stepInstanceId, stepInstanceId),
    eq(formSubmission.tenantId, user.tenantId),
    isNull(formSubmission.deletedAt)
  ));
```

This is inside the transaction, which is correct. The form-to-draft reset is atomic with the step-to-active reset.

### 7.3 Specific Risks

| Risk | Severity | Category | Evidence |
|---|---|---|---|
| Form submitted but step not completed | **High** | **Correctness** | `submit.ts` line 146-154: form UPDATE is committed before `completeStep()` is called. If `completeStep()` fails, the form stays submitted but the step is stuck. The error is caught and swallowed (line 218-220). |
| Duplicate form submission | Low | N/A (already safe) | `ALREADY_SUBMITTED` guard (line 62-66) prevents resubmission. Safe. |
| Form status inconsistent after decline | Low | N/A (already safe) | Decline in `complete.ts` resets form inside transaction. Safe. |
| Form validation blocking step completion | None | N/A | Validation runs before any state mutation. Safe. |
| Orphaned form submission (no workflow) | None | N/A | `formSubmission.processInstanceId` is nullable. Forms can exist independently. |

### 7.4 The `submit.ts` ↔ `complete.ts` Duplication Issue

There are two entry points that call `completeStep()` for form-type steps:

1. `POST /api/form-submissions/:id/submit` (in `submit.ts`) — calls `completeStep(db, ...)` **without** a transaction.
2. `POST /api/workflows/steps/:id/complete` (in `complete.ts`, action=submit) — calls `completeStep(tx, ...)` **inside** a transaction.

Both routes perform the same logical operation (complete a form step) but with different safety guarantees. The form-submissions route is the one users actually hit from the UI (the form renderer submits through this endpoint), making it the **more common and less safe** path.

Furthermore, `submit.ts` does NOT call `verifyTaskAssignment`. It only checks that the user is the original form submitter. This means:
- A user who created a draft but had their task reassigned could still submit.
- The task assignment check is bypassed entirely.

> **Story-planning note:** The fix for this should both wrap the mutation in a transaction AND ensure the route delegates state transitions to the engine, consistent with the "thin route, rich engine" principle (Section 13).

---

## 8. Document / Validation / Workflow Coupling Review

### 8.1 Document Lifecycle in Workflow

```
[Template]                              [Runtime]
documentTemplate                        workflowStepDocument
  requiredDocuments: [                    ├─ requiredDocumentName: "Tax Certificate"
    { name: "Tax Certificate" },          ├─ documentId: null → uuid (on upload)
    { name: "Insurance" },                ├─ status: pending → uploaded → approved/declined → pending (on decline reset)
  ]                                       └─ reviewedBy, reviewedAt, declineComment
```

**Seeding:** When a document-type step is activated (during `transitionToNextStep` or `instantiateWorkflow`), `seedStepDocuments()` creates one `workflowStepDocument` row per required document from the linked `documentTemplate`.

**Upload:** `upload.ts` creates a `documents` row and links it to the `workflowStepDocument` by setting `documentId` and `status='uploaded'`.

**Review:** `review.ts` sets each document to `approved` or `declined`, then either advances the workflow or returns the step for re-upload.

### 8.2 The `review.ts` Problem: Duplicated Engine Logic

The `review.ts` route re-implements workflow state transitions inline instead of delegating to the engine. Compare:

**For the "all approved" path, `review.ts` does:**
1. Update each `workflowStepDocument` → `approved` (N individual updates)
2. Update `taskInstance` → `completed`
3. Update `stepInstance` → `validated`
4. Call `transitionToNextStep(db, ...)`

**The engine's `completeStep` + `approveValidationTask` provides:**
1. CAS on step status
2. CAS on task status
3. Conditional `transitionToNextStep(tx, ...)`
4. All in a transaction

`review.ts` skips the CAS patterns, skips the transaction, and calls `transitionToNextStep` with `db` instead of `tx`. This means:
- **No concurrency protection:** Two simultaneous review submissions could both mark the step as validated.
- **No atomicity:** The step could be marked `validated` without the next step being activated.
- **The supplier status update on process completion is not atomic** with the step transition.

### 8.3 The Decline Double-Write Pattern

On the decline path in `review.ts`:
```typescript
// First: mark as declined
await db.update(workflowStepDocument).set({ status: "declined", ... });

// Then: reset to pending for re-upload
await db.update(workflowStepDocument).set({ status: "pending", documentId: null, ... });
```

The first write (setting `declined`) is immediately overwritten by the second write (setting `pending`). The `declined` status is never visible to any user or query. This is wasteful and confusing — the intent could be achieved with a single write to `pending`.

> **Planning note:** This is a trivial fix that should be folded into the document review transaction safety story, not its own story.

### 8.4 Document Completeness Check in `completeStep`

When `completeStep` processes a document-type step, it checks that all required documents are uploaded:

```
1. Read workflowStepDocument (all docs for step)
2. Read processInstance (for workflowTemplateId)
3. Read workflowStepTemplate (for documentTemplateId)
4. Read documentTemplate (for requiredDocuments list)
5. Compare uploaded count vs required count
```

This is 4 DB reads for what could be a single query with joins, or even a check against only `workflowStepDocument` rows (which are already seeded with the required document names).

> **Planning note:** Performance optimization. Not a story-planning priority.

### 8.5 Document Deletion Gap

`DELETE /api/documents/:id` soft-deletes a `documents` row but does NOT check whether the document is linked to an active `workflowStepDocument`. If a user deletes a document that's referenced by `workflowStepDocument.documentId`, the workflow step document view will show a broken reference.

### 8.6 Specific Risks

| Risk | Severity | Category | Evidence |
|---|---|---|---|
| Document review has no transaction | **Critical** | **Correctness** | `review.ts` — all writes are independent. Confirmed by code inspection. |
| No CAS on document review step transition | **High** | **Correctness** | `review.ts` line 233: `SET status='validated'` without a `WHERE status='awaiting_validation'` guard. Two concurrent reviews could both succeed. |
| Supplier status update not atomic with completion | **High** | **Correctness** | `transitionToNextStep(db, ...)` at line 241 of `review.ts` — `db` handle means supplier update is in its own implicit transaction. |
| Declined doc double-write | Low | Performance | `review.ts` lines 91-118 — wasteful but not dangerous. Fold fix into correctness story. |
| Document deletion breaks workflow reference | Low | **Correctness** (minor) | `documents/delete.ts` — orphaned `documentId` on `workflowStepDocument`. Visual glitch, not state corruption. |
| `seedStepDocuments` reads full template unnecessarily | Low | Performance | Could check only `workflowStepDocument` existence. 2-3 wasted queries per seeding. |

---

## 9. Idempotency and Recovery Analysis

### 9.1 Idempotency Guards in Place

| Guard | Location | Mechanism | Effectiveness |
|---|---|---|---|
| Task creation idempotency | `createTasksForStep()` | Check for existing pending tasks + `onConflictDoNothing` + DB unique constraint `idx_task_instance_step_action_pending` | **Strong** — triple-layered. |
| Validation task idempotency | `createValidationTasks()` | Check existing pending validation tasks by role + DB unique constraint `idx_task_instance_step_validation_role_pending` | **Strong** — double-layered. |
| Document seeding idempotency | `seedStepDocuments()` | Check existing docs by `requiredDocumentName` + DB unique constraint `idx_wsd_step_doc_name` | **Strong** — double-layered. |
| Step completion idempotency | `completeStep()` | CAS: `UPDATE WHERE status='active'` | **Moderate** — prevents double-completion but doesn't prevent the first attempt from failing partway. |
| Task approval idempotency | `approveValidationTask()` | CAS: `UPDATE WHERE status='pending'` | **Strong** — two-phase CAS on task then step. |
| Form submission idempotency | `submit.ts` | `status === 'submitted'` check before update | **Moderate** — prevents re-submission but the form status and step status can diverge. |
| Email job idempotency | `email-queue.ts` | `jobId: data.notificationId` (BullMQ dedup by notification ID) | **Good** — prevents duplicate jobs. |
| Email send idempotency | `email-job-processor.service.ts` | Checks `status !== 'SENT'` before processing | **Good** — prevents double-send. |

### 9.2 Missing Idempotency / Retryability

| Gap | Location | Risk | Category |
|---|---|---|---|
| **`review.ts` has no CAS guard** | Document review route | Two concurrent review submissions could both mark documents as approved and both attempt to transition. No CAS on step status change (line 233: `SET status='validated'` without `WHERE status='awaiting_validation'`). | **Correctness** |
| **`review.ts` step transition not atomic** | After marking step validated | `transitionToNextStep()` could fail after step is already marked validated. No rollback path. | **Correctness** |
| **`submit.ts` form-step divergence** | After form marked submitted | If `completeStep()` fails, form stays submitted, step stays active. No retry mechanism — the `ALREADY_SUBMITTED` guard prevents re-submission. **Dead state.** | **Correctness** |
| **No retry on partial transition** | `transitionToNextStep()` | If this function fails after activating the next step but before updating `processInstance.currentStepInstanceId`, the process has a dangling pointer. No auto-recovery. | **Correctness** |
| **No retry on partial instantiation** | `instantiateWorkflow()` | If the transaction commits but the event log insert fails — no issue (events are fire-and-forget). If the transaction itself fails, it rolls back cleanly. **Safe.** | N/A |
| **Orphaned email notifications** | `email-notification.service.ts` | If `queueEmailJob()` fails after `INSERT emailNotifications`, the notification row stays PENDING forever. No sweep/reconciliation job. | Performance |

### 9.3 States That Are Truthful but Not Recoverable

These are the specific partial-failure states that a recovery story should target:

| State | How It Occurs | Detection | Recovery Path Needed |
|---|---|---|---|
| Form `submitted` + Step `active` | `submit.ts`: form update succeeds, `completeStep()` fails | **Not currently detected.** Health endpoint does not check this. | Admin-triggered: re-run `completeStep()` for the step, or reset form to `draft`. |
| Step `validated` + Process `in_progress` (no next step active) | `review.ts`: step marked validated, `transitionToNextStep()` fails | **Detected by `workflow-health` endpoint** but no auto-repair. | Admin-triggered: re-run `transitionToNextStep()` for the step. Idempotent task/doc seeding makes this safe. |
| Step `validated` + Process `complete` + Supplier status unchanged | `review.ts` → `transitionToNextStep(db)`: process marked complete, supplier UPDATE fails | **Not currently detected.** | Admin-triggered: re-read the workflow type → supplier status mapping and apply the intended status. |
| Email notification `PENDING` with no BullMQ job | `queueEmailJob()` failure after INSERT | **Not currently detected.** | Sweep job: find PENDING notifications older than N minutes and re-queue. |
| Process `in_progress` + `currentStepInstanceId` is NULL | Transaction failure between step INSERT and process UPDATE | **Detected by `workflow-health` endpoint** as "stuck process." | Admin-triggered: determine intended current step and set `currentStepInstanceId`. |

### 9.4 Can Workflow Actions Be Safely Retried?

| Action | Safe to Retry? | Why |
|---|---|---|
| Instantiate | **Yes** — creates a new independent process each time | But: creates duplicate processes if called twice for the same entity. No dedup guard by entity. |
| Submit step (complete.ts) | **Yes, if step is still active** — CAS prevents double-completion | If step already completed, CAS fails gracefully. |
| Approve validation | **Yes** — CAS on task prevents double-approval | If already approved, returns error cleanly. |
| Decline validation | **Yes** — CAS on task + CAS on step prevent duplicates | Already-processed returns conflict error. |
| Form submit | **No** — `ALREADY_SUBMITTED` guard blocks retry | If form is submitted but step is stuck, there's no way to re-trigger `completeStep()`. |
| Document review | **Partially** — no CAS on step, so concurrent retries may corrupt | Approve+transition path has no idempotency guard on the step level. |
| Document upload | **Yes** — overwrites the existing document link | Status goes back to `uploaded`. Previous document is orphaned in storage but not a correctness issue. |

---

## 10. User-Facing Latency Risk Review

### 10.1 Latency Classification

| Action | User Expectation | Estimated Latency | DB Round Trips | Assessment |
|---|---|---|---|---|
| **Instantiate workflow** | Button click → redirect to process view. 1-2s acceptable. | 50-100ms (10-15 queries × 5-8ms) | 10-15 | **Acceptable.** Transaction is well-scoped. |
| **Submit form** | Button click → success toast. 1-2s acceptable. | 80-160ms (16-27 queries × 5-8ms) | 16-27 | **Borderline.** The event logging queries add 30-60ms unnecessarily. |
| **Approve validation** (not last) | Button click → success toast. <1s. | 30-50ms (6-7 queries) | 6-7 | **Good.** Light path. |
| **Approve validation** (last + transition) | Button click → success. 1-2s acceptable. | 85-160ms (17-26 queries) | 17-26 | **Borderline.** Acceptable today but will degrade with more steps. |
| **Decline validation** | Button click → success. 1-2s acceptable. | 60-100ms (12-14 queries) | 12-14 | **Acceptable.** Heavy transaction but necessary. |
| **Document upload** | File upload → success. 2-3s acceptable (includes file transfer). | File transfer + 30-50ms (4-5 queries) | 4-5 | **Good.** Dominated by file transfer time, not DB. |
| **Document review** (all approve) | Button click → success. 1-2s acceptable. | 40-160ms (8-20+ queries) | 8-20+ | **Risky.** No transaction means latency variance is high (each query is independent). Also, no backpressure — if Supabase is slow, each query compounds. |
| **Document review** (decline) | Button click → success. 1-2s acceptable. | 50-160ms (10-20+ queries) | 10-20+ | **Risky.** Same as approve path — high variance, no atomicity. |
| **My tasks list** | Page load. <1s. | 20-40ms (2 queries) | 2 | **Good.** |
| **Process detail** | Page load. <1s. | 40-70ms (7 parallel queries) | 7 (parallel) | **Good.** Queries run in parallel. |
| **Process list** | Page load. <1s. | 30-60ms (3 queries with subqueries) | 3 | **Good.** But correlated subqueries inside SELECT could become slow at scale. |

### 10.2 What Should Remain Synchronous

These operations MUST return their result to the user synchronously:
- Step completion (CAS result determines UI state)
- Validation approval/decline (user needs to see the outcome)
- Form submission status change
- Document upload acknowledgment
- Document review result

> **Planning note:** All first-wave correctness stories should keep workflow progression synchronous. Do not introduce async follow-up patterns until correctness is established.

### 10.3 What Could Be Deferred (Future — Not First Wave)

These operations currently run synchronously but could eventually be split into a "committed" acknowledgment + deferred follow-up:

| Operation | Critical Phase | Deferrable Phase |
|---|---|---|
| Step submission | CAS on step + mark tasks completed | Next step activation + task seeding + document seeding + supplier status update |
| Validation approval (last) | Task CAS + step CAS | Transition to next step + task/doc seeding |
| Process completion | Process status → complete | Supplier status update |
| All mutations | State change | Event logging (already deferred) |
| All mutations | State change | Email notifications (already deferred via BullMQ) |

> **Planning note:** This split is a valid architecture evolution for Wave 3+. It should NOT be attempted in Wave 1 or Wave 2 stories. The first priority is making the existing synchronous paths correct and consistent.

### 10.4 What Should Eventually Move to Background/Recovery (Future)

For a production-stage SaaS, these operations should eventually use a background pattern:
- **Supplier status update on process completion:** Currently inside the transaction. Could be an eventual-consistency operation triggered by a process-completed event.
- **Task seeding for next step:** Critical for the workflow to proceed, but could use a "step activated, tasks pending" intermediate state with a background seeder.
- **Document seeding:** Same pattern as task seeding.

However, these are **optimizations for scale**, not urgent fixes. The current synchronous approach is simpler and correct — the main risk is latency at very high throughput, not correctness.

---

## 11. Architectural Weaknesses — Correctness & Integrity

These weaknesses represent real risks to data consistency, workflow integrity, or correct system behavior. **Stories for these items should be prioritized first.**

Ranked by severity and impact.

### C1. Document Review Route Has No Transaction (Critical)

**Location:** `apps/api/src/routes/workflows/steps/documents/review.ts`

`review.ts` performs 8-20 independent writes across `workflowStepDocument`, `taskInstance`, `stepInstance`, `processInstance`, and `suppliers` with NO transaction wrapper. It also calls `transitionToNextStep(db, ...)` with the raw `db` handle, meaning the transition's internal writes (including supplier status on completion) are also non-atomic.

**Impact:** A network failure, Supabase timeout, or process crash midway through the review can leave the workflow in an inconsistent state that is not automatically recoverable. Additionally, there are no CAS guards on the step status transition — concurrent review submissions can both succeed.

**Root cause:** This route was likely written before the transaction hardening in Story 2.2.19 was applied to `complete.ts`. The same pattern needs to be applied here.

**Story acceptance criteria direction:**
- All document review writes wrapped in `db.transaction()`
- CAS guard on step status transition (`WHERE status='awaiting_validation'`)
- Engine function used for state transition instead of inline writes
- Concurrent review submissions handled safely (only one succeeds)

### C2. Form Submit Route Does Not Wrap completeStep in Transaction (High)

**Location:** `apps/api/src/routes/form-submissions/submit.ts` line 146-169

The form status is updated to `submitted` (line 146-154) as an independent write. Then `completeStep(db, ...)` is called with the raw `db` handle (line 164), not inside a `db.transaction()`. If `completeStep()` fails (line 218-220), the error is caught and swallowed, the form remains submitted, but the step is stuck in `active`.

This is a **dead state** — the form cannot be re-submitted (blocked by `ALREADY_SUBMITTED` guard), and there is no retry mechanism to re-trigger `completeStep()`.

**Contrast:** `complete.ts` (action=submit) wraps `completeStep(tx, ...)` in a proper `db.transaction()`. The `submit.ts` route is the less safe of the two paths for the same operation.

**Story acceptance criteria direction:**
- Form status update and `completeStep()` wrapped in a single `db.transaction()`
- `completeStep` receives `tx`, not `db`
- If form was already submitted but step is still active, completion can be retried
- `verifyTaskAssignment` enforced on this path (consistent with `complete.ts`)

### C3. Two Parallel Implementation Paths for the Same Operations (High)

The `review.ts` route re-implements workflow state transitions (mark step validated, close tasks, transition to next step, decline and reset) inline, duplicating logic that exists in the engine (`completeStep`, `approveValidationTask`, `returnToPreviousStep`). This means:
- Bug fixes to the engine don't propagate to `review.ts`.
- Transaction safety in the engine doesn't apply to `review.ts`.
- CAS guards in the engine don't protect `review.ts`.
- Testing the engine doesn't validate the `review.ts` path.

**Story acceptance criteria direction:**
- New engine function(s) for document review approve/decline
- `review.ts` route delegates to engine function(s) — no inline state transitions
- All CAS guards from the engine apply to the document review path
- Engine test suite covers the document review path

### C4. No Recovery Path for Partial Failures (Medium)

The `workflow-health` endpoint detects stuck processes, orphaned tasks, and state mismatches, but there is no repair mechanism — automated or manual.

For `submit.ts` specifically, the form-submitted + step-active state has no recovery path at all — the health endpoint doesn't detect it (the step is legitimately `active`, just with a submitted form that can't be re-triggered).

**Story acceptance criteria direction (first story — manual repair only):**
- Admin endpoint or admin-triggered function that can detect and repair known partial-failure states (see Section 9.3)
- Detects: form-submitted + step-active, step-validated + no next step active, process-complete + supplier-not-updated
- Repairs by re-running the appropriate idempotent engine function
- Logs the repair as a workflow event
- Does NOT require automated background execution (that is a separate later story)

### C5. Manual Supplier Status Override Bypasses Workflow (Medium)

**Location:** `apps/api/src/routes/suppliers/detail.ts` PATCH handler

`PATCH /api/suppliers/:id/status` allows admins to set any supplier status, regardless of active workflow processes. There is no guard against contradicting an in-progress workflow. The workflow engine will still try to set the supplier status on completion, potentially overwriting a manual override or being overwritten by one.

**Story acceptance criteria direction:**
- If the supplier has active workflow processes, the PATCH warns or blocks (configurable)
- Audit log entry created for manual status overrides

### C6. Supplier Soft-Delete Does Not Check Active Workflows (Medium)

**Location:** `apps/api/src/routes/suppliers/detail.ts` DELETE handler

A supplier can be soft-deleted while workflow processes are in-progress for that supplier. This leaves orphaned workflow processes that reference a deleted entity.

**Story acceptance criteria direction:**
- DELETE blocked if supplier has active (non-completed, non-cancelled) processes
- Error message identifies the active process(es)

### C7. Supplier Status / Workflow Type Referential Gaps (Low-Medium)

- Deleting a `supplierStatus` does not check if any `workflowType` references it. A completed workflow could try to set a supplier to a deleted status.
- Updating a `workflowType.supplierStatusId` doesn't cascade to running processes. New completions use the updated mapping; in-flight processes use whatever was configured at template publish time.

**Story acceptance criteria direction:**
- `DELETE /admin/supplier-statuses/:id` blocked if referenced by any `workflowType`
- Warning on `workflowType` status mapping change if active processes exist

---

## 12. Architectural Weaknesses — Performance & Efficiency

These weaknesses represent unnecessary overhead, wasted queries, or suboptimal patterns. They are real but **not correctness risks**. Stories for these items should be sequenced after correctness work unless they are trivially co-located with a correctness fix.

### P1. Event Logging Causes Excessive Post-Transaction DB Reads (Medium)

Every mutation route re-reads 3-8 tables after the transaction to populate event log fields (step name, process ID, step type, next step name). This data was either:
- Available inside the transaction (the engine functions already read it)
- Derivable from the engine function's return value
- Static context the route already had

**Impact:** 15-60ms of unnecessary latency per request. At 100 concurrent users, this is 100+ wasted queries per second.

**Story acceptance criteria direction:**
- Engine functions return all context needed for event logging in their result type
- Routes use returned context instead of re-reading from DB
- No post-mutation DB reads for event log population
- Estimated savings: 3-8 queries per mutation

### P2. `instantiateWorkflow` Ignores `outerDb` Parameter (Low)

**Location:** `apps/api/src/lib/workflow-engine/instantiate-workflow.ts` line 44-60

The function signature accepts `outerDb: DbOrTx` but line 60 always calls `db.transaction()` on the module-level import. The `outerDb` parameter is dead code. This prevents callers from composing instantiation into a larger transaction (e.g., instantiate workflow + create supplier in one atomic operation).

**This is a valid composability/contract issue but has lower priority than all correctness items (C1-C7).** The function works correctly in isolation — it just can't be composed into a larger transaction. This should not be prioritized ahead of document review transaction safety, form submit transaction safety, or engine unification.

**Story acceptance criteria direction:**
- `instantiateWorkflow` uses the provided `outerDb` parameter for all operations
- If caller passes a transaction handle, no new transaction is opened
- If caller passes `db`, function opens its own transaction (backward compatible)

### P3. `review.ts` Declined-Document Double-Write (Low)

On the decline path, each declined document is first written as `status='declined'` then immediately overwritten to `status='pending'`. This is a wasted write per declined document.

> **Planning note:** This should be folded into the C1 story (document review transaction safety), not scoped as its own story.

### P4. `transitionToNextStep` Redundant Reads (Low)

- Re-reads `processInstance` immediately after writing it (to get `workflowTemplateId` which doesn't change)
- Reads current step separately from all steps (could be combined)

**Story acceptance criteria direction:**
- `workflowTemplateId` passed as parameter, not re-read
- Current step and all steps fetched in single query
- Estimated savings: 2-3 queries per transition

### P5. `review.ts` N+1 Document Updates (Low)

Individual UPDATE per document decision instead of batch. Could be 2 batch updates using `inArray`.

> **Planning note:** This should be folded into the C1 story (document review transaction safety), not scoped as its own story.

---

## 13. Story-Planning Principles

These principles should guide the acceptance criteria and scope of every implementation story derived from this report.

### Principle 1: Thin Route, Rich Engine

**Route handlers should own:**
- Input validation (Elysia schema)
- Authentication and authorization (`authenticate`, `requirePermission`, `verifyTaskAssignment`)
- Response formatting and HTTP status codes

**Engine functions should own:**
- All workflow state mutation orchestration
- All CAS guards on state transitions
- All transition logic (step completion, validation, decline, return-to-previous)
- Transaction-compatible operation (accept `tx: DbOrTx`, never open own transaction)

**Acceptance criteria template:**  
*"After this story, [operation X] is executed by an engine function, not by inline writes in the route handler. The route handler validates input, checks authorization, calls the engine function inside a `db.transaction()`, and formats the response."*

### Principle 2: One Engine Path Per Operation

No workflow state transition should have two different code paths. If a form step and a document step both need "step completed → transition to next step," they should both call the same engine function.

**Acceptance criteria template:**  
*"After this story, there is exactly one code path for [state transition X]. All routes that trigger this transition delegate to the same engine function."*

### Principle 3: CAS on Every State Transition

Every UPDATE that changes a workflow status column must include a WHERE clause asserting the expected current status. This is the primary concurrency safety mechanism.

**Acceptance criteria template:**  
*"Every status UPDATE in this story uses a CAS pattern: `UPDATE ... SET status = :new WHERE status = :expected`. If the CAS fails (0 rows updated), the operation returns a conflict error."*

### Principle 4: Transaction Scope = All Interdependent Writes

If two writes must be consistent with each other (e.g., step status and process status), they must be in the same transaction. If a write is independent (e.g., event logging), it should be outside the transaction.

### Principle 5: Correctness Stories Must Not Depend on Performance Stories

A correctness story should never be blocked by or coupled to a performance optimization story. If a correctness fix incidentally improves performance (e.g., eliminating the double-write while fixing the transaction), that's fine, but the story's scope and acceptance criteria should be framed around correctness.

---

## 14. High-Level Target Architecture Direction

Based on the current implementation analysis, the workflow engine should move toward the following architecture — incrementally, not as a rewrite.

> **Planning guardrail:** The architecture direction below describes the **end state** after multiple waves of work. Individual stories should implement concrete, bounded steps toward this direction. The first wave of stories should focus on making existing mutation paths correct. Async/deferred patterns are a later evolution, not the first target.

### 14.1 Future Direction: Smaller Atomic Transactions with Deterministic Follow-Up

**Current:** The engine tries to do everything in one request — complete step, seed next tasks, seed next docs, transition, update supplier, log events — resulting in either oversized transactions (complete.ts) or no transactions (review.ts).

**Future target (Wave 3+):** Split each workflow action into:
1. **Critical atomic phase** (in a transaction): The minimum state change that must be consistent. Returns a "committed intent" to the caller.
2. **Follow-up phase** (retryable, idempotent): Everything else — task seeding, document seeding, notifications, supplier status updates — triggered by the committed state change and safe to retry.

Example for step completion:
```
Transaction: { step.status = completed, tasks.status = completed, process.completedSteps++ }
Follow-up:   { activate next step, seed tasks, seed docs, log events, send emails }
```

The follow-up phase can initially remain synchronous (just moved outside the transaction boundary) and later be migrated to a background job if needed.

> **First wave stories should NOT implement this split.** They should make the existing synchronous paths transactionally correct first. The split is an optimization for after correctness is established.

### 14.2 Principle: Single Engine Path per Operation

**Current:** Document review (`review.ts`) re-implements step transition logic inline, diverging from the engine.

**Target:** All workflow state transitions must go through the engine functions. Routes should be thin handlers that:
1. Validate input and authorization
2. Call a single engine function
3. Return the result

The engine functions should handle all the state machine logic, including the document review path.

> **This IS a first-wave target.** Unifying engine paths is both a correctness fix and an architecture improvement.

### 14.3 Principle: Engine Functions Must Accept and Use `tx`

**Current:** `instantiateWorkflow` ignores the `outerDb` param. `review.ts` calls engine functions with `db`.

**Target:** Every engine function that performs writes must:
- Accept `tx: DbOrTx` as the first parameter
- Use `tx` for ALL reads and writes
- Never open its own transaction (that's the caller's responsibility)

Callers decide the transaction scope. The engine is transaction-agnostic but transaction-compatible.

### 14.4 Principle: Return Rich Context from Engine Functions

**Current:** Engine functions return minimal results. Routes then re-read the DB to get context for event logging.

**Target:** Engine functions should return all the context needed by the caller, including:
- Step names, step orders
- Process status
- Whether the process completed
- Next step name (if activated)
- Entity type and ID (for event logging)

This eliminates the 3-8 extra queries per mutation.

> **This is a Wave 3 target.** Not urgent. Can be addressed when the event logging overhead becomes a measured problem, or opportunistically when engine functions are already being modified for correctness.

### 14.5 Principle: CAS Guards on Every State Transition

**Current:** `complete.ts` uses CAS correctly. `review.ts` does not.

**Target:** Every state transition must use a WHERE clause that includes the expected current status:
- `UPDATE stepInstance SET status='completed' WHERE status='active'`
- `UPDATE stepInstance SET status='validated' WHERE status='awaiting_validation'`
- `UPDATE taskInstance SET status='completed' WHERE status='pending'`
- `UPDATE processInstance SET status='complete' WHERE status='in_progress'`

This is already done in the engine functions — it just needs to be enforced in all paths.

> **This IS a first-wave target.** CAS is a correctness requirement.

### 14.6 Principle: Explicit Recovery for Known Partial-Failure States

**Current:** `workflow-health` detects problems but doesn't fix them.

**Target (two phases):**

**Phase 1 (Wave 2):** Add a "workflow repair" admin function that can:
1. Detect a stuck process (no active step, not complete)
2. Determine the intended next step based on `completedSteps` and step ordering
3. Re-run the transition (idempotent task/doc seeding means this is safe)
4. Log the repair as a workflow event

This should be a **manual admin action** — an endpoint or CLI command.

**Phase 2 (Wave 3+):** If manual repair proves insufficient or too frequent, add automated periodic reconciliation. This is not needed until the manual repair story reveals the actual frequency and nature of failures in production.

### 14.7 What This Architecture is NOT

- **Not a BPM engine.** No BPMN, no complex routing, no parallel branches, no subprocess embedding.
- **Not event-sourced.** The current direct-mutation model is simpler and appropriate for the product stage. The `workflowEvent` table is an audit log, not an event store.
- **Not queue-dependent for correctness.** BullMQ is used for emails only. Workflow state correctness must not depend on Redis availability.
- **Not microserviced.** The engine is a library within the API monolith. This is correct for the current scale.

**The current workflow model is conceptually sound. The product does not need a workflow redesign. It needs the existing engine hardened so that every mutation path is as safe, consistent, and recoverable as the best path already is.**

---

## 15. Recommended Story Sequencing Guidance

This section provides the Scrum Master with a concrete sequencing recommendation for stories derived from this report. Stories within a wave can be parallelized. Waves should be executed in order.

### Wave 1 — Correctness Hardening (Do First)

**Goal:** Make every workflow mutation path transactionally correct, eliminate duplicated engine logic, enforce CAS guards everywhere.

| Story Scope | Weaknesses Addressed | Key Acceptance Criteria |
|---|---|---|
| **Document review transaction safety + engine unification** | C1, C3, P3, P5 | `review.ts` wrapped in `db.transaction()`. All state transitions delegated to engine function(s). CAS guards on step status. Concurrent reviews handled safely. Double-write eliminated. N+1 pattern batched (co-located fix). |
| **Form submit transaction safety** | C2 | `submit.ts` wraps form update + `completeStep()` in single `db.transaction()`. `completeStep` receives `tx`. Dead-state (form submitted, step active) eliminated. `verifyTaskAssignment` enforced. |

> **Wave 1 is the minimum viable hardening.** These two stories close the most dangerous correctness gaps in the system. They should be completed before any other workflow work.

### Wave 2 — Operational Resilience (Do Next)

**Goal:** Add recovery for partial failures and guards against domain-level inconsistencies.

| Story Scope | Weaknesses Addressed | Key Acceptance Criteria |
|---|---|---|
| **Partial-failure recovery (manual/admin)** | C4 | Admin endpoint detects and repairs known partial-failure states (see Section 9.3). Manual trigger only — no automated background job. Repairs logged as workflow events. |
| **Workflow-aware supplier/domain guards** | C5, C6, C7 | Supplier status PATCH warns/blocks if active workflows exist. Supplier DELETE blocked if active processes. Supplier status DELETE blocked if referenced by workflow type. |

### Wave 3 — Performance & Composability Cleanup (Do When Convenient)

**Goal:** Reduce unnecessary DB overhead and improve engine composability. None of these are correctness issues.

| Story Scope | Weaknesses Addressed | Key Acceptance Criteria |
|---|---|---|
| **Reduce event logging re-reads** | P1 | Engine functions return rich context. Routes stop re-reading DB for event log fields. 3-8 fewer queries per mutation. |
| **Optimize transition query count** | P4 | `workflowTemplateId` passed as parameter. Current+all steps fetched in single query. 2-3 fewer queries per transition. |
| **Fix `instantiateWorkflow` transaction parameter contract** | P2 | `instantiateWorkflow` uses provided `outerDb`. No new transaction opened if caller provides `tx`. |

### Sequencing Constraints

- **Wave 1 must complete before Wave 2 begins.** Recovery stories assume the mutation paths are already correct.
- **Wave 2 stories can be parallelized** — recovery and domain guards are independent.
- **Wave 3 stories can be done in any order** and can be interleaved with other product work.
- **No story should introduce async/deferred follow-up patterns.** That is a future evolution (Section 14.1), not part of Waves 1-3.

---

## Appendix A: DB Schema Summary for Workflow Tables

| Table | Purpose | Key Status Values | Soft Delete |
|---|---|---|---|
| `process_instance` | Workflow execution instance | `in_progress`, `pending_validation`, `declined_resubmit`, `complete`, `cancelled` | Yes |
| `step_instance` | Step within a process | `pending`, `active`, `completed`, `blocked`, `skipped`, `awaiting_validation`, `validated`, `declined` | Yes |
| `task_instance` | Assignable work item for a step | `pending`, `completed` (outcomes: `submitted`, `approved`, `declined`, `auto_closed`) | Yes |
| `workflow_step_document` | Required document for a document step | `pending`, `uploaded`, `approved`, `declined` | Yes |
| `form_submission` | Dynamic form entry linked to a step | `draft`, `submitted`, `archived` | Yes |
| `comment_thread` | Comments on steps/forms | N/A | Yes |
| `workflow_event` | Audit log of workflow actions | N/A (immutable, append-only) | No |
| `workflow_template` | Template definition | `draft`, `published`, `archived` | Yes |
| `workflow_step_template` | Step definition within a template | N/A | Yes |
| `document_template` | Required documents definition | `draft`, `published`, `archived` | Yes |
| `workflow_type` | Links templates to supplier statuses | N/A | No |
| `supplier_status` | Custom supplier lifecycle statuses | N/A | No |

## Appendix B: File Inventory

### Workflow Engine Core (`apps/api/src/lib/workflow-engine/`)
- `instantiate-workflow.ts`
- `complete-step.ts`
- `transition-to-next-step.ts`
- `return-to-previous-step.ts`
- `approve-validation-task.ts`
- `create-tasks-for-step.ts`
- `create-validation-tasks.ts`
- `seed-step-documents.ts`

### Workflow Routes (`apps/api/src/routes/workflows/`)
- `instantiate.ts`
- `my-tasks.ts`, `my-tasks-count.ts`
- `supplier-processes.ts`
- `audit-log.ts`
- `processes/list.ts`, `processes/get.ts`, `processes/events.ts`, `processes/send-reminder.ts`
- `comments/create.ts`, `comments/get-by-step.ts`
- `steps/get.ts`, `steps/complete.ts`
- `steps/documents/list.ts`, `steps/documents/upload.ts`, `steps/documents/review.ts`, `steps/documents/view.ts`

### Form Routes (`apps/api/src/routes/form-submissions/`)
- `create-draft.ts`, `submit.ts`, `get.ts`, `list.ts`, `by-supplier.ts`

### Services
- `services/workflow-event-logger.ts`
- `services/email-notification.service.ts`
- `services/email-job-processor.service.ts`
- `services/resend-email.service.ts`
- `services/reviewer-assignment.service.ts`
- `queue/email-queue.ts`, `queue/email-worker.ts`, `queue/redis-connection.ts`

### Supporting
- `lib/rbac/entity-authorization.ts`
- `lib/validation/form-answer-validation.ts`
- `routes/admin/workflow-types.ts`, `routes/admin/supplier-statuses.ts`, `routes/admin/workflow-health.ts`
- `routes/suppliers/detail.ts` (PATCH status, DELETE)
