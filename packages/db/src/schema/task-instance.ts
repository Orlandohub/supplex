import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { tenants } from "./tenants";
import { users } from "./users";
import { processInstance } from "./process-instance";
import { stepInstance } from "./step-instance";

/**
 * Task Assignee Type Enum Values
 * Defines how a task is assigned
 */
export const TaskAssigneeType = {
  ROLE: "role",
  USER: "user",
} as const;

export type TaskAssigneeTypeType =
  (typeof TaskAssigneeType)[keyof typeof TaskAssigneeType];

/**
 * Task Instance Status Enum Values
 * Represents the current state of a runtime task
 */
export const TaskInstanceStatus = {
  PENDING: "pending",
  COMPLETED: "completed",
} as const;

export type TaskInstanceStatusType =
  (typeof TaskInstanceStatus)[keyof typeof TaskInstanceStatus];

/**
 * Task Type — PostgreSQL ENUM (migration 0028)
 * Categorises what kind of task this is.
 */
export const taskTypeEnum = pgEnum("task_type", [
  "action",
  "validation",
  "resubmission",
]);

export const TaskType = {
  ACTION: "action",
  VALIDATION: "validation",
  RESUBMISSION: "resubmission",
} as const;

export type TaskTypeType = (typeof TaskType)[keyof typeof TaskType];

/**
 * Task Outcome — PostgreSQL ENUM (migration 0028)
 * Records what happened when the task was completed. NULL while pending.
 */
export const taskOutcomeEnum = pgEnum("task_outcome", [
  "submitted",
  "approved",
  "declined",
  "auto_closed",
]);

export const TaskOutcome = {
  SUBMITTED: "submitted",
  APPROVED: "approved",
  DECLINED: "declined",
  AUTO_CLOSED: "auto_closed",
} as const;

export type TaskOutcomeType = (typeof TaskOutcome)[keyof typeof TaskOutcome];

/**
 * Task Instance Table
 * Runtime execution of tasks within a workflow step
 * Tasks are created when step_instance transitions to active
 * 
 * Changes in Story 2.2.5.1:
 * - Removed task_template_id (no more templates)
 * - Removed assigned_to (replaced with assignee_type + assignee_role/assignee_user_id)
 * - Added assignee_type, assignee_role, assignee_user_id for flexible assignment
 * - Added completion_time_days (from workflow step config)
 * - Renamed due_date to due_at
 * - step_instance_id is now NOT NULL (all tasks belong to a step)
 * - Simplified status to 'pending' and 'completed'
 *
 * Tenant Isolation:
 * - All queries must filter by tenant_id
 * - Inherits tenant_id from process_instance
 * - CASCADE delete when tenant, process_instance, or step_instance is removed
 *
 * Indexes:
 * - (tenant_id, assignee_type, assignee_role, status) WHERE status = 'pending' - for role-based task lists
 * - (tenant_id, assignee_user_id, status) WHERE assignee_type = 'user' AND status = 'pending' - for user task lists
 * - (process_instance_id, step_instance_id) - for workflow task retrieval
 * - (tenant_id, due_at) WHERE status = 'pending' - for overdue task detection
 *
 * Foreign Key Cascade Rules:
 * - tenant_id: CASCADE - when tenant deleted, all task instances deleted
 * - process_instance_id: CASCADE - when process deleted, all tasks deleted
 * - step_instance_id: CASCADE - when step deleted, all tasks deleted
 * - assignee_user_id: RESTRICT - cannot delete user assigned to tasks (audit trail)
 * - completed_by: RESTRICT - cannot delete users who completed tasks (audit trail)
 */
