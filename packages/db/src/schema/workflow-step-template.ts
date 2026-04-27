import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import type { ValidationConfig } from "@supplex/types";
import { tenants } from "./tenants";
import { users } from "./users";
import { workflowTemplate } from "./workflow-template";
import { formTemplate } from "./form-template";
import { documentTemplate } from "./document-template";
import { workflowType } from "./workflow-type";

/**
 * Step Type Enum
 * Defines the type of action required in a workflow step
 */
export const stepTypeEnum = pgEnum("step_type", [
  "form",
  "approval",
  "document",
  "task",
]);

/**
 * Form Action Mode Enum
 * Defines how forms are used in workflow steps
 */
export const formActionModeEnum = pgEnum("form_action_mode", [
  "fill_out",
  "validate",
]);

/**
 * Document Action Mode Enum
 * Defines how documents are used in workflow steps
 */
export const documentActionModeEnum = pgEnum("document_action_mode", [
  "upload",
  "validate",
]);

/**
 * Assignee Type Enum
 * Defines whether step is assigned to a role or specific user
 */
export const assigneeTypeEnum = pgEnum("assignee_type", ["role", "user"]);

/**
 * Workflow Step Template Table
 * Defines individual steps within a workflow template
 * Each step specifies task configuration, form/document integration, and approval requirements
 *
 * Tenant Isolation:
 * - All queries must filter by tenant_id
 * - CASCADE delete when tenant or workflow_template is removed
 * - RESTRICT delete when assignee_user_id, form_template_id, or document_template_id is removed
 *
 * Task Configuration (Runtime Task Creation):
 * When step_instance becomes 'active', workflow engine creates task_instance using:
 * - task_title → task_instance.title
 * - task_description → task_instance.description
 * - due_days → calculate task_instance.due_at (step start + due_days)
 * - assignee_type → task_instance.assignee_type ('role' or 'user')
 * - assignee_role → task_instance.assignee_role (if type = 'role')
 * - assignee_user_id → task_instance.assignee_user_id (if type = 'user')
 *
 * Form Integration:
 * - form_template_id: FK to form template to use
 * - form_action_mode:
 *   - 'fill_out': User edits form and submits (initial data entry)
 *   - 'validate': User reviews read-only form and approves/declines (approval step)
 *
 * Document Integration:
 * - document_template_id: FK to document template to use
 * - document_action_mode:
 *   - 'upload': User uploads required documents and submits
 *   - 'validate': User reviews documents and approves/declines
 *
 * Decline Behavior:
 * - decline_returns_to_step_offset: Relative offset for decline workflow return
 * - Default: 1 (returns to immediately previous step)
 * - Example: Step 4 declines → returns to Step 3 (offset=1) or Step 2 (offset=2)
 * - Returned step becomes 'active', user can modify and resubmit
 *
 * Auto-Validation Configuration (Story 2.2.15):
 * - requires_validation: When true, system creates validation tasks automatically after step completion
 * - validation_config: JSONB containing approver roles configuration
 *   - Structure: { "approverRoles": ["role1", "role2"], "requireAllApprovals": false }
 *   - Validation: If requires_validation=true, approverRoles must be non-empty
 * - Workflow engine creates validation task_instance for each role in approverRoles
 * - Next step activates only after all validation tasks are approved
 *
 * Indexes:
 * - (tenant_id, workflow_template_id, step_order) - for ordered step retrieval
 * - (form_template_id) - for form usage tracking
 * - (document_template_id) - for document template usage tracking
 */
