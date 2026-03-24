-- Migration: Add task_template and task_instance tables
-- Story: 2.2.5 - Task Template Library and Runtime Task Model (Tenant-Isolated)
-- Description: Creates tables for task templates and runtime task instances

-- ============================================================================
-- TABLE: task_template
-- Purpose: Reusable task definitions per tenant
-- ============================================================================

CREATE TABLE IF NOT EXISTS task_template (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,  -- Internal identifier (unique within tenant)
    title VARCHAR(300) NOT NULL, -- Display title for the task
    description TEXT,            -- Detailed task instructions
    default_due_days INTEGER NOT NULL DEFAULT 7,  -- Default days to complete task
    assignee_role VARCHAR(50),   -- Nullable: Role to auto-assign task to (e.g., 'procurement_manager', 'quality_manager')
    status VARCHAR(50) NOT NULL DEFAULT 'active', -- 'active' or 'archived'
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,  -- Flexible template-specific configuration
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT, -- RESTRICT: Preserve audit trail
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE  -- Soft delete support
);

-- Indexes for task_template
-- Unique name per tenant (for template lookup by name)
-- Partial index excludes soft-deleted records
CREATE UNIQUE INDEX idx_task_template_tenant_name_unique 
    ON task_template(tenant_id, name) 
    WHERE deleted_at IS NULL;

-- Filter templates by tenant and status (for listing active/archived templates)
CREATE INDEX idx_task_template_tenant_status 
    ON task_template(tenant_id, status) 
    WHERE deleted_at IS NULL;

-- SQL Comments for task_template
COMMENT ON TABLE task_template IS 'Reusable task definitions per tenant. Templates are instantiated into task_instance at runtime.';
COMMENT ON COLUMN task_template.id IS 'Unique template identifier';
COMMENT ON COLUMN task_template.tenant_id IS 'Tenant isolation - CASCADE delete when tenant removed';
COMMENT ON COLUMN task_template.name IS 'Internal identifier for template lookup (unique within tenant, not displayed to users)';
COMMENT ON COLUMN task_template.title IS 'Display title shown to users when task is instantiated';
COMMENT ON COLUMN task_template.description IS 'Detailed instructions for completing the task';
COMMENT ON COLUMN task_template.default_due_days IS 'Default number of days from task creation to due date (can be overridden at instantiation)';
COMMENT ON COLUMN task_template.assignee_role IS 'Role to auto-assign task to when instantiated (nullable - can be assigned manually instead). Examples: procurement_manager, quality_manager, admin';
COMMENT ON COLUMN task_template.status IS 'Template lifecycle: active (can be used) | archived (hidden but preserves runtime tasks)';
COMMENT ON COLUMN task_template.metadata IS 'Flexible JSONB field for template-specific configuration (e.g., checklist items, required attachments)';
COMMENT ON COLUMN task_template.created_by IS 'User who created the template - RESTRICT delete to preserve audit trail';
COMMENT ON COLUMN task_template.deleted_at IS 'Soft delete timestamp - NULL for active templates';

-- ============================================================================
-- TABLE: task_instance
-- Purpose: Runtime execution of tasks within workflows
-- ============================================================================

CREATE TABLE IF NOT EXISTS task_instance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    task_template_id UUID REFERENCES task_template(id) ON DELETE SET NULL,  -- SET NULL: Preserve runtime tasks if template deleted
    process_instance_id UUID NOT NULL REFERENCES process_instance(id) ON DELETE CASCADE,  -- CASCADE: Task belongs to process
    step_instance_id UUID REFERENCES step_instance(id) ON DELETE CASCADE,  -- Nullable: Task may belong to process without specific step
    title VARCHAR(300) NOT NULL,  -- Runtime title (copied from template or custom)
    description TEXT,             -- Runtime description (copied from template or custom)
    assigned_to UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,  -- RESTRICT: Cannot delete users with assigned tasks
    status VARCHAR(50) NOT NULL DEFAULT 'pending',  -- 'pending' | 'in_progress' | 'completed' | 'cancelled'
    due_date TIMESTAMP WITH TIME ZONE,  -- Calculated from default_due_days or set manually
    completed_by UUID REFERENCES users(id) ON DELETE RESTRICT,  -- RESTRICT: Preserve who completed the task
    completed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,  -- Runtime task-specific data (e.g., completion notes, attachments)
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE  -- Soft delete support
);

