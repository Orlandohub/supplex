---
name: Architecture Assessment Report
overview: Revised architecture assessment covering correctness, security, concurrency, performance, and maintainability of Dynamic Forms, Documents, and Workflow Engine for senior architect review.
todos: []
isProject: false
---

# Revised Architecture Assessment Report: Dynamic Forms, Documents, and Workflows

---

## 1. Agreement with Original Assessment

The original report correctly identified the most critical structural problem: **non-atomic multi-table writes in the workflow engine**. The findings on form-submit-then-step-complete inconsistency, tenant isolation without RLS, client/server validation drift, and live template reads vs runtime snapshots all hold and remain valid.

However, the original report was **materially incomplete** in several areas: it did not assess concurrency or idempotency risks at all, underweighted authorization gaps (focusing only on tenant isolation), ignored storage/document security details, lacked any observability analysis, and only superficially covered performance.

---

## 2. What Was Missing or Underweighted

- **Concurrency**: The single highest-density bug surface in the codebase. No step-level or task-level locking exists anywhere. Two validators can race on the same step, causing double transitions or phantom tasks.
- **Authorization within a tenant**: The original report treated "tenant isolation" as the security story. In practice, the more pressing risk is **same-tenant over-permissioning**: supplier users can access internal workflow details, process detail endpoints expose all tasks/comments to any tenant user, and document download has no ownership check beyond tenant match.
- **Runtime invariants**: The code does not enforce single-active-step, does not validate `current_step_instance_id` belongs to the process, and does not prevent duplicate task creation.
- **Storage security**: No virus scanning, no magic-byte validation, no RLS on the storage bucket, and document download/view routes have no role or ownership checks.
- **Observability**: Zero structured logging, no correlation IDs, no metrics, no alerting, no mechanism to detect stuck or inconsistent workflows.
- **Performance**: The report noted "deep query chains" but did not quantify DB round-trips (12-25+ per step completion), did not identify the N+1 insert pattern in instantiation, and did not assess list page query complexity.

---

## 3. Revised Top Risks (Ordered by Priority)

### TIER 1 -- Correctness and Security (fix before scaling)

**C1. Concurrent validation approval causes double transitions**
In `[approve-validation-task.ts](apps/api/src/lib/workflow-engine/approve-validation-task.ts)`, two validators approving nearly simultaneously will both: (a) mark their task as completed, (b) re-read all validation tasks, (c) both see `allComplete === true`, (d) both call `transitionToNextStep`. This creates duplicate next-step tasks, corrupts `current_step_instance_id`, and can double-complete the process. There is no `SELECT ... FOR UPDATE`, no optimistic version check, no DB constraint preventing this. This is the single most dangerous concurrency bug in the system.

**C2. Concurrent step completion (duplicate submit)**
`[completeStep](apps/api/src/lib/workflow-engine/complete-step.ts)` checks `step.status !== "active"` but between the read and the subsequent writes, a parallel request can also pass the guard. Both requests then mark the step completed, both create validation tasks (or both transition). The status check is a read-then-write race, not an atomic compare-and-swap.

**C3. Non-atomic workflow state mutations**
All engine operations -- instantiate, complete step, transition, approve validation, decline -- perform 5-25 sequential DB statements without transactions. A crash or error mid-sequence leaves partial state (e.g., step marked completed but no next step activated, or process marked complete but supplier status not updated). The manual rollback in `instantiateWorkflow` (delete process if no steps) does not cover task creation failure or document seeding failure.

**C4. Authorization: supplier users can access internal workflow data**
`GET /workflows/processes/:id` (`[processes/get.ts](apps/api/src/routes/workflows/processes/get.ts)`) returns all steps, all tasks (including internal validator assignments, emails, roles), all comments, and all document review metadata to any authenticated tenant user. The list endpoint correctly scopes supplier users to their supplier's processes, but the detail endpoint does not -- it only checks tenant match. A supplier user who obtains any `processInstanceId` (even for another supplier) can read the full internal workflow state.

