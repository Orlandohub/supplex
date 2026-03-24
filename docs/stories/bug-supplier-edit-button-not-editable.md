# Bug Story: Edit Button on Supplier Detail Page Not Making Form Editable

<!-- Powered by BMAD™ Core -->

## Status

**Draft**

Date Created: December 17, 2025  
Identified By: Manual Testing (User)  
Severity: **High** (Core supplier management functionality broken)  
Story Type: Bug Fix  
Priority: 🔴 **High Priority** - Blocks supplier data editing

---

## Bug Description

**As an** Admin or Procurement Manager,  
**I want** to click the "Edit" button on the supplier detail page and have the page transform into an editable form,  
**so that** I can update supplier information directly without navigating to a separate edit page.

---

## Current Behavior (Bug)

1. User navigates to supplier detail page (e.g., `/suppliers/123`)
2. User clicks "Edit" button on the supplier detail page
3. **Result:** One of the following occurs:
   - Nothing happens (button does not respond)
   - Button navigates to edit page but page doesn't load correctly
   - Edit page loads but fields are not editable (read-only)
   - Button has JavaScript error preventing action
4. User cannot edit supplier information
5. Supplier data remains unchanged

**Expected Edit Button Behavior (Two Possible Patterns):**

**Pattern A: Inline Edit (Toggle Form)**
- Clicking "Edit" button transforms detail view into editable form
- All fields become editable input fields
- "Save" and "Cancel" buttons appear
- "Edit" button hides or becomes disabled

**Pattern B: Navigate to Edit Page**
- Clicking "Edit" button navigates to `/suppliers/:id/edit`
- Dedicated edit page loads with pre-populated form
- Fields are editable
- "Save" redirects back to detail page

**User Report:** "Does not make the page an editable form"
- Suggests Pattern A expected (inline edit)
- Or Pattern B exists but form fields remain read-only

---

## Expected Behavior

**If Pattern A (Inline Edit):**
1. User clicks "Edit" button on supplier detail page
2. Page transforms into edit mode:
   - All supplier fields become editable input fields
   - "Edit" button hides or becomes disabled
   - "Save" and "Cancel" buttons appear
3. User modifies supplier information (name, address, contacts, etc.)
4. User clicks "Save" button
5. Form validates inputs
6. API request sent to update supplier
7. Success toast notification: "Supplier updated successfully"
8. Page returns to detail view (read-only) with updated data
9. Or user clicks "Cancel" → form reverts to detail view without saving

**If Pattern B (Separate Edit Page):**
1. User clicks "Edit" button on supplier detail page
2. Browser navigates to `/suppliers/:id/edit` route
3. Edit page loads with form pre-populated with supplier data
4. All fields are editable (not read-only)
5. User modifies supplier information
6. User clicks "Save" button
7. Form validates and submits
8. Success toast notification
9. Browser redirects back to `/suppliers/:id` detail page
10. Updated data displays in detail view

---

## Reproduction Evidence

**Date:** December 17, 2025  
**User:** Admin user  
**Supplier:** Existing supplier on detail page  

**Steps Taken:**
1. Logged in as Admin user
2. Navigated to supplier detail page
3. Clicked "Edit" button

**Expected Behavior:**
- Browser should navigate to `/suppliers/:id/edit` route
- Edit page should load with editable form pre-populated with supplier data

**Actual Behavior:**
- **Component refreshes but stays on the same detail page**
- No navigation occurs to edit page
- User remains on read-only detail view
- No error messages displayed

**Key Finding:** Edit button click triggers a refresh but **does not navigate** to the edit route. This is a navigation/routing issue, not a form editability issue.

---

## Root Cause Analysis

**✅ IDENTIFIED ROOT CAUSE:** Edit button click causes page refresh instead of navigation to edit route.

### Actual Behavior Observed

User clicks Edit button → Component refreshes → Stays on detail page (no navigation)

### Investigation Focus

**Pattern B (Separate Edit Page) is implemented** - Verified from code:
- ✅ Edit route exists: `apps/web/app/routes/_app.suppliers.$id.edit.tsx`
- ✅ Edit button exists in `SupplierDetailTabs.tsx` component
- ✅ Backend API exists: `PUT /api/suppliers/:id`
- ❌ Navigation from button to edit page is NOT working

