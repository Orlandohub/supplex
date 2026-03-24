# Test Users Setup and Documentation

## Purpose
This document provides comprehensive test user accounts for validating all role-based access control (RBAC) and workflow features in Supplex. These users cover all four user roles across multiple tenants to ensure complete test coverage.

## Test User Accounts

### Tenant 1: **Acme Manufacturing** (`acme-manufacturing`)

#### 1. Admin User
- **Email:** `admin@acme-test.com`
- **Password:** `Admin123!Test`
- **Full Name:** Alice Admin
- **Role:** `admin`
- **Tenant:** Acme Manufacturing
- **Purpose:** Test full system access, user management, settings configuration

**Permissions:**
- ✅ Manage users (invite, edit roles, deactivate)
- ✅ Access settings pages
- ✅ Create/edit/delete suppliers
- ✅ Upload/delete documents
- ✅ Initiate qualification workflows
- ✅ Approve/reject workflows at any stage
- ✅ View analytics
- ✅ Manage document checklist templates
- ✅ Configure email notifications

---

#### 2. Procurement Manager
- **Email:** `procurement@acme-test.com`
- **Password:** `Procure123!Test`
- **Full Name:** Peter Procurement
- **Role:** `procurement_manager`
- **Tenant:** Acme Manufacturing
- **Purpose:** Test procurement workflows, supplier management, Stage 1 approvals

**Permissions:**
- ✅ Create/edit suppliers
- ✅ Upload/delete documents
- ✅ Initiate qualification workflows
- ✅ Submit workflows for Stage 1 review
- ✅ Approve/reject Stage 1 workflows (as reviewer)
- ✅ View all suppliers and workflows
- ❌ Cannot manage users
- ❌ Cannot access admin settings
- ❌ Cannot approve Stage 2/3 workflows (unless assigned)

---

#### 3. Quality Manager
- **Email:** `quality@acme-test.com`
- **Password:** `Quality123!Test`
- **Full Name:** Quinn Quality
- **Role:** `quality_manager`
- **Tenant:** Acme Manufacturing
- **Purpose:** Test quality review workflows, Stage 2 approvals

**Permissions:**
- ✅ View suppliers (read-only for non-assigned)
- ✅ Approve/reject Stage 2 workflows (quality review)
- ✅ View workflow history and audit trails
- ✅ Add quality-specific comments to workflows
- ❌ Cannot create/edit suppliers
- ❌ Cannot initiate workflows
- ❌ Cannot manage users
- ❌ Cannot access admin settings

---

#### 4. Viewer
- **Email:** `viewer@acme-test.com`
- **Password:** `Viewer123!Test`
- **Full Name:** Victor Viewer
- **Role:** `viewer`
- **Tenant:** Acme Manufacturing
- **Purpose:** Test read-only access restrictions

**Permissions:**
- ✅ View suppliers (read-only)
- ✅ View workflows (read-only)
- ✅ View dashboard
- ❌ Cannot create/edit/delete anything
- ❌ Cannot upload documents
- ❌ Cannot initiate workflows
- ❌ Cannot approve/reject workflows
- ❌ Cannot access settings

---

### Tenant 2: **Global Logistics** (`global-logistics`)

#### 5. Admin User (Second Tenant)
- **Email:** `admin@globallog-test.com`
- **Password:** `Admin123!Test`
- **Full Name:** Gloria Global
- **Role:** `admin`
- **Tenant:** Global Logistics
- **Purpose:** Test multi-tenancy isolation - should NOT see Acme Manufacturing data

**Test Scenarios:**
- ✅ Can only see Global Logistics suppliers
- ✅ Cannot access Acme Manufacturing workflows
- ✅ Cannot manage Acme Manufacturing users
- ✅ Complete tenant data isolation

---

## How to Create Test Users

### Option 1: Via Signup UI (Recommended for First User)

1. Navigate to `/signup` in your local environment
2. Fill in the form:
   - **Email:** Use email from list above
   - **Password:** Use password from list above
   - **Full Name:** Use full name from list above
   - **Tenant Name:** Use tenant name from list above
3. Submit form
4. Check email for verification (or use Supabase dashboard to confirm email)
5. **IMPORTANT:** Update user role in Supabase dashboard:
   - Go to Supabase Dashboard → Authentication → Users
   - Find the user by email
   - Edit `user_metadata` → Set `role` to correct role from list
   - Save changes
6. **IMPORTANT:** Ensure user record exists in `users` table:
   - Go to Table Editor → `users`
   - Find user by `id` (matches Supabase auth user ID)
   - Update `role` column to match

### Option 2: Via Supabase Dashboard (For Additional Users)

1. **Create Auth User:**
   - Go to Supabase Dashboard → Authentication → Add user
   - Email: `admin@acme-test.com`
   - Password: `Admin123!Test`
   - Auto Confirm User: ✅ (check this to skip email verification)
   - User Metadata: 
     ```json
     {
       "full_name": "Alice Admin",
       "role": "admin"
     }
     ```

2. **Create Database User Record:**
   - Go to Table Editor → `users` table
   - Click "Insert" → "Insert row"
   - Fill in:
     ```
     id: [Copy UUID from auth.users table]
     tenant_id: [Copy tenant UUID from tenants table]
     email: admin@acme-test.com
     full_name: Alice Admin
     role: admin
     is_active: true
     ```

### Option 3: Via SQL Script (Fastest for Bulk Creation)

