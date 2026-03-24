# Page-by-Page Validation Guide

## Purpose
Comprehensive validation checklist for every page in Supplex, documenting expected behaviors, UI consistency requirements, and role-based access controls.

---

## 🔐 Authentication Pages

### 1. Login Page (`/login`)

**Expected Behaviors:**
- ✅ Email and password fields with proper validation
- ✅ "Remember me" checkbox
- ✅ "Forgot password" link navigates to `/forgot-password`
- ✅ "Sign up" link navigates to `/signup`
- ✅ OAuth buttons for Google and Microsoft
- ✅ Submit button disabled until fields are valid
- ✅ Error messages display inline for invalid credentials
- ✅ Success login redirects to dashboard (`/`)
- ✅ Already authenticated users redirect to dashboard

**UI Consistency Checks:**
- [ ] Supplex logo displayed
- [ ] Mobile-responsive (full-width form on mobile)
- [ ] Touch targets >= 44px
- [ ] Proper focus states on inputs
- [ ] Loading state while authenticating
- [ ] No duplicate submit buttons

**Role-Based Access:**
- N/A (public page)

**Common Issues to Test:**
- [ ] Error message clears when re-typing
- [ ] Password field shows/hides password toggle
- [ ] Form doesn't submit on Enter if invalid
- [ ] Session persists with "Remember me"
- [ ] Back button from dashboard returns to login (if logged out)

---

### 2. Signup Page (`/signup`)

**Expected Behaviors:**
- ✅ Email, password, password confirmation, full name, tenant name fields
- ✅ Password validation (min 8 chars, uppercase, lowercase, number)
- ✅ Password confirmation matches
- ✅ Submit creates tenant + admin user
- ✅ Redirect to email verification or dashboard
- ✅ "Already have an account?" link to `/login`
- ✅ OAuth signup buttons

**UI Consistency Checks:**
- [ ] All fields have labels
- [ ] Inline validation errors
- [ ] Password strength indicator
- [ ] Terms of Service and Privacy Policy links
- [ ] Mobile-responsive layout

**Common Issues:**
- [ ] Duplicate email shows proper error
- [ ] Form state resets after submission
- [ ] Loading state prevents double-submission

---

### 3. Forgot Password (`/forgot-password`)

**Expected Behaviors:**
- ✅ Email field only
- ✅ Submit sends reset email via Supabase
- ✅ Success message after submission
- ✅ Link back to login

**UI Consistency:**
- [ ] Clear instructions
- [ ] Success message prominent
- [ ] Email sent confirmation

---

### 4. Reset Password (`/reset-password`)

**Expected Behaviors:**
- ✅ New password and confirmation fields
- ✅ Token validation from email link
- ✅ Password requirements enforced
- ✅ Success redirects to login

**UI Consistency:**
- [ ] Token expiry handled gracefully
- [ ] Clear success/error states

---

## 📊 Dashboard

### 5. Dashboard (`/`) - Main Landing Page

**Expected Behaviors:**
- ✅ Welcome message with user name
- ✅ User info display (email, role, tenant)
- ✅ Feature cards (Suppliers, Documents, Analytics)
- ✅ Quick links to main sections
- ✅ Role badge displays correctly

**UI Consistency Checks:**
- [ ] **BREADCRUMBS:** "Dashboard" or "Home"
- [ ] Mobile-responsive cards
- [ ] Consistent padding and spacing
- [ ] No duplicate navigation links
- [ ] Sidebar collapsed state persists on reload

**Role-Based Access:**
- **Admin:** Full access, all feature cards clickable
- **Procurement:** All feature cards visible
- **Quality:** All feature cards visible
- **Viewer:** All feature cards visible (read-only notice)

**Common Issues:**
- [ ] Stats/counts load asynchronously
- [ ] UI doesn't flash/reload on back navigation
- [ ] Feature cards have hover states

---

## 👔 Supplier Management

### 6. Suppliers List (`/suppliers`)

**Expected Behaviors:**
- ✅ Table view (desktop) with columns: Name, Status, Category, Location, Contact, Last Updated
- ✅ Card view (mobile)
- ✅ Search bar filters by name, company ID, location
- ✅ Status filter (multi-select dropdown)
- ✅ Category filter (multi-select dropdown)
- ✅ Sort by Name (A-Z, Z-A), Status, Last Updated
- ✅ Pagination (20 per page default)
- ✅ "Add Supplier" button navigates to `/suppliers/new`
- ✅ Clicking row navigates to `/suppliers/{id}`
- ✅ Empty state with CTA when no suppliers

