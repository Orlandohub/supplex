# Epic 1: Foundation & Supplier Master Data Management

**Epic Goal:** Establish the technical foundation for Supplex including authentication, multi-tenant architecture, and CI/CD pipeline while delivering complete supplier master data management capabilities. This epic enables procurement teams to centralize supplier information, upload documents, and track supplier status—immediately replacing spreadsheets with a secure, auditable system.

## Story 1.1: Project Infrastructure & Monorepo Setup

As a **developer**,
I want a fully configured monorepo with development environment,
so that the team can collaborate efficiently with shared types and consistent tooling.

**Acceptance Criteria:**

1. Monorepo structure created using pnpm workspaces with `apps/web` (Remix), `apps/api` (ElysiaJS), and `packages/` (types, ui, db)
2. All package dependencies installed and version-locked with pnpm lockfile
3. TypeScript configured in strict mode across all workspaces with shared tsconfig base
4. Prettier and ESLint configured with consistent rules across all workspaces
5. Husky and lint-staged configured for pre-commit hooks (lint, format, type-check)
6. Development scripts functional: `pnpm dev` starts both frontend and backend concurrently
7. Hot module reload working for both Remix (frontend) and ElysiaJS (backend)
8. README with clear setup instructions, architecture overview, and development workflow
9. `.env.example` files provided for both apps with all required environment variables documented
10. Local development confirmed working on macOS, Linux, and Windows (WSL)

## Story 1.2: Database Schema & Multi-Tenancy Foundation

As a **developer**,
I want the database schema with multi-tenant support established,
so that all data is properly isolated by tenant from day one.

**Acceptance Criteria:**

1. Drizzle schema defined in `packages/db` for core tables: `tenants`, `users`, `suppliers`, `contacts`, `documents`
2. All tables include `tenant_id` foreign key with indexed lookup for query performance
3. Supabase RLS policies created and tested for all tables enforcing tenant isolation
4. Database migrations functional using Drizzle Kit with rollback capability
5. Tenant context helper functions created that enforce tenant filtering for Drizzle queries
6. Database connection pooling configured appropriately for Supabase
7. Seed data script created for local development (2 test tenants, 5 sample suppliers per tenant)
8. Automated tests verify tenant isolation (queries from Tenant A cannot see Tenant B data)
9. Database indexes created for common query patterns (tenant_id, status, search fields)
10. Entity relationship diagram (ERD) documented showing all tables and relationships

## Story 1.3: Authentication System with Supabase Auth

As a **user**,
I want to sign up, log in, and manage my session securely,
so that I can access the application with my credentials.

**Acceptance Criteria:**

1. Supabase Auth configured with email/password authentication enabled
2. Login page implemented with email and password fields, "Remember me" checkbox, and "Forgot password" link
3. Sign-up page implemented with email, password, password confirmation, and tenant name fields
4. Password validation enforces minimum 8 characters with uppercase, lowercase, and number
5. User registration creates both a Supabase auth user AND a tenant record in the database
6. JWT tokens stored in httpOnly cookies with appropriate expiration and refresh logic
7. Logout functionality clears session and redirects to login page
8. Forgot password flow sends reset email via Supabase Auth with branded email template
9. Protected routes implemented in Remix that redirect unauthenticated users to login
10. Session management handles token refresh automatically before expiration
11. OAuth login with Google provider configured and functional (bonus: Microsoft)
12. Login/signup UI is mobile-responsive and follows Midday design system aesthetic

## Story 1.4: Tenant Management & User Roles

As a **tenant administrator**,
I want to manage users and assign roles within my organization,
so that I can control who has access and what they can do.

**Acceptance Criteria:**

1. Four roles defined and enforced: Admin, Procurement Manager, Quality Manager, Viewer
2. Role stored in `user_metadata` field of Supabase Auth user record
3. Tenant settings page shows list of all users in current tenant with their roles
4. Admin can invite new users via email with role assignment
5. Admin can change user roles for existing users within their tenant
6. Admin can deactivate/reactivate users (soft delete, preserves audit history)
7. ElysiaJS middleware validates JWT and extracts user role for authorization
8. RBAC helper functions created to check permissions (e.g., `canEditSupplier(user, action)`)
9. Frontend conditionally renders UI elements based on user role (hide edit buttons for Viewers)
10. Attempting unauthorized actions returns 403 Forbidden with clear error message
11. Audit log records all user management actions (invite, role change, deactivation)
12. Initial tenant admin is automatically assigned during sign-up

## Story 1.5: Supplier List View & Search

As a **procurement manager**,
I want to see a list of all my suppliers with search and filtering,
so that I can quickly find and access supplier information.

**Acceptance Criteria:**

1. Supplier list page displays all suppliers in a responsive table/card view
2. Table columns: Supplier Name, Status, Category, Location, Contact, Last Updated
3. Status badges display with semantic colors (green=Approved, yellow=Conditional, red=Blocked, gray=Prospect, blue=Qualified)
4. Global search bar filters suppliers by name, company ID, or location in real-time
5. Filter dropdown allows filtering by status (multi-select)
6. Filter dropdown allows filtering by category (multi-select, e.g., "Raw Materials", "Logistics")
7. Pagination controls display for lists over 20 suppliers (20 per page default)
8. Sort functionality on columns: Name (A-Z, Z-A), Status, Last Updated (newest/oldest)
9. Empty state with "Add Your First Supplier" CTA displayed when no suppliers exist
10. Loading skeleton displays while data is fetching
11. Mobile view converts table to card layout with swipe-to-view-details gesture
12. Clicking a supplier row navigates to supplier detail page
13. List performance is acceptable with 1000+ suppliers (< 2s load time)

## Story 1.6: Supplier Detail Page

