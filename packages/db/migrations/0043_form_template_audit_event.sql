-- Migration: form_template_audit_event (SUP-27 / PR3)
-- Append-only changelog of form template structural changes:
-- field/section hard deletes (with full before snapshot), updates, and publish lifecycle events.

-- ============================================================================
-- 1. ENUMS
-- ============================================================================

CREATE TYPE form_template_audit_event_type AS ENUM (
    'section_updated',
    'section_hard_deleted',
    'field_updated',
    'field_hard_deleted',
    'draft_subtree_replaced_on_publish',
    'version_published'
);

CREATE TYPE form_template_audit_subject AS ENUM (
    'template',
    'version',
    'section',
    'field'
);

-- ============================================================================
-- 2. TABLE
-- ============================================================================

CREATE TABLE form_template_audit_event (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    form_template_id UUID NOT NULL REFERENCES form_template(id) ON DELETE CASCADE,
    form_template_version_id UUID REFERENCES form_template_version(id) ON DELETE SET NULL,
    actor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    event_type form_template_audit_event_type NOT NULL,
    subject_type form_template_audit_subject NOT NULL,
    subject_id UUID,
    "before" JSONB,
    "after" JSONB,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    summary VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE form_template_audit_event IS
    'Append-only audit trail for form template structural changes (SUP-27).';
COMMENT ON COLUMN form_template_audit_event.before IS
    'Full pre-change row snapshot for hard delete and update events.';
COMMENT ON COLUMN form_template_audit_event.after IS
    'Post-change row snapshot for update events; null for deletes.';
COMMENT ON COLUMN form_template_audit_event.metadata IS
    'Event-specific structured context (e.g. publish summary IDs).';

CREATE INDEX idx_form_template_audit_event_tenant_template_time
    ON form_template_audit_event (tenant_id, form_template_id, created_at);

CREATE INDEX idx_form_template_audit_event_tenant_version_time
    ON form_template_audit_event (tenant_id, form_template_version_id, created_at);

CREATE INDEX idx_form_template_audit_event_type
    ON form_template_audit_event (event_type);

-- ============================================================================
-- 3. RLS (Supabase only — vanilla Postgres CI has no `authenticated` role)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    ALTER TABLE form_template_audit_event ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "tenant_select_form_template_audit_event"
        ON form_template_audit_event;
    CREATE POLICY "tenant_select_form_template_audit_event"
        ON form_template_audit_event
        FOR SELECT
        TO authenticated
        USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);
  END IF;
END $$;