export const workflowStepTemplate = pgTable(
  "workflow_step_template",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workflowTemplateId: uuid("workflow_template_id")
      .notNull()
      .references(() => workflowTemplate.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    stepOrder: integer("step_order").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    stepType: stepTypeEnum("step_type").notNull(),

    // Task configuration (used to create task_instance when step starts)
    taskTitle: varchar("task_title", { length: 300 }),
    taskDescription: text("task_description"),
    dueDays: integer("due_days"),
    assigneeType: assigneeTypeEnum("assignee_type"),
    assigneeRole: varchar("assignee_role", { length: 50 }),
    assigneeUserId: uuid("assignee_user_id").references(() => users.id, {
      onDelete: "restrict",
    }),

    // Form integration
    formTemplateId: uuid("form_template_id").references(() => formTemplate.id, {
      onDelete: "restrict",
    }),
    formActionMode: formActionModeEnum("form_action_mode"),

    // Document integration
    documentTemplateId: uuid("document_template_id").references(
      () => documentTemplate.id,
      { onDelete: "restrict" }
    ),
    documentActionMode: documentActionModeEnum("document_action_mode"),

    // Decline behavior
    declineReturnsToStepOffset: integer("decline_returns_to_step_offset")
      .notNull()
      .default(1),

    // Auto-validation configuration (Story 2.2.15)
    requiresValidation: boolean("requires_validation").notNull().default(false),
    validationConfig: jsonb("validation_config")
      .$type<ValidationConfig | Record<string, never>>()
      .notNull()
      .default({}),

    // Extensible configuration
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (table) => ({
    // Composite index on (tenant_id, workflow_template_id, step_order) for ordered step retrieval
    tenantTemplateOrderIdx: index(
      "idx_workflow_step_template_tenant_template_order"
    )
      .on(table.tenantId, table.workflowTemplateId, table.stepOrder)
      .where(sql`${table.deletedAt} IS NULL`),
    // Index on form_template_id for form usage tracking
    formTemplateIdx: index("idx_workflow_step_template_form_template")
      .on(table.formTemplateId)
      .where(
        sql`${table.deletedAt} IS NULL AND ${table.formTemplateId} IS NOT NULL`
      ),
    // Index on document_template_id for document template usage tracking
    documentTemplateIdx: index("idx_workflow_step_template_document_template")
      .on(table.documentTemplateId)
      .where(
        sql`${table.deletedAt} IS NULL AND ${table.documentTemplateId} IS NOT NULL`
      ),
    // Index on requires_validation for efficient validation lookup (Story 2.2.15)
    requiresValidationIdx: index("idx_workflow_step_requires_validation")
      .on(table.requiresValidation)
      .where(
        sql`${table.requiresValidation} = true AND ${table.deletedAt} IS NULL`
      ),
  })
);

/**
 * Workflow Step Template Relations
 * Defines relationships with other tables for type-safe joins
 * Updated: Story 2.2.14 - All relations consolidated here, including approvers
 */
export const workflowStepTemplateRelations = relations(
  workflowStepTemplate,
  ({ one }) => ({
    workflowTemplate: one(workflowTemplate, {
      fields: [workflowStepTemplate.workflowTemplateId],
      references: [workflowTemplate.id],
    }),
    tenant: one(tenants, {
      fields: [workflowStepTemplate.tenantId],
      references: [tenants.id],
    }),
    formTemplate: one(formTemplate, {
      fields: [workflowStepTemplate.formTemplateId],
      references: [formTemplate.id],
    }),
    documentTemplate: one(documentTemplate, {
      fields: [workflowStepTemplate.documentTemplateId],
      references: [documentTemplate.id],
    }),
    assigneeUser: one(users, {
      fields: [workflowStepTemplate.assigneeUserId],
      references: [users.id],
    }),
  })
);

/**
 * Workflow Template Relations - Steps
 * Defines ALL relationships for workflowTemplate
 * Must be defined here (not in workflow-template.ts) to have access to workflowStepTemplate
 */
export const workflowTemplateRelations = relations(
  workflowTemplate,
  ({ one, many }) => ({
    tenant: one(tenants, {
      fields: [workflowTemplate.tenantId],
      references: [tenants.id],
    }),
    creator: one(users, {
      fields: [workflowTemplate.createdBy],
      references: [users.id],
    }),
    workflowType: one(workflowType, {
      fields: [workflowTemplate.workflowTypeId],
      references: [workflowType.id],
    }),
    steps: many(workflowStepTemplate),
  })
);

// Type for inserting/selecting workflow step templates
export type InsertWorkflowStepTemplate =
  typeof workflowStepTemplate.$inferInsert;
export type SelectWorkflowStepTemplate =
  typeof workflowStepTemplate.$inferSelect;
