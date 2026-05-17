-- SUP-34: Remove redundant denormalized form_template_id from form_section.
-- The template is reachable via form_template_version.form_template_id.

DROP INDEX IF EXISTS idx_form_section_tenant_template_order;

ALTER TABLE form_section DROP CONSTRAINT IF EXISTS form_section_form_template_id_fkey;

ALTER TABLE form_section DROP COLUMN IF EXISTS form_template_id;