**UI Consistency Checks:**
- [ ] **BREADCRUMBS:** "Home > Suppliers"
- [ ] Status badges: Approved (green), Conditional (yellow), Blocked (red), Prospect (gray), Qualified (blue)
- [ ] Search bar has debounce (not instant)
- [ ] Loading skeleton while fetching
- [ ] Mobile cards have swipe-to-view gesture
- [ ] No duplicate "Add Supplier" buttons
- [ ] Filter state persists in URL params
- [ ] Back navigation maintains scroll position and filters

**Role-Based Access:**
- **Admin:** ✅ "Add Supplier" button visible
- **Procurement:** ✅ "Add Supplier" button visible
- **Quality:** ❌ "Add Supplier" button hidden
- **Viewer:** ❌ "Add Supplier" button hidden

**Performance:**
- [ ] List loads < 2 seconds with 1000+ suppliers
- [ ] Pagination doesn't reload entire page

---

### 7. Supplier Detail (`/suppliers/{id}`)

**Expected Behaviors:**
- ✅ Tabbed interface: Overview, Documents, History, Qualifications
- ✅ **Overview Tab:** Company info, status badge, address, phone, email, website, categories, certifications, notes, contacts
- ✅ Status change dropdown (Admin/Procurement only)
- ✅ Status change confirmation modal
- ✅ "Edit" button navigates to `/suppliers/{id}/edit`
- ✅ "Delete" button with confirmation (Admin only)
- ✅ Metadata: Created date, Created by, Last modified
- ✅ **Documents Tab:** List of uploaded documents
- ✅ **History Tab:** Audit trail of changes
- ✅ **Qualifications Tab:** List of qualification workflows for this supplier
- ✅ "Start Qualification" button (if supplier is Prospect)
- ✅ 404 page if supplier not found or belongs to different tenant

**UI Consistency Checks:**
- [ ] **BREADCRUMBS:** "Home > Suppliers > [Supplier Name]"
- [ ] Mobile-responsive tabs
- [ ] Primary contact highlighted
- [ ] Certification expiry warnings (within 30 days = orange, expired = red)
- [ ] No duplicate Edit/Delete buttons
- [ ] Tab state persists in URL hash (e.g., `#documents`)
- [ ] Back button returns to suppliers list with filters preserved

**Role-Based Access:**
- **Admin:** ✅ Edit, ✅ Delete, ✅ Change Status, ✅ Start Qualification
- **Procurement:** ✅ Edit, ❌ Delete, ✅ Change Status, ✅ Start Qualification
- **Quality:** ❌ Edit, ❌ Delete, ❌ Change Status, ❌ Start Qualification
- **Viewer:** ❌ Edit, ❌ Delete, ❌ Change Status, ❌ Start Qualification

**Common Issues:**
- [ ] Tab switching doesn't reload page
- [ ] Large supplier data doesn't lag UI
- [ ] Contact list scrollable if > 5 contacts

---

### 8. Create Supplier (`/suppliers/new`)

**Expected Behaviors:**
- ✅ Form fields: Company name (required), Status dropdown, Address (street, city, state, postal, country), Phone, Email (validated), Website (validated URL), Categories (multi-select), Notes (textarea)
- ✅ Contact section: Add multiple contacts with Name (required), Title, Email (validated), Phone, isPrimary checkbox (only one primary)
- ✅ Form validation with Zod + React Hook Form
- ✅ Inline error messages
- ✅ "Save" button disabled until valid
- ✅ Duplicate detection warns if name matches existing
- ✅ Success redirects to supplier detail page
- ✅ "Cancel" button with unsaved changes confirmation
- ✅ Auto-save draft to localStorage on blur

**UI Consistency Checks:**
- [ ] **BREADCRUMBS:** "Home > Suppliers > New Supplier"
- [ ] Form sections clearly labeled
- [ ] Mobile keyboard types (email keyboard for email, phone keyboard for phone)
- [ ] "Add Contact" button adds new contact row
- [ ] "Remove Contact" button (X icon) removes contact
- [ ] Primary contact radio buttons (only one selected)
- [ ] Loading state on Save
- [ ] No duplicate Save buttons