### Potential Root Causes (Navigation Failure)

**Code Verification Completed:**
- ✅ Edit button EXISTS at lines 125-136 in `SupplierDetailTabs.tsx`
- ✅ Button uses `asChild` prop with Remix `Link` component
- ✅ Link points to `/suppliers/${supplier.id}/edit`
- ✅ Edit route file EXISTS: `_app.suppliers.$id.edit.tsx`
- ✅ NOT wrapped in a `<Form>` element (checked parent components)
- ✅ Backend API endpoint EXISTS and works

**Most Likely Causes:**

1. **Route Collision / Catch-All Route:**
   - `/suppliers/:id` (detail route) may be catching `/suppliers/:id/edit`
   - Remix router prioritizing wrong route pattern
   - Need to check if `_app.suppliers.$.tsx` catch-all exists

2. **Button `asChild` Implementation Issue:**
   - Button component with `asChild={true}` uses Radix UI `Slot`
   - `Slot` may not be correctly passing click events to `Link`
   - `Link` may not be rendered as expected child

3. **Link Rendered But Not Interactive:**
   - CSS `pointer-events: none` preventing clicks
   - `z-index` issue with overlapping elements
   - Button visually renders but Link doesn't receive click

4. **Client-Side JavaScript Error:**
   - Error in console preventing navigation
   - usePermissions hook error
   - React error boundary catching navigation

5. **Route Parameter Mismatch:**
   - Detail route uses `:id` but edit route expects `:supplierId`
   - Or vice versa - causing route not to match

**Less Likely:**

6. **Nested Button/Link Issue:**
   - Browser may be preventing nested interactive elements
   - `<Button><Link>` pattern might not work as expected

7. **Event Propagation Issue:**
   - Parent `div` or table row has click handler
   - Click event being stopped before reaching Link

### Files to Investigate (UPDATED - Focus on Navigation)

**Priority 1 - Button Component:**
- `apps/web/app/components/suppliers/SupplierDetailTabs.tsx` (lines 125-136)
  - Check if Edit button is inside a `<Form>` element
  - Verify Button component with `asChild` prop works correctly
  - Check for any click handlers on parent elements

**Priority 2 - Route Configuration:**
- `apps/web/app/routes/_app.suppliers.$id.tsx` - Detail page route
- `apps/web/app/routes/_app.suppliers.$id.edit.tsx` - Edit page route
- Check for route conflicts or overlapping patterns

**Priority 3 - Button/Link Components:**
- `apps/web/app/components/ui/button.tsx` - Verify `asChild` implementation
- Check if Button component properly delegates to child Link

**NOT the Issue:**
- ❌ Backend API (navigation never reaches backend)
- ❌ Form fields being read-only (never gets to edit page)
- ❌ Permission issues (button is visible and clickable)

---

## Acceptance Criteria

1. **Edit Button Exists:** "Edit" button visible on supplier detail page (Admin/Procurement only)
2. **Edit Button Responds:** Clicking "Edit" button triggers edit functionality (no errors)
3. **Edit Mode Activates:** Either page transforms to editable form OR navigates to edit page
4. **Fields Editable:** All supplier fields become editable input fields (not read-only)
5. **Form Pre-Populated:** Existing supplier data pre-fills form fields correctly
6. **Save Button Works:** Clicking "Save" validates, submits, and updates supplier
7. **Success Feedback:** Success toast notification displays after successful save
8. **Return to Detail:** After save, user returns to detail view with updated data
9. **Cancel Works:** Clicking "Cancel" reverts changes and returns to detail view
10. **Validation Works:** Invalid inputs show validation errors and prevent submission
11. **Permissions:** Only Admin/Procurement can see and use "Edit" button
12. **Error Handling:** Any errors display user-friendly messages

---

## Tasks / Subtasks

- [ ] **Task 1: Reproduce and Document Bug** (AC: 1-4)
  - [ ] Login as Admin or Procurement Manager
  - [ ] Navigate to supplier detail page (e.g., `/suppliers/123`)
  - [ ] Locate "Edit" button on page
  - [ ] Click "Edit" button
  - [ ] Document exact behavior:
    - Does button respond (loading state, navigation, etc.)?
    - Does page navigate to `/suppliers/:id/edit`?
    - Does page transform to edit mode?
    - Are form fields editable or read-only?
  - [ ] Check browser DevTools Console for JavaScript errors
  - [ ] Check Network tab for API requests or navigation

