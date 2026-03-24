Epic 2.2: Dynamic Forms and Workflow Template Builder (Reusable Engine)

Epic Goal:
Provide a reusable backoffice capability to build dynamic form/questionnaire templates and configurable workflow templates (multiple steps, role-based and multi-approver assignment, task templates, and due dates), architected for reuse across all supplier-related processes, while enforcing strict tenant isolation. Organizations create workflows freely based on name and description.

All templates, workflows, and executions must be isolated by tenant and never shared across tenants unless explicitly granted by a global application owner.

Story 2.2.1: Database Refactor and Decommission of Legacy Qualification Workflow Tables

As a developer,
I need to refactor the database schema to support a reusable, tenant-isolated workflow engine,
so that dynamic forms and workflows are not constrained by qualification-only tables.

Acceptance Criteria:

The following existing tables are not extended with new functionality:

qualification_process

qualification_stages

workflow_documents

workflow_events

qualification_templates

A new, domain-agnostic execution model is introduced using:

process_instance

step_instance

All new workflow execution logic is implemented only using the new tables

Existing qualification tables are treated as legacy and remain unchanged

No data migration from legacy tables to the new engine is required

All new engine tables include tenant_id and enforce tenant isolation

New foreign keys, events, and runtime data must reference the new engine tables only

Story 2.2.2: Form Template Data Model and Versioning (Tenant-Isolated)

As a developer,
I want to define a versioned, tenant-isolated data model for dynamic form templates,
so that forms can be reused safely within a tenant and audited.

Acceptance Criteria:

A form_template entity exists with fields id, tenant_id, name, status

A form_template_version entity exists with tenant_id, version, status, created_at

Supported statuses are draft, published, archived

A form_section entity exists and references form_template_version

A form_field entity exists with:

field_type (text, textarea, number, date, dropdown, checkbox, multi_select)

required

validation_rules

Published versions are immutable

Runtime executions reference a specific form_template_version

A tenant can access only form templates with matching tenant_id

Story 2.2.3: Backoffice Form Builder UI (Tenant Scope)

As an admin,
I want to create and manage form templates in a tenant-scoped backoffice UI,
so that questionnaires are visible only to my company.

Acceptance Criteria:

A backoffice form builder UI exists

admin can manage only form templates belonging to their tenant_id

admin can:

Create and edit form templates in draft status

Add, edit, remove, and reorder sections and fields

Fields can be marked required

Basic validation can be configured

Publishing creates a new immutable form_template_version

Story 2.2.4: Form Runtime Execution with Save Draft

As a supplier_user or internal_user,
I want to fill in forms progressively and save my progress,
so that I can complete long questionnaires over time.

Acceptance Criteria:

Forms render dynamically based on form_template_version

Users can save_draft without completing required fields

Draft submissions remain editable

Users can submit the form only when required fields are completed

After submit, form answers become read-only

Form answers are stored in form_submission and form_answer

Access to submissions is restricted by tenant_id and process context

Story 2.2.5: Task Template Library and Runtime Task Model (Tenant-Isolated)

As an admin,
I want to define reusable task templates per tenant,
so that tasks are consistently created across workflows in my company.

Acceptance Criteria:

A task_template entity exists with tenant_id

A task_instance entity exists for runtime execution

Each task template includes:

title

description

default_due_days

assignee_role (nullable)

Task templates are visible only within the same tenant_id

Runtime tasks are linked to:

process_instance

step_instance

Story 2.2.5.1: Course Correction for Tasks (Remove Task Templates, Create Runtime To-Do Tasks on Step Start)

As a developer,
I want to remove the concept of task templates and generate runtime tasks only when a workflow step starts,
so that tasks act as to-do warnings and are driven by workflow execution.

Acceptance Criteria:

The engine does not use task_template

Tasks are created only as task_instance when a step_instance transitions to active

A task_instance represents a to-do warning and includes:

tenant_id

process_instance_id

step_instance_id

assignee_type (role or user)

assignee_role (nullable)

assignee_user_id (nullable)

title

description

completion_time_days (nullable)

due_at (nullable)

status (open, completed)

Tasks are not configurable via reusable templates

Task title/description/completion_time_days are configured at the workflow step level (template) and instantiated at runtime

Task visibility is tenant-isolated via tenant_id

Story 2.2.6: Workflow Template Data Model (Tenant-Isolated, Multi-Approver, Action Modes)

As a developer,
I want a flexible, tenant-isolated workflow template model with action modes for forms and documents,
so that each tenant can design approval and validation loops correctly.

Acceptance Criteria:

A workflow_template entity exists with tenant_id (process_type removed - organizations create workflows freely by name)

A workflow_template_version entity exists with tenant_id and versioning

A workflow_step_template entity exists with:

step_order

name

task_title

task_description

due_days (nullable)

A step can include an associated form with:

form_template_version_id

form_action_mode with values fill_out or validate

A step can include associated document requirements with:

document_template_id

document_action_mode with values upload or validate

A step supports multi_approver = true

When multi_approver = true:

The step defines approver_count

Each approver definition specifies either:

a role within the tenant, or

a specific user within the tenant

A step supports auto-validation (Story 2.2.15):

requires_validation (boolean) - When true, system automatically creates validation tasks when step completes

validation_config (JSONB) - Contains approverRoles array specifying which roles receive validation tasks

Validation can be configured:
- Manually via formActionMode='validate' or documentActionMode='validate' (legacy approach)
- Automatically via requiresValidation checkbox (Story 2.2.15 - recommended)

A step defines a decline return behavior:

decline_returns_to_step_offset = 1 (returns to the immediately previous step)

Story 2.2.7: Backoffice Workflow Template Builder (Approvers + Form/Document Modes)

As an admin,
I want to configure workflow steps including approvers and form/document action modes,
so that the workflow matches how my organization works.

Acceptance Criteria:

Workflow builder UI exists

admin can create workflow templates scoped to tenant_id

For each step, admin can configure:

Step name

Task title

Task description

Due days (optional)

For each step, admin can optionally attach a form and set:

form_template_version_id (selected from dropdown of published form templates for tenant)

form_action_mode = fill_out or validate

For each step, admin can optionally attach a document template and set:

document_template_id (selected from dropdown of published document templates for tenant)

document_action_mode = upload or validate

For form template selection, admin sees:

A dropdown showing only published form templates for their tenant_id

Dropdown is filtered by: tenant_id = current_user.tenant_id AND status = 'published'

For document template selection, admin sees:

A dropdown showing only published document templates for their tenant_id

Dropdown is filtered by: tenant_id = current_user.tenant_id AND status = 'published'

For multi-approver steps, admin can configure:

Multi-approver flag

Number of approvers

For each approver, admin can select:

A role (tenant-wide), or

A specific user (within the tenant)

For auto-validation steps (Story 2.2.15), admin can configure:

"Requires Validation?" checkbox

Validation approver roles (multi-select):
- Admin
- Procurement Manager
- Quality Manager
- Supplier User

When enabled:
- System automatically creates validation tasks when step completes
- Each selected role receives a validation task
- Next step remains blocked until all validation tasks are approved
- Simpler than manual validation steps (no need to create separate validate steps)

If a role is selected:

All users in the same tenant_id with that role will see and be able to complete the task

Workflow templates can be published, creating immutable versions

Story 2.2.7.1: Course Correction - Remove Process Type Constraint

As a developer,
I want to remove the process_type field from workflow templates,
so that organizations can create workflows freely without system-imposed type constraints.

Acceptance Criteria:

The process_type column is removed from workflow_template table

The idx_workflow_template_tenant_process_status index is dropped

The Drizzle schema workflow-template.ts no longer includes processType field

