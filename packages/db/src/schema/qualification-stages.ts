import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  integer,
  text,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { qualificationWorkflows } from "./qualification-workflows";
import { users } from "./users";

/**
 * Stage Status Enum Values
 * Represents the approval status of a single qualification stage
 */
export const StageStatus = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
} as const;

export type StageStatusType = (typeof StageStatus)[keyof typeof StageStatus];

/**
 * Qualification Stages Table
 * Individual approval stages within a qualification workflow
 *
 * Stage Numbers:
 * - 1: Initial Review (Procurement)
 * - 2: Technical Assessment (Quality)
 * - 3: Final Approval (Management)
 *
 * Indexes:
 * - (workflow_id, stage_number) - for sequential stage retrieval
 * - (assigned_to) WHERE status = 'Pending' - for user task lists
 */
export const qualificationStages = pgTable(
  "qualification_stages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workflowId: uuid("workflow_id")
      .notNull()
      .references(() => qualificationWorkflows.id, { onDelete: "cascade" }),
    stageNumber: integer("stage_number").notNull(),
    stageName: varchar("stage_name", { length: 100 }).notNull(),
    assignedTo: uuid("assigned_to")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    status: varchar("status", { length: 50 })
      .notNull()
      .default(StageStatus.PENDING),
    reviewedBy: uuid("reviewed_by").references(() => users.id, {
      onDelete: "restrict",
    }),
    reviewedDate: timestamp("reviewed_date", {
      withTimezone: true,
      mode: "date",
    }),
    comments: text("comments"),
    attachments: jsonb("attachments").notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (table) => ({
    // Composite index on (workflow_id, stage_number) for sequential stage retrieval
    workflowStageIdx: index("idx_qualification_stages_workflow_stage").on(
      table.workflowId,
      table.stageNumber
    ),
    // Partial index on (assigned_to) WHERE status = 'Pending' for user task lists
    assignedToPendingIdx: index("idx_qualification_stages_assigned_to_pending")
      .on(table.assignedTo)
      .where(sql`${table.status} = 'Pending'`),
  })
);

// Type for inserting/selecting qualification stages
export type InsertQualificationStage = typeof qualificationStages.$inferInsert;
export type SelectQualificationStage = typeof qualificationStages.$inferSelect;
