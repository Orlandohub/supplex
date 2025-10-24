import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  numeric,
  integer,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { suppliers } from "./suppliers";
import { users } from "./users";

/**
 * Workflow Status Enum Values
 * Represents the current state of a supplier qualification workflow
 */
export const WorkflowStatus = {
  DRAFT: "Draft",
  STAGE1: "Stage1",
  STAGE2: "Stage2",
  STAGE3: "Stage3",
  APPROVED: "Approved",
  REJECTED: "Rejected",
} as const;

export type WorkflowStatusType =
  (typeof WorkflowStatus)[keyof typeof WorkflowStatus];

/**
 * Qualification Workflows Table
 * Core table for tracking supplier qualification processes
 *
 * Workflow States:
 * - Draft: Initial state, workflow being prepared
 * - Stage1/2/3: In progress through approval stages
 * - Approved: Successfully completed all stages
 * - Rejected: Failed qualification at any stage
 *
 * Indexes:
 * - (tenant_id, supplier_id) - for supplier workflow lookups
 * - (tenant_id, status) - for status filtering
 */
export const qualificationWorkflows = pgTable(
  "qualification_workflows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 50 })
      .notNull()
      .default(WorkflowStatus.DRAFT),
    initiatedBy: uuid("initiated_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    initiatedDate: timestamp("initiated_date", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .defaultNow(),
    currentStage: integer("current_stage").default(0),
    riskScore: numeric("risk_score", { precision: 4, scale: 2 }),
    snapshotedChecklist: jsonb("snapshotted_checklist").notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (table) => ({
    // Composite index on (tenant_id, supplier_id) for supplier workflow lookups
    tenantSupplierIdx: index("idx_qualification_workflows_tenant_supplier").on(
      table.tenantId,
      table.supplierId
    ),
    // Composite index on (tenant_id, status) for status filtering
    tenantStatusIdx: index("idx_qualification_workflows_tenant_status").on(
      table.tenantId,
      table.status
    ),
  })
);

// Type for inserting/selecting qualification workflows
export type InsertQualificationWorkflow =
  typeof qualificationWorkflows.$inferInsert;
export type SelectQualificationWorkflow =
  typeof qualificationWorkflows.$inferSelect;
