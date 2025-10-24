# Technical Debt Log

This document tracks known technical debt, performance optimizations, and future improvements across the Supplex platform.

## Status Legend
- 🔴 **High Priority** - Should be addressed soon
- 🟡 **Medium Priority** - Plan to address in next sprint
- 🟢 **Low Priority** - Nice to have, address when convenient
- ✅ **Resolved** - Completed

---

## Database & Schema

### 🟡 Partial Index Optimization - qualification_stages
- **Story**: 2.1 - Qualification Workflow Data Model & Foundation
- **Created**: 2025-10-24
- **Priority**: Medium
- **Severity**: Low Impact
- **Status**: Open

**Description**:
The `idx_qualification_stages_assigned_to_pending` index in the migration file is missing the `WHERE status = 'Pending'` clause due to a known Drizzle Kit limitation (v0.30.x). The schema definition correctly specifies the partial index, but the generated migration doesn't include the WHERE clause.

**Impact**:
- Index still works but isn't optimized for the common "pending tasks" query pattern
- Larger index size (includes all rows instead of just pending)
- Slightly slower query performance for user task lists
- Non-blocking - system functions correctly

**Current State**:
```sql
-- Current (in migration line 280):
CREATE INDEX IF NOT EXISTS "idx_qualification_stages_assigned_to_pending" 
ON "qualification_stages" ("assigned_to");
```

**Desired State**:
```sql
-- Optimized version:
CREATE INDEX IF NOT EXISTS "idx_qualification_stages_assigned_to_pending" 
ON "qualification_stages" ("assigned_to") 
WHERE status = 'Pending';
```

**Resolution Options**:
1. **Before Production Deployment**: Manually edit migration file line 280 before applying to production database
2. **Next Migration**: Generate new migration with corrected index (DROP old, CREATE new with WHERE clause)
3. **Manual Database Update**: Run ALTER INDEX command directly on production database
4. **Wait for Drizzle Kit**: Update to future version that supports partial indexes correctly

**Recommendation**: Apply manual fix before production deployment (Option 1). This is a one-line change that provides immediate performance benefit.

**References**:
- Migration: `packages/db/migrations/0000_quiet_stone_men.sql:280`
- Schema: `packages/db/src/schema/qualification-stages.ts:75-77`
- QA Gate: `docs/qa/gates/2.1-qualification-workflow-data-model-foundation.yml`

---

## Future Enhancements

### 🟢 Runtime Validation with Zod Schemas
- **Story**: 2.1 - Qualification Workflow Data Model & Foundation
- **Created**: 2025-10-24
- **Priority**: Low
- **Status**: Open

**Description**:
Add Zod schemas to `packages/types` for runtime validation at API boundaries. Currently, we have TypeScript interfaces but no runtime validation schemas for the qualification workflow entities.

**Benefits**:
- Enhanced type safety at API boundaries
- Better error messages for invalid data
- Runtime validation of enum values
- Consistent validation across frontend and backend

**Effort**: Medium (4-8 hours)

**Files to Update**:
- `packages/types/src/models/qualification-workflow.ts`
- `packages/types/src/models/qualification-stage.ts`
- `packages/types/src/models/document-checklist.ts`
- `packages/types/src/models/workflow-document.ts`

**References**:
- QA Gate: `docs/qa/gates/2.1-qualification-workflow-data-model-foundation.yml`

---

### 🟢 Database-Level CHECK Constraints for Enums
- **Story**: 2.1 - Qualification Workflow Data Model & Foundation
- **Created**: 2025-10-24
- **Priority**: Low
- **Status**: Open

**Description**:
Add database-level CHECK constraints to enforce valid enum values at the database layer. This is a defense-in-depth strategy.

**Current Protection**:
- TypeScript enum types (compile-time)
- RLS policies (database-level tenant isolation)
- Application-level validation

**Benefits**:
- Additional layer of data integrity protection
- Prevents invalid data from external sources
- Database-enforced business rules

**Effort**: Low (2-4 hours)

**Example**:
```sql
ALTER TABLE qualification_workflows
ADD CONSTRAINT check_workflow_status 
CHECK (status IN ('Draft', 'Stage1', 'Stage2', 'Stage3', 'Approved', 'Rejected'));
```

**Note**: Current RLS + application-level validation is sufficient for current implementation. This is truly optional.

**References**:
- Schema: `packages/db/src/schema/qualification-workflows.ts`
- Schema: `packages/db/src/schema/qualification-stages.ts`

---

### 🟢 JSONB Indexing Strategy
- **Story**: 2.1 - Qualification Workflow Data Model & Foundation
- **Created**: 2025-10-24
- **Priority**: Low
- **Status**: Monitoring

**Description**:
Monitor JSONB query patterns for `qualification_stages.attachments` and `document_checklists.required_documents`. Add GIN indexes if deep nested queries become common.

**Current State**:
- No JSONB indexes (appropriate for initial implementation)
- JSONB fields used for flexible metadata storage

**When to Add Indexes**:
- If querying deeply nested JSONB data becomes common
- If performance monitoring shows slow JSONB queries
- If using JSONB operators frequently (@>, ?, ?&, ?|)

**Example**:
```sql
-- Add if needed:
CREATE INDEX idx_stage_attachments_gin 
ON qualification_stages USING GIN (attachments);

CREATE INDEX idx_checklist_documents_gin 
ON document_checklists USING GIN (required_documents);
```

**Effort**: Trivial (30 minutes)

**References**:
- Schema: `packages/db/src/schema/qualification-stages.ts:59`
- Schema: `packages/db/src/schema/document-checklists.ts:43`

---

## Template

### 🔴/🟡/🟢 [Title]
- **Story**: [Story Number] - [Story Title]
- **Created**: [YYYY-MM-DD]
- **Priority**: High/Medium/Low
- **Status**: Open/In Progress/Resolved
- **Estimated Effort**: [Time estimate]

**Description**:
[Detailed description of the technical debt item]

**Impact**:
[What is affected and how]

**Resolution Options**:
[List of possible ways to address this]

**References**:
[Links to related files, stories, or documentation]

---

*Last Updated: October 24, 2025*

