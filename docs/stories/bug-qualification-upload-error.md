# Bug Story: Upload Document in Qualification Workflow Error

<!-- Powered by BMAD™ Core -->

## Status

**Approved**

Date Created: December 17, 2025  
Identified By: Manual Testing (User)  
Severity: **High** (Blocks qualification workflow completion)  
Story Type: Bug Fix  
Priority: 🔴 **High Priority** - Blocks critical workflow functionality

---

## Bug Description

**As a** Procurement Manager or Admin initiating a qualification workflow,  
**I want** to upload required documents to the qualification workflow checklist,  
**so that** I can complete the document requirements and submit the workflow for review.

---

## Current Behavior (Bug)

1. User initiates a qualification workflow for a supplier
2. User navigates to workflow detail page showing document checklist
3. User clicks "Upload" button for a required document item
4. Upload modal opens (or upload functionality is triggered)
5. **Result:** An error occurs during the document upload process
6. Document is not uploaded successfully to the workflow
7. User cannot progress the workflow to submission stage

**Impact:**
- Qualification workflows cannot be completed
- Document checklist requirements cannot be fulfilled
- Workflows stuck in Draft status
- Critical business process blocked

---

## Expected Behavior

When user uploads a document in qualification workflow:
1. Click "Upload" button for document checklist item
2. File picker opens or upload modal displays
3. User selects file (PDF, Excel, Word, Images - max 10MB)
4. Upload progress indicator shows
5. Document metadata form displays (Document Type, Description, Expiration Date)
6. User fills metadata and clicks "Save" or "Upload"
7. Document uploads successfully to workflow
8. Document checklist item shows as "Uploaded" with checkmark
9. Progress indicator updates (e.g., "3 of 8 documents uploaded")
10. Audit trail records DOCUMENT_UPLOADED event
11. Success toast notification shown

---

## Reproduction Evidence

**Date:** December 17, 2025, 09:30:21 UTC  
**User:** procurement@acme-test.com (Peter Procurement, Procurement Manager)  
**Tenant:** ACME (f6a3cf49-e995-4d28-8430-c5bfd0f77184)  
**Workflow ID:** c95f1084-e742-4473-83a7-968ab73e66f6  
**Supplier ID:** 65acce3c-60f1-4687-b791-ac5f630f849d

**Error Message:**
```
Error: You made a POST request to "/api/workflows/c95f1084-e742-4473-83a7-968ab73e66f6/documents" 
but did not provide an `action` for route "routes/$", so there is no way to handle the request.
```

**HTTP Status:** 405 Method Not Allowed  
**Error Source:** Remix Router (Frontend - NOT Backend)  
**Stack Trace:** Terminal output shows error originates from `@remix-run/router` and `@remix-run/server-runtime`

**Key Finding:** The request **NEVER reaches the ElysiaJS backend API**. Remix is intercepting the POST request and treating it as a Remix route submission instead of an external API call.

---

## Root Cause Analysis

**✅ IDENTIFIED ROOT CAUSE:** Remix routing is intercepting the POST request to `/api/workflows/:id/documents` before it reaches the ElysiaJS backend API.

### Why This Happens

Remix treats ALL requests as potential Remix routes. When a POST request is made to any URL, Remix:
1. Checks if a matching route file exists with an `action` function
2. If no `action` exists, returns 405 Method Not Allowed
3. The request never reaches the external API

### Specific Causes (Investigation Required)

**Frontend Issue (MOST LIKELY - Primary Focus):**
- ❌ `UploadWorkflowDocumentModal.tsx` is NOT using Eden Treaty client correctly
- ❌ Component may be using `<Form method="post">` (Remix intercepts this)
- ❌ Component may be using `useFetcher().submit()` (Remix intercepts this)
- ❌ Component may be using raw `fetch()` with relative URL (Remix dev server intercepts)
- ❌ API call is being treated as Remix route submission instead of external API call

**Configuration Issue (POSSIBLE - Secondary Focus):**
- Vite proxy configuration may not be forwarding `/api/workflows/*` requests to backend
- Eden Treaty client may have incorrect or missing base URL configuration
- Dev server routing may not be properly proxying API requests to `http://localhost:3001`