**C5. Authorization: document download/view has no ownership check**
`[download.ts](apps/api/src/routes/documents/download.ts)` and `[view.ts](apps/api/src/routes/workflows/steps/documents/view.ts)` generate signed URLs for any document in the tenant. No check on supplier ownership, workflow assignment, or user role. A supplier user with one document UUID can obtain signed URLs for any other tenant document.

**C6. Authorization: `requirePermission` middleware is defined but unused**
The `PermissionAction` enum and `PERMISSION_MATRIX` in `[permissions.ts](packages/types/src/models/permissions.ts)` define granular permissions (e.g., `VIEW_OWN_SUPPLIER` for supplier users). However, `requirePermission()` is **never called in any production route**. Authorization is either `authenticate`-only (most routes) or ad-hoc inline role checks. The RBAC matrix is effectively dead code.

**C7. No virus/malware scanning on file uploads**
Both upload routes ([supplier](apps/api/src/routes/documents/upload.ts), [workflow step](apps/api/src/routes/workflows/steps/documents/upload.ts)) accept files and store them immediately. The supplier upload has a `TODO` comment for ClamAV; the workflow upload has no mention. MIME validation trusts the client-provided `Content-Type` header with no magic-byte verification. A malicious file uploaded by a supplier user is served to internal reviewers via signed URL.

**C8. Tenant isolation relies entirely on application code**
Every query manually adds `eq(table.tenantId, tenantId)`. Supabase storage bucket has `public: false` but **no RLS policies** (explicitly deferred to "Phase 2" per `[storage-bucket-setup.sql](packages/db/storage-bucket-setup.sql)`). The storage path embeds `tenantId` but nothing prevents the service-role client from generating a signed URL for a path belonging to another tenant if the application-layer check is missed.

### TIER 2 -- Concurrency and Idempotency (high-probability bugs under load)

**R1. Duplicate task creation on re-activation**
When a validation decline resets a step to `active` in `[complete.ts](apps/api/src/routes/workflows/steps/complete.ts)` (line 374), `createTasksForStep` is called without checking if pending tasks already exist for that step. If the decline is processed twice (race or retry), duplicate action tasks are created. There is no unique constraint on `(step_instance_id, task_type, status)`.

**R2. Duplicate validation task creation**
`[createValidationTasks](apps/api/src/lib/workflow-engine/create-validation-tasks.ts)` inserts one task per approver role in a loop with no idempotency check. If `completeStep` is called twice concurrently (see C2), validation tasks are duplicated. When the system later counts completed validation tasks, the count is wrong and the "all complete" check may never trigger (or trigger prematurely).

**R3. Document upload races with review**
A supplier can upload a new file to a `workflow_step_document` slot while a reviewer is batch-approving documents in `[review.ts](apps/api/src/routes/workflows/steps/documents/review.ts)`. The upload route checks `wsd.status !== "approved"` but does not check `awaiting_validation`. A supplier could replace a document that is currently being reviewed, and the reviewer's approval would apply to a different file than the one they saw.

**R4. Stale UI actions against changed workflow state**
No API endpoint returns a version token or `updated_at` value that the client could use for optimistic concurrency. A user viewing a step in `active` state can click "Submit" after another user has already completed or declined the step. The server check on `step.status` is the only guard, but due to C2, even that check is not atomic.

**R5. Event logger duplicates and losses**
`logWorkflowEvent()` is fire-and-forget and not idempotent. If a route retries (client timeout + retry), the event is logged again. If the logger fails, the event is silently lost. Events are not correlated to the operation that produced them.

### TIER 3 -- Performance and Scalability

**P1. Workflow list page: correlated subqueries per row**
`[processes/list.ts](apps/api/src/routes/workflows/processes/list.ts)` uses `EXISTS` subqueries against `task_instance` for each filter view (my_work, waiting_supplier, waiting_internal, overdue). Per-row computed fields include `totalStepCount`, `completedStepCount`, pending/overdue task counts -- all as correlated subqueries. With 500+ processes and many tasks, this is quadratic in practice even though it avoids N+1 in the classical sense. Summary aggregation is a separate query. Total: 3-4 round trips per page load.