- [ ] **Task 2: Verify Route Configuration** (AC: 3) **[CRITICAL - Route collision check]**
  - [ ] Confirm `_app.suppliers.$id.tsx` (detail route) exists
  - [ ] Confirm `_app.suppliers.$id.edit.tsx` (edit route) exists
  - [ ] Check for catch-all routes like `_app.suppliers.$.tsx` that might intercept
  - [ ] Check for route parameter name consistency (`:id` vs `:supplierId`)
  - [ ] Test direct URL navigation: Type `/suppliers/{id}/edit` in browser address bar
  - [ ] Verify if direct URL works but button click doesn't

- [ ] **Task 3: Investigate Edit Button Click Behavior** (AC: 2) **[PRIMARY INVESTIGATION]**
  - [ ] Open browser DevTools Console
  - [ ] Click Edit button and check for JavaScript errors
  - [ ] Verify button is visible and not hidden by permissions check
  - [ ] Check if `permissions.canEditSupplier` returns true (Admin/Procurement Manager)
  - [ ] Inspect Edit button element in DOM:
    - [ ] Verify it renders as `<a>` tag (from Link)
    - [ ] Check `href` attribute value (should be `/suppliers/{id}/edit`)
    - [ ] Check for `pointer-events: none` or other blocking CSS
  - [ ] Add console.log before Link to verify render
  - [ ] Check Network tab for any navigation requests

- [ ] **Task 4: Test Button `asChild` Pattern** (AC: 2)
  - [ ] Read `apps/web/app/components/ui/button.tsx` component
  - [ ] Verify `asChild` prop uses Radix UI `Slot` component
  - [ ] Check if `Slot` is imported from `@radix-ui/react-slot`
  - [ ] Test if other buttons using `asChild` work (compare with working examples)
  - [ ] Temporarily remove `asChild` and use plain `Link` to test
  - [ ] Check if issue is specific to `Button asChild` pattern

- [ ] **Task 5: Investigate CSS and Z-Index Issues** (AC: 2)
  - [ ] Inspect Edit button in browser DevTools Elements tab
  - [ ] Check computed CSS styles on button and Link
  - [ ] Look for `pointer-events: none` on button or parents
  - [ ] Check `z-index` values - verify button not behind other elements
  - [ ] Check for absolutely positioned overlays blocking clicks
  - [ ] Test if CSS `cursor: pointer` works (hover shows pointer cursor)
  - [ ] Temporarily add inline style to button: `style="position: relative; z-index: 9999"`

- [ ] **Task 6: Check for Event Propagation Issues** (AC: 2)
  - [ ] Check if button is inside clickable parent (table row, card)
  - [ ] Look for `onClick` handlers on parent elements
  - [ ] Check if parent is using `stopPropagation()` or `preventDefault()`
  - [ ] Temporarily add `onClick={(e) => { e.stopPropagation(); console.log('Link clicked'); }}` to Link

- [ ] **Task 7: Implement Fix Based on Root Cause** (AC: 1-12)
  - [ ] **Fix Option A: Route Priority/Collision**
    - [ ] Rename routes to ensure proper ordering (Remix uses alphabetical)
    - [ ] Or use route config to explicitly set priority
    - [ ] Ensure edit route matches before detail route
  - [ ] **Fix Option B: Replace `asChild` Pattern**
    - [ ] Remove `Button asChild` wrapper
    - [ ] Use styled `Link` component directly
    - [ ] Or use `useNavigate()` with Button `onClick`
  - [ ] **Fix Option C: CSS/Z-Index**
    - [ ] Remove blocking CSS from button or parents
    - [ ] Adjust z-index values
    - [ ] Remove overlapping absolutely positioned elements
  - [ ] **Fix Option D: Event Handler**
    - [ ] Add explicit `onClick` to Link with navigation
    - [ ] Use `useNavigate()` hook in button click handler
    - [ ] Stop event propagation from parent elements
  - [ ] Verify fix allows navigation to edit page
  - [ ] Ensure edit page loads correctly after fix