**NOT Backend Issues** (Backend is working correctly):
- ✅ Backend API endpoint exists and is implemented: `apps/api/src/routes/workflows/upload-document.ts`
- ✅ Backend has proper authentication, validation, and error handling
- ✅ Database schema is correct
- ✅ RLS policies are in place
- ✅ File storage bucket exists (`supplier-documents`)
- **Note:** Backend never receives the request, so backend is not the issue

### Files to Investigate (UPDATED)

**Priority 1 - Frontend Component:**
- `apps/web/app/components/workflows/UploadWorkflowDocumentModal.tsx` - **PRIMARY INVESTIGATION**
  - Check: Is Eden Treaty client being used? `api.workflows[workflowId].documents.post(...)`
  - Check: Is `<Form>`, `useFetcher`, or raw `fetch` being used?
  - Check: What is the exact API call code?

**Priority 2 - Configuration:**
- `apps/web/vite.config.ts` - Check proxy configuration for `/api` routes
- `apps/web/app/lib/api-client.ts` (or similar) - Check Eden Treaty client setup and base URL
- `apps/web/app/config.ts` - Check API URL configuration

**Priority 3 - Route File (if needed):**
- `apps/web/app/routes/_app.workflows.$id.tsx` - Check if route has unnecessary form handling

**NOT Needed:**
- ❌ Backend files (backend is working, request never reaches it)

---

## Acceptance Criteria

1. **File Picker Opens:** Clicking "Upload" button successfully opens file picker or upload modal
2. **File Upload Works:** User can select and upload valid file types (PDF, Excel, Word, Images)
3. **File Validation:** Files are validated for type and size (max 10MB) with clear error messages
4. **Metadata Form:** Document metadata form displays and accepts input (Type, Description, Expiration)
5. **Upload Success:** Document successfully uploads to Supabase Storage and database
6. **Checklist Updates:** Document checklist item shows as "Uploaded" with document details
7. **Progress Updates:** Progress indicator updates correctly (e.g., "4 of 8 documents (50%)")
8. **Audit Trail:** DOCUMENT_UPLOADED event is recorded in workflow timeline
9. **Error Handling:** Any upload errors display user-friendly error messages (not generic errors)
10. **Permissions:** Only workflow initiator and authorized roles can upload documents in Draft stage
11. **Existing Functionality:** All other workflow features remain unaffected

---

## Tasks / Subtasks

- [ ] **Task 1: Reproduce and Document Bug** (AC: 1-9)
  - [ ] Login as Procurement Manager or Admin
  - [ ] Navigate to a qualification workflow in Draft status
  - [ ] Attempt to upload a document for a checklist item
  - [ ] Document exact error message displayed (browser console, UI toast, network tab)
  - [ ] Check browser DevTools Console for JavaScript errors
  - [ ] Check Network tab for failed API requests (note status code and response)
  - [ ] Test with different file types (PDF, Excel, Word, Images)
  - [ ] Test with different file sizes (small <1MB, medium 5MB, large 9MB, oversized 11MB)

- [ ] **Task 2: Investigate Frontend Upload Component** (AC: 1, 2, 9) **[PRIMARY INVESTIGATION]**
  - [ ] Read `UploadWorkflowDocumentModal.tsx` component code
  - [ ] **CRITICAL:** Identify how API call is being made:
    - [ ] Is Eden Treaty client being used? Look for: `api.workflows[workflowId].documents.post(...)`
    - [ ] Is `<Form method="post">` being used? (This causes Remix interception)
    - [ ] Is `useFetcher().submit()` being used? (This causes Remix interception)
    - [ ] Is raw `fetch()` being used with relative URL? (May cause interception)
  - [ ] Check if API call includes full base URL or relative path
  - [ ] Verify Eden Treaty client is imported and configured
  - [ ] Check file upload form submission handler
  - [ ] Add console logging to see exact API call being made