export const taskInstance = pgTable(
  "task_instance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    processInstanceId: uuid("process_instance_id")
      .notNull()
      .references(() => processInstance.id, { onDelete: "cascade" }),
    stepInstanceId: uuid("step_instance_id")
      .notNull()
      .references(() => stepInstance.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 300 }).notNull(),
    description: text("description"),
    assigneeType: varchar("assignee_type", { length: 50 })
      .notNull()
      .default(TaskAssigneeType.USER),
    assigneeRole: varchar("assignee_role", { length: 50 }),
    assigneeUserId: uuid("assignee_user_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    completionTimeDays: integer("completion_time_days"),
    dueAt: timestamp("due_at", { withTimezone: true, mode: "date" }),
    validationRound: integer("validation_round"),
    taskType: taskTypeEnum("task_type").notNull().default("action"),
    status: varchar("status", { length: 50 })
      .notNull()
      .default(TaskInstanceStatus.PENDING),
    outcome: taskOutcomeEnum("outcome"),
    completedBy: uuid("completed_by").references(() => users.id, {
      onDelete: "restrict",
    }),
    completedAt: timestamp("completed_at", {
      withTimezone: true,
      mode: "date",
    }),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (table) => ({
    // Partial index on (tenant_id, assignee_type, assignee_role, status) for role-based task lists
    tenantAssigneeStatusIdx: index("idx_task_instance_tenant_assignee_status")
      .on(table.tenantId, table.assigneeType, table.assigneeRole, table.status)
      .where(
        sql`${table.status} = 'pending' AND ${table.deletedAt} IS NULL`
      ),
    // Partial index on (tenant_id, assignee_user_id, status) for user-based task lists
    tenantAssigneeUserStatusIdx: index(
      "idx_task_instance_tenant_assignee_user_status"
    )
      .on(table.tenantId, table.assigneeUserId, table.status)
      .where(
        sql`${table.assigneeType} = 'user' AND ${table.status} = 'pending' AND ${table.deletedAt} IS NULL`
      ),
    // Composite index on (process_instance_id, step_instance_id) for workflow task retrieval
    processStepIdx: index("idx_task_instance_process_step")
      .on(table.processInstanceId, table.stepInstanceId)
      .where(sql`${table.deletedAt} IS NULL`),
    // Partial index on (tenant_id, due_at) for overdue task detection
    tenantDueAtIdx: index("idx_task_instance_tenant_due_at")
      .on(table.tenantId, table.dueAt)
      .where(sql`${table.status} = 'pending' AND ${table.deletedAt} IS NULL`),
    // Story 2.2.19: Idempotency — one pending validation task per role per step
    stepValidationRolePendingIdx: uniqueIndex("idx_task_instance_step_validation_role_pending")
      .on(table.stepInstanceId, table.taskType, table.assigneeRole)
      .where(sql`${table.status} = 'pending' AND ${table.deletedAt} IS NULL AND ${table.taskType} = 'validation'`),
    // Story 2.2.19: Idempotency — one pending action/resubmission task per step
    stepActionPendingIdx: uniqueIndex("idx_task_instance_step_action_pending")
      .on(table.stepInstanceId, table.taskType)
      .where(sql`${table.status} = 'pending' AND ${table.deletedAt} IS NULL AND ${table.taskType} IN ('action', 'resubmission')`),
    // Story 2.2.19: Performance index for validation approval path
    stepStatusIdx: index("idx_task_instance_step_status")
      .on(table.stepInstanceId, table.status)
      .where(sql`${table.deletedAt} IS NULL`),
  })
);

/**
 * Task Instance Relations
 * Defines relationships with other tables for type-safe joins
 */
export const taskInstanceRelations = relations(taskInstance, ({ one }) => ({
  tenant: one(tenants, {
    fields: [taskInstance.tenantId],
    references: [tenants.id],
  }),
  processInstance: one(processInstance, {
    fields: [taskInstance.processInstanceId],
    references: [processInstance.id],
  }),
  stepInstance: one(stepInstance, {
    fields: [taskInstance.stepInstanceId],
    references: [stepInstance.id],
  }),
  assignedUser: one(users, {
    fields: [taskInstance.assigneeUserId],
    references: [users.id],
    relationName: "assignedTasks",
  }),
  completedByUser: one(users, {
    fields: [taskInstance.completedBy],
    references: [users.id],
    relationName: "completedTasks",
  }),
}));

// Type for inserting/selecting task instances
export type InsertTaskInstance = typeof taskInstance.$inferInsert;
export type SelectTaskInstance = typeof taskInstance.$inferSelect;
