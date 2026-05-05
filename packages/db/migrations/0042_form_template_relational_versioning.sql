-- Migration: Relational form_template_version (SUP-25 / PR1)
-- Restores version rows with draft (version_number NULL) vs immutable published/superseded,
-- wires form_section/form_field to versions via composite FK, adds submission + step pins.

-- ============================================================================
-- 1. ENUM + VERSION TABLE
-- ============================================================================

CREATE TYPE form_template_version_status AS ENUM ('draft', 'published', 'superseded');

CREATE TABLE form_template_version (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_template_id UUID NOT NULL REFERENCES form_template(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    version_number INTEGER,
    status form_template_version_status NOT NULL,
    based_on_version_id UUID REFERENCES form_template_version(id) ON DELETE SET NULL,
    compiled_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_form_template_version_draft_vs_immutable CHECK (
        (
            version_number IS NULL
            AND status = 'draft'::form_template_version_status
        )
        OR (
            version_number IS NOT NULL
            AND version_number >= 1
            AND status IN (
                'published'::form_template_version_status,
                'superseded'::form_template_version_status
            )
        )
    )
);

COMMENT ON TABLE form_template_version IS 'Relational form structure versions; draft uses NULL version_number';
COMMENT ON COLUMN form_template_version.version_number IS 'NULL = mutable draft row; positive integer = immutable lineage';

CREATE UNIQUE INDEX uq_form_template_version_one_draft
    ON form_template_version (form_template_id)
    WHERE version_number IS NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX uq_form_template_version_template_version_number
    ON form_template_version (form_template_id, version_number)
    WHERE version_number IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_form_template_version_tenant_template
    ON form_template_version (tenant_id, form_template_id)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_form_template_version_template_version_desc
    ON form_template_version (form_template_id, version_number DESC NULLS LAST)
    WHERE deleted_at IS NULL AND version_number IS NOT NULL;

-- ============================================================================
-- 2. SEED ONE VERSION ROW PER EXISTING form_template
-- ============================================================================

INSERT INTO form_template_version (
    form_template_id,
    tenant_id,
    version_number,
    status,
    based_on_version_id,
    compiled_json,
    created_at,
    updated_at
)
SELECT
    ft.id,
    ft.tenant_id,
    CASE
        WHEN ft.status = 'draft'::form_template_status THEN NULL
        ELSE 1
    END,
    CASE
        WHEN ft.status = 'draft'::form_template_status THEN 'draft'::form_template_version_status
        WHEN ft.status = 'archived'::form_template_status THEN 'superseded'::form_template_version_status
        ELSE 'published'::form_template_version_status
    END,
    NULL,
    NULL,
    ft.created_at,
    ft.updated_at
FROM form_template ft;

-- ============================================================================
-- 3. form_section → version + composite uniqueness
-- ============================================================================

ALTER TABLE form_section
    ADD COLUMN form_template_version_id UUID;

UPDATE form_section fs
SET form_template_version_id = ftv.id
FROM form_template_version ftv
WHERE fs.form_template_id = ftv.form_template_id
    AND ftv.deleted_at IS NULL;

DO $$
DECLARE
    bad INTEGER;
BEGIN
    SELECT COUNT(*) INTO bad FROM form_section WHERE form_template_version_id IS NULL;
    IF bad > 0 THEN
        RAISE EXCEPTION 'Migration error: % form_section rows missing form_template_version_id', bad;
    END IF;
END $$;

ALTER TABLE form_section
    ALTER COLUMN form_template_version_id SET NOT NULL;

ALTER TABLE form_section
    ADD CONSTRAINT form_section_form_template_version_id_form_template_version_id_fk
    FOREIGN KEY (form_template_version_id) REFERENCES form_template_version(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX uq_form_section_id_template_version
    ON form_section (id, form_template_version_id);

CREATE INDEX idx_form_section_tenant_version_order
    ON form_section (tenant_id, form_template_version_id, section_order)
    WHERE deleted_at IS NULL;

-- ============================================================================
-- 4. form_field → composite FK (drop simple section FK first)
-- ============================================================================

ALTER TABLE form_field
    ADD COLUMN form_template_version_id UUID;

UPDATE form_field ff
SET form_template_version_id = fs.form_template_version_id
FROM form_section fs
WHERE ff.form_section_id = fs.id;

DO $$
DECLARE
    bad INTEGER;
BEGIN
    SELECT COUNT(*) INTO bad FROM form_field WHERE form_template_version_id IS NULL;
    IF bad > 0 THEN
        RAISE EXCEPTION 'Migration error: % form_field rows missing form_template_version_id', bad;
    END IF;
END $$;

ALTER TABLE form_field
    ALTER COLUMN form_template_version_id SET NOT NULL;

ALTER TABLE form_field
    DROP CONSTRAINT IF EXISTS form_field_form_section_id_form_section_id_fk;

ALTER TABLE form_field
    ADD CONSTRAINT form_field_section_version_fkey
    FOREIGN KEY (form_section_id, form_template_version_id)
    REFERENCES form_section (id, form_template_version_id)
    ON DELETE CASCADE;

ALTER TABLE form_field
    ADD CONSTRAINT form_field_form_template_version_id_form_template_version_id_fk
    FOREIGN KEY (form_template_version_id) REFERENCES form_template_version(id) ON DELETE CASCADE;

-- ============================================================================
-- 5. Workflow step pin + submission pin (compat: nullable submission FK)
-- ============================================================================

ALTER TABLE step_instance
    ADD COLUMN pinned_form_template_version_id UUID REFERENCES form_template_version(id) ON DELETE SET NULL;

CREATE INDEX idx_step_instance_pinned_form_template_version
    ON step_instance (pinned_form_template_version_id)
    WHERE deleted_at IS NULL AND pinned_form_template_version_id IS NOT NULL;

ALTER TABLE form_submission
    ADD COLUMN form_template_version_id UUID REFERENCES form_template_version(id) ON DELETE RESTRICT;

UPDATE form_submission fs
SET form_template_version_id = ftv.id
FROM form_template_version ftv
WHERE fs.form_template_id = ftv.form_template_id
    AND ftv.deleted_at IS NULL;

CREATE INDEX idx_form_submission_tenant_template_version
    ON form_submission (tenant_id, form_template_version_id)
    WHERE deleted_at IS NULL AND form_template_version_id IS NOT NULL;

-- ============================================================================
-- 6. RLS (Supabase only — vanilla Postgres CI has no `authenticated` role)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    ALTER TABLE form_template_version ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "tenant_select_form_template_version" ON form_template_version;
    CREATE POLICY "tenant_select_form_template_version" ON form_template_version
        FOR SELECT
        TO authenticated
        USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);
  END IF;
END $$;
