-- Migration: Add Workflow Template Tables
-- Story: 2.2.6 - Workflow Template Data Model (Tenant-Isolated, Multi-Approver, Action Modes)
-- Generated: 2026-01-24

-- ========================================
-- ENUMS
-- ========================================

-- Note: workflow_template reuses form_template_status enum (already exists from migration 0008)
-- The enum contains: 'draft', 'published', 'archived'

-- Step Type Enum
-- Defines the type of action required in a workflow step
CREATE TYPE step_type AS ENUM ('form', 'approval', 'document', 'task');

-- Form Action Mode Enum
-- Defines how forms are used in workflow steps:
-- - 'fill_out': User edits form and submits (initial data entry)
-- - 'validate': User reviews read-only form and approves/declines (approval step)
CREATE TYPE form_action_mode AS ENUM ('fill_out', 'validate');

-- Document Action Mode Enum
-- Defines how documents are used in workflow steps:
-- - 'upload': User uploads required documents
-- - 'validate': User reviews documents and approves/declines
CREATE TYPE document_action_mode AS ENUM ('upload', 'validate');

-- Assignee Type Enum
-- Defines whether step is assigned to a role or specific user
CREATE TYPE assignee_type AS ENUM ('role', 'user');

-- Approver Type Enum
-- Defines whether approver is a role or specific user
CREATE TYPE approver_type AS ENUM ('role', 'user');

