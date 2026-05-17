# ADR 0008: Form template versioning, pins, audit, and compiled_json

## Status

Accepted — 2026-05-17

## Context

Dynamic form templates gained relational versioning (`form_template_version`), structure audit events (`form_template_audit_event`), workflow/submission pins to specific versions, and a publish-time derived cache (`compiled_json`) for fast reads. Earlier schema iterations denormalized `form_template_id` onto `form_section`, duplicating the link already present on each version row.

## Decision

1. **Version-centric structure:** `form_section` and `form_field` rows are scoped by `form_template_version_id` (and `tenant_id`). The container template is reached via `form_template_version.form_template_id`, not a second copy on every section row (SUP-34).

2. **Pins:** `form_submission` and `step_instance` (among others) reference a concrete `form_template_version_id` so historical submissions and pinned workflow steps stay on the structure that was active when they were created. Workflow/template configuration continues to reference the template container where that is appropriate; resolve the structure version at runtime using helpers in `packages/db/src/helpers/form-template-version-lifecycle.ts` and related modules.

3. **Audit:** Structural edits on draft versions emit rows in `form_template_audit_event`. Publish lifecycle uses summary-level events appropriate for the admin changelog; internal teardown mechanics stay out of the user-facing timeline where filtered by the API.

4. **compiled_json:** On publish, the API computes a versioned JSON artifact (v2 schema in `@supplex/types`) and stores it on the immutable published `form_template_version` row. Readers may use `loadFormStructureForVersion` (`packages/db/src/helpers/form-template-structure-loader.ts`), which prefers `compiled_json` when valid and falls back to the relational subtree (e.g. drafts or malformed cache). This is a read strategy, not duplicate storage.

## Consequences

### Positive

- Single logical path from version to sections/fields without redundant FKs.
- Clear separation between "container" (`form_template`) and "versioned structure" (`form_template_version` + subtree).

### Negative

- Queries that only had `form_template_id` on sections must join `form_template_version` when the container id is required.
- Destructive migrations must be coordinated when dropping legacy columns.

### Neutral

- Schema details remain in `packages/db/src/schema/`; this ADR records intent and boundaries only.

## Alternatives Considered

### Keep denormalized `form_section.form_template_id`

Slightly simpler for template-scoped filters, but redundant and risks drift; removed in favor of the version join.