**P2. Step completion: 12-25+ DB round trips**
A full submit-with-validation-then-transition path executes approximately: 3 route-level reads + 2-5 `completeStep` reads + 2 updates + validation task creation (1 per role) + `transitionToNextStep` (5-6 reads + 2-3 updates + `createTasksForStep` (3-5 reads + 1 insert) + optional `seedStepDocuments` (3-4 reads + 1 insert)). Conservative estimate: **15-25 round trips** for a single step completion. All sequential, no batching.

**P3. Instantiation: N+1 step inserts**
`[instantiateWorkflow](apps/api/src/lib/workflow-engine/instantiate-workflow.ts)` inserts each step in a `for` loop with individual `await db.insert(stepInstance)` calls (line 136-148). A 10-step workflow = 10 individual INSERT round trips. Should be a single batch insert.

**P4. Process detail page: 7-8 sequential queries**
`[processes/get.ts](apps/api/src/routes/workflows/processes/get.ts)` loads process, steps, tasks, step templates, comments, form submissions, workflow step documents, and optionally supplier name -- all as sequential queries (not parallel, not joined). Total: ~8 round trips.

**P5. ILIKE search without trigram indexes**
List routes use `ILIKE '%...%'` on `workflow_name` and `suppliers.name`. Btree indexes do not help leading-wildcard patterns. No `pg_trgm` extension or GIN indexes exist.

**P6. Missing composite index for task-by-step lookups**
Many hot paths query `task_instance` filtered by `step_instance_id + status`. The existing index `idx_task_instance_process_step` leads with `process_instance_id`. A partial index on `(step_instance_id, status) WHERE deleted_at IS NULL` would better serve the validation approval and step completion paths.

### TIER 4 -- Maintainability and Type Safety (tech debt)

**M1. Client/server validation drift**: `FormRenderer.tsx` validateFieldValue() covers number/date/text; server `form-answer-validation.ts` also handles dropdown/multi_select/checkbox. No shared validation module.

**M2. Step status as varchar, not enum**: `step_instance.status` allows arbitrary strings. TS types do not enumerate all runtime values (`awaiting_validation`, `validated`, `declined`).

**M3. `document_type` enum drift**: Workflow uploads write `"workflow_document"` which is not in the shared `DocumentType` enum.

**M4. Heavy `any` usage on JSONB fields**: `validationRules`, `options`, `requiredDocuments`, `validationConfig` all read as untyped JSONB. No runtime Zod parsing on read.

**M5. Duplicate instantiation code**: `lib/workflow-engine/instantiate-workflow.ts` and `routes/workflows/instantiate.ts` contain parallel logic.

**M6. Legacy naming**: `FormTemplateVersionWithStructure` and `form-template-ui.ts` reference the removed versioning model.

**M7. `console.log` in production paths**: `complete-step.ts`, `approve-validation-task.ts`, `create-tasks-for-step.ts`, `create-validation-tasks.ts` all use `console.log`/`console.warn` with no structured format.

**M8. Fire-and-forget audit logging**: `logWorkflowEvent()` uses its own DB handle, catches and swallows errors. Audit trail has no completeness guarantee.

**M9. Stale documentation**: PRD and architecture docs describe removed versioning and multi-approver models.

**M10. Migration numbering collision**: Two files share prefix `0020_`.

---

## 4. New Findings (Not in Original Report)

### 4.1 Runtime Invariants Not Enforced

The system should preserve these invariants but does not enforce them at the DB or application level:

