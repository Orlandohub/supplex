import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { tenants } from "./tenants";
import { users } from "./users";
import { workflowStepTemplate } from "./workflow-step-template";

/**
 * Approver Type Enum
 * Defines whether approver is a role or specific user
 */
export const approverTypeEnum = pgEnum("approver_type", ["role", "user"]);

/**
 * Step Approver Table
 * Defines approvers for multi-approver workflow steps
 * Used when workflow_step_template.multi_approver = true
 *
 * Tenant Isolation:
 * - All queries must filter by tenant_id
 * - CASCADE delete when tenant or workflow_step_template is removed
 * - RESTRICT delete when approver_user_id is removed (audit trail)
 *
 * Multi-Approver Logic:
 * When workflow_step_template.multi_approver = true:
 * - This table defines who can approve (role-based or user-specific)
 * - workflow_step_template.approver_count specifies how many approvals needed
 * - Workflow engine creates one task_instance per approver
 * - Step completes when approver_count tasks marked completed
 *
 * Approver Types:
 * - 'role': Any user with the specified role can approve
 *   - approver_role contains role name (e.g., 'procurement_manager')
 *   - One user action counts as one approval
 *   - Multiple users with same role can approve independently
 * - 'user': Only specific user can approve
 *   - approver_user_id contains user ID
 *   - Ensures specific person must approve (e.g., CEO approval)
 *
 * Ordering:
 * - approver_order defines the sequence (1, 2, 3, ...)
 * - Used for UI display order and logging
 * - All approvers can act in parallel (not sequential)
 *
 * Example Configuration:
 * Step: "Multi-Department Approval"
 * - multi_approver = true
 * - approver_count = 2
 * - step_approver records:
 *   1. approver_order=1, approver_type='role', approver_role='procurement_manager'
 *   2. approver_order=2, approver_type='role', approver_role='quality_manager'
 *   3. approver_order=3, approver_type='user', approver_user_id='...' (CEO)
 * - Step completes when any 2 of these 3 approve
 *
 * Indexes:
 * - (tenant_id, workflow_step_template_id, approver_order) - for ordered approver retrieval
 */
export const stepApprover = pgTable(
  "step_approver",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workflowStepTemplateId: uuid("workflow_step_template_id")
      .notNull()
      .references(() => workflowStepTemplate.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    approverOrder: integer("approver_order").notNull(),
    approverType: approverTypeEnum("approver_type").notNull(),
    approverRole: varchar("approver_role", { length: 50 }),
    approverUserId: uuid("approver_user_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (table) => ({
    // Composite index on (tenant_id, workflow_step_template_id, approver_order) for ordered approver retrieval
    tenantStepOrderIdx: index("idx_step_approver_tenant_step_order")
      .on(table.tenantId, table.workflowStepTemplateId, table.approverOrder)
      .where(sql`${table.deletedAt} IS NULL`),
  })
);

/**
 * Step Approver Relations
 * Defines relationships with other tables for type-safe joins
 */
export const stepApproverRelations = relations(stepApprover, ({ one }) => ({
  workflowStepTemplate: one(workflowStepTemplate, {
    fields: [stepApprover.workflowStepTemplateId],
    references: [workflowStepTemplate.id],
  }),
  tenant: one(tenants, {
    fields: [stepApprover.tenantId],
    references: [tenants.id],
  }),
  approverUser: one(users, {
    fields: [stepApprover.approverUserId],
    references: [users.id],
  }),
}));

// Type for inserting/selecting step approvers
export type InsertStepApprover = typeof stepApprover.$inferInsert;
export type SelectStepApprover = typeof stepApprover.$inferSelect;

