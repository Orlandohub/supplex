-- Migration: Add Workflow Engine Tables
-- Story: 2.2.1 - Database Refactor for Dynamic Workflows
-- Date: 2026-01-20
--
-- This migration creates new domain-agnostic workflow execution tables:
-- - process_instance: Tracks any type of multi-step process
-- - step_instance: Tracks individual steps within a process
--
-- These tables are independent from legacy qualification tables and will
-- eventually replace them in future migrations.

-- Create process_instance table
CREATE TABLE IF NOT EXISTS process_instance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    process_type VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    initiated_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    initiated_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_date TIMESTAMP WITH TIME ZONE,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for process_instance
CREATE INDEX IF NOT EXISTS idx_process_instance_tenant_type_status 
    ON process_instance(tenant_id, process_type, status) 
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_process_instance_tenant_entity 
    ON process_instance(tenant_id, entity_type, entity_id) 
    WHERE deleted_at IS NULL;

-- Create step_instance table
CREATE TABLE IF NOT EXISTS step_instance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    process_instance_id UUID NOT NULL REFERENCES process_instance(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL,
    step_name VARCHAR(200) NOT NULL,
    step_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    assigned_to UUID REFERENCES users(id) ON DELETE RESTRICT,
    completed_by UUID REFERENCES users(id) ON DELETE RESTRICT,
    completed_date TIMESTAMP WITH TIME ZONE,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for step_instance
CREATE INDEX IF NOT EXISTS idx_step_instance_process_order 
    ON step_instance(process_instance_id, step_order) 
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_step_instance_tenant_assigned_status 
    ON step_instance(tenant_id, assigned_to, status) 
    WHERE status IN ('pending', 'active') AND deleted_at IS NULL;