**Role-Based Access:**
- **Admin:** ✅ Access
- **Procurement:** ✅ Access
- **Quality:** ❌ 403 Forbidden
- **Viewer:** ❌ 403 Forbidden

**Common Issues:**
- [ ] Draft recovery works after browser refresh
- [ ] Validation errors clear when corrected
- [ ] Phone/email fields validate format
- [ ] Duplicate warning has "Continue anyway" option

---

### 9. Edit Supplier (`/suppliers/{id}/edit`)

**Expected Behaviors:**
- ✅ Same form as Create, pre-populated with existing data
- ✅ All fields editable
- ✅ Contacts editable (add, remove, change primary)
- ✅ Success redirects back to supplier detail
- ✅ "Cancel" returns to detail view

**UI Consistency Checks:**
- [ ] **BREADCRUMBS:** "Home > Suppliers > [Supplier Name] > Edit"
- [ ] Form matches Create supplier exactly
- [ ] Loading state while fetching data
- [ ] Back button prompts if unsaved changes

**Role-Based Access:**
- **Admin:** ✅ Access
- **Procurement:** ✅ Access
- **Quality:** ❌ 403 Forbidden
- **Viewer:** ❌ 403 Forbidden

---

## 📄 Document Management (Within Supplier Detail)

### 10. Documents Tab (`/suppliers/{id}#documents`)

**Expected Behaviors:**
- ✅ List of documents: Filename, Type, Upload date, Uploaded by, File size, Expiration date
- ✅ "Upload Document" button opens file picker
- ✅ Supports PDF, Excel, Word, PNG, JPG (max 10MB)
- ✅ Multiple files uploaded simultaneously
- ✅ Progress bar per file
- ✅ Document metadata form: Type (dropdown), Description, Expiration date
- ✅ Download button (opens PDF in new tab)
- ✅ Delete button with confirmation
- ✅ Expiration warnings (< 30 days = orange, expired = red)
- ✅ Sortable by upload date, expiration date, type
- ✅ Empty state "Upload your first document"

**UI Consistency Checks:**
- [ ] File size validation before upload
- [ ] File type validation with clear error
- [ ] Progress bars accurate
- [ ] Document list refreshes after upload
- [ ] No duplicate Upload buttons
- [ ] Mobile-friendly file picker

**Role-Based Access:**
- **Admin:** ✅ Upload, ✅ Delete
- **Procurement:** ✅ Upload, ✅ Delete
- **Quality:** ❌ Upload, ❌ Delete (view only)
- **Viewer:** ❌ Upload, ❌ Delete (view only)

---

## 🎯 Qualification Workflows

### 11. Qualifications List (`/qualifications`)

**Expected Behaviors:**
- ✅ Tabs: All, My Tasks, My Initiated
- ✅ Table columns: Supplier Name, Status (badge), Current Stage, Initiated By, Initiated Date, Days In Progress, Risk Score
- ✅ Filters: Status (Draft, In Progress, Approved, Rejected), Stage (1-3), Risk Level (Low, Medium, High)
- ✅ Search bar (by supplier name)
- ✅ Sort by: Initiated date, Days in progress, Risk score
- ✅ Pagination (20 per page)
- ✅ Clicking row navigates to `/workflows/{id}`
- ✅ "Export CSV" button exports filtered view
- ✅ Empty state per tab
- ✅ **My Tasks tab:** Shows only workflows assigned to current user for review
- ✅ **My Initiated tab:** Shows only workflows initiated by current user

**UI Consistency Checks:**
- [ ] **BREADCRUMBS:** "Home > Qualifications"
- [ ] Status badges: Draft (gray), Stage 1-3 (blue), Approved (green), Rejected (red)
- [ ] Tab switching updates URL param (`?tab=myTasks`)
- [ ] Filter state in URL (`?status=Draft&stage=1`)
- [ ] Mobile card view
- [ ] No duplicate Export buttons
- [ ] Loading state while fetching
- [ ] Back button maintains tab and filter state

**Role-Based Access:**
- **All Roles:** ✅ View list
- **My Tasks Tab:** Shows workflows assigned as reviewer
- **Export:** All roles can export

**Performance:**
- [ ] List loads quickly with 100+ workflows
- [ ] CSV export handles large datasets

---

### 12. Workflow Detail (`/workflows/{id}`)

