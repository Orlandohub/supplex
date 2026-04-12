# Workflow Execution Flow

> **Story:** 2.2.8 - Workflow Execution Engine  
> **Date:** January 26, 2026  
> **Status:** Active
>
> **⚠️ Stale References (Story 2.2.23):** This document references `multi_approver`. Multi-approver was removed in Story 2.2.18 (replaced by auto-validation in Story 2.2.15). The actual engine code in `apps/api/src/lib/workflow-engine/` is the source of truth.

## Overview

This document describes the state machine and execution flow for the dynamic workflow engine. It covers process instantiation, step transitions, approval logic, and decline/return flows.

## Process Instance State Machine

### States

```
┌──────────┐
│  active  │  Initial state when workflow is instantiated
└────┬─────┘
     │
     ├─────────────┐
     │             │
     ▼             ▼
┌────────────┐  ┌───────────┐
│ completed  │  │ cancelled │  Terminal states
└────────────┘  └───────────┘
```

### State Transitions

| From State | To State | Trigger | Description |
|-----------|----------|---------|-------------|
| `active` | `completed` | Last step completed | All steps successfully completed |
| `active` | `cancelled` | Admin action | Process manually cancelled |

### Process Lifecycle

1. **Instantiation**
   - Admin selects published workflow template
   - System creates `process_instance` record with status = `active`
   - System creates all `step_instance` records:
     - First step (step_order = 1): status = `active`
     - All other steps: status = `blocked`
   - System creates task(s) for active step based on approver configuration

2. **Execution**
   - Steps progress sequentially through the workflow
   - Each step must complete before next step activates
   - Steps can be declined, causing workflow to return to previous step

3. **Completion**
   - When final step completes, process status → `completed`
   - Completed timestamp recorded
   - All associated tasks marked complete

4. **Cancellation** (Future Enhancement)
   - Admin can manually cancel active processes
   - All open tasks are cancelled
   - Process marked with cancellation reason in metadata

## Step Instance State Machine

### States

```
                    ┌─────────┐
                    │ blocked │  Created but waiting for previous steps
                    └────┬────┘
                         │
                         ▼
         ┌────────┐    ┌────────┐    ┌───────────┐
    ┌────│declined│◄───│ active │───►│ completed │
    │    └────────┘    └────┬───┘    └───────────┘
    │                       │
    │                       ▼
    │                  ┌─────────┐
    │                  │ skipped │  (Future: conditional logic)
    │                  └─────────┘
    │
    │ (decline_returns_to_step_offset)
    │
    └──► (returns to previous step → active)
```

### State Transitions

| From State | To State | Trigger | Description |
|-----------|----------|---------|-------------|
| `blocked` | `active` | Previous step completes | Step becomes ready for action |
| `active` | `completed` | User completes step | Step successfully finished |
| `active` | `declined` | Validator declines | Step requires revision |
| `declined` | `active` | Workflow returns | Previous step reactivated for updates |
| `active` | `skipped` | Conditional logic (future) | Step not required |
| `blocked` | `skipped` | Conditional logic (future) | Step not required |

### Step Lifecycle

#### 1. Form Fill-Out Steps (`form_action_mode = 'fill_out'`)

```
1. User receives task assignment
2. User opens form in editable mode
3. User fills form fields
4. User submits form
5. Form submission saved to database
6. Step status → completed
7. Workflow transitions to next step
```

#### 2. Form Validation Steps (`form_action_mode = 'validate'`)

```
1. Validator receives task assignment
2. Validator views form in read-only mode
3. Validator reviews submitted data
4. Validator chooses action:
   
   APPROVE PATH:
   - Validator clicks "Approve"
   - Step status → completed
   - Workflow transitions to next step
   
   DECLINE PATH:
   - Validator clicks "Decline"
   - System requires comment
   - Comment saved to comment_thread
   - Step status → declined
   - Workflow returns to previous step (offset configurable)
   - Previous step status → active
   - New tasks created for previous step
```

#### 3. Document Upload Steps (`document_action_mode = 'upload'`)