- [ ] **Task 8: Test Edit Flow End-to-End** (AC: 1-12)
  - [ ] Login as Admin
  - [ ] Navigate to supplier detail page
  - [ ] Click "Edit" button → verify edit mode activates or navigates
  - [ ] Verify all fields are editable (not read-only)
  - [ ] Verify existing data pre-fills form correctly
  - [ ] Modify supplier name, address, and contacts
  - [ ] Click "Save" → verify success toast displays
  - [ ] Verify redirects/returns to detail view
  - [ ] Verify updated data displays correctly in detail view
  - [ ] Click "Edit" again
  - [ ] Modify data but click "Cancel" → verify changes not saved
  - [ ] Verify returns to detail view with original data

- [ ] **Task 9: Test Validation** (AC: 10)
  - [ ] Click "Edit" button
  - [ ] Clear required field (e.g., company name)
  - [ ] Click "Save" → verify validation error displays
  - [ ] Enter invalid email format
  - [ ] Click "Save" → verify email validation error
  - [ ] Enter invalid phone format
  - [ ] Click "Save" → verify phone validation error
  - [ ] Fix all errors and click "Save" → verify success

- [ ] **Task 10: Test Permissions** (AC: 11)
  - [ ] Login as Admin → "Edit" button visible → Edit works
  - [ ] Login as Procurement Manager → "Edit" button visible → Edit works
  - [ ] Login as Quality Manager → "Edit" button hidden or disabled
  - [ ] Login as Viewer → "Edit" button hidden or disabled
  - [ ] Test direct URL access to edit page (if Pattern B)
    - Quality Manager navigates to `/suppliers/:id/edit` → 403 Forbidden

- [ ] **Task 11: Test Error Handling** (AC: 12)
  - [ ] Click "Edit", modify data, disconnect network
  - [ ] Click "Save" → verify user-friendly error message
  - [ ] Reconnect network, click "Save" → verify success
  - [ ] Test backend validation failure → verify error message
  - [ ] Test unauthorized access → verify 403 error

- [ ] **Task 12: Regression Testing** (AC: All)
  - [ ] Verify supplier detail page displays correctly
  - [ ] Verify all tabs work (Overview, Documents, History, Qualifications)
  - [ ] Verify status change dropdown works
  - [ ] Verify "Delete" button works (Admin only)
  - [ ] Verify breadcrumbs display correctly
  - [ ] Verify other supplier actions unaffected

---

## Dev Notes

### Supplier Detail and Edit Routes

**Supplier Detail Route:**
- **File:** `apps/web/app/routes/_app.suppliers.$id.tsx`
- Contains supplier detail view with tabs (Overview, Documents, History, Qualifications)
- Has loader that fetches supplier data via Eden Treaty API
- Expected to have "Edit" button (Admin/Procurement only)

**Supplier Edit Route** (If Pattern B):
- **File:** `apps/web/app/routes/_app.suppliers.$id.edit.tsx`
- Dedicated edit page with pre-populated form
- Loader fetches supplier data for form
- Action or client-side handler submits updates

**Expected Patterns** (From QA docs):

**From PAGE-BY-PAGE-VALIDATION-GUIDE.md:**
> ### 9. Edit Supplier (`/suppliers/{id}/edit`)
> - ✅ Same form as Create, pre-populated with existing data
> - ✅ All fields editable
> - ✅ Success redirects back to supplier detail

**This confirms Pattern B (separate edit page) is the expected implementation.**

### Expected Behavior (Pattern B - Separate Edit Page)

**Detail Page:**
```typescript
// File: apps/web/app/routes/_app.suppliers.$id.tsx

export default function SupplierDetail() {
  const { supplier } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  
  const handleEdit = () => {
    navigate(`/suppliers/${supplier.id}/edit`);
  };
  
  return (
    <div>
      {/* Supplier detail content */}
      {(userRole === 'admin' || userRole === 'procurement_manager') && (
        <Button onClick={handleEdit}>Edit</Button>
      )}
    </div>
  );
}
```