**Expected Behaviors:**
- ✅ Supplier information section
- ✅ Current stage badge (Draft, Stage 1 Pending, Stage 2 Pending, Stage 3 Pending, Approved, Rejected)
- ✅ Risk assessment display (if completed)
- ✅ Document checklist section with status indicators
- ✅ Checklist shows: Document name, Description, Required badge, Upload status
- ✅ "Upload" button per checklist item
- ✅ Progress indicator: "5 of 8 documents uploaded (63%)"
- ✅ Timeline/History tab showing all events
- ✅ **Draft Status:**
   - ✅ "Submit for Review" button (when all required docs uploaded)
   - ✅ Edit document uploads
- ✅ **Stage 1-3 Pending:**
   - ✅ Read-only for initiator
   - ✅ Reviewer sees "Approve" and "Request Changes" buttons
   - ✅ Review comments text area
- ✅ **Approved/Rejected:**
   - ✅ Read-only for all
   - ✅ Full timeline visible

**UI Consistency Checks:**
- [ ] **BREADCRUMBS:** "Home > Qualifications > [Supplier Name] - Qualification"
- [ ] Stage progress indicator (visual stepper: Draft → Stage 1 → Stage 2 → Stage 3 → Approved)
- [ ] Document checklist completion percentage updates real-time
- [ ] Upload progress bars
- [ ] Confirmation modals for Submit, Approve, Reject
- [ ] No duplicate Submit/Approve buttons
- [ ] Timeline events in reverse chronological order
- [ ] Timeline events have icons (upload, approval, rejection, etc.)
- [ ] Print button for audit trail PDF
- [ ] Mobile-responsive stage stepper

**Role-Based Access:**
- **Initiator (Admin/Procurement):** Can upload docs in Draft, submit for review
- **Stage 1 Reviewer (Procurement):** Can approve/reject Stage 1
- **Stage 2 Reviewer (Quality):** Can approve/reject Stage 2
- **Stage 3 Reviewer (Admin):** Can approve/reject Stage 3
- **Others:** Read-only

**Common Issues:**
- [ ] Document upload doesn't refresh checklist automatically
- [ ] Approve/Reject updates status immediately
- [ ] Timeline loads incrementally if very long
- [ ] PDF export includes all timeline events

---

### 13. Workflow Review Page (`/workflows/{id}/review`)

**Expected Behaviors:**
- ✅ Full workflow summary: Supplier info, risk score, all documents
- ✅ Document viewer (inline PDF preview or download)
- ✅ Previous stage comments visible
- ✅ Review comments text area (required for rejection)
- ✅ "Approve" button → confirmation modal → advances to next stage
- ✅ "Request Changes" button → confirmation modal → returns to Draft
- ✅ Email notification sent to initiator after decision
- ✅ Timeline updated with decision

**UI Consistency Checks:**
- [ ] **BREADCRUMBS:** "Home > Qualifications > [Supplier Name] > Review"
- [ ] Document preview works for PDFs
- [ ] Download works for non-PDF files
- [ ] Previous comments clearly separated by stage
- [ ] Approve/Reject buttons prominent
- [ ] Loading state during submission
- [ ] No duplicate action buttons

**Role-Based Access:**
- **Assigned Reviewer Only:** ✅ Access
- **Others:** ❌ 403 Forbidden

---

## 🏗️ My Tasks Page

### 14. My Tasks (`/tasks`)

**Expected Behaviors:**
- ✅ List of workflows awaiting current user's review
- ✅ Table: Supplier name, Submitted by, Submitted date, Risk score, Days pending
- ✅ Clicking row navigates to `/workflows/{id}/review`
- ✅ Count badge in sidebar navigation
- ✅ Empty state "No pending tasks"
- ✅ Sort by days pending (oldest first)

**UI Consistency Checks:**
- [ ] **BREADCRUMBS:** "Home > My Tasks"
- [ ] Task count badge matches list count
- [ ] Badge updates after completing review
- [ ] Mobile card view
- [ ] Loading state

**Role-Based Access:**
- **All Roles:** ✅ View (only shows tasks assigned to them)

---

## ⚙️ Settings Pages

### 15. Settings Landing (`/settings`)

**Expected Behaviors:**
- ✅ Settings navigation menu (tabs or sidebar)
- ✅ Options: Users, Checklists, Notifications, Email Settings, Email Logs
- ✅ Default view shows overview or redirects to first tab

**UI Consistency Checks:**
- [ ] **BREADCRUMBS:** "Home > Settings"
- [ ] Settings menu highlights active section
- [ ] Mobile: Settings menu in dropdown or accordion

