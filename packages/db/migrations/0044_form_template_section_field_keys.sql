-- SUP-28: Stable section_key / field_key per form_template_version_id, slug flags,
-- partial unique indexes, audit enum extensions.

ALTER TYPE form_template_audit_event_type ADD VALUE IF NOT EXISTS 'section_created';
ALTER TYPE form_template_audit_event_type ADD VALUE IF NOT EXISTS 'field_created';

ALTER TABLE form_section
    ADD COLUMN IF NOT EXISTS section_key varchar(64),
    ADD COLUMN IF NOT EXISTS slug_manually_edited boolean NOT NULL DEFAULT false;

ALTER TABLE form_field
    ADD COLUMN IF NOT EXISTS field_key varchar(64),
    ADD COLUMN IF NOT EXISTS slug_manually_edited boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION _sup28_slugify(p_input text)
RETURNS text AS $$
DECLARE
    s text;
BEGIN
    IF p_input IS NULL OR trim(p_input) = '' THEN
        RETURN 'x';
    END IF;
    s := lower(trim(p_input));
    s := regexp_replace(s, '[^a-z0-9]+', '_', 'g');
    s := trim(both '_' from s);
    IF s = '' OR s IS NULL THEN
        s := 'x';
    END IF;
    IF substring(s FROM 1 FOR 1) !~ '[a-z]' THEN
        s := 's_' || s;
    END IF;
    IF length(s) > 64 THEN
        s := left(s, 64);
    END IF;
    s := trim(trailing '_' from s);
    IF s = '' OR substring(s FROM 1 FOR 1) !~ '[a-z]' THEN
        s := 'x';
    END IF;
    RETURN s;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION _sup28_alloc_key(
    p_base text,
    p_suffix int,
    p_max_len int
)
RETURNS text AS $$
DECLARE
    suf text;
    pref_len int;
BEGIN
    suf := '_' || p_suffix::text;
    pref_len := p_max_len - length(suf);
    IF pref_len < 1 THEN
        pref_len := 1;
    END IF;
    RETURN left(p_base, pref_len) || suf;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

DO $$
DECLARE
    r record;
    v_base text;
    v_cand text;
    n int;
BEGIN
    FOR r IN
        SELECT id, form_template_version_id, title, deleted_at
        FROM form_section
        ORDER BY form_template_version_id, section_order, id
    LOOP
        IF r.deleted_at IS NOT NULL THEN
            v_cand := left('z_arch_' || replace(r.id::text, '-', ''), 64);
        ELSE
            v_base := _sup28_slugify(r.title);
            v_cand := left(v_base, 64);
            n := 2;
            WHILE EXISTS (
                SELECT 1
                FROM form_section o
                WHERE o.form_template_version_id = r.form_template_version_id
                  AND o.section_key IS NOT DISTINCT FROM v_cand
                  AND o.id <> r.id
            ) LOOP
                v_cand := _sup28_alloc_key(v_base, n, 64);
                n := n + 1;
                IF n > 100000 THEN
                    RAISE EXCEPTION 'SUP-28 section_key allocation exceeded retries for section %', r.id;
                END IF;
            END LOOP;
        END IF;

        UPDATE form_section SET section_key = v_cand WHERE id = r.id;
    END LOOP;
END $$;

DO $$
DECLARE
    r record;
    v_base text;
    v_cand text;
    n int;
BEGIN
    FOR r IN
        SELECT id, form_template_version_id, label, deleted_at
        FROM form_field
        ORDER BY form_template_version_id, form_section_id, field_order, id
    LOOP
        IF r.deleted_at IS NOT NULL THEN
            v_cand := left('z_arch_' || replace(r.id::text, '-', ''), 64);
        ELSE
            v_base := _sup28_slugify(r.label);
            v_cand := left(v_base, 64);
            n := 2;
            WHILE EXISTS (
                SELECT 1
                FROM form_field o
                WHERE o.form_template_version_id = r.form_template_version_id
                  AND o.field_key IS NOT DISTINCT FROM v_cand
                  AND o.id <> r.id
            ) LOOP
                v_cand := _sup28_alloc_key(v_base, n, 64);
                n := n + 1;
                IF n > 100000 THEN
                    RAISE EXCEPTION 'SUP-28 field_key allocation exceeded retries for field %', r.id;
                END IF;
            END LOOP;
        END IF;

        UPDATE form_field SET field_key = v_cand WHERE id = r.id;
    END LOOP;
END $$;

DROP FUNCTION IF EXISTS _sup28_alloc_key(text, int, int);
DROP FUNCTION IF EXISTS _sup28_slugify(text);

ALTER TABLE form_section ALTER COLUMN section_key SET NOT NULL;
ALTER TABLE form_field ALTER COLUMN field_key SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_form_section_version_key_active
    ON form_section (form_template_version_id, section_key)
    WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_form_field_version_key_active
    ON form_field (form_template_version_id, field_key)
    WHERE deleted_at IS NULL;