TypeScript types no longer include processType in WorkflowTemplate interface

All existing workflow templates remain intact

Migration is reversible

Tests are updated to remove process_type expectations

Story 2.2.7.2: Course Correction - Add Tenant-Scoped Dropdowns for Form and Document Templates

As an admin,
I want form and document template selection to show only published templates from my company,
so that I only see relevant templates and cannot accidentally select templates from other tenants.

Acceptance Criteria:

When adding a workflow step with form integration, form template selection is a dropdown

The form template dropdown shows only form templates where tenant_id = current_user.tenant_id AND status = 'published'

Dropdown displays form_template.name with form_template_version.version (e.g., "Supplier Profile v3")

When adding a workflow step with document integration, document template selection is a dropdown

The document template dropdown shows only document templates where tenant_id = current_user.tenant_id AND status = 'published'

If no published templates exist, dropdown shows "No published templates available" message

Dropdown options are sorted alphabetically by name

API endpoints enforce tenant isolation

Story 2.2.8: Workflow Execution Engine (Tenant-Aware, Validate Loops, Comment Threads)

As the system,
I want to execute workflow templates with fill/validate modes and decline loops,
so that users can submit, validate, request changes, and re-submit with comments.

Acceptance Criteria:

Admin selects workflow from dropdown of published workflow templates filtered by tenant_id

A process_instance is created with tenant_id from the workflow template

step_instance records inherit tenant_id

Only the first step is created in active state

Subsequent steps are created in blocked state

When a step becomes active:

The system creates one or more task_instance records for that step (based on approver configuration)

Auto-validation behavior (Story 2.2.15):

When a step with requires_validation=true completes:
- Step status changes to awaiting_validation
- System automatically creates validation task(s) for each role in validation_config.approverRoles
- Each validation task has metadata flag isValidationTask=true
- Next step remains blocked until all validation tasks are approved

When all validation tasks are approved:
- Step status changes to validated
- Next step activates automatically

Form behavior:

If form_action_mode = fill_out:

The assigned user must fill and submit the form

After submission, the workflow proceeds to the next step (or creates validation tasks if requires_validation=true)

If form_action_mode = validate:

The form is read-only

The step UI shows approve and decline actions

On decline:

A comment is required

The workflow returns to the previous step

The previous step user can update the form and respond to the comment

Document behavior:

If document_action_mode = upload:

The assigned user must upload required documents and submit

After submission, the workflow proceeds to the next step (or creates validation tasks if requires_validation=true)

After submission, the workflow proceeds to the next step

If document_action_mode = validate:

The validator sees documents in read-only mode

The step UI shows approve and decline actions

On decline:

A comment is required

The workflow returns to the previous step

The previous step user can re-upload documents and respond to the comment

Commenting model:

Decline comments are stored and linked to:

process_instance_id

step_instance_id

entity_type = form or document

Responses to decline comments are supported and stored in the same thread

Tenant isolation applies to all runtime records:

process_instance, step_instance, task_instance, submissions, documents, comments

Story 2.2.9: Supplier Workflow Integration

As an admin or procurement_manager,
I want to start any workflow process for a supplier from the supplier detail page,
so that I can manage all supplier-related processes (qualification, audits, onboarding, compliance checks, etc.) in one central location.

Acceptance Criteria:

Database Changes:

workflow_template table has active BOOLEAN field (default: true)

workflow_step_template table has completion_status VARCHAR(100) field (nullable)

Workflow Template Management:

Admin can toggle workflow templates between active and inactive

Only templates with active = true AND status = 'published' appear in workflow selection dropdowns

Inactive workflows cannot be instantiated (existing process instances continue normally)

Supplier Detail Page - Workflows Tab:

Supplier detail page has "Workflows" tab (replaces "Qualifications" tab)

Tab shows all workflow process instances where entity_type='supplier' AND entity_id=supplier.id