- **Only one active step per process**: No DB constraint. The transition code sets the next step to `active` and updates `current_step_instance_id`, but a concurrent completion (C2) can activate two steps simultaneously.
- `**current_step_instance_id` must belong to the same process**: The FK exists but there is no CHECK constraint validating the step's `process_instance_id` matches. A bug in transition code could point to a step from a different process.
- **No duplicate pending tasks per step+type**: `createTasksForStep` and `createValidationTasks` insert unconditionally. No unique partial index on `(step_instance_id, task_type) WHERE status = 'pending'` exists.
- **Process completion only when all steps are done**: `transitionToNextStep` completes the process when no `stepOrder + 1` exists, but does not verify all prior steps are in a terminal state.
- **Validation state consistency**: After all validation tasks are approved, the step moves to `validated` and then transitions. But the check `validationTasks.every(t => t.status === "completed")` in `approve-validation-task.ts` re-reads after an unguarded write, so two concurrent approvals can both evaluate this as true (C1).

### 4.2 Authorization Boundaries (Detailed)

- **Step completion**: `[complete.ts](apps/api/src/routes/workflows/steps/complete.ts)` checks `authenticate` + tenant. For `approve`/`decline`, it queries for a matching task by user ID or role. For `submit`, there is **no check that the user is the task assignee** -- any tenant user can submit any active step.
- **Document review**: `[review.ts](apps/api/src/routes/workflows/steps/documents/review.ts)` checks `authenticate` + tenant + step in `awaiting_validation`. No check that the user is a designated validator (no task ownership verification).
- **Comments**: No internal/external flag in `comment_thread` schema. All comments for a step are returned to any tenant user, including supplier users. Decline comments (which may contain internal reasoning) are visible to the resubmitter.
- **Supplier process list vs detail gap**: `processes/list.ts` correctly scopes `supplier_user` to `entity_id = their supplierId`. But `processes/get.ts`, `steps/get.ts`, and `steps/documents/list.ts` do not apply this filter. A supplier user who guesses or obtains a process UUID from a different supplier can read the full detail.
- `**GET /suppliers/:id`**: No role check. `supplier_user` has `VIEW_OWN_SUPPLIER` in the permission matrix but the route does not enforce it -- any tenant user can read any supplier's details.
- `**GET /form-submissions/by-supplier/:supplierId`**: `authenticate`-only. No check that a `supplier_user` is requesting their own supplier's submissions.

### 4.3 Storage and Document Security (Detailed)

- **Bucket privacy**: `public: false` in `[storage-bucket-setup.sql](packages/db/storage-bucket-setup.sql)`. Access requires service-role signed URLs. This is correct.
- **No storage-level RLS**: Explicitly deferred to Phase 2. The service-role key bypasses all storage policies. Security depends entirely on application-layer `tenantId` checks before URL generation.
- **Signed URL lifetime**: 300 seconds (5 minutes). Reasonable for download; potentially too long for sensitive documents if a URL is leaked.
- **MIME validation**: Allowlist check on `file.type` (client-provided Content-Type). No server-side magic-byte sniffing. Elysia body schema on the supplier upload route includes `t.File({ type: ALLOWED_MIME_TYPES })` but the workflow upload route uses bare `t.File()` -- the MIME check is manual code only.
- **File size**: 10MB enforced in code and bucket config.
- **No virus scanning**: Both upload routes store files immediately. Supplier upload has a Phase 2 TODO for ClamAV.
- **Document replace after approval**: Correctly blocked. Workflow upload checks `wsd.status === "approved"` and rejects. However, `uploaded` status is not protected -- a file can be replaced before review.
- **Storage object cleanup**: Soft-deleted documents leave orphaned files in storage. No background cleanup job exists.

### 4.4 Observability and Failure Detection

The system currently has **no operational observability infrastructure**:

- **Structured logging**: All logging is `console.log`/`console.warn`/`console.error` with free-form string concatenation. No log levels outside the auth middleware. No JSON-structured output.
- **Correlation IDs**: No request ID is generated or propagated. A step completion that triggers transition, task creation, document seeding, and event logging cannot be correlated across log lines.
- **Metrics**: No application metrics (request latency, error rates, workflow throughput, queue depths, cache hit rates).
- **Alerting**: No mechanism to detect stuck workflows (process `in_progress` with no active step), orphaned tasks (pending with no matching active step), or state mismatches (step `completed` but process still `in_progress`).
- **Operational diagnostics**: No admin endpoint or query to find inconsistent workflow states. The `workflow_event` table is append-only audit, but there is no reconciliation tool that compares events against actual entity states.