-- Indexes for task_instance
-- User task lists (active/pending tasks assigned to user)
-- Partial index for performance: only index active tasks
CREATE INDEX idx_task_instance_tenant_assigned_status 
    ON task_instance(tenant_id, assigned_to, status) 
    WHERE status IN ('pending', 'in_progress') AND deleted_at IS NULL;

-- Workflow task retrieval (tasks for specific process/step)
CREATE INDEX idx_task_instance_process_step 
    ON task_instance(process_instance_id, step_instance_id) 
    WHERE deleted_at IS NULL;

-- Overdue task detection
CREATE INDEX idx_task_instance_tenant_due_date 
    ON task_instance(tenant_id, due_date) 
    WHERE status IN ('pending', 'in_progress') AND deleted_at IS NULL;

-- SQL Comments for task_instance
COMMENT ON TABLE task_instance IS 'Runtime execution of tasks within workflows. May be instantiated from template or created ad-hoc.';
COMMENT ON COLUMN task_instance.id IS 'Unique task instance identifier';
COMMENT ON COLUMN task_instance.tenant_id IS 'Tenant isolation - CASCADE delete when tenant removed';
COMMENT ON COLUMN task_instance.task_template_id IS 'Reference to template (nullable, SET NULL if template deleted to preserve runtime tasks)';
COMMENT ON COLUMN task_instance.process_instance_id IS 'Parent workflow process - CASCADE delete when process deleted';
COMMENT ON COLUMN task_instance.step_instance_id IS 'Optional link to specific workflow step - CASCADE delete when step deleted. NULL for process-level tasks.';
COMMENT ON COLUMN task_instance.title IS 'Runtime task title (copied from template or custom for ad-hoc tasks)';
COMMENT ON COLUMN task_instance.description IS 'Runtime task description (copied from template or custom)';
COMMENT ON COLUMN task_instance.assigned_to IS 'User assigned to complete task - RESTRICT delete to preserve audit trail';
COMMENT ON COLUMN task_instance.status IS 'Task execution status: pending (not started) | in_progress (actively working) | completed (finished) | cancelled (no longer needed)';
COMMENT ON COLUMN task_instance.due_date IS 'Task due date/time (calculated from template default_due_days or set manually)';
COMMENT ON COLUMN task_instance.completed_by IS 'User who completed the task - RESTRICT delete to preserve audit trail';
COMMENT ON COLUMN task_instance.completed_at IS 'Timestamp when task was marked complete';
COMMENT ON COLUMN task_instance.metadata IS 'Runtime task data (e.g., completion notes, file attachments, custom fields)';
COMMENT ON COLUMN task_instance.deleted_at IS 'Soft delete timestamp - NULL for active tasks';

-- ============================================================================
-- FOREIGN KEY CASCADE/RESTRICT STRATEGY
-- ============================================================================

-- EXPLANATION OF CASCADE RULES:
-- 
-- CASCADE DELETE (Parent-Child Hierarchy):
-- - tenant_id → CASCADE: When tenant deleted, all templates and instances deleted
-- - process_instance_id → CASCADE: When process deleted, all tasks deleted
-- - step_instance_id → CASCADE: When step deleted, all step-specific tasks deleted
--
-- SET NULL (Preserve Runtime Data):
-- - task_template_id → SET NULL: When template deleted/archived, runtime tasks continue
--   Rationale: Historical tasks should survive template deletion. Task instance contains
--   denormalized title/description copied from template at creation time.
--
-- RESTRICT (Audit Trail Preservation):
-- - created_by, assigned_to, completed_by → RESTRICT: Cannot delete users who participated in tasks
--   Rationale: Maintains audit trail of who created, worked on, and completed tasks.
--   Users must be deactivated rather than deleted if they have task history.