```sql
-- Note: Run this AFTER creating Supabase auth users manually
-- Replace UUIDs with actual values from your auth.users and tenants tables

-- Insert users into users table (assumes auth users already created)
INSERT INTO users (id, tenant_id, email, full_name, role, is_active)
VALUES
  -- Tenant 1: Acme Manufacturing (replace tenant_id with actual UUID)
  ('[auth-user-uuid-1]', '[tenant-1-uuid]', 'admin@acme-test.com', 'Alice Admin', 'admin', true),
  ('[auth-user-uuid-2]', '[tenant-1-uuid]', 'procurement@acme-test.com', 'Peter Procurement', 'procurement_manager', true),
  ('[auth-user-uuid-3]', '[tenant-1-uuid]', 'quality@acme-test.com', 'Quinn Quality', 'quality_manager', true),
  ('[auth-user-uuid-4]', '[tenant-1-uuid]', 'viewer@acme-test.com', 'Victor Viewer', 'viewer', true),
  
  -- Tenant 2: Global Logistics (replace tenant_id with actual UUID)
  ('[auth-user-uuid-5]', '[tenant-2-uuid]', 'admin@globallog-test.com', 'Gloria Global', 'admin', true);
```

---

## Login Instructions

1. Navigate to `/login` in your local environment
2. Enter email and password from the list above
3. Click "Sign In"
4. You should be redirected to the dashboard
5. Verify your role badge displays correctly in the top navigation

---

## Test Coverage Matrix

| Feature | Admin | Procurement | Quality | Viewer |
|---------|-------|-------------|---------|--------|
| View Dashboard | ✅ | ✅ | ✅ | ✅ |
| View Suppliers | ✅ | ✅ | ✅ | ✅ |
| Create Supplier | ✅ | ✅ | ❌ | ❌ |
| Edit Supplier | ✅ | ✅ | ❌ | ❌ |
| Delete Supplier | ✅ | ❌ | ❌ | ❌ |
| Upload Documents | ✅ | ✅ | ❌ | ❌ |
| Delete Documents | ✅ | ✅ | ❌ | ❌ |
| Initiate Workflow | ✅ | ✅ | ❌ | ❌ |
| View Workflows | ✅ | ✅ | ✅ | ✅ |
| Approve Stage 1 | ✅ | ✅ | ❌ | ❌ |
| Approve Stage 2 | ✅ | ❌ | ✅ | ❌ |
| Approve Stage 3 | ✅ | ❌ | ❌ | ❌ |
| View Audit Trail | ✅ | ✅ | ✅ | ✅ |
| Manage Users | ✅ | ❌ | ❌ | ❌ |
| Access Settings | ✅ | ❌ | ❌ | ❌ |
| Configure Checklists | ✅ | ❌ | ❌ | ❌ |
| View Analytics | ✅ | ✅ | ✅ | ❌ |

---

## Validation Checklist

### ✅ Authentication Flows
- [ ] Login with each role
- [ ] Logout properly clears session
- [ ] Password reset flow works
- [ ] Email verification works
- [ ] OAuth login (Google/Microsoft)
- [ ] Session persistence (remember me)
- [ ] Session timeout and refresh

### ✅ Authorization Tests
- [ ] Viewer cannot edit suppliers
- [ ] Viewer cannot initiate workflows
- [ ] Procurement cannot access admin settings
- [ ] Quality manager cannot create suppliers
- [ ] Quality manager can approve Stage 2
- [ ] Procurement can approve Stage 1
- [ ] Admin has full access

### ✅ Multi-Tenancy Isolation
- [ ] Tenant 1 users cannot see Tenant 2 data
- [ ] Tenant 2 users cannot see Tenant 1 data
- [ ] Cross-tenant workflow access blocked
- [ ] Cross-tenant supplier access blocked

### ✅ UI Consistency
- [ ] Edit buttons hidden for Viewers
- [ ] Settings link only visible to Admins
- [ ] My Tasks badge shows correct count
- [ ] Role badge displays correctly
- [ ] Navigation consistent across roles
- [ ] Breadcrumbs present on all pages
- [ ] No duplicate action buttons
- [ ] UI state persists on back navigation

---

## Troubleshooting

### Issue: User can't log in
**Solution:**
1. Check Supabase Dashboard → Authentication → Users
2. Verify email is confirmed (green checkmark)
3. If not confirmed, click "..." → "Confirm email"

### Issue: User has wrong permissions
**Solution:**
1. Check Supabase `user_metadata` → `role` field matches database
2. Check `users` table → `role` column matches
3. Both must be identical (e.g., `procurement_manager`)

### Issue: User sees "Unauthorized" on pages
**Solution:**
1. Verify user record exists in `users` table
2. Check `tenant_id` is correctly set
3. Check `is_active` is `true`
4. Clear cookies and log in again

### Issue: User sees other tenant's data
**CRITICAL:** This is a security bug!
1. Check RLS policies are enabled on all tables
2. Verify API uses tenant context filtering
3. Check user's `tenant_id` in session matches database

---

## Next Steps

After creating test users:
1. ✅ Complete navigation gap fix (add Qualifications link)
2. ✅ Start development environment
3. ✅ Run through complete user flow for each role
4. ✅ Document all gaps, bugs, and UX issues
5. ✅ Generate comprehensive QA report

---

**Last Updated:** 2025-10-29
**QA Engineer:** Quinn (Test Architect)
**Status:** Ready for Testing

