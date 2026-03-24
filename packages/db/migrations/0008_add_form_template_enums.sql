-- Migration: Add PostgreSQL ENUM types for Form Templates
-- Story: 2.2.2 - Form Template Data Model and Versioning (Option A Implementation)
-- Date: 2026-01-21
--
-- This migration converts varchar status and field_type columns to PostgreSQL ENUMs
-- for database-level type validation. This prevents invalid values from being inserted
-- via direct SQL, migrations, or third-party integrations.
--
-- IMPORTANT: This migration must be run BEFORE any data exists in these tables.
-- If data already exists, see the alternative migration approach in comments below.

-- ============================================================================
-- STEP 1: CREATE ENUM TYPES
-- ============================================================================

-- Form template status enum
CREATE TYPE form_template_status AS ENUM ('draft', 'published', 'archived');

-- Field type enum
CREATE TYPE field_type AS ENUM (
    'text',
    'textarea',
    'number',
    'date',
    'dropdown',
    'checkbox',
    'multi_select'
);

COMMENT ON TYPE form_template_status IS 'Lifecycle status of form templates and versions';
COMMENT ON TYPE field_type IS 'Supported form field input types';

-- ============================================================================
-- STEP 2: ALTER TABLES TO USE ENUM TYPES
-- ============================================================================

-- Alter form_template.status to use enum
-- NOTE: If data exists, use: ALTER COLUMN status TYPE form_template_status USING status::form_template_status;
ALTER TABLE form_template 
    ALTER COLUMN status TYPE form_template_status USING status::form_template_status;

-- Alter form_template_version.status to use enum
ALTER TABLE form_template_version 
    ALTER COLUMN status TYPE form_template_status USING status::form_template_status;

-- Alter form_field.field_type to use enum
ALTER TABLE form_field 
    ALTER COLUMN field_type TYPE field_type USING field_type::field_type;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify enum types were created
-- SELECT typname, typtype FROM pg_type WHERE typname IN ('form_template_status', 'field_type');

-- Verify columns are using enum types
-- SELECT 
--     table_name, 
--     column_name, 
--     data_type, 
--     udt_name 
-- FROM information_schema.columns 
-- WHERE table_name IN ('form_template', 'form_template_version', 'form_field') 
--     AND column_name IN ('status', 'field_type');

-- Test enum constraint (should fail with invalid value)
-- INSERT INTO form_template (tenant_id, name, status) VALUES ('...', 'Test', 'invalid_status');
-- Expected: ERROR: invalid input value for enum form_template_status: "invalid_status"

-- ============================================================================
-- ALTERNATIVE MIGRATION APPROACH (If data already exists)
-- ============================================================================

-- If you already have data in these tables, use this approach instead:
--
-- STEP 1: Create enum types (same as above)
--
-- STEP 2: Add temporary columns with enum types
-- ALTER TABLE form_template ADD COLUMN status_new form_template_status;
-- ALTER TABLE form_template_version ADD COLUMN status_new form_template_status;
-- ALTER TABLE form_field ADD COLUMN field_type_new field_type;
--
-- STEP 3: Copy data to new columns with type casting
-- UPDATE form_template SET status_new = status::form_template_status;
-- UPDATE form_template_version SET status_new = status::form_template_status;
-- UPDATE form_field SET field_type_new = field_type::field_type;
--
-- STEP 4: Drop old columns
-- ALTER TABLE form_template DROP COLUMN status;
-- ALTER TABLE form_template_version DROP COLUMN status;
-- ALTER TABLE form_field DROP COLUMN field_type;
--
-- STEP 5: Rename new columns
-- ALTER TABLE form_template RENAME COLUMN status_new TO status;
-- ALTER TABLE form_template_version RENAME COLUMN status_new TO status;
-- ALTER TABLE form_field RENAME COLUMN field_type_new TO field_type;
--
-- STEP 6: Set NOT NULL and defaults
-- ALTER TABLE form_template ALTER COLUMN status SET NOT NULL;
-- ALTER TABLE form_template ALTER COLUMN status SET DEFAULT 'draft';
-- ALTER TABLE form_template_version ALTER COLUMN status SET NOT NULL;
-- ALTER TABLE form_template_version ALTER COLUMN status SET DEFAULT 'draft';
-- ALTER TABLE form_field ALTER COLUMN field_type SET NOT NULL;

-- ============================================================================
-- ROLLBACK INSTRUCTIONS (Manual)
-- ============================================================================

-- To rollback this migration:
-- 1. ALTER TABLE form_template ALTER COLUMN status TYPE VARCHAR(50);
-- 2. ALTER TABLE form_template_version ALTER COLUMN status TYPE VARCHAR(50);
-- 3. ALTER TABLE form_field ALTER COLUMN field_type TYPE VARCHAR(50);
-- 4. DROP TYPE form_template_status;
-- 5. DROP TYPE field_type;

-- ============================================================================
-- BENEFITS OF ENUM TYPES
-- ============================================================================

-- ✅ Database-level validation prevents invalid values
-- ✅ Better query performance (internally stored as integers)
-- ✅ Explicit documentation of allowed values at DB level
-- ✅ Type safety for direct SQL queries and migrations
-- ✅ Protection against typos in manual database operations
-- ✅ Third-party tools see enum constraints automatically