```
1. User receives task assignment
2. User uploads required documents
3. Documents saved with step_instance_id reference
4. User submits
5. Step status → completed
6. Workflow transitions to next step
```

#### 4. Document Validation Steps (`document_action_mode = 'validate'`)

```
1. Validator receives task assignment
2. Validator views documents in read-only mode
3. Validator reviews documents
4. Validator chooses action:
   
   APPROVE PATH:
   - Validator clicks "Approve"
   - Step status → completed
   - Workflow transitions to next step
   
   DECLINE PATH:
   - Validator clicks "Decline"
   - System requires comment
   - Comment saved to comment_thread
   - Step status → declined
   - Workflow returns to previous step
   - User can re-upload documents and respond
```

## Multi-Approver Logic

### Single Approver (`multi_approver = false`)

```
1. System creates ONE task_instance
2. Assigned user receives task
3. User completes/approves/declines
4. Step immediately transitions based on action
```

### Multiple Approvers (`multi_approver = true`)

```
1. System creates MULTIPLE task_instance records (one per approver)
2. Each approver receives their task
3. Approvers work independently
4. System tracks completion count
5. When count >= approver_count threshold:
   - Step status → completed
   - Remaining open tasks auto-cancelled
   - Workflow transitions to next step
```

**Example:**
- Step requires 3 approvals (`approver_count = 3`)
- System creates 5 task instances (5 approvers configured)
- Approvers A, B, C approve (count = 3)
- Threshold met → step completes
- Tasks for approvers D, E are auto-cancelled

## Decline and Return Flow

### Configuration

- Each step template defines `decline_returns_to_step_offset` (default: 1)
- Offset determines how many steps back to return
- Example:
  - Step 3 declined with offset = 1 → returns to Step 2
  - Step 4 declined with offset = 2 → returns to Step 2

### Decline Process

```
CURRENT STATE:
Step 1: completed
Step 2: completed
Step 3: active (being validated)
Step 4: blocked
Step 5: blocked

VALIDATOR DECLINES STEP 3:
1. Validator provides decline comment (required)
2. Comment saved to comment_thread:
   - process_instance_id = current process
   - step_instance_id = Step 3
   - entity_type = 'form' or 'document'
   - comment_text = validator's reason
3. Step 3 status → declined
4. Calculate target step: 3 - offset (default 1) = Step 2
5. Step 2 status → active
6. New tasks created for Step 2 assignees

NEW STATE:
Step 1: completed
Step 2: active (reactivated)
Step 3: declined (preserved for audit)
Step 4: blocked
Step 5: blocked
```

### Response and Resubmission

```
1. Original user receives notification
2. User views decline comment in workflow UI
3. User updates form/documents
4. User responds to comment (threaded)
5. User resubmits
6. Step 2 status → completed
7. System checks if Step 3 can reactivate:
   - If Step 3 is next in sequence → status = active
   - Create new tasks for Step 3
8. Workflow continues forward
```

## Task Instance Lifecycle

### States

```
┌──────┐     (user completes)     ┌───────────┐
│ open │─────────────────────────►│ completed │
└──────┘                           └───────────┘
```

### Task Creation

**When:** Step becomes `active`

**Process:**
```typescript
function createTasksForStep(stepInstance, stepTemplate) {
  if (!stepTemplate.multiApprover) {
    // Single task
    createTask({
      stepInstanceId: stepInstance.id,
      assigneeType: stepTemplate.assigneeType,
      assigneeRole: stepTemplate.assigneeRole,
      assigneeUserId: stepTemplate.assigneeUserId,
      status: 'open'
    });
  } else {
    // Multiple tasks (one per approver)
    const approvers = getStepApprovers(stepTemplate.id);
    for (const approver of approvers) {
      createTask({
        stepInstanceId: stepInstance.id,
        assigneeType: approver.approverType,
        assigneeRole: approver.approverRole,
        assigneeUserId: approver.approverUserId,
        status: 'open'
      });
    }
  }
}
```

### Task Completion

**Single Approver:**
```
1. User completes task
2. Task status → completed
3. Step status → completed
4. Workflow transitions to next step
```