-- ========================================
-- TABLE: workflow_template
-- ========================================
-- Tenant-isolated workflow template definitions
-- Each template defines a reusable workflow structure (e.g., "Supplier Qualification v2")
--
-- Tenant Isolation:
-- - All queries must filter by tenant_id
-- - CASCADE delete when tenant is removed
-- - RESTRICT delete when created_by user is removed (audit trail)
--
-- Process Types:
-- - 'supplier_qualification' - Supplier onboarding and qualification
-- - 'sourcing' - Strategic sourcing processes
-- - 'product_lifecycle' - Product development workflows
-- - Custom types can be defined per tenant
--
-- Versioning:
-- - Templates have multiple versions (see workflow_template_version)
-- - Draft versions can be edited
-- - Published versions are immutable (enforced at application level)
-- - Archived templates are no longer selectable
CREATE TABLE workflow_template (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    process_type VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status form_template_status NOT NULL DEFAULT 'draft',
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Index for filtering templates by process type and status
CREATE INDEX idx_workflow_template_tenant_process_status 
    ON workflow_template(tenant_id, process_type, status) 
    WHERE deleted_at IS NULL;

-- Index for filtering templates by status
CREATE INDEX idx_workflow_template_tenant_status 
    ON workflow_template(tenant_id, status) 
    WHERE deleted_at IS NULL;

-- ========================================
-- TABLE: workflow_template_version
-- ========================================
-- Immutable versions of workflow templates
-- Published versions cannot be edited (enforced at application level)
--
-- Tenant Isolation:
-- - All queries must filter by tenant_id
-- - CASCADE delete when tenant or workflow_template is removed
--
-- Versioning:
-- - version is an incrementing integer per workflow_template (1, 2, 3, ...)
-- - Unique constraint on (workflow_template_id, version)
-- - is_published = true implies status = 'published' (CHECK constraint)
-- - Only one version per template can have is_published = true at a time (enforced at application level)
--
-- Lifecycle:
-- - Draft: Can be edited, not yet available for process execution
-- - Published: Immutable, actively used for new process instances
-- - Archived: Immutable, no longer available for new process instances
CREATE TABLE workflow_template_version (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_template_id UUID NOT NULL REFERENCES workflow_template(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    status form_template_status NOT NULL DEFAULT 'draft',
    is_published BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    -- Unique constraint on (workflow_template_id, version) to prevent duplicate versions
    CONSTRAINT uq_workflow_template_version_template_version UNIQUE (workflow_template_id, version),
    
    -- CHECK constraint: is_published = true implies status = 'published'
    CONSTRAINT chk_workflow_template_version_published_status 
        CHECK ((is_published = false) OR (is_published = true AND status = 'published'))
);

-- Composite index on (tenant_id, workflow_template_id, version) for version lookups
CREATE INDEX idx_workflow_template_version_tenant_template_version 
    ON workflow_template_version(tenant_id, workflow_template_id, version) 
    WHERE deleted_at IS NULL;

-- Composite index on (tenant_id, status) for filtering by status
CREATE INDEX idx_workflow_template_version_tenant_status 
    ON workflow_template_version(tenant_id, status) 
    WHERE deleted_at IS NULL;

-- ========================================
-- TABLE: workflow_step_template
-- ========================================
-- Defines individual steps within a workflow template version
-- Each step specifies task configuration, form/document integration, and approval requirements
--
-- Tenant Isolation:
-- - All queries must filter by tenant_id
-- - CASCADE delete when tenant or workflow_template_version is removed
-- - RESTRICT delete when assignee_user_id or form_template_version_id is removed
--
-- Task Configuration (Runtime Task Creation):
-- When step_instance becomes 'active', workflow engine creates task_instance using:
-- - task_title → task_instance.title
-- - task_description → task_instance.description
-- - due_days → calculate task_instance.due_at (step start + due_days)
-- - assignee_type → task_instance.assignee_type ('role' or 'user')
-- - assignee_role → task_instance.assignee_role (if type = 'role')
-- - assignee_user_id → task_instance.assignee_user_id (if type = 'user')
--
-- Form Integration:
-- - form_template_version_id: FK to form template version to use
-- - form_action_mode:
--   - 'fill_out': User edits form and submits (initial data entry)
--   - 'validate': User reviews read-only form and approves/declines (approval step)
--
-- Document Integration:
-- - document_template_id: Reference to document template (not yet implemented)
-- - document_action_mode:
--   - 'upload': User uploads required documents
--   - 'validate': User reviews documents and approves/declines
--
-- Multi-Approver Configuration:
-- - multi_approver = true: Step requires multiple approvals
-- - approver_count: Number of approvals needed (e.g., 2 out of 3)
-- - Approvers defined in step_approver table (role-based or user-specific)
-- - Workflow engine creates one task_instance per approver
-- - Step completes when approver_count tasks marked completed
--
-- Decline Behavior:
-- - decline_returns_to_step_offset: Relative offset for decline workflow return
-- - Default: 1 (returns to immediately previous step)
-- - Example: Step 4 declines → returns to Step 3 (offset=1) or Step 2 (offset=2)
-- - Returned step becomes 'active', user can modify and resubmit
CREATE TABLE workflow_step_template (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_template_version_id UUID NOT NULL REFERENCES workflow_template_version(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    step_type step_type NOT NULL,
    
    -- Task configuration (used to create task_instance when step starts)
    task_title VARCHAR(300),
    task_description TEXT,
    due_days INTEGER,
    assignee_type assignee_type,
    assignee_role VARCHAR(50),
    assignee_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    
    -- Form integration
    form_template_version_id UUID REFERENCES form_template_version(id) ON DELETE RESTRICT,
    form_action_mode form_action_mode,
    
    -- Document integration
    document_template_id UUID, -- Not yet implemented
    document_action_mode document_action_mode,
    
    -- Multi-approver configuration
    multi_approver BOOLEAN NOT NULL DEFAULT false,
    approver_count INTEGER,
    
    -- Decline behavior
    decline_returns_to_step_offset INTEGER NOT NULL DEFAULT 1,
    
    -- Extensible configuration
    metadata JSONB NOT NULL DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Composite index on (tenant_id, workflow_template_version_id, step_order) for ordered step retrieval
CREATE INDEX idx_workflow_step_template_tenant_version_order 
    ON workflow_step_template(tenant_id, workflow_template_version_id, step_order) 
    WHERE deleted_at IS NULL;

-- Index on form_template_version_id for form usage tracking
CREATE INDEX idx_workflow_step_template_form_version 
    ON workflow_step_template(form_template_version_id) 
    WHERE deleted_at IS NULL AND form_template_version_id IS NOT NULL;

-- ========================================
-- TABLE: step_approver
-- ========================================
-- Defines approvers for multi-approver workflow steps
-- Used when workflow_step_template.multi_approver = true
--
-- Tenant Isolation:
-- - All queries must filter by tenant_id
-- - CASCADE delete when tenant or workflow_step_template is removed
-- - RESTRICT delete when approver_user_id is removed (audit trail)
--
-- Multi-Approver Logic:
-- When workflow_step_template.multi_approver = true:
-- - This table defines who can approve (role-based or user-specific)
-- - workflow_step_template.approver_count specifies how many approvals needed
-- - Workflow engine creates one task_instance per approver
-- - Step completes when approver_count tasks marked completed
--
-- Approver Types:
-- - 'role': Any user with the specified role can approve
--   - approver_role contains role name (e.g., 'procurement_manager')
--   - One user action counts as one approval
--   - Multiple users with same role can approve independently
-- - 'user': Only specific user can approve
--   - approver_user_id contains user ID
--   - Ensures specific person must approve (e.g., CEO approval)
--
-- Ordering:
-- - approver_order defines the sequence (1, 2, 3, ...)
-- - Used for UI display order and logging
-- - All approvers can act in parallel (not sequential)
--
-- Example Configuration:
-- Step: "Multi-Department Approval"
-- - multi_approver = true
-- - approver_count = 2
-- - step_approver records:
--   1. approver_order=1, approver_type='role', approver_role='procurement_manager'
--   2. approver_order=2, approver_type='role', approver_role='quality_manager'
--   3. approver_order=3, approver_type='user', approver_user_id='...' (CEO)
-- - Step completes when any 2 of these 3 approve
CREATE TABLE step_approver (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_step_template_id UUID NOT NULL REFERENCES workflow_step_template(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    approver_order INTEGER NOT NULL,
    approver_type approver_type NOT NULL,
    approver_role VARCHAR(50),
    approver_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Composite index on (tenant_id, workflow_step_template_id, approver_order) for ordered approver retrieval
CREATE INDEX idx_step_approver_tenant_step_order 
    ON step_approver(tenant_id, workflow_step_template_id, approver_order) 
    WHERE deleted_at IS NULL;

