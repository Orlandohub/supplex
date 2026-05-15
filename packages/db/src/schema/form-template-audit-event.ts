import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { tenants } from "./tenants";
import { users } from "./users";
import { formTemplate } from "./form-template";
import { formTemplateVersion } from "./form-template-version";

/**
 * Form Template Audit Event Type Enum
 * Append-only changelog of structural changes against a form template's
 * version subtree (draft mutations + publish lifecycle).
 */
export const formTemplateAuditEventTypeEnum = pgEnum(
  "form_template_audit_event_type",
  [
    "section_updated",
    "section_hard_deleted",
    "field_updated",
    "field_hard_deleted",
    "draft_subtree_replaced_on_publish",
    "version_published",
    "section_created",
    "field_created",
  ]
);

export const FormTemplateAuditEventType = {
  SECTION_UPDATED: "section_updated",
  SECTION_HARD_DELETED: "section_hard_deleted",
  FIELD_UPDATED: "field_updated",
  FIELD_HARD_DELETED: "field_hard_deleted",
  DRAFT_SUBTREE_REPLACED_ON_PUBLISH: "draft_subtree_replaced_on_publish",
  VERSION_PUBLISHED: "version_published",
  SECTION_CREATED: "section_created",
  FIELD_CREATED: "field_created",
} as const;

export type FormTemplateAuditEventTypeValue =
  (typeof FormTemplateAuditEventType)[keyof typeof FormTemplateAuditEventType];

/**
 * Form Template Audit Subject Enum
 * Identifies the kind of row (or summary) the event is about.
 */
export const formTemplateAuditSubjectEnum = pgEnum(
  "form_template_audit_subject",
  ["template", "version", "section", "field"]
);

export const FormTemplateAuditSubject = {
  TEMPLATE: "template",
  VERSION: "version",
  SECTION: "section",
  FIELD: "field",
} as const;

export type FormTemplateAuditSubjectValue =
  (typeof FormTemplateAuditSubject)[keyof typeof FormTemplateAuditSubject];

/**
 * Form Template Audit Event Table
 * Tenant-scoped, append-only audit trail for form template structural changes.
 *
 * Tenant Isolation:
 * - All queries must filter by tenant_id
 * - CASCADE delete only when the tenant itself is removed
 *
 * Lifecycle Notes:
 * - `form_template_version_id` is SET NULL if the version row is later removed
 *   (e.g. draft replaced on publish), so historical events remain visible.
 * - `actor_user_id` is RESTRICT to keep an attributable trail of admin actions.
 * - `before` / `after` capture full row snapshots (JSONB) for delete/update events;
 *   publish summaries put metadata on `metadata` instead.
 */
export const formTemplateAuditEvent = pgTable(
  "form_template_audit_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    formTemplateId: uuid("form_template_id")
      .notNull()
      .references(() => formTemplate.id, { onDelete: "cascade" }),
    formTemplateVersionId: uuid("form_template_version_id").references(
      () => formTemplateVersion.id,
      { onDelete: "set null" }
    ),
    actorUserId: uuid("actor_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    eventType: formTemplateAuditEventTypeEnum("event_type").notNull(),
    subjectType: formTemplateAuditSubjectEnum("subject_type").notNull(),
    subjectId: uuid("subject_id"),
    before: jsonb("before"),
    after: jsonb("after"),
    metadata: jsonb("metadata").notNull().default({}),
    summary: varchar("summary", { length: 500 }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tenantTemplateTimeIdx: index(
      "idx_form_template_audit_event_tenant_template_time"
    ).on(table.tenantId, table.formTemplateId, table.createdAt),
    tenantVersionTimeIdx: index(
      "idx_form_template_audit_event_tenant_version_time"
    ).on(table.tenantId, table.formTemplateVersionId, table.createdAt),
    eventTypeIdx: index("idx_form_template_audit_event_type").on(
      table.eventType
    ),
  })
);

export const formTemplateAuditEventRelations = relations(
  formTemplateAuditEvent,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [formTemplateAuditEvent.tenantId],
      references: [tenants.id],
    }),
    template: one(formTemplate, {
      fields: [formTemplateAuditEvent.formTemplateId],
      references: [formTemplate.id],
    }),
    version: one(formTemplateVersion, {
      fields: [formTemplateAuditEvent.formTemplateVersionId],
      references: [formTemplateVersion.id],
    }),
    actor: one(users, {
      fields: [formTemplateAuditEvent.actorUserId],
      references: [users.id],
    }),
  })
);

export type InsertFormTemplateAuditEvent =
  typeof formTemplateAuditEvent.$inferInsert;
export type SelectFormTemplateAuditEvent =
  typeof formTemplateAuditEvent.$inferSelect;
