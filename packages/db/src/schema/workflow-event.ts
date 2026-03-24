import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { tenants } from "./tenants";
import { users } from "./users";
import { processInstance } from "./process-instance";
import { stepInstance } from "./step-instance";
import { taskInstance } from "./task-instance";

/**
 * Workflow Event Table
 * Immutable, append-only audit/event log for all workflow actions.
 * Used for workflow history display and tenant-wide audit trail.
 *
 * Design:
 * - No updated_at column (events are never modified)
 * - Actor name/role denormalized at write time for historical accuracy
 * - Fire-and-forget: logging failures must not block workflow actions
 *
 * Indexes:
 * - (tenant_id, process_instance_id, created_at) — process history queries
 * - (tenant_id, created_at DESC) — tenant-wide audit log
 * - (event_type) — event type filtering
 */
export const workflowEvent = pgTable(
  "workflow_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    processInstanceId: uuid("process_instance_id").references(
      () => processInstance.id,
      { onDelete: "set null" }
    ),
    stepInstanceId: uuid("step_instance_id").references(
      () => stepInstance.id,
      { onDelete: "set null" }
    ),
    taskInstanceId: uuid("task_instance_id").references(
      () => taskInstance.id,
      { onDelete: "set null" }
    ),
    eventType: varchar("event_type", { length: 50 }).notNull(),
    eventDescription: varchar("event_description", { length: 500 }).notNull(),
    actorUserId: uuid("actor_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    actorName: varchar("actor_name", { length: 255 }).notNull(),
    actorRole: varchar("actor_role", { length: 50 }).notNull(),
    entityType: varchar("entity_type", { length: 50 }),
    entityId: uuid("entity_id"),
    comment: text("comment"),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    processIdx: index("idx_workflow_event_process").on(
      table.tenantId,
      table.processInstanceId,
      table.createdAt
    ),
    tenantTimeIdx: index("idx_workflow_event_tenant_time").on(
      table.tenantId,
      table.createdAt
    ),
    eventTypeIdx: index("idx_workflow_event_type").on(table.eventType),
  })
);

export const workflowEventRelations = relations(workflowEvent, ({ one }) => ({
  tenant: one(tenants, {
    fields: [workflowEvent.tenantId],
    references: [tenants.id],
  }),
  actor: one(users, {
    fields: [workflowEvent.actorUserId],
    references: [users.id],
  }),
  process: one(processInstance, {
    fields: [workflowEvent.processInstanceId],
    references: [processInstance.id],
  }),
  step: one(stepInstance, {
    fields: [workflowEvent.stepInstanceId],
    references: [stepInstance.id],
  }),
  task: one(taskInstance, {
    fields: [workflowEvent.taskInstanceId],
    references: [taskInstance.id],
  }),
}));

export type InsertWorkflowEvent = typeof workflowEvent.$inferInsert;
export type SelectWorkflowEvent = typeof workflowEvent.$inferSelect;