**Edit Page:**
```typescript
// File: apps/web/app/routes/_app.suppliers.$id.edit.tsx

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { api } = await requireAuth(request);
  const supplier = await api.suppliers({ id: params.id }).get();
  return json({ supplier });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const { api } = await requireAuth(request);
  const formData = await request.formData();
  
  // Update supplier via API
  const result = await api.suppliers({ id: params.id }).patch({
    name: formData.get('name'),
    address: formData.get('address'),
    // ... other fields
  });
  
  // Redirect back to detail page
  return redirect(`/suppliers/${params.id}`);
}

export default function SupplierEdit() {
  const { supplier } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  
  return (
    <Form method="post">
      {/* Editable form fields pre-populated with supplier data */}
      <Input name="name" defaultValue={supplier.name} required />
      <Input name="address" defaultValue={supplier.address} />
      {/* ... other fields */}
      
      <Button type="submit" disabled={navigation.state === "submitting"}>
        Save
      </Button>
      <Button type="button" onClick={() => navigate(`/suppliers/${supplier.id}`)}>
        Cancel
      </Button>
    </Form>
  );
}
```

### Common Issues to Check

**Issue 1: Edit Route Doesn't Exist**
- File `_app.suppliers.$id.edit.tsx` may not exist
- Edit button tries to navigate but route is 404
- **Fix:** Create edit route file

**Issue 2: Edit Button Handler Missing/Broken**
- Edit button has empty handler or incorrect navigation path
- **Fix:** Implement navigation: `navigate(\`/suppliers/${id}/edit\`)`

**Issue 3: Form Fields Are Read-Only**
- Form uses display components instead of input components
- Inputs have `disabled={true}` or `readOnly={true}` attributes
- **Fix:** Use editable input components, remove disabled/readOnly

**Issue 4: Form Not Pre-Populated**
- Loader not fetching supplier data correctly
- `useLoaderData()` not used to populate form
- **Fix:** Ensure loader returns supplier data, use `defaultValue` on inputs

**Issue 5: Form Submission Broken**
- Action not implemented or has errors
- API call failing
- No redirect after save
- **Fix:** Implement action with API call and redirect

**Issue 6: Wrong Route Parameter Name**
- Edit route uses different param name (e.g., `:supplierId` vs. `:id`)
- Causes route mismatch or 404
- **Fix:** Use consistent parameter name across routes

### Expected API Endpoint

**Backend Route:**
- **Update Supplier:** `PATCH /api/suppliers/:id`
- Or: `PUT /api/suppliers/:id`

**Expected Payload:**
```typescript
{
  name: string;
  status: string;
  address: {
    street: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
  phone: string;
  email: string;
  website?: string;
  categories?: string[];
  notes?: string;
  contacts?: Array<{
    name: string;
    title?: string;
    email: string;
    phone?: string;
    is_primary: boolean;
  }>;
}
```

### Database Schema

**Table:** `suppliers`

**Key Fields:**
- `id` (UUID, primary key)
- `name` (text, required)
- `status` (enum)
- `tenant_id` (UUID - for RLS)
- `address_street`, `address_city`, `address_state`, `address_postal_code`, `address_country`
- `phone`, `email`, `website` (optional)
- `categories` (array or JSON)
- `notes` (text, optional)
- `created_at`, `updated_at`

**Table:** `supplier_contacts` (if separate)

**RLS Policies:**
- Admin/Procurement can UPDATE suppliers in their tenant
- Quality/Viewer cannot UPDATE suppliers (read-only)

### Tech Stack (From architecture/tech-stack.md)

- **Frontend Framework:** Remix 2.8+ (SSR framework)
- **UI Components:** shadcn/ui (Midday fork)
- **Form Management:** React Hook Form 7.51+ (performant, uncontrolled inputs)
- **Validation:** Zod 3.22+ (shared frontend/backend validation)
- **Backend Framework:** ElysiaJS 1.0+ on Bun runtime
- **API Style:** REST + Eden Treaty (type-safe client)
- **Database:** PostgreSQL 15+ (hosted on Supabase)
- **ORM:** Drizzle 0.30+ (lightweight, type-safe)

### Critical Coding Standards (From architecture/coding-standards.md)

