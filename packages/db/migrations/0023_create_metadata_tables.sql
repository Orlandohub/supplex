-- Migration: Create tenant-scoped metadata lookup tables
-- Stories: Workflow Engine Fixes & Metadata Tables
--
-- Creates:
--   1. supplier_status  - tenant-scoped supplier status definitions
--   2. workflow_status   - tenant-scoped workflow status definitions (process instance display status)
--   3. workflow_type     - tenant-scoped workflow type definitions with optional supplier status link

-- ============================================================
-- 1. supplier_status (tenant-scoped)
-- ============================================================
CREATE TABLE IF NOT EXISTS supplier_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

CREATE INDEX idx_supplier_status_tenant
  ON supplier_status(tenant_id);

-- ============================================================
-- 2. workflow_status (tenant-scoped)
-- ============================================================
CREATE TABLE IF NOT EXISTS workflow_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

CREATE INDEX idx_workflow_status_tenant
  ON workflow_status(tenant_id);

-- ============================================================
-- 3. workflow_type (tenant-scoped, links to supplier_status)
-- ============================================================
CREATE TABLE IF NOT EXISTS workflow_type (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  supplier_status_id UUID REFERENCES supplier_status(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

CREATE INDEX idx_workflow_type_tenant
  ON workflow_type(tenant_id);