"Start Process" button shows dropdown of active published workflow templates

Admin or Procurement Manager can initiate any workflow for the supplier

Workflow Instantiation:

Selected workflow_template_version_id is used to instantiate the process

Process is linked via: entity_type='supplier', entity_id=supplier.id

Workflow status tracking follows custom completion statuses (see below)

Custom Workflow Status Tracking:

When a workflow step completes:

If workflow_step_template.completion_status is NOT NULL, copy value to process_instance.status

If completion_status is NULL, leave process_instance.status unchanged

Example: Step "Document Review" with completion_status="Under Review" completes → workflow status becomes "Under Review"

Task Visibility:

Supplier-facing tasks visible only to supplier_user of that supplier and tenant

Internal tasks visible only to internal users of the same tenant

Workflows Page:

Global workflows page at /workflows (replaces /qualifications)

Lists all workflow processes across all suppliers (tenant-filtered)

Filters: All, My Tasks, My Initiated

Supports search, filtering by status, export to CSV

UI Navigation:

Sidebar "Qualifications" link renamed to "Workflows" linking to /workflows

Backward Compatibility:

Existing process instances with entity_type='qualification' continue to work

System treats qualification as a legacy entity type

No data migration required

Story 2.2.10: Assignment Rules for Supplier Contact Absence

As the system,
I want workflow tasks to always be assigned to a valid tenant user,
so that processes never block.

Acceptance Criteria:

If a supplier workflow step exists and no supplier contact is present:

Tasks are assigned to the procurement_manager who initiated the process (same tenant_id)

When a supplier contact is added:

Existing task reassignment follows confirmation rules already defined

Assignment logic is consistent and tenant-isolated

Story 2.2.11: Multi-Approver Step Completion Rules

As the system,
I want steps with multiple approvers to complete only when all required approvers act,
so that approval rigor is enforced.

Acceptance Criteria:

For multi-approver steps, multiple task_instance records are created

Tasks are assigned based on:

selected role (all users with that role in the tenant), or

selected specific users

A step completes only when the required number of approver tasks reach completed

Rejection behavior follows existing workflow rules

Story 2.2.12: Audit Logging for Templates and Execution

As the system,
I want all template and workflow actions to be auditable per tenant,
so that compliance and traceability are ensured.

Acceptance Criteria:

Audit logs record:

Template creation, update, publish

Workflow instantiation

Step transitions

Task assignment and completion

Form submission

Audit records include:

tenant_id

entity_type

entity_id

action

performed_by

timestamp

Audit records are immutable

Story 2.2.13: Isolation and Controlled Cross-Tenant Usage

As an application_owner_admin,
I want to optionally grant specific tenants access to selected templates,
so that reuse is controlled and explicit.

Acceptance Criteria:

By default, templates and workflows are visible only within their tenant_id

Cross-tenant access is disabled by default

Any cross-tenant usage must be explicitly granted via backoffice

No implicit sharing is allowed

Story 2.2.14: Remove Template Versioning, Add Copy Template Functionality

As an admin and developer,
I want template versioning removed and replaced with copy functionality,
so that template management is simpler, more intuitive, and easier for users to understand.

Acceptance Criteria:

See Story 2.2.14 for complete acceptance criteria (48 ACs)

Story 2.2.15: Auto-Validation Task Creation (Eliminate Manual Validation Steps)

As an admin,
I want to configure validation as a checkbox property on workflow steps,
so that validation tasks are automatically created at runtime without requiring manual validation step creation.

Acceptance Criteria:

Database adds requires_validation boolean and validation_config JSONB fields

API endpoints accept validation configuration on step create/update

Workflow engine automatically creates validation tasks when step completes (if requires_validation=true)

Frontend step builder displays "Requires Validation?" checkbox with approver role selector

Validation tasks block next step activation until approved

Documentation updated (PRD + architecture docs)

Backward compatible with existing workflows using manual validation steps