**Remix Patterns:**
- ✅ Use Remix `action` for form submissions (progressive enhancement)
- ✅ Use `useNavigation()` for loading states during submission
- ✅ Use `redirect()` after successful mutation
- ✅ Use `useActionData()` for validation errors

**Form Management:**
- ✅ Use React Hook Form for complex forms with many fields
- ✅ Integrate with Zod for validation schemas
- ✅ Use `defaultValue` to pre-populate form from loader data

**API Calls:**
- ✅ MUST use Eden Treaty client - never direct HTTP calls
- ✅ MUST handle errors and display user-friendly messages

**Database Queries:**
- ✅ MUST include tenant filter on ALL queries (tenant isolation)
- ✅ MUST verify field names against actual schema

**Remix Data Loading:**
- ✅ Loader fetches supplier data server-side
- ✅ Action handles form submission server-side
- ✅ Use `redirect()` to navigate after successful save

### Validation Schema Example

**Shared Zod Schema** (packages/types):
```typescript
import { z } from 'zod';

export const supplierSchema = z.object({
  name: z.string().min(1, 'Company name is required').max(255),
  status: z.enum(['prospect', 'qualified', 'approved', 'conditional', 'blocked']),
  address_street: z.string().optional(),
  address_city: z.string().optional(),
  address_state: z.string().optional(),
  address_postal_code: z.string().optional(),
  address_country: z.string().optional(),
  phone: z.string().regex(/^\+?[\d\s\-()]+$/, 'Invalid phone format').optional(),
  email: z.string().email('Invalid email format').optional(),
  website: z.string().url('Invalid URL format').optional().or(z.literal('')),
  notes: z.string().optional(),
});
```

### Debugging Steps

1. **Reproduce Bug:** Click "Edit" button, note exact behavior
2. **Check Route Exists:** Verify `_app.suppliers.$id.edit.tsx` file exists
3. **Check Navigation:** Verify URL changes to `/suppliers/:id/edit`
4. **Check Console:** Look for JavaScript errors in browser console
5. **Check Network:** Verify loader request fetches supplier data
6. **Inspect Form Fields:** Check if fields are input elements or display-only
7. **Check Attributes:** Verify inputs don't have `disabled` or `readOnly`
8. **Test Submission:** Try to save, check network tab for API request

---

## Testing

### Manual Testing Checklist

- [ ] **Happy Path - Edit Supplier:**
  - [ ] Login as Admin or Procurement Manager
  - [ ] Navigate to supplier detail page (e.g., `/suppliers/123`)
  - [ ] Click "Edit" button
  - [ ] Verify navigates to `/suppliers/123/edit` (Pattern B)
  - [ ] Verify form loads with all supplier data pre-filled
  - [ ] Verify all fields are editable (can type, select, modify)
  - [ ] Modify company name
  - [ ] Modify address fields
  - [ ] Modify phone and email
  - [ ] Add/modify contact person
  - [ ] Click "Save" button
  - [ ] Verify success toast notification
  - [ ] Verify redirects back to `/suppliers/123` detail page
  - [ ] Verify updated data displays correctly

- [ ] **Cancel Functionality:**
  - [ ] Navigate to supplier detail
  - [ ] Click "Edit"
  - [ ] Modify several fields
  - [ ] Click "Cancel" button
  - [ ] Verify returns to detail page
  - [ ] Verify changes were NOT saved (original data displays)

- [ ] **Form Validation:**
  - [ ] Click "Edit"
  - [ ] Clear company name (required field)
  - [ ] Click "Save" → Verify validation error displays
  - [ ] Enter invalid email format
  - [ ] Click "Save" → Verify email validation error
  - [ ] Enter invalid website URL
  - [ ] Click "Save" → Verify URL validation error
  - [ ] Fix all errors
  - [ ] Click "Save" → Verify success

- [ ] **Permissions:**
  - [ ] Login as Admin → "Edit" button visible → Edit works
  - [ ] Login as Procurement Manager → "Edit" button visible → Edit works
  - [ ] Login as Quality Manager → "Edit" button hidden or disabled
  - [ ] Login as Viewer → "Edit" button hidden or disabled
  - [ ] Quality Manager direct URL access to `/suppliers/:id/edit` → 403 Forbidden

