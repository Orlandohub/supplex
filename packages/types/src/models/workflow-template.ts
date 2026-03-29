/**
 * Workflow Template Data Models
 * TypeScript types and enums for workflow template system (without versioning)
 * Shared between frontend (Remix) and backend (ElysiaJS)
 * Templates can be copied to create new drafts for editing
 */

/**
 * Workflow Template Status Enum
 * Defines the lifecycle states of a workflow template
 */
export enum WorkflowTemplateStatus {
  DRAFT = "draft",
  PUBLISHED = "published",
  ARCHIVED = "archived",
}

/**
 * Workflow Step Type Enum
 * Defines the type of action required in a workflow step
 */
export enum WorkflowStepType {
  FORM = "form",
  /** @deprecated Approvals are handled via form/document validate mode */
  APPROVAL = "approval",
  DOCUMENT = "document",
  /** @deprecated Task-only steps are no longer used */
  TASK = "task",
}

/**
 * Form Action Mode Enum
 * Defines how forms are used in workflow steps
 */
export enum FormActionMode {
  FILL_OUT = "fill_out",
  VALIDATE = "validate",
}

/**
 * Document Action Mode Enum
 * Defines how documents are used in workflow steps
 */
export enum DocumentActionMode {
  UPLOAD = "upload",
  VALIDATE = "validate",
}

/**
 * Assignee Type Enum
 * Defines whether step is assigned to a role or specific user
 */
export enum AssigneeType {
  ROLE = "role",
  USER = "user",
}

/**
 * Approver Type Enum
 * Defines whether approver is a role or specific user
 */
export enum ApproverType {
  ROLE = "role",
  USER = "user",
}

/**
 * Validation Config Interface (Story 2.2.15)
 * Configuration for automatic validation task creation
 */
export interface ValidationConfig {
  approverRoles: string[]; // Roles that can approve validation (must be non-empty if requiresValidation=true)
  requireAllApprovals?: boolean; // Future enhancement: require all approvals (default: false)
}

/**
 * Workflow Template Interface
 * Tenant-isolated workflow template definition
 * Organizations create workflows freely using descriptive names
 */
export interface WorkflowTemplate {
  id: string; // UUID
  tenantId: string; // FK to tenants - CASCADE delete
  name: string; // Display name (e.g., "Supplier Qualification - ISO Certified Vendors")
  description: string | null; // Template purpose and categorization
  active: boolean; // Controls whether template can be instantiated - default: true
  status: WorkflowTemplateStatus; // 'draft' | 'published' | 'archived'
  workflowTypeId: string | null; // FK to workflow_type - SET NULL on delete
  createdBy: string; // User ID - RESTRICT delete
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/**
 * Workflow Step Template Interface
 * Defines individual step within a workflow template
 */
export interface WorkflowStepTemplate {
  id: string; // UUID
  workflowTemplateId: string; // FK to workflow_template - CASCADE delete
  tenantId: string; // FK to tenants - CASCADE delete
  stepOrder: number; // Sequential step order (1, 2, 3, ...)
  name: string; // Step display name
  stepType: WorkflowStepType; // 'form' | 'approval' | 'document' | 'task'

  // Task configuration (used to create task_instance when step starts)
  taskTitle: string | null; // Title for runtime task
  taskDescription: string | null; // Description for runtime task
  dueDays: number | null; // Days from step start until due
  assigneeType: AssigneeType | null; // 'role' or 'user'
  assigneeRole: string | null; // Role name if assigneeType = 'role'
  assigneeUserId: string | null; // User ID if assigneeType = 'user' - RESTRICT delete

  // Form integration
  formTemplateId: string | null; // FK to form_template - RESTRICT delete
  formActionMode: FormActionMode | null; // 'fill_out' or 'validate'

  // Document integration
  documentTemplateId: string | null; // Reference to document template
  documentActionMode: DocumentActionMode | null; // 'upload' or 'validate'

  // Multi-approver configuration
  multiApprover: boolean; // Default false
  approverCount: number | null; // Number of approvers required if multiApprover = true

  // Decline behavior
  declineReturnsToStepOffset: number; // Default 1 (returns to previous step)

  // Auto-validation configuration (Story 2.2.15)
  requiresValidation: boolean; // When true, system auto-creates validation tasks
  validationConfig: ValidationConfig | Record<string, never>; // Approver roles configuration

  metadata: Record<string, any>; // Extensible configuration
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/**
 * Step Approver Interface
 * Defines approver for multi-approver workflow steps
 */
export interface StepApprover {
  id: string; // UUID
  workflowStepTemplateId: string; // FK to workflow_step_template - CASCADE delete
  tenantId: string; // FK to tenants - CASCADE delete
  approverOrder: number; // Order of approver (1, 2, 3, ...)
  approverType: ApproverType; // 'role' or 'user'
  approverRole: string | null; // Role name if approverType = 'role'
  approverUserId: string | null; // User ID if approverType = 'user' - RESTRICT delete
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/**
 * Workflow Step Template With Approvers
 * Includes list of approvers for a workflow step template
 */
export interface WorkflowStepTemplateWithApprovers
  extends WorkflowStepTemplate {
  approvers: StepApprover[];
}

/**
 * Workflow Template With Steps
 * Includes ordered list of steps for a workflow template
 */
export interface WorkflowTemplateWithSteps extends WorkflowTemplate {
  steps: WorkflowStepTemplateWithApprovers[];
}