**Multi-Approver:**
```
1. User completes their task
2. Task status → completed
3. Count completed tasks for step
4. If count >= threshold:
   - Step status → completed
   - Cancel remaining tasks
   - Workflow transitions
5. Else:
   - Wait for more approvals
```

## Comment Threading

### Use Cases

1. **Decline Reasons:** Validator explains why work needs revision
2. **Responses:** Original user addresses concerns
3. **Discussion:** Multiple back-and-forth exchanges

### Thread Structure

```
Comment 1 (parent_comment_id = null)
├─ Reply 1.1 (parent_comment_id = Comment 1)
│  └─ Reply 1.1.1 (parent_comment_id = Reply 1.1)
└─ Reply 1.2 (parent_comment_id = Comment 1)

Comment 2 (parent_comment_id = null)
└─ Reply 2.1 (parent_comment_id = Comment 2)
```

### Comment Storage

```typescript
{
  id: UUID,
  tenantId: UUID,
  processInstanceId: UUID,
  stepInstanceId: UUID,
  entityType: 'form' | 'document',
  parentCommentId: UUID | null,
  commentText: string,
  commentedBy: UUID,
  createdAt: timestamp
}
```

## Tenant Isolation

All runtime records respect tenant boundaries:

```sql
-- Every query includes tenant filter
SELECT * FROM process_instance 
WHERE tenant_id = $1 AND id = $2;

SELECT * FROM step_instance 
WHERE tenant_id = $1 AND process_instance_id = $2;

SELECT * FROM task_instance 
WHERE tenant_id = $1 AND assignee_user_id = $2;

SELECT * FROM comment_thread 
WHERE tenant_id = $1 AND step_instance_id = $2;
```

**Isolation Guarantees:**
- Users can only see workflows in their tenant
- API endpoints validate tenant_id on every query
- Foreign keys enforce CASCADE delete at tenant level
- Indexes start with tenant_id for performance

## Error Handling

### Invalid State Transitions

```typescript
// Attempting to complete a blocked step
if (step.status !== 'active') {
  throw new Error('Step is not active');
}

// Attempting to complete without permission
if (!userIsAssignedToStep(user, step)) {
  throw new Error('User is not assigned to this step');
}
```

### Missing Dependencies

```typescript
// Attempting to complete form step without submission
if (stepTemplate.formActionMode === 'fill_out') {
  const submission = await getFormSubmission(stepInstanceId);
  if (!submission) {
    throw new Error('Form must be submitted before completing step');
  }
}
```

### Tenant Boundary Violations

```typescript
// Attempting cross-tenant access
const process = await db
  .select()
  .from(processInstance)
  .where(and(
    eq(processInstance.id, processId),
    eq(processInstance.tenantId, user.tenantId)
  ));

if (!process) {
  throw new Error('Process not found or access denied');
}
```

## Performance Considerations

### Query Optimization

```sql
-- Use composite indexes for common queries
CREATE INDEX idx_step_instance_tenant_process_status 
    ON step_instance(tenant_id, process_instance_id, status);

-- Use partial indexes for active records
CREATE INDEX idx_task_instance_tenant_assignee_open 
    ON task_instance(tenant_id, assignee_user_id) 
    WHERE status = 'open' AND deleted_at IS NULL;
```

### Caching Strategy

- Cache workflow templates (published versions are immutable)
- Cache step templates (rarely change)
- Do NOT cache runtime instances (frequently updated)

## Future Enhancements

1. **Parallel Steps:** Steps that can execute simultaneously
2. **Conditional Steps:** Skip steps based on runtime data
3. **Dynamic Approvers:** Calculate approvers at runtime
4. **Escalation:** Automatic reassignment after deadline
5. **Sub-Workflows:** Nested workflow execution
6. **Workflow Versioning:** Upgrade running processes to new template versions

## Related Documentation

- [Workflow Engine Schema](./workflow-engine-schema.md)
- [Workflow Template Schema](./workflow-template-schema.md)
- [Task Instance Schema](./task-instance-schema.md)
- [API Specification](./api-specification.md)
- [Story 2.2.8](../stories/2.2.8.story.md)

---

*Last Updated: January 26, 2026*