**Recommendations:**

- Add a request-scoped correlation ID (middleware) and propagate it through all log calls and event inserts.
- Replace `console.`* with a structured logger (e.g., pino) outputting JSON with `{correlationId, tenantId, processId, stepId, action, durationMs}`.
- Add a periodic health-check query: `SELECT process_instances WHERE status = 'in_progress' AND current_step_instance_id IS NULL` (stuck workflows).
- Add basic Prometheus-compatible counters: workflow_instantiated, step_completed, validation_approved, errors_by_type.
- Consider a dead-letter pattern for failed transitions: if `transitionToNextStep` fails, enqueue a retry job rather than leaving the process in limbo.

---

## 5. Performance-Specific Findings

### DB Design Assessment

The relational model is **fundamentally sound** for the current feature set. The normalized template-to-runtime pattern (template -> sections -> fields, template -> process -> steps -> tasks) is appropriate. The schema is **under-optimized for the query patterns actually used**, not structurally broken.

### Workflow List Page

- **3-4 DB round trips** per page load (main query, count query, optional supplier lookup, summary aggregation).
- Per-row correlated subqueries for step counts, task counts, assignee checks, and overdue flags. At scale (1000+ processes), these become the dominant cost.
- `ILIKE '%..%'` search on `workflow_name` and `suppliers.name` cannot use btree indexes.
- Missing: `pg_trgm` GIN index for search. Consider materialized progress columns on `process_instance` (total_steps, completed_steps) updated on transition rather than computed per query.

### Workflow Detail Page

- **7-8 sequential queries** loading process, steps, tasks (with user joins), step templates, comments, form submissions, workflow step documents, and supplier name.
- All queries are set-based (no N+1), which is good. But they are sequential, not parallel. Running them concurrently with `Promise.all` where there are no dependencies would roughly halve latency.
- Comments, events, and documents grow unbounded per process. No pagination on detail sub-collections.

### Workflow Actions (Step Completion)

- **15-25 DB round trips** for a full submit+transition path. This is the most concerning hot path.
- The `resolveSupplierUser` function alone performs 2-4 queries depending on fallback chain.
- `createTasksForStep` and `createValidationTasks` insert tasks one at a time in loops.
- `transitionToNextStep` completes: queries all steps for the process, finds next by `stepOrder + 1` in JS (not SQL), then runs separate updates and inserts.
- The supplier-status-update chain on process completion is 5 sequential lookups that should be a single joined query.

### Existing Indexes (Adequate for Current Patterns)

The migration history shows a reasonable index set for the main tables:

- `process_instance`: tenant+status+updated_at, tenant+entity, current_step, workflow_template
- `step_instance`: process+order, tenant+assigned+status, step_template
- `task_instance`: tenant+assignee+status (both role and user variants), process+step, tenant+due_at
- `workflow_step_document`: step_instance, tenant+process, unique step+doc_name
- `form_submission`: tenant+status, process, step, submitted_by
- `workflow_event`: tenant+process+time, tenant+time, event_type

### Missing Indexes

- `task_instance(step_instance_id, status)` partial -- hot path for validation approval checks and step completion task updates
- Trigram GIN indexes on `process_instance.workflow_name` and `suppliers.name` for `ILIKE` search
- `step_instance(process_instance_id, status)` partial -- used in list page subqueries for step counts

### Recommended Performance Actions

1. **Wrap step completion in a transaction** (also solves correctness). A single transaction eliminates the need for 15+ separate round trips and allows the DB to batch commits.
2. **Batch step inserts** in `instantiateWorkflow` using a single multi-row INSERT.
3. **Parallelize independent reads** in `processes/get.ts` with `Promise.all`.
4. **Denormalize progress counts** on `process_instance` (total_steps, completed_steps, has_overdue_tasks) updated transactionally on step transitions.
5. **Add missing partial indexes** for task-by-step and step-by-process-status queries.