- [ ] **Task 3: Investigate API Client Configuration** (AC: 2, 5, 9)
  - [ ] Check `apps/web/app/lib/api-client.ts` (or similar file) for Eden Treaty setup
  - [ ] Verify Eden Treaty client base URL is configured (should be `http://localhost:3001` for dev)
  - [ ] Check `apps/web/app/config.ts` for API_URL or similar configuration
  - [ ] Verify Vite proxy configuration in `apps/web/vite.config.ts`:
    ```typescript
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        }
      }
    }
    ```
  - [ ] Test if other API endpoints work (GET requests to workflows, suppliers, etc.)
  - [ ] Verify backend is running on correct port (3001)

- [ ] **Task 4: Test Backend API Directly** (AC: 5, 10) **[Verify backend works]**
  - [ ] Test backend API endpoint directly with Postman/curl/Thunder Client
  - [ ] POST to `http://localhost:3001/api/workflows/{workflowId}/documents`
  - [ ] Include valid auth token in Authorization header
  - [ ] Include multipart/form-data with file and metadata
  - [ ] Verify backend responds with 201 Created (proves backend works)
  - [ ] This confirms issue is in frontend routing, not backend

- [ ] **Task 5: Implement Fix Based on Root Cause** (AC: 1-11)
  - [ ] **Fix Option A: Use Eden Treaty Client Properly**
    - [ ] Replace any `<Form>` or `useFetcher` with Eden Treaty API call
    - [ ] Ensure Eden Treaty client is imported: `import { api } from '~/lib/api-client'`
    - [ ] Use proper Eden Treaty syntax: `await api.workflows[workflowId].documents.post({ body: formData })`
    - [ ] Ensure Eden Treaty client has base URL configured
  - [ ] **Fix Option B: Fix Vite Proxy (if Eden Treaty not working)**
    - [ ] Update `vite.config.ts` to properly proxy `/api` requests to backend
    - [ ] Ensure proxy target is `http://localhost:3001`
    - [ ] Test that proxy forwards requests correctly
  - [ ] **Fix Option C: Use Absolute URL (workaround)**
    - [ ] If using raw `fetch`, use absolute URL: `fetch('http://localhost:3001/api/...')`
    - [ ] Not recommended for production, but proves the issue
  - [ ] Verify fix allows upload to reach backend API
  - [ ] Ensure error messages are user-friendly and actionable

- [ ] **Task 6: Test Upload Flow End-to-End** (AC: 1-11)
  - [ ] Login as Procurement Manager
  - [ ] Navigate to qualification workflow in Draft
  - [ ] Click "Upload" for first document item → verify modal opens
  - [ ] Select PDF file (valid, <10MB) → verify uploads successfully
  - [ ] Fill metadata (Type, Description, Expiration) → verify saves
  - [ ] Verify checklist item shows "Uploaded" status with document name
  - [ ] Verify progress indicator updates (e.g., "1 of 8 documents (13%)")
  - [ ] Check audit trail → verify DOCUMENT_UPLOADED event appears
  - [ ] Upload Excel, Word, and Image files → verify all work
  - [ ] Test oversized file (>10MB) → verify clear error message
  - [ ] Test invalid file type (.exe, .zip) → verify clear error message

- [ ] **Task 7: Test Error Scenarios** (AC: 9)
  - [ ] Test with network offline → verify error message
  - [ ] Test with invalid file type → verify error message
  - [ ] Test with oversized file → verify error message
  - [ ] Test without required metadata → verify validation error
  - [ ] Test as Quality Manager (not workflow initiator) → verify correct behavior

- [ ] **Task 8: Regression Testing** (AC: 11)
  - [ ] Verify document list displays uploaded documents correctly
  - [ ] Verify download button works for uploaded documents
  - [ ] Verify remove document button works (if in Draft)
  - [ ] Verify linking existing supplier document works (if feature exists)
  - [ ] Verify workflow submission button enables when all required docs uploaded
  - [ ] Verify other workflow functionality unaffected

---

## Dev Notes

### Workflow Document Upload Components