**Role-Based Access:**
- **Admin:** ✅ Access
- **Others:** ❌ 403 Forbidden (entire settings section)

---

### 16. Users Management (`/settings/users`)

**Expected Behaviors:**
- ✅ List of all users in current tenant
- ✅ Table: Name, Email, Role, Status (Active/Inactive), Last Login
- ✅ "Invite User" button opens modal
- ✅ Invite form: Email, Role dropdown, optional message
- ✅ Send invite email
- ✅ Edit user role (dropdown in table row or edit modal)
- ✅ Deactivate/Reactivate toggle
- ✅ Delete user with confirmation (soft delete)
- ✅ Audit log records all actions

**UI Consistency Checks:**
- [ ] **BREADCRUMBS:** "Home > Settings > Users"
- [ ] Role badges consistent with other pages
- [ ] Status toggle (Active = green, Inactive = gray)
- [ ] Invite modal closable
- [ ] Table sortable by name, role, last login
- [ ] No duplicate Invite buttons

**Role-Based Access:**
- **Admin:** ✅ Full access
- **Others:** ❌ No access

---

### 17. Checklists Management (`/settings/checklists`)

**Expected Behaviors:**
- ✅ List of checklist templates
- ✅ Table: Template name, # of required documents, Is default, Created date, Last modified
- ✅ "Create Template" button opens form
- ✅ Template form: Name, Description, Document list (add/remove items)
- ✅ Each checklist item: Document name, Description, Required checkbox, Type dropdown
- ✅ Mark one template as "Default"
- ✅ Edit existing templates
- ✅ Delete templates (only if not in use by active workflows)
- ✅ Default template pre-populated with ISO 9001 items

**UI Consistency Checks:**
- [ ] **BREADCRUMBS:** "Home > Settings > Checklists"
- [ ] "Add Document" button adds row
- [ ] "Remove" button (X icon) removes row
- [ ] Default badge prominent (gold star or badge)
- [ ] Form validation (name required, at least one doc)
- [ ] No duplicate Create buttons

**Role-Based Access:**
- **Admin:** ✅ Full access
- **Others:** ❌ No access

---

### 18. Notifications Settings (`/settings/notifications`)

**Expected Behaviors:**
- ✅ Tenant-level notification preferences
- ✅ Toggle switches for each event type:
   - Workflow submitted
   - Approval needed
   - Workflow approved
   - Workflow rejected
   - Stage advanced
   - Document expiring soon
- ✅ User-level preferences (opt-in/out)
- ✅ Email address for tenant notifications
- ✅ Save button with success toast

**UI Consistency Checks:**
- [ ] **BREADCRUMBS:** "Home > Settings > Notifications"
- [ ] Toggle switches accessible (keyboard navigable)
- [ ] Clear labeling of tenant vs. user preferences
- [ ] Save button shows loading state
- [ ] Success toast after save
- [ ] No duplicate toggle switches

**Role-Based Access:**
- **Admin:** ✅ Tenant-level + User-level
- **Others:** ✅ User-level only (if accessible via profile)

---

### 19. Email Settings (`/settings/email-settings`)

**Expected Behaviors:**
- ✅ Configure email service (Resend API key)
- ✅ Test email functionality
- ✅ Sender email address configuration
- ✅ Email template preview
- ✅ Rate limiting settings

**UI Consistency Checks:**
- [ ] **BREADCRUMBS:** "Home > Settings > Email Settings"
- [ ] API key masked (show/hide toggle)
- [ ] "Send Test Email" button
- [ ] Template preview renders correctly

**Role-Based Access:**
- **Admin:** ✅ Full access
- **Others:** ❌ No access

---

### 20. Email Logs (`/settings/email-logs` or `/admin/email-logs`)

**Expected Behaviors:**
- ✅ List of sent emails (last 30 days)
- ✅ Table: Recipient, Subject, Status (Sent, Failed, Bounced), Sent date
- ✅ Filter by status
- ✅ Search by recipient email
- ✅ Click row to view email details/body
- ✅ Retry failed emails button

**UI Consistency Checks:**
- [ ] **BREADCRUMBS:** "Home > Settings > Email Logs"
- [ ] Status badges: Sent (green), Failed (red), Bounced (orange)
- [ ] Pagination for large logs
- [ ] Loading state

