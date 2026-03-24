

# Epic 2.1: Bug Fixing and Course Correction

**Epic Goal:** Fix identified bugs, correct implementation misalignments, and introduce explicitly required supporting functionality to ensure the supplier qualification process behaves as expected.

---

## Story 2.1.1: Qualification Data Model Naming Alignment

As a **developer**,
I want qualification-related database entities to use clear and business-aligned names,
so that the data model reflects the supplier qualification process correctly.

**Acceptance Criteria:**

1. The `document_checklist` table is renamed to `qualification_template`
2. The `qualification_workflows` table is renamed to `qualification_process`
3. All foreign keys, queries, API contracts, and services are updated accordingly
4. Existing data is preserved during migration
5. No functional behavior is changed as a result of renaming

---

## Story 2.1.2: Prevent Manual Editing of Supplier Qualification Status

As the **system**,
I want supplier qualification status to be controlled exclusively by the qualification process,
so that manual changes cannot bypass validation and approval steps.

**Acceptance Criteria:**

1. Supplier qualification status is displayed as `read_only` on the supplier detail page
2. Supplier qualification status is not editable on the supplier edit page
3. Qualification status is updated only by qualification process transitions
4. Backend APIs reject direct updates to qualification status
5. No new workflows, permissions, or roles are introduced

---

## Story 2.1.3: Block Login for Deactivated Users

As a **user**,
when my account is `deactivated`,
I should not be able to sign in and should receive a clear explanation.

**Acceptance Criteria:**

1. Users marked as `deactivated` cannot authenticate
2. Authentication fails before session or token creation
3. The following message is displayed on login attempt:

```
Your user has been deactivated, please contact your company's admin:
[admin_name]
[admin_email]
```

4. Active users are not affected

---

## Story 2.1.4: Introduce Supplier User Role

As a **tenant_user**,
I want suppliers to access the platform through a restricted user role,
so that they can manage only their own information and tasks.

**Acceptance Criteria:**

1. A new role `supplier_user` exists
2. `supplier_user` can:

   * View and edit its own supplier information
   * View its own task list
   * Manage personal notification settings
3. `supplier_user` cannot access other suppliers or tenant configuration

---

## Story 2.1.5: Supplier Contact Definition and Automatic User Creation

As a **procurement_manager**,
when creating a supplier,
I want to define a supplier contact and automatically create the corresponding user.

**Acceptance Criteria:**

1. Supplier creation includes a **supplier_contact** section
2. Supplier contact fields include `name`, `email`, `phone`
3. On supplier creation:

   * A user is created using the supplier contact information
   * The user is assigned the `supplier_user` role
   * The user is linked to the supplier
4. If the `email` already exists, creation is blocked

---

## Story 2.1.6: View and Manage Supplier Contact on Supplier Detail Page

As an **admin** or **procurement_manager**,
when viewing a supplier,
I want to see and manage the supplier contact with platform access.

**Acceptance Criteria:**

1. Supplier detail page displays:

   * `contact_name`
   * `contact_email`
   * `access_status` with values `active` or `deactivated`
2. **admin** and **procurement_manager** can:

   * Edit `contact_name`
   * Edit `contact_email`
   * Activate or deactivate the contact user
3. Email updates are blocked if the `email` already exists

---

## Story 2.1.7: Support Suppliers Without a Contact User

As a **procurement_manager**,
I want suppliers to exist without a contact user,
so that access can be added later if required.

**Acceptance Criteria:**

1. Suppliers may exist without a contact user
2. Supplier detail page displays `no_contact_associated` when applicable
3. **procurement_manager** can add a supplier contact
4. Adding a supplier contact creates a `supplier_user`
5. Email duplication is blocked

---

## Story 2.1.8: Task Assignment on Qualification Process Start

As the **system**,
when a qualification process starts,
I want the qualification task assigned to the correct user.

**Acceptance Criteria:**

1. If the supplier has a contact user, the task is assigned to the `supplier_user`
2. If the supplier has no contact user, the task is assigned to the **procurement_manager** of the tenant to whom this supplier belongs
3. Exactly one task is created per qualification process start
4. The task listed on the task link page links to the qualification information page

---

## Story 2.1.9: Task Reassignment When Supplier Contact Is Deactivated or Deleted

As an **admin** or **procurement_manager**,
when removing supplier access,
I want pending tasks reassigned after confirmation.

**Acceptance Criteria:**

1. Deactivation and deletion have the same behavior
2. If pending tasks exist, a confirmation modal is shown with the exact message:

```
This user has pending tasks that will be assigned to the procurement manager. Do you wish to continue?
```

3. On confirmation:

   * Pending tasks are reassigned to the **procurement_manager**
4. On cancellation:

   * No changes are made

---

## Story 2.1.10: Task Transfer When Adding a New Supplier Contact

As a **procurement_manager**,
when adding a supplier contact while tasks exist,
I want to decide whether tasks should be transferred.

**Acceptance Criteria:**

1. If supplier-related tasks are assigned to the **procurement_manager**, a confirmation modal is shown with the exact message:

```
This supplier has tasks currently assigned to the procurement manager. Do you wish to transfer those to the new supplier contact?
```

2. On confirmation:

   * Tasks are reassigned to the new `supplier_user`
3. On decline:

   * Tasks remain assigned to the **procurement_manager**
4. The supplier contact is created regardless of the choice

---

## Story 2.1.11: Audit Logging of Task Assignment and Reassignment

As the **system**,
I want all task assignment changes recorded in audit logs,
so that task ownership history is fully traceable.

**Acceptance Criteria:**

1. All task assignments are logged
2. All task reassignments are logged
3. Audit records include:

   * `task_id`
   * `previous_assignee`
   * `new_assignee`
   * `timestamp`
   * `reason_for_change`
4. Audit records are immutable

---

If you want **no more changes**, this version is now **syntax-locked** and ready to paste into your document or Jira exactly as requested.