**Frontend Files (Investigation Focus):**
- **Upload Modal:** `apps/web/app/components/workflows/UploadWorkflowDocumentModal.tsx` **[PRIMARY]**
- **Document List:** `apps/web/app/components/workflows/UploadedDocumentsList.tsx`
- **Workflow Detail Route:** `apps/web/app/routes/_app.workflows.$id.tsx`
- **API Client:** `apps/web/app/lib/api-client.ts` (Eden Treaty setup)
- **Config:** `apps/web/app/config.ts` (API URL configuration)
- **Vite Config:** `apps/web/vite.config.ts` (Proxy configuration)

**Backend Files (Verified - Working Correctly):**
- **Workflow Routes:** `apps/api/src/routes/workflows/` directory ✅
- **Document Upload Endpoint:** `apps/api/src/routes/workflows/upload-document.ts` ✅
- **Route Aggregator:** `apps/api/src/routes/workflows/index.ts` ✅
- **Test File:** `apps/api/src/routes/workflows/__tests__/upload-document.test.ts` ✅
- **Note:** Backend implementation is correct and tested. Issue is in frontend routing.

### Expected API Flow (CORRECTED)

**Frontend → Backend (CORRECT Implementation):**
```typescript
// Frontend: UploadWorkflowDocumentModal.tsx
// MUST use Eden Treaty client, NOT Remix forms

import { api } from '~/lib/api-client'; // Eden Treaty client

const handleUpload = async (formData: FormData) => {
  // Eden Treaty API call - bypasses Remix routing
  const response = await api.workflows[workflowId].documents.post({
    file: fileData,
    checklistItemId: checklistItemId,
    documentType: formData.type,
    description: formData.description,
    // Note: Backend uses expiryDate, not expiration_date
  });
};
```

**INCORRECT Implementations (Cause Remix Interception):**
```typescript
// ❌ WRONG: Using Remix Form (causes 405 error)
<Form method="post" action={`/api/workflows/${workflowId}/documents`}>
  {/* Remix intercepts this */}
</Form>

// ❌ WRONG: Using useFetcher (causes 405 error)
const fetcher = useFetcher();
fetcher.submit(formData, { 
  method: "post", 
  action: `/api/workflows/${workflowId}/documents` 
});

// ⚠️ MAYBE WRONG: Raw fetch with relative URL (may be intercepted)
fetch(`/api/workflows/${workflowId}/documents`, { method: 'POST', ... });
// Should use absolute URL or Eden Treaty
```

**Backend: Document Upload Handler (VERIFIED WORKING)**
```typescript
// apps/api/src/routes/workflows/upload-document.ts
// Actual endpoint: POST /api/workflows/:workflowId/documents (NO /upload suffix)
// Uses authenticate middleware (not nested in wrappers) ✅
// Validates payload with TypeBox (not Zod) ✅
// Uploads file to Supabase Storage bucket: "supplier-documents" ✅
// Inserts record into workflow_documents table ✅
// Creates audit trail event (DOCUMENT_UPLOADED) ✅
// Returns document record ✅
```

### File Upload Specifications

**Allowed File Types:**
- PDF (`.pdf`)
- Excel (`.xlsx`, `.xls`)
- Word (`.docx`, `.doc`)
- Images (`.png`, `.jpg`, `.jpeg`)

**File Size Limit:** 10MB maximum

**Validation:** Must validate both on frontend (UX) and backend (security)

### Database Schema (VERIFIED)

**Table:** `workflow_documents` ✅

**Actual Fields (Verified from schema files):**
- `id` (UUID, primary key) - Drizzle: `id`
- `workflow_id` (UUID, foreign key) - Drizzle: `workflowId`
- `checklist_item_id` (UUID, nullable) - Drizzle: `checklistItemId`
- `document_id` (UUID, foreign key to `documents` table) - Drizzle: `documentId`
- `status` (varchar) - Drizzle: `status` (Pending, Uploaded, Approved, Rejected)
- `created_at` (timestamp) - Drizzle: `createdAt`
- `updated_at` (timestamp) - Drizzle: `updatedAt`
- `deleted_at` (timestamp, nullable) - Drizzle: `deletedAt`

**Table:** `documents` ✅ (Stores actual document metadata)