- [ ] **Error Handling:**
  - [ ] Click "Edit", modify data, disconnect network
  - [ ] Click "Save" → Verify user-friendly error message
  - [ ] Reconnect network, try again → Success
  - [ ] Test backend error → User-friendly error shown

- [ ] **Contact Management (if applicable):**
  - [ ] Click "Edit"
  - [ ] Add new contact → Verify field group appears
  - [ ] Remove contact → Verify field group removed
  - [ ] Mark contact as primary → Verify only one primary allowed
  - [ ] Save → Verify contacts saved correctly

- [ ] **Regression:**
  - [ ] Verify "Create Supplier" form still works
  - [ ] Verify supplier detail view displays correctly
  - [ ] Verify supplier status change works
  - [ ] Verify supplier delete works (Admin only)
  - [ ] Verify breadcrumbs display correctly
  - [ ] Verify other supplier features unaffected

### Testing Standards (From architecture)

**Framework:** Vitest 1.4+ (frontend unit/integration tests)

**Test File Location (if adding tests):**
- Frontend route tests: `apps/web/app/routes/__tests__/_app.suppliers.$id.edit.test.tsx`
- Backend API tests: `apps/api/src/routes/suppliers/__tests__/update.test.ts`

**Testing Focus:**
- Manual testing is PRIMARY for this bug fix
- Consider adding E2E test for edit supplier flow to prevent regression
- Playwright test: Navigate → Click Edit → Modify → Save → Verify updated

---

## Implementation Priority

**Priority:** 🔴 **High - Core Functionality**

**Impact:** High - Blocks supplier data editing, core business functionality

