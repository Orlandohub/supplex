/**
 * SUP-32: Shared DTOs for the form-template admin read APIs.
 *
 * These wire shapes back the versions/changelog/usage/compare admin
 * experience. Keep them free of DB row leakage (no `compiledJson`,
 * snapshots, or other heavy payloads) so the loaders/Treaty client
 * stay light and the contract is stable across the API + web app.
 *
 * Routes:
 * - GET /api/form-templates/:id/versions
 * - GET /api/form-templates/:id/audit-events
 * - GET /api/form-templates/:id/version-diff
 * - GET /api/form-templates/:id/usage
 */

import type {
  FormTemplateStructureDiff,
  FormTemplateStructureDiffSummary,
  FormTemplatePublishImpact,
} from "./form-template-publish-preview";

/**
 * One row in `GET /api/form-templates/:id/versions`.
 *
 * `versionNumber` is `null` for the live draft and a monotonic positive
 * integer for immutable rows (`published` / `superseded`). Dates are ISO
 * strings to match Treaty / JSON serialization.
 */
export interface FormTemplateVersionListItem {
  id: string;
  status: "draft" | "published" | "superseded";
  versionNumber: number | null;
  basedOnVersionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FormTemplateVersionsListData {
  versions: FormTemplateVersionListItem[];
}

/**
 * Audit event projection for the admin changelog timeline.
 *
 * The DB row carries large `before` / `after` snapshots and free-form
 * `metadata`; we surface only the small, presentation-relevant subset
 * here so the list endpoint stays cheap and stable.
 */
export interface FormTemplateAuditEventListItem {
  id: string;
  eventType: FormTemplateAuditEventTypeWire;
  subjectType: FormTemplateAuditSubjectWire;
  subjectId: string | null;
  formTemplateVersionId: string | null;
  /** Optional human-readable summary persisted by the emitter. */
  summary: string | null;
  /** ISO timestamp of the audit event. */
  createdAt: string;
  /** Acting user when available. Falls back to `null` if the row's user has been removed. */
  actor: {
    id: string;
    email: string;
    fullName: string;
  } | null;
}

/**
 * Wire-friendly mirrors of the DB enums. We keep these as string-literal
 * unions (rather than re-exporting the Drizzle enums) so `@supplex/types`
 * does not depend on `@supplex/db`.
 */
export type FormTemplateAuditEventTypeWire =
  | "section_updated"
  | "section_hard_deleted"
  | "field_updated"
  | "field_hard_deleted"
  | "draft_subtree_replaced_on_publish"
  | "version_published"
  | "section_created"
  | "field_created";

export type FormTemplateAuditSubjectWire =
  | "template"
  | "version"
  | "section"
  | "field";

export interface FormTemplateAuditEventsListData {
  events: FormTemplateAuditEventListItem[];
  /**
   * Opaque cursor for the next page. `null` when the caller has fetched
   * the tail of the timeline. Cursors are not URL-safe-encoded here;
   * callers should treat them as opaque strings.
   */
  nextCursor: string | null;
}

/**
 * `GET /api/form-templates/:id/usage`
 *
 * Steady-state view of who is using this template container — usable
 * whether or not a draft exists. Mirrors the buckets surfaced by the
 * publish preview so the UI can render one shared component.
 */
export interface FormTemplateUsageData {
  /**
   * Id of the current published head version, or `null` when the
   * template has never been published. Useful for cross-linking from the
   * usage tab into the versions list.
   */
  publishedHeadVersionId: string | null;
  publishedHeadVersionNumber: number | null;
  impact: FormTemplatePublishImpact;
}

/**
 * `GET /api/form-templates/:id/version-diff?fromVersionId=&toVersionId=`
 *
 * Structural diff between two versions of the same template, computed
 * with the existing `loadFormTemplateStructureSnapshot` +
 * `diffFormTemplateStructureSnapshots` helpers used by publish preview.
 *
 * `fromVersion` / `toVersion` echo the requested ids and their version
 * numbers so the UI does not have to cross-reference the versions list.
 */
export interface FormTemplateVersionDiffData {
  fromVersion: FormTemplateVersionDiffSideMeta;
  toVersion: FormTemplateVersionDiffSideMeta;
  diff: FormTemplateStructureDiff;
  structureDiffSummary: FormTemplateStructureDiffSummary;
  structureChanged: boolean;
}

export interface FormTemplateVersionDiffSideMeta {
  id: string;
  status: "draft" | "published" | "superseded";
  versionNumber: number | null;
}