**Actual Fields:**
- `id` (UUID, primary key)
- `tenant_id` (UUID) - Drizzle: `tenantId`
- `supplier_id` (UUID) - Drizzle: `supplierId`
- `filename` (varchar) - Drizzle: `filename`
- `document_type` (varchar) - Drizzle: `documentType`
- `storage_path` (varchar) - Drizzle: `storagePath`
- `file_size` (bigint) - Drizzle: `fileSize`
- `mime_type` (varchar) - Drizzle: `mimeType`
- `description` (text, nullable) - Drizzle: `description`
- `expiry_date` (date, nullable) - Drizzle: `expiryDate` **[Note: camelCase in code]**
- `uploaded_by` (UUID) - Drizzle: `uploadedBy`
- `created_at` (timestamp) - Drizzle: `createdAt`
- `updated_at` (timestamp) - Drizzle: `updatedAt`
- `deleted_at` (timestamp, nullable) - Drizzle: `deletedAt`

**RLS Policies:**
- Users can INSERT documents to workflows in their tenant
- Users can SELECT documents from workflows in their tenant
- Users can DELETE documents only if they are workflow initiator AND workflow is in Draft

### Supabase Storage (VERIFIED)

**Bucket Name:** `supplier-documents` ✅ (Verified from upload-document.ts)

**File Path Pattern:** `{tenantId}/{supplierId}/qualification-{workflowId}/{uuid}_{sanitizedFilename}`
- Example: `f6a3cf49-e995-4d28-8430-c5bfd0f77184/65acce3c-60f1-4687-b791-ac5f630f849d/qualification-c95f1084-e742-4473-83a7-968ab73e66f6/a1b2c3d4_certificate.pdf`

**Bucket Permissions:**
- Must allow authenticated users to upload
- Must enforce tenant isolation via RLS or bucket policies
- Files should be private (not public) - accessed via signed URLs

### Tech Stack (From architecture/tech-stack.md)

- **Frontend Framework:** Remix 2.8+ (SSR framework)
- **UI Components:** shadcn/ui (Midday fork)
- **Form Management:** React Hook Form 7.51+
- **Validation:** Zod 3.22+ (frontend) / TypeBox (backend ElysiaJS)
- **Backend Framework:** ElysiaJS 1.0+ on Bun runtime
- **API Style:** REST + Eden Treaty (type-safe client)
- **Database:** PostgreSQL 15+ (hosted on Supabase)
- **File Storage:** Supabase Storage (managed object storage)
- **Authentication:** Supabase Auth (JWT tokens)

### Critical Coding Standards (From architecture/coding-standards.md)

**API Calls:**
- ✅ MUST use Eden Treaty client - never direct HTTP calls
- ✅ MUST handle errors and display user-friendly messages

**Authentication Middleware (Backend):**
- ✅ MUST use `authenticate` middleware directly on routes, NOT nested in wrappers
- ✅ MUST perform role checks inside handlers with null checks: `if (!user?.role || ...)`

**Database Queries:**
- ✅ MUST include tenant filter on ALL queries (tenant isolation)
- ✅ MUST verify field names against actual schema before writing queries
- ✅ MUST add null checks for joined data: `joinedTable?.field`

**ElysiaJS Validation:**
- ✅ MUST use TypeBox (`t.*`) exclusively for route validation, never Zod (`z.*`)
- ✅ For enums, use `t.Union([t.Literal(...), ...])` not Zod schemas

**ElysiaJS Route Organization:**
- ✅ ONLY parent aggregator (`index.ts`) should have a prefix
- ✅ Child routes must NOT have prefixes - parent provides them
- ✅ Use consistent parameter names (e.g., `:workflowId`)

**Error Handling:**
- ✅ All API routes must use standard error handler
- ✅ Return user-friendly error messages (not stack traces)
- ✅ Log errors to monitoring system (Sentry)

**Remix Data Loading:**
- ✅ ALL data fetching must be in loaders (server-side), never in `useEffect`
- ✅ Use `useRevalidator()` for mutations, never manual state updates

### Common Issues to Check (UPDATED - Focus on Remix Routing)

