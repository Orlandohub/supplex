# Database Schema

This section provides the complete PostgreSQL database schema for Supplex, including table definitions, indexes, constraints, Row Level Security (RLS) policies, and Drizzle ORM mappings.

## SQL DDL (PostgreSQL)

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tenants Table
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    plan VARCHAR(50) NOT NULL DEFAULT 'starter',
    settings JSONB DEFAULT '{}',
    subscription_ends_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(200) NOT NULL,
    role VARCHAR(50) NOT NULL, -- Supports: admin, procurement_manager, quality_manager, viewer, supplier_user (Story 2.1.4)
    avatar_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    UNIQUE(tenant_id, email)
);

-- Suppliers Table
CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    tax_id VARCHAR(50) NOT NULL,
    category VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'prospect',
    performance_score NUMERIC(3, 2),
    contact_name VARCHAR(200) NOT NULL,
    contact_email VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(50),
    address JSONB NOT NULL,
    certifications JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    risk_score NUMERIC(4, 2),
    supplier_user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Added in Story 2.1.5
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(tenant_id, tax_id)
);

-- Indexes for Performance
CREATE INDEX idx_suppliers_tenant_id ON suppliers(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_suppliers_status ON suppliers(tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_suppliers_supplier_user_id ON suppliers(supplier_user_id); -- Added in Story 2.1.5
```

_(Full schema continues with all tables, indexes, triggers, and RLS policies...)_

---