---

## 6. Recommended Next Actions (Priority Order)

### Phase 1: Correctness (immediate)

1. **Wrap all engine operations in DB transactions.** `completeStep`, `transitionToNextStep`, `instantiateWorkflow`, `approveValidationTask`, and the decline path in `complete.ts` must each run inside `db.transaction()`. This fixes C1, C2, C3, and is the single highest-impact change.
2. **Add `SELECT ... FOR UPDATE` or atomic status transitions.** Inside the transaction, use `UPDATE step_instance SET status = 'completed' WHERE id = :id AND status = 'active' RETURNING` * instead of read-then-write. If the update affects 0 rows, abort (another request already processed it). This fixes the concurrency races.
3. **Add idempotency guards on task creation.** Before inserting tasks, check for existing pending tasks for the same step+type. Alternatively, add a unique partial index on `(step_instance_id, task_type) WHERE status = 'pending'` and handle conflict.

### Phase 2: Security (immediate)

1. **Add entity-level authorization to `processes/get.ts`, `steps/get.ts`, and document routes.** For `supplier_user` role, verify `process.entity_id` matches the user's supplier. For document download/view, verify the requesting user has a legitimate relationship to the document (task assignee, submitter, or internal role).
2. **Add server-side MIME validation** using magic bytes (e.g., `file-type` npm package) in addition to Content-Type header checks.
3. **Add role checks to document review route.** Verify the user has a pending validation task for the step before allowing approve/decline.
4. **Enable Supabase Storage RLS** with tenant-scoped folder policies.

### Phase 3: Observability (short-term)

1. **Introduce structured logging** with pino or similar. Replace all `console.`* calls.
2. **Add request-scoped correlation IDs** in the Elysia middleware, propagated to all log entries and `workflow_event` metadata.
3. **Add a workflow health-check query** (cron or admin endpoint) to detect stuck/inconsistent states.

### Phase 4: Performance (medium-term)

1. **Batch step inserts** in instantiation.
2. **Parallelize independent queries** in process detail page.
3. **Add missing indexes** (task by step+status, trigram for search).
4. **Denormalize progress counters** on `process_instance`.

### Phase 5: Cleanup (ongoing)

1. Consolidate duplicate instantiation logic.
2. Migrate `step_instance.status` to a PG enum.
3. Fix `DocumentType` enum to include `workflow_document`.
4. Remove stale version-related type names.
5. Extract shared validation module for client/server.
6. Add internal/external flag to comment_thread schema.

---

## 7. Findings Downgraded from Original Report

The following items from the original report are valid but should be classified as **cleanup/debt**, not architectural risks:

- **F3 (Legacy naming debt)**: Low-impact cosmetic issue. Not a correctness or security risk.
- **F4 (Answers as text strings)**: Acceptable trade-off for a metadata-driven form system. Common pattern.
- **W4 (Linear-only execution)**: Design decision, not a defect. Appropriate for the current product scope.
- **W8 (Deep query chains)**: Folded into performance section. Will be resolved by transaction wrapping.
- **X2 (Stale documentation)**: Housekeeping. Not blocking.
- **X3 (Migration numbering collision)**: Should be fixed but is not an operational risk.
- **X4 (No shared error types)**: API ergonomics issue, not an architectural risk.
- **D3 (Soft delete without storage cleanup)**: Acceptable for audit retention as long as storage costs are monitored.

---

## 8. Quick Stats

- **31 migrations** (0000-0031, one numbering collision at 0020)
- **26 active schema tables** exported from `packages/db`
- **~50+ indexes** declared across migrations and Drizzle schemas
- **15-25 DB round trips** per step completion (most critical hot path)
- **7-8 sequential queries** per process detail page load
- **0 transactions** in the workflow engine
- **0 production routes** using `requirePermission()` middleware
- **0 structured log calls** (all `console.`*)
- **0 idempotency guards** on task creation
- **0 concurrency controls** (no SELECT FOR UPDATE, no optimistic locking, no atomic CAS)