1. **🔴 PRIMARY ISSUE: Remix Intercepting API Calls**
   - Using `<Form>` or `useFetcher` causes Remix to intercept POST requests
   - Solution: Use Eden Treaty client directly, NOT Remix form components
   
2. **Eden Treaty Not Configured:** 
   - Client may be missing base URL configuration
   - Should point to `http://localhost:3001` in dev
   
3. **Vite Proxy Not Configured:**
   - If using relative URLs, Vite must proxy `/api` to backend
   - Check `vite.config.ts` has proper proxy configuration
   
4. **Using Relative URL with fetch():**
   - Raw `fetch('/api/...')` may be intercepted by Remix dev server
   - Solution: Use Eden Treaty or absolute URL
   
5. **Backend Not Running:**
   - Ensure ElysiaJS API is running on port 3001
   - Check terminal for backend process
   
6. **File Upload FormData Issues:**
   - Ensure multipart/form-data is used for file uploads
   - Eden Treaty should handle this automatically
   
7. **Progress Indicator Not Updating:**
   - After successful upload, ensure frontend re-fetches workflow data
   - Use `useRevalidator()` to trigger Remix loader re-fetch

### Debugging Steps (UPDATED for Remix Routing Issue)

1. **Browser DevTools Console:** 
   - Check for JavaScript errors
   - Look for Remix routing errors: "did not provide an `action`"
   - Check if error mentions `@remix-run/router`

2. **Network Tab (Critical):**
   - Look for POST request to `/api/workflows/:id/documents`
   - Check status code: **405 = Remix interception issue**
   - Check if request reaches backend (look in backend terminal logs)
   - If no request in backend logs → Remix is intercepting

3. **Frontend Code Inspection:**
   - Open `UploadWorkflowDocumentModal.tsx`
   - Search for form submission code
   - Check if Eden Treaty is used: `api.workflows[id].documents.post`
   - Check if `<Form>` or `useFetcher` is used (causes issue)

4. **Test Backend Directly (Bypass Frontend):**
   - Use Postman/Thunder Client/curl
   - POST to `http://localhost:3001/api/workflows/{id}/documents`
   - Include Authorization header with valid JWT token
   - If this works → confirms frontend routing is the issue

5. **Check Vite Configuration:**
   - Open `apps/web/vite.config.ts`
   - Verify proxy configuration exists for `/api` routes
   - Ensure proxy target is `http://localhost:3001`

6. **Backend Logs (Secondary):**
   - Check ElysiaJS console for incoming requests
   - If no POST requests appear → frontend routing issue confirmed
   - If requests appear with errors → backend issue (unlikely based on reproduction)

---

## Testing

### Manual Testing Checklist

- [ ] **Happy Path:**
  - [ ] Login as Procurement Manager
  - [ ] Navigate to qualification workflow (Draft status)
  - [ ] Click "Upload" for document checklist item
  - [ ] Upload PDF file (<10MB)
  - [ ] Fill metadata form
  - [ ] Verify document uploads successfully
  - [ ] Verify checklist item shows "Uploaded"
  - [ ] Verify progress indicator updates
  - [ ] Verify audit trail event appears

- [ ] **File Type Validation:**
  - [ ] Upload PDF → Success
  - [ ] Upload Excel → Success
  - [ ] Upload Word → Success
  - [ ] Upload Image (PNG, JPG) → Success
  - [ ] Upload invalid type (.exe, .zip) → Clear error message

- [ ] **File Size Validation:**
  - [ ] Upload 1MB file → Success
  - [ ] Upload 5MB file → Success
  - [ ] Upload 9.9MB file → Success
  - [ ] Upload 11MB file → Clear error message

- [ ] **Permissions:**
  - [ ] Workflow initiator can upload (Draft stage) → Success
  - [ ] Admin can upload (Draft stage) → Success
  - [ ] Quality Manager (reviewer) cannot upload (Draft stage) → Correct behavior
  - [ ] Workflow initiator cannot upload (In Review/Approved) → Correct behavior

