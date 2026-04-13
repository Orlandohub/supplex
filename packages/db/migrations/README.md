# Database Migrations

Use this note alongside [`../../../docs/deployment.md`](../../../docs/deployment.md) and [`../../../docs/README.md`](../../../docs/README.md). This file documents a local migration numbering exception, not the full migration workflow.

## Migration Numbering

Migrations use sequential numeric prefixes (`0000_`, `0001_`, ...).
New migrations should use the **next available number** after the current highest.

### Known Collision: `0020_`

Two migration files share the `0020_` prefix:

- `0020_remove_template_versioning.sql`
- `0020_fix_workflow_step_form_template.sql`

Both migrations have already been applied to production. Renaming either file
would break drizzle-kit's migration tracking, so they are intentionally left as-is.
The fix migration (`0020_fix_...`) was created shortly after the original to add
a missing column and was accidentally given the same prefix.

All migrations from `0021_` onward use strictly sequential numbering.