**Root Cause:** ✅ **IDENTIFIED** - Navigation failure (button click doesn't navigate to edit route)

**Estimated Effort:** 1-2 hours (root cause narrowed down)
- Investigation: ✅ COMPLETE (30 minutes) - Identified as navigation issue
- Fix (route collision or Button asChild pattern): 30-60 minutes
- Testing: 15-30 minutes (Verify navigation works)
- Regression testing: 15-30 minutes (Verify other buttons work)

**Dependencies:** None - can be investigated immediately

**Recommendation:** Fix ASAP - blocks core supplier management functionality

---

## Notes

**User Impact:**
- Users cannot edit supplier information
- Supplier data becomes stale and incorrect
- Cannot update addresses, contacts, or other critical details
- Forces manual workarounds or direct database edits

**Business Impact:**
- High - Prevents maintaining accurate supplier records
- High - Blocks supplier onboarding process updates
- Moderate - Workaround may exist (re-create supplier, but loses history)

**Expected Implementation:**
- Based on QA docs, Pattern B (separate edit page) is expected
- Edit page should be at `/suppliers/:id/edit` route
- Form should be identical to "Create Supplier" but pre-populated
- Save should redirect back to detail page

**Related Stories:**
- Story 1.7: Create & Edit Supplier (likely where feature was implemented)
- Existing bug: `bug-supplier-tab-full-reload.md` (similar supplier detail page issues)

**Investigation Status:**
1. ✅ Bug reproduced - Edit button click causes refresh, no navigation
2. ✅ Edit route verified - `_app.suppliers.$id.edit.tsx` exists and is correctly implemented
3. ✅ Button code verified - Uses `Button asChild` with `Link` component
4. ✅ Root cause identified - Navigation failure, likely route collision or `asChild` pattern issue
5. 🔄 **NEXT:** Test route collision, Button asChild pattern, CSS blocking, or event propagation

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2025-12-17 | 1.0 | Bug story created - Edit button on supplier detail page not making form editable | Bob (Scrum Master) |
| 2025-12-17 | 1.1 | Added reproduction evidence - Button click causes refresh instead of navigation | Sarah (PO) |
| 2025-12-17 | 1.2 | Updated root cause analysis - Navigation failure, not form editability issue | Sarah (PO) |
| 2025-12-17 | 1.3 | Verified code implementation - Edit route exists, Button asChild pattern used | Sarah (PO) |
| 2025-12-17 | 1.4 | Updated investigation tasks to focus on navigation/routing issues | Sarah (PO) |
| 2025-12-17 | 2.0 | ✅ **COMPLETED** - Fixed Remix route nesting issue, edit page now works | James (Dev) |

---

## Dev Agent Record

### Implementation Summary

**Date:** December 17, 2025  
**Agent:** James (Dev Agent)  
**Status:** ✅ **COMPLETED**

### Root Cause Analysis

**Initial Investigation:**
- Edit button click caused URL to change from `/suppliers/:id` to `/suppliers/:id/edit` ✅
- However, page displayed detail view instead of edit form ❌
- No input fields visible on edit page ❌
- No JavaScript errors in console
- Investigation revealed Remix routing configuration issue

**Actual Root Cause:**
The edit route file `_app.suppliers.$id.edit.tsx` was creating a **child route** nested under the detail route `_app.suppliers.$id.tsx`. In Remix v2 flat file routing:
- Dot notation `$id.edit` creates parent-child relationship
- Child routes require parent to render `<Outlet />` component
- Parent route had no `<Outlet />`, so child never rendered
- Result: Navigating to edit URL showed parent (detail) component only

### Implementation Steps

1. **Fixed Edit Button Navigation (SupplierDetailTabs.tsx)**
   - Removed `Button asChild` pattern (potential Radix UI Slot issue)
   - Changed to direct Link with button styling
   - Code: `<Link to={...} className={cn(buttonVariants({ variant: "outline" }), "inline-flex items-center gap-2")}>`
   - This ensured reliable client-side navigation

2. **Fixed Route Nesting (Primary Fix)**
   - **Renamed:** `_app.suppliers.$id.edit.tsx` → `_app.suppliers.$id_.edit.tsx`
   - **Trailing underscore** after `$id_` creates sibling route instead of child
   - Edit and detail routes now independent (no Outlet required)
   - Edit page now renders correctly with full form

3. **Fixed Permission Check**
   - Replaced non-existent `permissions.isProcurementManager` with `permissions.canEditSupplier`
   - Applied to "Start Qualification" button visibility logic

4. **Updated Tests**
   - Fixed test setup to use `createMemoryRouter` with `RouterProvider`
   - Added missing props: `documents`, `workflows`, `token`

5. **Documentation**
   - Added Issue 9 to `known-issues-and-fixes.md`
   - Created prevention guidelines for future route creation
   - Documented Remix flat file routing conventions

### Files Modified

| File | Change | Reason |
|------|--------|--------|
| `apps/web/app/routes/_app.suppliers.$id_.edit.tsx` | **RENAMED** (was `$id.edit.tsx`) | Make sibling route, not child route |
| `apps/web/app/components/suppliers/SupplierDetailTabs.tsx` | Removed Button asChild, styled Link directly | Ensure reliable navigation |
| `apps/web/app/components/suppliers/__tests__/SupplierDetailTabs.test.tsx` | Updated router setup | Fix test configuration |
| `docs/troubleshooting/known-issues-and-fixes.md` | Added Issue 9 | Document for future reference |

### Testing Results

✅ **Navigation:** Edit button correctly navigates to `/suppliers/:id/edit`  
✅ **URL Change:** Browser address bar updates properly  
✅ **Form Rendering:** Edit page displays full form with input fields  
✅ **Pre-population:** Form fields populated with existing supplier data  
✅ **Editability:** All input fields are editable (can type and modify)  
✅ **Permissions:** Edit button visible only for Admin/Procurement Manager  
✅ **No Errors:** No JavaScript errors in console  

### Lessons Learned

1. **Remix Routing Convention:** Trailing underscore (`$id_`) creates sibling routes, dot without underscore (`$id.segment`) creates child routes
2. **Child Routes Require Outlet:** Never create child routes without verifying parent has `<Outlet />`
3. **Test Navigation Thoroughly:** URL change doesn't guarantee correct component renders
4. **Button asChild Pattern:** Can be fragile with Remix Link - consider direct Link styling
5. **Document Complex Routing:** File naming conventions have significant behavioral impact

### Prevention Measures

- Updated troubleshooting docs with Issue 9 and detailed prevention guidelines
- Documented proper route naming conventions for edit/detail pages
- Added checklist for creating new routes (sibling vs child decision)
- Created reference for when to use `$id_.segment` vs `$id.segment`

---

## QA Results

*To be populated after implementation and QA review*

