-- Migration: Course Correct Task Model - Remove task_template, Update task_instance
-- Story: 2.2.5.1 - Course Correction for Tasks
-- Date: 2026-01-24
-- 
-- RATIONALE:
-- Task templates add unnecessary complexity for MVP. Task configuration belongs
-- at the workflow step level, not as standalone reusable library. Tasks should be
-- simple to-do warnings created when a step starts.
--
-- CHANGES:
-- 1. DROP task_template table entirely (no more reusable task library)
-- 2. REMOVE task_template_id from task_instance (no template reference)
-- 3. REMOVE assigned_to column (replaced with flexible assignee system)
-- 4. ADD assignee_type, assignee_role, assignee_user_id (flexible assignment)
-- 5. ADD completion_time_days (from workflow step config)
-- 6. RENAME due_date to due_at (consistency)
-- 7. UPDATE step_instance_id to NOT NULL (all tasks belong to a step)
-- 8. UPDATE indexes (remove old, add new for assignee system)
-- 9. SIMPLIFY status values (only 'open' and 'completed')

-- Step 1: Drop the task_template table and all its dependencies
-- CASCADE will handle any remaining foreign key references
DROP TABLE IF EXISTS task_template CASCADE;

-- Step 2: Remove old columns from task_instance
ALTER TABLE task_instance DROP COLUMN IF EXISTS task_template_id;
ALTER TABLE task_instance DROP COLUMN IF EXISTS assigned_to;

-- Step 3: Rename due_date to due_at for consistency
ALTER TABLE task_instance RENAME COLUMN due_date TO due_at;

-- Step 4: Add new columns for flexible assignee system
-- assignee_type determines if task is assigned to a role or specific user
ALTER TABLE task_instance ADD COLUMN assignee_type VARCHAR(50) NOT NULL DEFAULT 'user';

-- assignee_role stores the role name when assignee_type = 'role'
-- Examples: 'procurement_manager', 'quality_manager', 'admin'
ALTER TABLE task_instance ADD COLUMN assignee_role VARCHAR(50);

-- assignee_user_id references specific user when assignee_type = 'user'
-- RESTRICT prevents deleting users assigned to tasks (audit trail)
ALTER TABLE task_instance ADD COLUMN assignee_user_id UUID REFERENCES users(id) ON DELETE RESTRICT;

-- Step 5: Add completion_time_days for due date calculation
-- This value comes from workflow step configuration
-- Nullable because not all tasks have deadlines
ALTER TABLE task_instance ADD COLUMN completion_time_days INTEGER;

-- Step 6: Make step_instance_id NOT NULL
-- All tasks must belong to a specific step now (no process-level tasks)
-- First, we need to handle any existing NULL values (shouldn't be any in development)
DELETE FROM task_instance WHERE step_instance_id IS NULL;
ALTER TABLE task_instance ALTER COLUMN step_instance_id SET NOT NULL;

-- Step 7: Drop old indexes
DROP INDEX IF EXISTS idx_task_instance_tenant_assigned_status;
DROP INDEX IF EXISTS idx_task_instance_tenant_due_date;

-- Step 8: Create new indexes for optimized task queries

-- Index for role-based task assignment queries
-- Query pattern: "Show all open tasks for users with role X in tenant Y"
CREATE INDEX idx_task_instance_tenant_assignee_status 
    ON task_instance(tenant_id, assignee_type, assignee_role, status) 
    WHERE status = 'open' AND deleted_at IS NULL;

-- Index for user-specific task assignment queries  
-- Query pattern: "Show all open tasks assigned to user X in tenant Y"
CREATE INDEX idx_task_instance_tenant_assignee_user_status 
    ON task_instance(tenant_id, assignee_user_id, status) 
    WHERE assignee_type = 'user' AND status = 'open' AND deleted_at IS NULL;

-- Recreate due_at index with new column name
-- Query pattern: "Show all overdue open tasks in tenant X"
CREATE INDEX idx_task_instance_tenant_due_at 
    ON task_instance(tenant_id, due_at) 
    WHERE status = 'open' AND deleted_at IS NULL;

-- Step 9: Update existing task_instance records to use new status values
-- 'pending' → 'open'
-- 'in_progress' → 'open' (tasks are either open or completed, no in-progress state)
-- 'cancelled' → 'open' (if task was cancelled, it should be deleted, not kept as cancelled)
-- 'completed' → 'completed' (unchanged)
UPDATE task_instance 
SET status = 'open' 
WHERE status IN ('pending', 'in_progress', 'cancelled');

-- Step 10: Add comment explaining the assignee system
COMMENT ON COLUMN task_instance.assignee_type IS 
'Determines assignment strategy: "role" for all users with a role, "user" for specific user';

COMMENT ON COLUMN task_instance.assignee_role IS 
'Role name when assignee_type = "role". All users with this role can see and complete the task.';

COMMENT ON COLUMN task_instance.assignee_user_id IS 
'User ID when assignee_type = "user". Only this specific user can see and complete the task.';

COMMENT ON COLUMN task_instance.completion_time_days IS 
'Number of days to complete the task (from workflow step config). Used to calculate due_at.';

-- Migration complete!
-- Next steps:
-- 1. Verify task_template table no longer exists: \d task_template
-- 2. Verify task_instance has new columns: \d task_instance
-- 3. Verify indexes exist: SELECT indexname FROM pg_indexes WHERE tablename = 'task_instance';
-- 4. Test creating tasks with role-based and user-based assignment

