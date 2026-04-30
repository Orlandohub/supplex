/**
 * Comment Thread Schema
 * Story: 2.2.8 - Workflow Execution Engine
 *
 * Stores decline comments and threaded responses for workflow steps
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { tenants } from "./tenants";
import { users } from "./users";
import { processInstance } from "./process-instance";
import { stepInstance } from "./step-instance";

export const commentThread = pgTable(
  "comment_thread",
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
    entityType: varchar("entity_type", { length: 50 }).notNull(), // 'form' or 'document'
    entityId: uuid("entity_id"), // nullable - for future use
    // Self-referential foreign key. At Drizzle 0.30.x, the table type is not
    // yet constructed inside its own schema body, so the `references()` callback
    // cannot be typed as `() => AnyPgColumn` without forming an unsatisfiable
    // recursive constraint. The `(): any` return-type annotation is the
    // documented Drizzle workaround for this case (see drizzle-orm#1903) and is
    // the single sanctioned `any` in `packages/db/src/**` non-test code.
    // Re-evaluate on the next Drizzle minor.
    parentCommentId: uuid("parent_comment_id").references(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle self-reference workaround, see comment above
      (): any => commentThread.id,
      { onDelete: "cascade" }
    ),
    commentText: text("comment_text").notNull(),
    commentedBy: uuid("commented_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    tenantProcessStepIdx: index("idx_comment_thread_tenant_process_step")
      .on(table.tenantId, table.processInstanceId, table.stepInstanceId)
      .where(sql`${table.deletedAt} IS NULL`),
    parentIdx: index("idx_comment_thread_parent")
      .on(table.parentCommentId)
      .where(
        sql`${table.deletedAt} IS NULL AND ${table.parentCommentId} IS NOT NULL`
      ),
    userIdx: index("idx_comment_thread_user")
      .on(table.commentedBy, table.tenantId)
      .where(sql`${table.deletedAt} IS NULL`),
  })
);

// Relations
export const commentThreadRelations = relations(
  commentThread,
  ({ one, many }) => ({
    tenant: one(tenants, {
      fields: [commentThread.tenantId],
      references: [tenants.id],
    }),
    processInstance: one(processInstance, {
      fields: [commentThread.processInstanceId],
      references: [processInstance.id],
    }),
    stepInstance: one(stepInstance, {
      fields: [commentThread.stepInstanceId],
      references: [stepInstance.id],
    }),
    commentedByUser: one(users, {
      fields: [commentThread.commentedBy],
      references: [users.id],
    }),
    parentComment: one(commentThread, {
      fields: [commentThread.parentCommentId],
      references: [commentThread.id],
      relationName: "commentReplies",
    }),
    replies: many(commentThread, {
      relationName: "commentReplies",
    }),
  })
);

// Type for inserting/selecting comment threads
export type InsertCommentThread = typeof commentThread.$inferInsert;
export type SelectCommentThread = typeof commentThread.$inferSelect;