**Role-Based Access:**
- **Admin:** ✅ Full access
- **Others:** ❌ No access

---

## 🔍 Cross-Page Consistency Checks

### Global UI Elements

#### Sidebar Navigation (Desktop)
- [ ] Supplex logo always visible (collapsed: icon only)
- [ ] Active page highlighted
- [ ] My Tasks badge shows correct count
- [ ] Collapse/Expand toggle works
- [ ] State persists across pages
- [ ] Keyboard navigation works (Tab, Arrow keys)
- [ ] Settings link only visible to Admins
- [ ] Analytics link only visible to non-Viewers

#### Top Navigation Bar
- [ ] Tenant name displayed
- [ ] User menu (avatar, name, role badge)
- [ ] Notification bell (placeholder, no count badge yet)
- [ ] Search bar (global, placeholder for future)
- [ ] Mobile: Hamburger menu toggles sidebar

#### Mobile Navigation (Bottom Tab Bar)
- [ ] Dashboard, Suppliers, More tabs
- [ ] Active tab highlighted
- [ ] "More" drawer has all other links
- [ ] Drawer closes when link clicked
- [ ] Qualifications in "More" drawer

#### Breadcrumbs
- [ ] **EVERY PAGE** except login/signup has breadcrumbs
- [ ] Breadcrumb links clickable and navigate correctly
- [ ] Current page is last item (not clickable)
- [ ] Mobile: Breadcrumbs collapse to "< Back" button

#### Footer
- [ ] Consistent across all pages (or no footer)
- [ ] Copyright, Terms, Privacy links

---

## ⚠️ Common UI Issues to Check

### Disappearing UI on Back Navigation
- [ ] Filters persist when navigating back to list pages
- [ ] Scroll position restored on back navigation
- [ ] Tab state maintained (e.g., Documents tab still active)
- [ ] Sidebar collapsed state persists
- [ ] Modal state doesn't reopen incorrectly

### Duplicate Buttons/Actions
- [ ] No duplicate "Save" buttons on forms
- [ ] No duplicate "Add Supplier" buttons
- [ ] No duplicate "Upload" buttons
- [ ] No duplicate "Export" buttons
- [ ] Action buttons don't repeat in mobile view

### Loading States
- [ ] Skeleton loaders for lists
- [ ] Spinner for button actions
- [ ] Progress bars for file uploads
- [ ] Disabled state while loading

### Error Handling
- [ ] 404 pages styled consistently
- [ ] 403 Forbidden pages explain lack of permission
- [ ] Network errors show retry button
- [ ] Form errors clear when corrected
- [ ] Toast notifications dismiss automatically

### Mobile Responsiveness
- [ ] All pages fit mobile width (no horizontal scroll)
- [ ] Touch targets >= 44px
- [ ] Tables convert to cards on mobile
- [ ] Forms stack vertically on mobile
- [ ] Modals fit mobile screen
- [ ] Bottom tab bar doesn't overlap content

### Accessibility
- [ ] All buttons have aria-labels
- [ ] Form inputs have labels
- [ ] Color contrast meets WCAG AA
- [ ] Keyboard navigation works
- [ ] Screen reader announcements for status changes

---

## 🚀 Performance Checks

- [ ] Dashboard loads < 2 seconds
- [ ] Supplier list with 1000+ items loads < 2 seconds
- [ ] Supplier detail loads < 1 second
- [ ] Workflow list with 100+ items loads < 2 seconds
- [ ] Document upload progress accurate
- [ ] CSV export completes in reasonable time
- [ ] No memory leaks (check DevTools)
- [ ] API calls use proper caching

---

## 🔒 Security Checks

### Multi-Tenancy Isolation
- [ ] Tenant 1 users cannot see Tenant 2 data
- [ ] Direct URL access to other tenant's resources returns 404/403
- [ ] API calls enforce tenant context

### Role-Based Access Control
- [ ] Viewers cannot access edit pages (403)
- [ ] Procurement cannot access admin settings (403)
- [ ] Quality managers cannot create suppliers (403)
- [ ] Admin can access everything

### Session Management
- [ ] Session expires after timeout
- [ ] Logout clears session completely
- [ ] JWT refresh works seamlessly
- [ ] Unauthorized API calls redirect to login

---

**Last Updated:** 2025-10-29
**QA Engineer:** Quinn (Test Architect)
**Status:** Validation Framework Ready