As a **procurement manager**,
I want to view complete supplier information on a detail page,
so that I have all supplier context in one place.

**Acceptance Criteria:**

1. Supplier detail page displays comprehensive information in tabbed interface: Overview, Documents, History
2. **Overview Tab** displays: Company name, status badge, address, phone, email, website, categories, certifications, notes
3. Primary contact and additional contacts displayed with name, title, email, phone
4. Status change dropdown allows Admin/Procurement Manager to update supplier status
5. Status change triggers confirmation modal and records change in audit history
6. Supplier metadata displayed: Created date, Created by, Last modified date, Last modified by
7. "Edit" button navigates to edit form (visible only to users with edit permissions)
8. "Delete" button with confirmation modal (soft delete, preserves history, Admin only)
9. Mobile-responsive layout with touch-optimized buttons and readable text
10. Loading state displays while fetching supplier data
11. 404 page displays if supplier ID not found or belongs to different tenant
12. Breadcrumb navigation: Home > Suppliers > [Supplier Name]

## Story 1.7: Create & Edit Supplier

As a **procurement manager**,
I want to create new suppliers and edit existing ones,
so that I can maintain accurate supplier information.

**Acceptance Criteria:**

1. "Add Supplier" button on supplier list navigates to create form
2. Create/Edit form includes fields: Company name (required), Status (dropdown), Address (street, city, state, postal, country), Phone, Email (validated format), Website (validated URL format), Categories (multi-select), Notes (textarea)
3. Contact section allows adding multiple contacts with: Name (required), Title, Email (validated), Phone, isPrimary (checkbox, only one can be primary)
4. Form validation using React Hook Form + Zod with inline error messages
5. "Save" button disabled until required fields are valid
6. Duplicate detection warns if supplier name matches existing supplier (fuzzy match)
7. Successful save redirects to supplier detail page with success toast notification
8. Cancel button with confirmation if form has unsaved changes
9. Form data persists in browser local storage on blur (auto-save draft) to prevent data loss
10. Edit form pre-populates all fields with existing supplier data
11. Audit trail records who created/edited and when
12. Mobile-responsive form with appropriate input types (email keyboard, phone keyboard)

## Story 1.8: Document Upload & Management

As a **procurement manager**,
I want to upload and manage documents for each supplier,
so that all certifications and contracts are centralized and accessible.

**Acceptance Criteria:**

1. **Documents Tab** on supplier detail page displays list of uploaded documents
2. Document list shows: Filename, Document type (dropdown: Certificate, Contract, Insurance, Audit Report, Other), Upload date, Uploaded by, File size, Expiration date (optional)
3. "Upload Document" button opens file picker supporting PDF, Excel, Word, PNG, JPG (max 10MB per file)
4. Multiple files can be uploaded simultaneously with progress bar per file
5. Document metadata form captures: Document type (required), Description, Expiration date (date picker)
6. Documents stored in Supabase Storage with tenant-isolated buckets using RLS
7. Download button allows users to download document (opens in new tab for PDFs)
8. Delete button with confirmation modal (soft delete, Admin/Procurement Manager only)
9. Document expiration warning displays if expiration date is within 30 days
10. Expired documents display with red warning badge
11. Document list is sortable by upload date, expiration date, document type
12. Empty state displayed with "Upload your first document" CTA when no documents exist
13. File upload validates file type and size before upload with clear error messages
14. Virus scanning integration point documented for future implementation (Phase 2)

## Story 1.9: CI/CD Pipeline & Deployment

As a **developer**,
I want automated testing and deployment pipelines,
so that code changes are validated and deployed safely.

**Acceptance Criteria:**

1. GitHub Actions workflow configured to run on every pull request
2. CI pipeline runs: lint, type-check, unit tests, integration tests in parallel
3. Test coverage report generated and commented on PR if coverage drops below threshold (70% backend, 60% frontend)
4. Frontend (Remix) configured for automatic deployment to Vercel on merge to `main`
5. Backend (ElysiaJS) configured for deployment to Fly.io (or Vercel) on merge to `main`
6. Preview deployments created for every PR with unique URL (Vercel preview + Fly.io preview app)
7. Database migrations run automatically on deployment using Drizzle Kit
8. Environment variables properly configured for Dev, Staging, Production environments
9. Deployment status badges added to README showing build status
10. Rollback procedure documented in case deployment fails
11. Health check endpoints implemented for both frontend (`/health`) and backend (`/api/health`)
12. Monitoring alerts configured in Sentry for production errors
13. Failed builds block merge with clear error messaging

## Story 1.10: Base UI Shell & Navigation

As a **user**,
I want intuitive navigation to access different areas of the application,
so that I can efficiently move between features.

**Acceptance Criteria:**

1. App shell implemented with top navigation bar showing: Supplex logo, global search, notifications icon, user menu
2. Sidebar navigation (collapsible) with menu items: Dashboard, Suppliers, Qualifications, Evaluations, Complaints, Settings, API
3. Navigation highlights active page/section
4. User menu dropdown shows: User name, email, role, tenant name, "Settings", "Logout"
5. Notification center (bell icon) displays placeholder for future notifications feature with count badge
6. Mobile navigation uses bottom tab bar with primary sections: Dashboard, Suppliers, More (drawer)
7. Sidebar collapses to icon-only mode on narrow desktop screens with tooltip labels
8. Page layout includes breadcrumb navigation for context
9. All navigation components follow Midday design system (colors, spacing, typography) https://github.com/midday-ai/midday/tree/main/packages/ui
10. Keyboard navigation fully functional (Tab, Arrow keys, Enter, Escape)
11. Accessible navigation with proper ARIA labels and roles for screen readers
12. "Skip to main content" link for accessibility