- [ ] **Error Handling:**
  - [ ] Network offline → User-friendly error
  - [ ] Invalid file type → Validation error
  - [ ] Oversized file → Validation error
  - [ ] Missing metadata → Validation error

- [ ] **Regression:**
  - [ ] Download document works
  - [ ] Remove document works (if in Draft)
  - [ ] View document list works
  - [ ] Workflow submission works after all docs uploaded

### Testing Standards (From architecture)

**Framework:** Vitest 1.4+ (frontend unit/integration tests)

**Test File Location (if adding tests):**
- Frontend component tests: `apps/web/app/components/workflows/__tests__/UploadWorkflowDocumentModal.test.tsx`
- Backend API tests: `apps/api/src/routes/workflows/documents/__tests__/upload.test.ts`

**Testing Focus:**
- Manual testing is PRIMARY for this bug fix (reproduce, fix, verify)
- Consider adding regression tests if bug was caused by missing validation
- E2E test: Consider Playwright test for workflow document upload flow

---

## Implementation Priority

**Priority:** 🔴 **High - Blocker**

**Impact:** High - Blocks qualification workflow completion, critical business process

**Root Cause:** ✅ **IDENTIFIED** - Remix routing intercepting API POST requests

**Estimated Effort:** 1-2 hours (root cause identified, fix is straightforward)
- Investigation: ✅ COMPLETE (30 minutes) - Root cause identified as Remix routing
- Fix (frontend routing): 30-45 minutes (Replace form submission with Eden Treaty client)
- Testing: 15-30 minutes (Verify upload works end-to-end)
- Regression testing: 15-30 minutes (Verify other workflow features unaffected)

**Dependencies:** None - can be fixed immediately

**Recommendation:** Fix ASAP - replace Remix form submission with Eden Treaty API client in UploadWorkflowDocumentModal.tsx

---

## Notes

**User Impact:**
- Procurement Managers cannot complete qualification workflows
- Document checklist requirements cannot be fulfilled
- Workflows stuck in Draft status indefinitely
- Supplier qualification process completely blocked

**Business Impact:**
- High - Prevents supplier onboarding
- High - Blocks compliance documentation requirements
- Critical for qualification workflow feature (Epic 2)

**Root Cause Summary:**
- ✅ **IDENTIFIED:** Remix router is intercepting POST requests to `/api/workflows/:id/documents`
- ✅ **ERROR:** 405 Method Not Allowed - "did not provide an `action` for route"
- ✅ **LOCATION:** Frontend routing issue in `UploadWorkflowDocumentModal.tsx`
- ✅ **BACKEND STATUS:** Backend API is working correctly and never receives the request
- ✅ **FIX:** Replace Remix form submission with Eden Treaty API client

**Related Stories:**
- Story 2.4: Document Upload for Qualification (`docs/stories/2.4.story.md`)
- Story 1.8: Document Upload & Management (supplier documents - may share similar code patterns)

**Investigation Status:**
1. ✅ Bug reproduced and error captured (405 Remix routing error)
2. ✅ Root cause identified (Remix intercepting API calls)
3. ✅ Backend verified working (tested endpoint exists and is correct)
4. ✅ Technical details verified (storage bucket, schema, API paths)
5. 🔄 **NEXT:** Fix frontend component to use Eden Treaty client

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2025-12-17 | 1.0 | Bug story created - Document upload in qualification workflow has error | Bob (Scrum Master) |
| 2025-12-17 | 1.1 | Added reproduction evidence with actual error (405 Remix routing issue) | Sarah (PO) |
| 2025-12-17 | 1.2 | Updated root cause analysis - Identified Remix intercepting POST requests | Sarah (PO) |
| 2025-12-17 | 1.3 | Updated investigation tasks to focus on frontend routing, not backend | Sarah (PO) |
| 2025-12-17 | 1.4 | Verified and corrected technical details (API paths, storage bucket, schema fields) | Sarah (PO) |
| 2025-12-17 | 1.5 | Story status changed to Approved - Ready for implementation | Sarah (PO) |

---

## Dev Agent Record

*To be populated during implementation*

---

## QA Results

*To be populated after implementation and QA review*

