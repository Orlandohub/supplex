# Supplex Product Requirements Document (PRD)

## Goals and Background Context

### Goals

- Launch a multi-tenant SaaS platform enabling mid-sized manufacturers to manage their complete supplier lifecycle from qualification through performance evaluation and complaints management
- Reduce supplier management administrative burden by 10+ hours per week through automation and centralized workflows
- Achieve supplier qualification time reduction of 50%+ (from 4-8 weeks to 2-4 weeks)
- Provide enterprise-grade supplier management at 80-90% lower cost than enterprise solutions ($299-$799/month vs. $10K-$150K+/month)
- Enable compliance with ISO 9001, IATF 16949, and other quality certifications through robust audit trails and documentation management
- Deliver MVP within 4 months with 30 paying customers and $250K ARR by Month 12
- Achieve 99%+ system uptime, <2s page load times, and <500ms API response times
- Build modern, intuitive UX with mobile-first responsive design inspired by Midday theme

### Background Context

Mid-sized manufacturing companies (50-500 employees) manage 20-200 active suppliers who are critical to their operations, yet 68% still rely on Excel spreadsheets, email, and shared drives for supplier management. This manual approach exposes them to compliance risks, audit failures, and operational inefficiencies costing 10-20 hours per week in staff time. Enterprise solutions like SAP Ariba ($150K+/year, 6-12 month implementations) are prohibitively expensive, while existing alternatives lack the supplier-focused depth needed for quality and procurement teams.

Supplex addresses this $4.2B market opportunity by combining supplier master data, qualification workflows, continuous performance evaluation, and complaint management in a single platform built on a modern tech stack (Remix, ElysiaJS, Drizzle, Supabase). Post-COVID supply chain disruptions and tightening regulatory requirements have elevated supplier risk management to a board-level concern, creating urgent demand for affordable, cloud-based solutions that can be implemented in weeks rather than months.

### Change Log

| Date             | Version | Description                                  | Author    |
| ---------------- | ------- | -------------------------------------------- | --------- |
| October 13, 2025 | 1.0     | Initial PRD creation from Project Brief v2.0 | John (PM) |

## Requirements

### Functional

**FR1:** The system must support multi-tenant architecture with complete data isolation between tenants using Supabase Row Level Security (RLS) policies

**FR2:** Users must be able to authenticate using email/password and OAuth providers through Supabase Auth

**FR3:** The system must support role-based access control with four roles: Admin, Procurement Manager, Quality Manager, and Viewer

**FR4:** Users must be able to create and manage comprehensive supplier profiles including company information, contacts, categories, certifications, and documents

**FR5:** The system must support supplier status tracking across states: Prospect, Qualified, Approved, Conditional, and Blocked

**FR6:** Users must be able to search, filter, and detect duplicate suppliers

**FR7:** The system must provide a 3-stage linear approval workflow for supplier qualification with configurable document collection checklists

**FR8:** The system must provide manual risk scoring capabilities for supplier qualification

**FR9:** Users must receive email notifications on supplier qualification status changes

**FR10:** The system must maintain a complete audit trail for all qualification workflow activities

**FR11:** Users must be able to schedule and conduct quarterly performance evaluations with manual triggering

**FR12:** Performance evaluations must support 4 standard dimensions: Quality, Delivery, Service, and Cost with 1-5 scale manual scoring

**FR13:** The system must track historical performance data and display trending over time

**FR14:** Users must be able to generate supplier scorecards showing performance across all dimensions

**FR15:** Users must be able to register complaints with category, severity level, description, and file attachments

**FR16:** The system must support basic CAPA (Corrective and Preventive Action) workflow including root cause, corrective actions, and preventive actions

**FR17:** Complaints must support status tracking, assignment to users, and due date management

**FR18:** Users must receive email notifications for complaint assignments and status changes

**FR19:** The system must display complaint history per supplier

**FR20:** The system must provide an executive dashboard showing total suppliers, performance tier distribution, and open complaints

**FR21:** Users must be able to export data in CSV/Excel and PDF formats

**FR22:** The system must provide a RESTful API for all core entities with JWT authentication

**FR23:** The API must support versioning (v1) and include OpenAPI/Swagger documentation

**FR24:** The system must provide API key management for programmatic access

**FR25:** Users must be able to upload and download documents to supplier repositories with version tracking

**FR26:** The system must send automated notifications and reminders for certificate expirations

**FR27:** Tenant administrators must be able to configure qualification document checklists per tenant

**FR28:** The system must support manual evaluation scheduling and execution

### Non Functional

**NFR1:** The system must achieve 99%+ uptime for MVP phase

**NFR2:** Page load times must be under 2 seconds at 95th percentile

**NFR3:** API response times must be under 500ms at 95th percentile

**NFR4:** The system error rate must be below 0.1%

**NFR5:** The application must be mobile-first responsive, functional on all modern browsers and mobile devices

**NFR6:** Touch targets must be minimum 44px for mobile usability

**NFR7:** The system must be built using Remix framework for frontend with server-side rendering

**NFR8:** The backend API must be built using ElysiaJS on Bun runtime

**NFR9:** The database must be PostgreSQL 15+ hosted on Supabase

**NFR10:** All database queries must use either Supabase SDK (with RLS) or Drizzle ORM with manual tenant filtering

**NFR11:** The system must use Tailwind CSS and shadcn/ui components with Midday design theme (https://github.com/midday-ai/midday/tree/main/packages/ui)

**NFR12:** Backend test coverage must be at least 70%, frontend test coverage at least 60%

**NFR13:** The system must address OWASP Top 10 security vulnerabilities

**NFR14:** Multi-tenant data isolation must be verified through automated testing and security audit

**NFR15:** The system must implement rate limiting on all API endpoints

**NFR16:** The system must support basic GDPR compliance requirements including data export and deletion

**NFR17:** The frontend must be deployed on Vercel, backend on Fly.io or Vercel

**NFR18:** The system must use Redis (Upstash) for caching

**NFR19:** The system must use BullMQ for queue management

**NFR20:** The codebase must be organized as a monorepo using pnpm workspaces

**NFR21:** The system must provide end-to-end type safety using TypeScript with shared types package

**NFR22:** Authentication must use Supabase Auth with application-level role authorization in ElysiaJS middleware

**NFR23:** The system must be production-ready within 4 months from start of development

**NFR24:** The system must support load of 50 concurrent users and 1000 suppliers minimum

**NFR25:** The system must include monitoring and alerting configured with Sentry and Vercel Analytics

## User Interface Design Goals

### Overall UX Vision

Supplex delivers a **modern, intuitive, and professional** user experience inspired by the Midday design system—clean, minimalist, and data-focused. The interface prioritizes **speed and efficiency** for busy procurement and quality managers who need to complete tasks quickly without extensive training. The design balances **visual clarity** (clear data hierarchy, generous whitespace, readable typography) with **information density** (power users need to see critical data at a glance). Mobile-first responsive design ensures full functionality on tablets and phones for users conducting supplier audits on-site or reviewing performance metrics on the go. The experience should feel **trustworthy and enterprise-grade** while remaining approachable and lightweight—not overwhelming like SAP, but more sophisticated than a simple CRUD app.

### Key Interaction Paradigms

- **Dashboard-First Navigation:** Users land on role-specific dashboards (Executive, Procurement, Quality) showing actionable insights and pending tasks
- **Contextual Workflows:** Multi-step processes (qualification, evaluation, CAPA) use progressive disclosure with clear step indicators and ability to save/resume
- **Inline Editing:** Quick edits happen in-place with optimistic UI updates (click to edit supplier status, inline comment entry)
- **Smart Search & Filtering:** Global search with type-ahead, faceted filters, and saved filter presets for common views
- **Notification Center:** Bell icon with categorized notifications (approvals needed, due dates, alerts) with deep links to relevant context
- **Bulk Actions:** Select multiple items (suppliers, complaints) for batch operations (export, status change, assignment)
- **Mobile Touch Patterns:** Bottom navigation for mobile, swipe gestures for mobile list actions, pull-to-refresh on data views

### Core Screens and Views

From a product perspective, the critical screens necessary to deliver PRD value are:

- **Login/Authentication Screen**
- **Executive Dashboard** (KPI cards, charts, quick actions)
- **Supplier List View** (searchable, filterable table/cards with status indicators)
- **Supplier Detail Page** (profile, documents, performance history, complaints, tabbed interface)
- **Supplier Create/Edit Form**
- **Qualification Workflow Screen** (stepper interface, document checklist, approval actions)
- **Evaluation Form/Screen** (rating inputs for 4 dimensions, comments, historical comparison)
- **Complaint Registration Form**
- **Complaint Detail/CAPA Workflow Screen** (root cause, actions, timeline, evidence)
- **Performance Scorecards View** (supplier comparison, trending charts)
- **User/Tenant Settings** (role management, configuration, notifications preferences)
- **API Management Screen** (API keys, documentation links, usage stats)

### Accessibility: WCAG AA

Target WCAG 2.1 Level AA compliance to meet regulatory and enterprise customer requirements. Key considerations:

- Color contrast ratios meet 4.5:1 minimum for text
- All interactive elements keyboard accessible with visible focus indicators
- Screen reader compatibility with semantic HTML and ARIA labels
- Form validation with clear error messaging
- Skip navigation links for efficiency

### Branding

**Design Inspiration:** Midday design system aesthetic—clean, professional, data-focused with subtle use of color

**Color Approach:**

- Neutral grayscale base (blacks, grays, whites) for primary interface
- Strategic accent color for CTAs, active states, and key metrics (suggest professional blue or teal)
- Semantic colors for status indicators (green=approved, yellow=conditional, red=blocked/critical, blue=in-progress)
- Supplier performance tier colors (high/medium/low performers)

**Typography:**

- Modern sans-serif font stack (Inter, system fonts) for readability
- Clear hierarchy with consistent sizing scale
- Emphasis on data readability (tabular numerics, monospace for IDs/codes)

**Visual Elements:**

- Minimalist iconography (Lucide or Heroicons)
- Subtle shadows and borders (avoid heavy skeuomorphism)
- Data visualization using clean charts (consider Tremor or Recharts components)

**Tone:** Professional, trustworthy, efficient—not playful, not corporate-boring, just right for mid-market manufacturing audience

### Target Device and Platforms: Web Responsive

**Primary:** Web Responsive (desktop-first development, mobile-first design)

- Desktop browsers: Chrome, Firefox, Safari, Edge (latest 2 versions)
- Tablet: iPad, Android tablets (responsive breakpoints)
- Mobile: iOS Safari, Chrome Mobile (full functionality, optimized layouts)

**Breakpoints Strategy:**

- Mobile: 320px - 767px (single column, bottom nav, simplified tables)
- Tablet: 768px - 1023px (adaptive layouts, optimized for portrait/landscape)
- Desktop: 1024px+ (full multi-column layouts, data tables, side navigation)

**Touch Optimization:**

- Minimum 44px touch targets on mobile
- Swipe gestures for mobile list actions
- Bottom sheet modals for mobile forms
- Responsive tables convert to cards or horizontal scroll on mobile

**MVP Limitation:** Responsive web only—no native mobile apps until Phase 3

## Technical Assumptions

### Repository Structure: Monorepo

**Decision:** Monorepo using pnpm workspaces

**Structure:**

```
supplex/
├── apps/
│   ├── web/          # Remix frontend application
│   └── api/          # ElysiaJS backend API
├── packages/
│   ├── types/        # Shared TypeScript types and interfaces
│   ├── ui/           # Shared UI components (Midday-based shadcn/ui)
│   └── db/           # Drizzle schema definitions and migrations
```

**Rationale:**

- **Code sharing:** Enables type-safe sharing of TypeScript interfaces between frontend and backend (end-to-end type safety)
- **Consistency:** Shared UI component library ensures consistent design across all interfaces
- **Developer experience:** Single repository simplifies development workflow, unified versioning, single CI/CD pipeline
- **Monorepo tooling:** pnpm workspaces provides efficient dependency management and fast installs
- **Scalability:** Structure supports future additions (mobile apps, worker services, additional packages)

**Alternatives considered:**

- Polyrepo rejected: Overhead of managing multiple repos, versioning complexity, duplicate tooling setup
- Turborepo considered but pnpm workspaces sufficient for MVP

### Service Architecture

**Decision:** Hybrid Architecture - Remix SSR frontend + ElysiaJS REST API backend (functionally a distributed monolith with clear separation)

**Architecture Pattern:**

**Frontend (Remix):**

- Server-Side Rendering (SSR) for optimal performance and SEO
- Uses Supabase SDK for direct database queries (RLS-protected, automatically tenant-filtered)
- Handles user-facing pages, forms, and initial data loading
- Route-based code splitting for optimal bundle sizes

**Backend (ElysiaJS API):**

- RESTful API for complex business logic and cross-cutting operations
- Uses Drizzle ORM for type-safe SQL queries with manual tenant filtering
- Handles workflows, notifications, scheduled jobs, data exports
- Provides API for external integrations and future mobile apps

**Data Access Strategy (Hybrid Query Pattern):**

```typescript
// Remix loaders - Use Supabase SDK (RLS enforced automatically)
export async function loader({ request }) {
  const supabase = createServerClient(request); // User JWT in context
  const { data } = await supabase.from("suppliers").select("*"); // RLS auto-filters by tenant
  return json({ suppliers: data });
}

// ElysiaJS API - Use Drizzle ORM (manual tenant filtering)
app.get("/api/v1/suppliers/:id/scorecard", async ({ tenantId, params }) => {
  const tenantDb = createTenantDB(tenantId); // Helper enforces tenant context
  // Complex aggregations across multiple tables
  return await tenantDb.query.suppliers.findMany({
    where: eq(suppliers.tenantId, tenantId),
    with: { evaluations: true, complaints: true },
  });
});
```

**Rationale:**

- **Best of both worlds:** Remix SSR provides excellent UX, ElysiaJS provides high-performance API
- **Security depth:** Two-layer tenant isolation (RLS for user queries, app-level for complex queries)
- **Type safety:** End-to-end types from database → API → frontend using shared types package
- **Performance:** Bun runtime for ElysiaJS delivers exceptional speed (3-4x faster than Node.js)
- **Scalability:** Can independently scale frontend (Vercel) and backend (Fly.io) based on load patterns
- **Future-proof:** API-first approach supports future mobile apps and integrations

**MVP Constraint:** Not microservices—services are coupled through shared database for simplicity

### Testing Requirements

**Decision:** Comprehensive testing pyramid with focus on backend coverage

**Backend Testing (70%+ coverage required):**

- **Unit tests:** Business logic, validators, helpers (Bun test framework)
- **Integration tests:** API endpoints with test database (Supabase local dev)
- **Security tests:** Tenant isolation verification, RLS policy validation
- **Key areas:** Multi-tenancy isolation, authentication/authorization, workflow logic, data integrity

**Frontend Testing (60%+ coverage required):**

- **Component tests:** UI components using Vitest + Testing Library
- **Integration tests:** Forms, workflows, user journeys
- **E2E tests:** Critical paths using Playwright (login → create supplier → qualification workflow)

**API Testing:**

- OpenAPI/Swagger spec validation
- Contract tests between frontend and API
- Rate limiting verification
- API key authentication tests

**Performance Testing:**

- Load testing: 50 concurrent users minimum
- Database query performance (< 500ms for 95th percentile)
- Page load testing (< 2s for 95th percentile)

**Manual Testing:**

- Cross-browser testing (Chrome, Firefox, Safari, Edge)
- Mobile device testing (iOS, Android - real devices)
- Accessibility testing (keyboard navigation, screen readers)
- Usability testing with 5 internal users before MVP launch

**CI/CD Integration:**

- All tests run on every pull request
- Deployment blocked if tests fail or coverage drops below thresholds
- Preview deployments for every PR (Vercel)

**Rationale:**

- **Backend priority:** Higher coverage required for backend due to security criticality (multi-tenancy, auth)
- **Tenant isolation is critical:** Automated tests prevent data leaks between tenants (catastrophic failure scenario)
- **Compliance requirement:** Audit trail and data integrity testing essential for ISO 9001 customers
- **MVP pragmatism:** 60-70% coverage balances quality with speed—100% coverage would delay launch

### Additional Technical Assumptions and Requests

**Languages & Frameworks:**

- **Primary language:** TypeScript (strict mode) for entire stack
- **Frontend framework:** Remix v2.x (React-based SSR framework)
- **Backend framework:** ElysiaJS v1.x (Bun-native fast API framework)
- **UI framework:** React 18+ with Tailwind CSS v3.x
- **Component library:** shadcn/ui (Midday packages: https://github.com/midday-ai/midday/tree/main/packages/ui)

**Database & ORM:**

- **Database:** PostgreSQL 15+ (hosted on Supabase)
- **ORM:** Drizzle ORM for type-safe SQL queries
- **Migrations:** Drizzle Kit for schema migrations
- **Multi-tenancy:** Hybrid approach (RLS policies + application-level filtering)

**Authentication & Authorization:**

- **Auth provider:** Supabase Auth (email/password + OAuth providers: Google, Microsoft)
- **Session management:** Supabase JWT tokens (stored in httpOnly cookies)
- **Role management:** Custom roles in `user_metadata` (Admin, Procurement Manager, Quality Manager, Viewer)
- **API authorization:** ElysiaJS middleware validates JWT and enforces RBAC

**State Management:**

- **Server state:** Remix loaders/actions (built-in data fetching)
- **Client state:** Zustand for complex client-side state (minimal, prefer server state)
- **Form state:** React Hook Form + Zod for validation

**Styling & Design:**

- **CSS framework:** Tailwind CSS with custom configuration from Midday theme
- **Icons:** Lucide React (consistent with Midday)
- **Charts:** Tremor or Recharts for data visualizations
- **Mobile-first:** All components built mobile-first with responsive breakpoints

**File Storage:**

- **Storage provider:** Supabase Storage for document uploads
- **File types:** PDF, Excel, Word, images (PNG, JPG) for supplier documents and certificates
- **Security:** Row-level security on storage buckets (tenant-isolated)

**Email & Notifications:**

- **Email service:** Resend.com for transactional emails
- **Email types:** Qualification notifications, complaint assignments, evaluation reminders, certificate expirations
- **In-app notifications:** Database-backed notification system with real-time updates

**Background Jobs & Queue:**

- **Queue:** BullMQ for background job processing
- **Redis:** Upstash Redis (serverless, low-cost)
- **Job types:** Email sending, scheduled evaluations, certificate expiration checks, data exports

**Caching:**

- **Cache layer:** Redis (Upstash) for session data and frequently accessed data
- **Strategy:** Cache-aside pattern, TTL-based invalidation
- **Cached data:** User permissions, tenant configuration, dashboard KPIs

**Infrastructure & Deployment:**

- **Frontend hosting:** Vercel (Remix SSR, automatic deployments, preview URLs)
- **Backend hosting:** Fly.io (Bun support, global edge deployment) OR Vercel if Bun is supported
- **Database:** Supabase (managed PostgreSQL + Auth + Storage)
- **CDN:** Vercel Edge Network for static assets
- **Monitoring:** Sentry (error tracking), Vercel Analytics (performance monitoring)
- **Logging:** Structured JSON logs, centralized log aggregation

**CI/CD:**

- **Repository:** GitHub
- **CI/CD:** GitHub Actions for automated testing and deployment
- **Workflow:** PR → tests → preview deployment → merge → production deployment
- **Environment strategy:** Development (local), Staging (pre-production), Production

**Security Requirements:**

- **HTTPS only:** All communication over TLS
- **API rate limiting:** 100 requests/minute per user, 1000/minute per tenant
- **CSRF protection:** Remix built-in CSRF tokens
- **SQL injection:** Parameterized queries via Drizzle ORM
- **XSS protection:** React automatic escaping + Content Security Policy headers
- **Environment secrets:** Never commit secrets, use environment variables
- **Security audit:** External security audit before production launch

**Third-Party Services:**

- **Analytics:** Vercel Analytics (performance), Posthog or Mixpanel (product analytics in Phase 2)
- **Error tracking:** Sentry for both frontend and backend
- **Email:** Resend.com (modern, developer-friendly) or SendGrid (enterprise-grade)
- **Payment processing:** Stripe (for subscription billing in Phase 2)

**Developer Experience:**

- **Package manager:** pnpm (fast, efficient, workspace support)
- **Code formatting:** Prettier with shared config
- **Linting:** ESLint with TypeScript rules
- **Git hooks:** Husky + lint-staged for pre-commit checks
- **Type checking:** TypeScript strict mode, no `any` types allowed
- **API client:** Eden Treaty (type-safe ElysiaJS client) for frontend → backend communication

**Open Questions:**

1. **Bun stability:** Week 1-2 POC must validate Bun/ElysiaJS production readiness—have Node.js/NestJS fallback plan documented if Bun is unstable
2. **Fly.io vs Vercel:** Confirm Vercel supports Bun deployment, otherwise use Fly.io for backend
3. **Email provider:** Finalize Resend vs SendGrid based on cost and deliverability requirements
4. **Analytics:** Decide on product analytics tool for user behavior tracking (Posthog, Mixpanel, or delay to Phase 2)

## Epic List

Based on the MVP scope and requirements, the following **5 epics** will deliver Supplex functionality:

**Epic 1: Foundation & Supplier Master Data Management**
Establish project infrastructure (monorepo, CI/CD, auth, multi-tenancy) and deliver complete supplier master data management with document repository, enabling teams to centralize supplier information and replace spreadsheets.

**Epic 2: Supplier Qualification Workflows**
Implement 3-stage approval workflow with document checklists, risk scoring, notifications, and audit trails, enabling structured onboarding processes that meet compliance requirements and reduce qualification time.

**Epic 3: Supplier Performance Evaluation System**
Build quarterly evaluation scheduling with 4-dimension scoring (Quality, Delivery, Service, Cost), historical trending, and supplier scorecards, enabling data-driven supplier performance management and benchmarking.

**Epic 4: Complaints & CAPA Management**
Deliver complaint registration with severity tracking, basic CAPA workflows (root cause, corrective/preventive actions), and supplier issue history, enabling quality teams to systematically manage and resolve supplier quality issues.

**Epic 5: Analytics, Reporting & API Platform**
Implement role-specific dashboards (Executive, Procurement, Quality), data export capabilities, complete REST API with documentation, and API key management, providing insights and enabling integrations for enterprise customers.

## Epic 1: Foundation & Supplier Master Data Management

**Epic Goal:** Establish the technical foundation for Supplex including authentication, multi-tenant architecture, and CI/CD pipeline while delivering complete supplier master data management capabilities. This epic enables procurement teams to centralize supplier information, upload documents, and track supplier status—immediately replacing spreadsheets with a secure, auditable system.

### Story 1.1: Project Infrastructure & Monorepo Setup

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

### Story 1.2: Database Schema & Multi-Tenancy Foundation

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

### Story 1.3: Authentication System with Supabase Auth

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

### Story 1.4: Tenant Management & User Roles

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

### Story 1.5: Supplier List View & Search

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

### Story 1.6: Supplier Detail Page

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

### Story 1.7: Create & Edit Supplier

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

### Story 1.8: Document Upload & Management

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

### Story 1.9: CI/CD Pipeline & Deployment

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

### Story 1.10: Base UI Shell & Navigation

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

## Epic 2: Supplier Qualification Workflows

**Epic Goal:** Enable procurement and quality teams to run structured, compliant supplier qualification processes with a 3-stage linear approval workflow, configurable document checklists, risk assessment, automated notifications, and complete audit trails. This epic reduces qualification time by 50% and ensures audit-ready documentation for ISO 9001 and other certifications.

### Story 2.1: Qualification Workflow Data Model & Foundation

As a **developer**,
I want the database schema for qualification workflows established,
so that we can track supplier qualification states and approvals.

**Acceptance Criteria:**

1. Drizzle schema defined for `qualification_workflows` table with fields: id, tenant_id, supplier_id, status (Draft, Stage1, Stage2, Stage3, Approved, Rejected), initiated_by, initiated_date, current_stage, risk_score
2. Schema defined for `qualification_stages` table: id, workflow_id, stage_number (1-3), stage_name, assigned_to, status (Pending, Approved, Rejected), reviewed_by, reviewed_date, comments, attachments
3. Schema defined for `document_checklists` table: id, tenant_id, template_name, required_documents (JSON array), is_default
4. Schema defined for `workflow_documents` table: id, workflow_id, checklist_item_id, document_id, status (Pending, Uploaded, Approved, Rejected)
5. Database migrations created and tested for all new tables
6. RLS policies applied to all workflow tables enforcing tenant isolation
7. Foreign key relationships established: workflow → supplier, stage → workflow, document → workflow
8. Indexes created for common queries: workflow by supplier_id, workflow by status, stage by assigned_to
9. Seed data includes default document checklist template (ISO 9001 certificate, W-9, Insurance certificate, Quality manual, etc.)
10. Automated tests verify tenant isolation for workflow data

### Story 2.2: Document Checklist Configuration

As a **tenant administrator**,
I want to configure document checklist templates for qualifications,
so that my team uses consistent requirements across all supplier qualifications.

**Acceptance Criteria:**

1. Settings page includes "Qualification Checklists" section
2. Admin can view list of existing checklist templates
3. "Create Template" button opens form to create new checklist template
4. Template form includes: Template name (required), Description, Required documents list (add/remove items)
5. Each checklist item has: Document name (required), Description, Is required (checkbox), Document type dropdown
6. Default template is pre-populated with standard items: ISO 9001 Certificate, Business License, Insurance Certificate, W-9 Tax Form, Quality Manual
7. Admin can mark one template as "Default" (used for new qualifications)
8. Admin can edit existing templates
9. Admin can delete templates (with confirmation, only if not in use by active workflows)
10. Template list shows: Name, # of required documents, Is default, Created date, Last modified
11. Changes to templates do not affect in-progress qualifications (snapshot template at workflow creation)
12. Mobile-responsive interface with touch-optimized controls

### Story 2.3: Initiate Qualification Workflow

As a **procurement manager**,
I want to initiate a qualification workflow for a supplier,
so that we can formally assess and approve them.

**Acceptance Criteria:**

1. Supplier detail page includes "Start Qualification" button (visible when supplier is in Prospect status)
2. Clicking "Start Qualification" opens workflow initiation modal
3. Modal displays: Supplier name, Selected checklist template dropdown (defaults to tenant default), Risk assessment section, Notes field
4. Risk assessment includes manual inputs: Geographic risk (Low/Medium/High), Financial risk, Quality risk, Delivery risk
5. Overall risk score calculated automatically from individual risk inputs (weighted average)
6. "Initiate Workflow" button creates workflow record in Draft status
7. Workflow creation associates default document checklist with workflow (snapshot, not reference)
8. Workflow displays on supplier detail page in new "Qualifications" tab
9. Workflow status badge shows current stage: Draft, Stage 1 (Pending), Stage 2 (Pending), Stage 3 (Pending), Approved, Rejected
10. Initiator receives confirmation toast: "Qualification workflow initiated for [Supplier Name]"
11. Audit log records workflow initiation with user, timestamp, and initial risk scores
12. Can only initiate one active qualification per supplier at a time (prevents duplicates)

### Story 2.4: Document Upload for Qualification

As a **procurement manager**,
I want to upload required documents during qualification,
so that we collect all necessary documentation before approval.

**Acceptance Criteria:**

1. Qualification workflow detail page displays document checklist section
2. Checklist displays all required documents with status indicators: Not uploaded (gray), Uploaded (blue), Approved (green), Rejected (red)
3. Each checklist item shows: Document name, Description, Required badge, Upload status, Upload button
4. Clicking "Upload" opens file picker and document metadata form
5. User can upload file and map it to checklist item (links existing supplier document OR uploads new document)
6. Progress bar shows upload progress for each document
7. After upload, checklist item status updates to "Uploaded (Pending Review)"
8. Document list shows all uploaded documents with: Filename, Uploaded by, Upload date, Status
9. Can upload multiple documents per checklist item if needed
10. Can remove uploaded document and re-upload (Admin/Procurement Manager only)
11. Checklist completion percentage displayed: "5 of 8 documents uploaded (63%)"
12. Cannot submit workflow for Stage 1 approval until all required documents are uploaded
13. Mobile-responsive with touch-optimized file upload interface

### Story 2.5: Stage 1 - Submit for Procurement Review

As a **procurement manager**,
I want to submit a qualification workflow for stage 1 approval,
so that it can be reviewed by procurement leadership.

**Acceptance Criteria:**

1. "Submit for Review" button displayed when workflow is in Draft status and all required documents uploaded
2. Clicking button opens confirmation modal: "Submit to Stage 1: Procurement Review?"
3. Modal displays summary: Supplier name, Risk score, # of documents uploaded, Reviewer (auto-assigned based on tenant config)
4. Submission changes workflow status from Draft → Stage 1 (Pending)
5. Stage 1 record created with status Pending, assigned to configured procurement reviewer
6. Email notification sent to assigned reviewer with: Supplier name, Initiated by, Risk score, Direct link to workflow
7. Supplier status automatically updated from Prospect → Qualified (in-progress qualification)
8. Timeline/history widget on workflow page shows: "Submitted for Stage 1 review by [User] on [Date/Time]"
9. Initiator can no longer edit workflow or documents (read-only unless rejected)
10. "Pending Review" badge displayed prominently on workflow page
11. Workflow appears in reviewer's "My Tasks" queue with "Action Required" indicator
12. Audit log records submission with user, timestamp, and assigned reviewer

### Story 2.6: Stage 1 - Procurement Approval/Rejection

As a **procurement manager (reviewer)**,
I want to review and approve or reject stage 1 qualifications,
so that only suitable suppliers proceed to quality review.

**Acceptance Criteria:**

1. "My Tasks" queue in navigation shows count of pending workflow reviews assigned to user
2. Task queue displays list of workflows awaiting approval with: Supplier name, Submitted by, Submitted date, Risk score, Days pending
3. Clicking workflow opens qualification review page with full details
4. Review page displays: Supplier information, Risk assessment, Document checklist with all uploaded documents, Notes from previous stages
5. Documents can be viewed inline (PDFs) or downloaded
6. Reviewer can add review comments in text area
7. "Approve" and "Request Changes" buttons displayed at bottom
8. "Approve" button opens confirmation modal, updates stage status to Approved, advances workflow to Stage 2 (Pending)
9. "Request Changes" button opens modal with required comment field, changes stage status to Rejected, returns workflow to Draft status
10. Email notification sent to initiator: "Qualification for [Supplier] approved/rejected by [Reviewer]"
11. If rejected, notification includes reviewer comments and link to workflow
12. Timeline updated with approval/rejection action, reviewer name, timestamp, comments
13. If approved, Stage 2 record auto-created and assigned to quality manager (based on tenant config)
14. Audit log records approval/rejection decision with comments

### Story 2.7: Stage 2 & 3 - Quality and Management Approval

As a **quality manager**,
I want to review qualifications from a quality perspective,
so that we ensure suppliers meet our quality standards before final approval.

**Acceptance Criteria:**

1. Stage 2 approval workflow identical to Stage 1 but assigned to Quality Manager role
2. Stage 2 review includes quality-specific checklist items: Quality manual reviewed, Quality certifications verified, Quality audit findings
3. Quality manager can add quality-specific comments separate from procurement comments
4. Approving Stage 2 advances workflow to Stage 3 (Management approval)
5. Stage 3 assigned to Admin or designated approver (configurable per tenant)
6. Stage 3 review shows summary of all previous stages: Stage 1 approval (user, date), Stage 2 approval (user, date), Risk score, Document completion
7. Management approver sees complete history and all previous reviewer comments
8. Approving Stage 3 marks workflow as Approved (final state)
9. Final approval automatically updates supplier status from Qualified → Approved
10. Final approval triggers congratulatory email to supplier primary contact (if enabled in settings)
11. Rejection at any stage returns workflow to Draft and reverts supplier status to Prospect
12. All three stages recorded in timeline with full audit trail
13. Each stage completion records: Reviewer name, Review date/time, Decision, Comments, Attachments (if any)

### Story 2.8: Email Notification System

As a **developer**,
I want an email notification system for workflow events,
so that users are notified of actions requiring their attention.

**Acceptance Criteria:**

1. Email service integrated (Resend.com) with API key configured
2. Email templates created for workflow events: Workflow submitted, Approval needed, Workflow approved, Workflow rejected, Stage advanced
3. Email template uses Supplex branding with logo, consistent styling
4. Notification preferences configured at tenant level: Enable/disable email notifications per event type
5. User preferences page allows individual users to opt-in/out of specific notification types
6. Emails include: Actionable subject line, Recipient name, Summary of action, Direct deep link to workflow, Sender/actor name
7. Background job worker (BullMQ) processes email sending asynchronously
8. Failed emails are retried up to 3 times with exponential backoff
9. Email send status tracked in database: Pending, Sent, Failed, Bounced
10. Email logs accessible to admins for debugging (last 30 days)
11. Rate limiting prevents email spam (max 10 emails per user per hour)
12. Unsubscribe link included in all emails (compliance with CAN-SPAM)
13. Email deliverability monitored (bounce rate, open rate) in admin dashboard (Phase 2: just log for now)

### Story 2.9: Qualification Workflow List & Filtering

As a **procurement manager**,
I want to see all qualification workflows with filtering,
so that I can track progress and identify bottlenecks.

**Acceptance Criteria:**

1. "Qualifications" page displays list of all workflows in tenant
2. Table columns: Supplier Name, Status (badge with color), Current Stage, Initiated By, Initiated Date, Days In Progress, Risk Score
3. Status filter dropdown: All, Draft, In Progress (Stage 1-3), Approved, Rejected
4. Stage filter: All, Stage 1, Stage 2, Stage 3
5. Risk filter: All, Low, Medium, High
6. Search bar filters by supplier name
7. Sort by: Initiated date (newest/oldest), Days in progress (longest/shortest), Risk score (high/low)
8. Clicking workflow row navigates to workflow detail page
9. "My Tasks" tab shows only workflows assigned to current user for review
10. "My Initiated" tab shows only workflows initiated by current user
11. Pagination for lists over 20 workflows
12. Empty state displays "No qualifications found" with "Start New Qualification" CTA
13. Mobile view converts to card layout with swipe actions
14. Export to CSV button exports current filtered view

### Story 2.10: Audit Trail & History View

As a **compliance officer**,
I want to view complete audit history for qualifications,
so that we can demonstrate compliance during audits.

**Acceptance Criteria:**

1. Workflow detail page includes "History" tab showing complete audit trail
2. Timeline view displays all events in reverse chronological order (newest first)
3. Each event displays: Event type icon, Event description, Actor (user), Timestamp, Comments/notes
4. Event types tracked: Workflow initiated, Document uploaded, Document removed, Stage submitted, Stage approved, Stage rejected, Risk score changed, Comments added
5. Document events show document name and type
6. Stage events show reviewer name and decision
7. Each event is immutable (cannot be edited or deleted)
8. Events display user's full name and role at time of action
9. Timestamps display in user's local timezone with UTC timestamp on hover
10. Can filter timeline by event type: All events, Approvals, Rejections, Documents, Comments
11. Timeline is printable with "Print Audit Trail" button generating PDF
12. PDF includes: Supplier name, Workflow ID, Print date, Complete timeline with all events
13. Database audit trail table indexed for fast queries (workflow_id, timestamp)
14. Mobile-responsive timeline with touch-friendly expand/collapse for event details

## Epic 3: Supplier Performance Evaluation System

**Epic Goal:** Enable procurement and quality teams to systematically evaluate supplier performance across Quality, Delivery, Service, and Cost dimensions with quarterly scheduling, historical trending, and supplier scorecards. This epic provides data-driven insights to identify top performers, address underperformance, and make informed sourcing decisions.

### Story 3.1: Evaluation Data Model & Schema

As a **developer**,
I want the database schema for supplier evaluations established,
so that we can track performance data over time.

**Acceptance Criteria:**

1. Drizzle schema defined for `supplier_evaluations` table with fields: id, tenant_id, supplier_id, evaluation_period (Q1-Q4, Year), evaluation_date, evaluator_id, status (Draft, Submitted, Completed), overall_score (calculated)
2. Schema defined for `evaluation_dimensions` table: id, evaluation_id, dimension_type (Quality, Delivery, Service, Cost), score (1-5), weight (percentage), comments, evidence_documents
3. Schema defined for `evaluation_templates` table: id, tenant_id, template_name, dimensions (JSON: name, weight, criteria), is_default
4. Database migrations created and tested for all evaluation tables
5. RLS policies applied enforcing tenant isolation on all evaluation data
6. Foreign key relationships: evaluation → supplier, dimension → evaluation
7. Indexes created for common queries: evaluations by supplier_id, evaluations by period, evaluations by status
8. Seed data includes default evaluation template: Quality (40%), Delivery (30%), Service (20%), Cost (10%)
9. Check constraints ensure scores are 1-5, weights sum to 100%
10. Automated tests verify tenant isolation and data integrity (scores, weights)

### Story 3.2: Evaluation Template Configuration

As a **tenant administrator**,
I want to configure evaluation templates with custom dimensions and weights,
so that evaluations align with my organization's priorities.

**Acceptance Criteria:**

1. Settings page includes "Evaluation Templates" section
2. Admin can view list of existing evaluation templates
3. "Create Template" button opens template configuration form
4. Template form includes: Template name (required), Description
5. Dimension configuration allows: Add/remove dimensions, Set dimension name, Set weight (percentage), Define evaluation criteria/guidelines (text)
6. Default template pre-populated with: Quality (40%), Delivery (30%), Service (20%), Cost (10%)
7. Real-time validation ensures dimension weights sum to exactly 100%
8. Each dimension includes criteria guidance: e.g., Quality - "Defect rates, customer complaints, corrective actions"
9. Admin can mark one template as "Default" (used for new evaluations)
10. Admin can edit existing templates (changes apply to future evaluations only)
11. Admin can duplicate templates to create variations
12. Template list shows: Name, # of dimensions, Default badge, Created date, Last modified
13. Cannot delete template if used by any evaluation (show warning with count)
14. Mobile-responsive interface with drag-to-reorder dimensions

### Story 3.3: Schedule and Initiate Evaluation

As a **procurement manager**,
I want to schedule and initiate performance evaluations for suppliers,
so that we regularly assess supplier performance.

**Acceptance Criteria:**

1. Supplier detail page includes "Evaluations" tab showing evaluation history
2. "Start New Evaluation" button visible to Procurement Manager and Quality Manager roles
3. Clicking button opens evaluation creation modal
4. Modal displays: Supplier name, Evaluation period dropdown (Q1-Q4 2025, etc.), Template selector (defaults to tenant default), Assigned evaluator(s) dropdown
5. Period dropdown shows last 2 years and next year quarters
6. System warns if evaluation already exists for selected period: "Evaluation for Q3 2025 already exists. View or create new?"
7. "Create Evaluation" button creates evaluation record in Draft status
8. Evaluation record associates selected template (snapshot for consistency)
9. Evaluation appears in "Evaluations" tab with status badge: Draft (gray), In Progress (blue), Completed (green)
10. Assigned evaluator receives email notification: "Performance evaluation assigned for [Supplier] - [Period]"
11. Evaluation can be assigned to multiple evaluators for collaborative input (optional)
12. Audit log records evaluation creation with initiator, period, assigned evaluator(s)
13. Can create ad-hoc evaluations (outside quarterly schedule) for special assessments

### Story 3.4: Evaluation Scoring Form

As a **quality manager**,
I want to score supplier performance across multiple dimensions,
so that we capture comprehensive performance data.

**Acceptance Criteria:**

1. Evaluation detail page displays scoring form with all dimensions from template
2. Each dimension section shows: Dimension name, Weight (%), Scoring criteria/guidance, Score input (1-5 scale), Comments textarea, Attach evidence button
3. Score input uses visual rating component: 1 star = Poor, 2 = Below Average, 3 = Average, 4 = Good, 5 = Excellent
4. Hovering over stars shows descriptive labels
5. Comments field allows evaluator to provide detailed feedback and examples
6. "Attach Evidence" allows uploading supporting documents (defect reports, delivery logs, invoices)
7. Each dimension can have multiple document attachments
8. Overall score calculated automatically as weighted average of dimension scores (displayed prominently)
9. Overall score updates in real-time as dimension scores are entered
10. Form validation requires all dimension scores before submission
11. "Save Draft" button saves progress without completing evaluation
12. "Submit Evaluation" button validates completeness and changes status to Completed
13. Completed evaluations are read-only (can view but not edit)
14. Evaluation timestamp records submission date and evaluator
15. Mobile-responsive with touch-optimized star rating and expandable sections

### Story 3.5: Historical Performance Tracking

As a **procurement manager**,
I want to view historical evaluation trends for each supplier,
so that I can identify performance improvements or declines over time.

**Acceptance Criteria:**

1. Supplier detail page "Evaluations" tab displays historical evaluations table
2. Table columns: Period, Evaluation Date, Overall Score (with badge), Evaluator, Status, Actions (View)
3. Overall score badge color-coded: 4.0-5.0 = green (High), 3.0-3.9 = yellow (Medium), 1.0-2.9 = red (Low)
4. Table sorted by evaluation date (newest first) with option to sort by score
5. Line chart displays overall score trend over time (x-axis: period, y-axis: score 1-5)
6. Chart includes trend line showing performance trajectory (improving/declining/stable)
7. Chart tooltips show: Period, Overall score, Evaluator, Click to view details
8. Dimension breakdown chart shows score trends for each dimension (multi-line chart)
9. Chart toggle allows switching between: Overall score only, All dimensions, Selected dimensions
10. Performance alerts displayed if: Score drops >0.5 points from previous eval, Score falls below 3.0 (underperforming)
11. Historical data table paginated if more than 8 evaluations
12. "Export to PDF" button generates performance report with charts and all evaluation data
13. Empty state displays "No evaluations yet" with "Start First Evaluation" CTA
14. Charts are mobile-responsive (convert to simpler view on small screens)

### Story 3.6: Supplier Scorecard View

As a **procurement manager**,
I want to see a comprehensive scorecard for each supplier,
so that I can quickly assess current and historical performance.

**Acceptance Criteria:**

1. Supplier detail page includes "Scorecard" tab as primary view
2. Scorecard header displays: Overall current score (large, prominent), Performance tier badge (High/Medium/Low), Total evaluations count, Last evaluation date
3. Performance tier automatically assigned: High (avg >4.0), Medium (avg 3.0-4.0), Low (avg <3.0)
4. Current evaluation section shows latest evaluation with all dimension scores in card layout
5. Each dimension card displays: Dimension name, Current score (stars), Weight, Trend indicator (↑ improving, ↓ declining, → stable)
6. Trend indicator compares current score vs. previous evaluation (3 period moving average)
7. Historical summary section displays: Average score across all evaluations, Best score (with period), Worst score (with period), Trend direction
8. Dimension performance breakdown shows average score per dimension across all evaluations (bar chart)
9. Recent comments section displays latest evaluator comments from last 3 evaluations
10. Performance alerts section highlights: Recent score drops, Consistently low dimensions, Missing recent evaluations
11. Scorecard is printable with "Print Scorecard" button (PDF generation)
12. Scorecard displays "Insufficient Data" message if fewer than 2 evaluations exist
13. Mobile-responsive with cards stacking vertically and collapsible sections

### Story 3.7: Evaluation Notifications & Reminders

As a **procurement manager**,
I want to receive notifications about evaluation assignments and upcoming evaluations,
so that I don't miss scheduled assessments.

**Acceptance Criteria:**

1. Email notification sent when evaluation is assigned: "You've been assigned to evaluate [Supplier] for [Period]"
2. Email includes: Supplier name, Evaluation period, Due date (30 days from creation), Direct link to evaluation form
3. Reminder email sent when evaluation is in draft status for 14 days: "Evaluation for [Supplier] is in progress - Please complete"
4. Reminder email sent when evaluation is 7 days overdue: "Overdue: Evaluation for [Supplier] needs completion"
5. Notification sent when evaluation is completed: "Evaluation for [Supplier] completed by [Evaluator]"
6. Procurement managers receive weekly digest email: "Pending evaluations summary" with list of drafts and overdue evals
7. Notifications respect user preferences (can opt-out of reminders but not assignments)
8. In-app notification center shows evaluation-related notifications with count badge
9. Background job (BullMQ) checks daily for evaluation reminders and due dates
10. Admin dashboard shows evaluation completion metrics: On-time %, Overdue count, Average completion time
11. Supplier performance alerts trigger notifications: "Supplier [Name] score dropped below 3.0"
12. Can configure tenant-wide due date window: 30, 60, or 90 days from creation (default 30)

### Story 3.8: Evaluation List View & Filtering

As a **quality manager**,
I want to view and filter all evaluations across suppliers,
so that I can track evaluation completion and identify performance patterns.

**Acceptance Criteria:**

1. "Evaluations" page displays list of all evaluations in tenant
2. Table columns: Supplier Name, Period, Overall Score (badge), Status, Evaluator, Evaluation Date, Days Since Completed
3. Status filter: All, Draft, Completed
4. Period filter: All, Current quarter, Last quarter, Custom range (date picker)
5. Score filter: All, High (4.0-5.0), Medium (3.0-3.9), Low (1.0-2.9)
6. Supplier search bar filters by supplier name
7. Sort by: Evaluation date (newest/oldest), Overall score (high/low), Supplier name (A-Z)
8. "My Evaluations" tab shows only evaluations assigned to current user
9. "Draft" tab shows only incomplete evaluations with "Days in Draft" column
10. "Overdue" tab shows evaluations past due date with days overdue highlighted in red
11. Clicking evaluation row navigates to evaluation detail/form page
12. Bulk actions: Select multiple draft evaluations, "Send Reminder" button sends reminder to assigned evaluators
13. Empty state displays "No evaluations found" with "Create Evaluation" CTA
14. Export to CSV button exports current filtered view with all dimension scores
15. Mobile view converts to card layout with key info: Supplier, Score, Status, Period

### Story 3.9: Comparative Supplier Analysis

As a **procurement manager**,
I want to compare performance across multiple suppliers,
so that I can identify top performers and make sourcing decisions.

**Acceptance Criteria:**

1. "Suppliers" page includes "Compare" mode toggle
2. Compare mode allows selecting 2-10 suppliers via checkboxes
3. "Compare Selected" button opens comparison view
4. Comparison view displays side-by-side scorecard for each selected supplier
5. Each supplier column shows: Name, Overall avg score, Performance tier, Latest evaluation date, Evaluation count
6. Dimension comparison table shows average scores per dimension for each supplier
7. Dimension rows color-coded: Highest score = green, Lowest score = red, Others = neutral
8. Overall score column sortable to rank suppliers
9. Chart view toggles comparison to bar chart: Suppliers on x-axis, Scores on y-axis, Dimensions grouped
10. Filter allows selecting which dimensions to compare (default: all)
11. Filter allows selecting time range: All time, Last 4 quarters, Last year, Custom
12. Comparison view includes summary insights: Best performer, Most improved, Needs attention
13. "Export Comparison" button generates PDF report with all comparison data and charts
14. Comparison view is printable
15. Mobile view shows suppliers in vertically stacked cards instead of side-by-side

### Story 3.10: Evaluation Performance Metrics Dashboard

As an **admin**,
I want to see metrics on evaluation completion and compliance,
so that I can ensure my team is regularly assessing suppliers.

**Acceptance Criteria:**

1. Admin dashboard includes "Evaluation Metrics" section
2. Key metrics displayed: Total evaluations completed (current quarter), Completion rate (%), Average score across all suppliers, On-time completion %
3. Chart shows evaluation completion trend over time (past 8 quarters)
4. Completion rate calculated: (Completed evaluations / Expected evaluations) × 100%
5. Expected evaluations calculated: # of Approved suppliers × # of quarters elapsed in current year
6. Overdue evaluations widget shows count and list of overdue evaluations with days overdue
7. Evaluator performance table shows: Evaluator name, Assigned count, Completed count, Completion rate, Avg time to complete
8. Supplier coverage metrics: % of suppliers with at least 1 evaluation, % with evaluations in last 6 months
9. Dimension analysis shows average scores across all evaluations per dimension (identifies systemic issues)
10. Performance tier distribution: Pie chart showing % of suppliers in High/Medium/Low tiers
11. All metrics filterable by date range: Current quarter, Last quarter, Year-to-date, All time
12. Drill-down links from metrics to detailed views (e.g., click overdue count → see overdue list)
13. "Export Metrics" button generates PDF report with all dashboard data
14. Dashboard auto-refreshes data every 5 minutes (or manual refresh button)

## Epic 4: Complaints & CAPA Management

**Epic Goal:** Enable quality teams to systematically register, track, and resolve supplier quality issues through structured complaint management and basic CAPA (Corrective and Preventive Action) workflows. This epic improves supplier quality accountability, reduces repeat defects, and provides compliance documentation for quality audits.

### Story 4.1: Complaint Data Model & Schema

As a **developer**,
I want the database schema for complaints and CAPA established,
so that we can track supplier issues and corrective actions.

**Acceptance Criteria:**

1. Drizzle schema defined for `complaints` table with fields: id, tenant_id, supplier_id, complaint_number (auto-generated), title, description, severity (Critical, High, Medium, Low), category, status (Open, In Progress, Resolved, Closed), reported_by, reported_date, due_date, assigned_to, closed_date
2. Schema defined for `complaint_categories` table: id, tenant_id, category_name, description, is_default
3. Schema defined for `capa_actions` table: id, complaint_id, action_type (Corrective, Preventive), root_cause, action_description, responsible_party, target_date, completion_date, status (Pending, In Progress, Completed, Verified), verification_notes
4. Schema defined for `complaint_impacts` table: id, complaint_id, impact_type (Financial, Operational, Customer, Regulatory), impact_description, estimated_cost
5. Database migrations created and tested for all complaint tables
6. RLS policies applied enforcing tenant isolation on all complaint data
7. Foreign key relationships: complaint → supplier, capa → complaint, impact → complaint
8. Indexes created: complaints by supplier_id, complaints by status, complaints by severity, complaints by assigned_to
9. Seed data includes default complaint categories: Defective Material, Late Delivery, Non-Conformance, Documentation Issue, Communication Issue
10. Complaint number auto-generation pattern: `COMP-{YEAR}-{SEQUENCE}` (e.g., COMP-2025-0001)
11. Automated tests verify tenant isolation and cascading relationships

### Story 4.2: Complaint Category Configuration

As a **tenant administrator**,
I want to configure complaint categories,
so that complaints are consistently classified across my organization.

**Acceptance Criteria:**

1. Settings page includes "Complaint Categories" section
2. Admin can view list of existing complaint categories
3. "Add Category" button opens category creation form
4. Category form includes: Category name (required), Description, Color (for badges), Icon selection
5. Default categories pre-populated: Defective Material (red), Late Delivery (orange), Non-Conformance (yellow), Documentation Issue (blue), Communication Issue (gray)
6. Admin can edit existing categories (name, description, color, icon)
7. Admin can mark categories as "Archived" (hidden from new complaints but preserved for historical data)
8. Cannot delete categories in use by existing complaints (show count and archive option)
9. Category list shows: Name, Description, # of complaints using category, Created date
10. Categories used in dropdown selection throughout complaint forms
11. Mobile-responsive interface with color picker and icon selector

### Story 4.3: Register New Complaint

As a **quality manager**,
I want to register a complaint against a supplier,
so that we can formally document and track quality issues.

**Acceptance Criteria:**

1. Supplier detail page includes "Complaints" tab with "Register Complaint" button
2. "Complaints" page includes global "Register Complaint" button with supplier selector
3. Complaint registration form includes: Supplier (dropdown or pre-selected), Title (required), Description (rich text), Severity (Critical/High/Medium/Low dropdown), Category (dropdown), Reported date (default today, editable), Due date (auto-calculated based on severity), Assigned to (user dropdown)
4. Severity affects due date: Critical = 3 days, High = 7 days, Medium = 14 days, Low = 30 days
5. Due date editable by user after auto-calculation
6. Description field supports rich text formatting (bold, italic, bullets, numbered lists)
7. "Attach Files" section allows uploading evidence (photos, documents, defect reports) with max 10MB per file
8. Multiple file uploads with progress indicator
9. Optional impact assessment section: Impact type checkboxes (Financial, Operational, Customer, Regulatory), Impact description, Estimated cost (dollar amount)
10. "Save Draft" saves complaint with status Open but doesn't send notifications
11. "Submit" saves complaint with status Open and sends notification to assigned user and supplier contact (optional)
12. Complaint number auto-generated on submission: COMP-2025-0001
13. Success message displays: "Complaint COMP-2025-0001 registered for [Supplier Name]"
14. Audit log records complaint creation with reporter, timestamp, initial details
15. Mobile-responsive form with appropriate input types

### Story 4.4: Complaint Detail View & Status Management

As a **quality manager**,
I want to view complaint details and update status,
so that I can track resolution progress.

**Acceptance Criteria:**

1. Complaint detail page displays header: Complaint number (prominent), Supplier name (linked), Status badge, Severity badge, Reported date, Due date, Days open/overdue
2. Overdue complaints display red "OVERDUE" badge with days overdue
3. Main content sections: Description, Category, Assigned to, Impact assessment, Attachments, Activity timeline
4. Description displayed with rich text formatting preserved
5. Status update dropdown allows: Open → In Progress → Resolved → Closed
6. Status change requires comment explaining the change
7. Status change from Resolved → Closed requires final verification notes
8. Cannot reopen Closed complaints (Admin override only)
9. Severity can be updated (requires comment explaining why)
10. Can reassign complaint to different user (sends notification to new assignee)
11. Can edit due date (requires comment, records audit trail)
12. Activity timeline shows all status changes, reassignments, comments, CAPA actions with timestamp and user
13. "Add Comment" button allows adding notes/updates to complaint
14. Comments display with user avatar, name, timestamp, and text
15. Email notification sent on status changes to: Assigned user, Reporter, Watchers (if configured)
16. Mobile-responsive with collapsible sections

### Story 4.5: CAPA Workflow - Root Cause Analysis

As a **quality manager**,
I want to document root cause analysis for complaints,
so that we understand why issues occurred.

**Acceptance Criteria:**

1. Complaint detail page includes "CAPA" tab for Corrective and Preventive Action tracking
2. "Add Root Cause Analysis" button opens root cause form
3. Root cause form includes: Problem statement (auto-populated from complaint description, editable), Root cause description (textarea), Contributing factors (bullet list), Analysis method used (dropdown: 5 Whys, Fishbone, Other, None - basic for MVP)
4. Analysis method dropdown is informational only (no guided workflow in MVP)
5. Supporting evidence section allows uploading documents (investigation reports, test results)
6. "Save Root Cause" button saves analysis and enables CAPA action creation
7. Root cause analysis displayed in CAPA tab with: Problem, Root cause, Contributing factors, Evidence links
8. Can edit root cause analysis until CAPA actions are marked complete
9. Root cause is required before creating corrective actions (validation)
10. Timeline records root cause entry with user and timestamp
11. Mobile-responsive with expandable text areas

### Story 4.6: CAPA Workflow - Corrective Actions

As a **quality manager**,
I want to define and track corrective actions,
so that we ensure issues are resolved and won't recur.

**Acceptance Criteria:**

1. CAPA tab includes "Add Corrective Action" button (enabled after root cause documented)
2. Corrective action form includes: Action description (required), Responsible party (supplier contact or internal user), Target completion date, Status (Pending, In Progress, Completed, Verified), Verification method (description of how action will be verified)
3. Can add multiple corrective actions for single complaint
4. Each action displays as card: Description, Responsible party, Target date, Status badge, Days until due/overdue
5. Status update modal allows changing status with comments
6. Completing action requires evidence: Completion date, Completion notes, Attach evidence documents
7. Verification step separate from completion: Verifier (different user), Verification date, Verification result (Pass/Fail), Verification notes
8. Failed verification returns action to In Progress status
9. Email notification sent to responsible party when action assigned
10. Reminder email sent when action is 3 days from target date and status is Pending/In Progress
11. Overdue actions highlighted in red with "OVERDUE" badge
12. Cannot close complaint until all corrective actions are Completed and Verified
13. Timeline records all action creation, updates, completions, verifications
14. Mobile-responsive action cards with swipe-to-update on mobile

### Story 4.7: CAPA Workflow - Preventive Actions

As a **quality manager**,
I want to define preventive actions,
so that we prevent similar issues from occurring in the future.

**Acceptance Criteria:**

1. CAPA tab includes "Add Preventive Action" button
2. Preventive action form identical to corrective action form: Description, Responsible party, Target date, Status, Verification method
3. Preventive actions displayed separately from corrective actions (different section or tab)
4. Preventive action description prompts: "What will be done to prevent recurrence?" with example text
5. Preventive actions can be added even without root cause (proactive measures)
6. Status workflow identical to corrective actions: Pending → In Progress → Completed → Verified
7. Preventive actions not required to close complaint (nice-to-have, not mandatory)
8. Email notifications follow same pattern as corrective actions
9. Timeline distinguishes between corrective and preventive actions with icons/labels
10. Can convert corrective action to preventive action or vice versa (status resets)
11. Summary view shows: Total CAPA actions, # Corrective, # Preventive, # Completed, # Overdue
12. Mobile-responsive with clear visual distinction between corrective vs. preventive

### Story 4.8: Complaint List View & Filtering

As a **quality manager**,
I want to view and filter all complaints,
so that I can prioritize and track resolution efforts.

**Acceptance Criteria:**

1. "Complaints" page displays list of all complaints in tenant
2. Table columns: Complaint #, Supplier Name, Title, Severity (badge), Category, Status (badge), Assigned To, Reported Date, Due Date, Days Open
3. Severity badges color-coded: Critical (red), High (orange), Medium (yellow), Low (blue)
4. Status filter: All, Open, In Progress, Resolved, Closed
5. Severity filter: All, Critical, High, Medium, Low
6. Category filter: Multi-select dropdown with all categories
7. Supplier filter: Multi-select dropdown with all suppliers
8. Date range filter: Reported date range, Due date range
9. Overdue toggle: Show only overdue complaints
10. Search bar filters by complaint number or title
11. Sort by: Reported date, Due date, Severity, Status, Supplier name
12. "My Complaints" tab shows only complaints assigned to current user
13. "Open Issues" tab shows only Open and In Progress complaints
14. "Overdue" tab shows only overdue complaints with days overdue prominently displayed
15. Clicking complaint row navigates to complaint detail page
16. Bulk actions: Select multiple complaints, "Reassign" to different user
17. Export to CSV includes all fields plus CAPA action count
18. Empty state displays "No complaints" with "Register Complaint" CTA
19. Mobile view converts to card layout with key info highlighted

### Story 4.9: Supplier Complaint History & Tracking

As a **procurement manager**,
I want to see all complaints filed against each supplier,
so that I can identify recurring issues and trends.

**Acceptance Criteria:**

1. Supplier detail page "Complaints" tab displays all complaints for that supplier
2. Tab shows summary metrics: Total complaints, Open complaints, Critical/High complaints, Average resolution time
3. Complaints table with columns: Complaint #, Title, Severity, Status, Reported Date, Resolution Date, Days to Resolve
4. Status filter: All, Open, In Progress, Resolved, Closed
5. Severity filter: All, Critical, High, Medium, Low
6. Complaints sorted by reported date (newest first) with option to sort by severity or status
7. Visual indicator for repeat issues: "Similar issues: 3" if same category/title pattern detected
8. Chart shows complaints over time (past 12 months): Bars = complaint count by month, Color-coded by severity
9. Category breakdown chart: Pie chart showing distribution of complaint categories for this supplier
10. Trend analysis section: "Most common issue: Defective Material (45%)", "Average resolution time: 12 days"
11. Performance impact link: If evaluations exist, show correlation between complaints and evaluation scores
12. Alert displayed if multiple critical complaints in last 90 days: "Quality Alert: 3 critical issues"
13. "Export Complaint History" button generates PDF report with all complaints and charts
14. Empty state displays "No complaints registered" (positive message)
15. Mobile-responsive with charts converting to simplified view

### Story 4.10: Complaint Notifications & Escalations

As a **quality manager**,
I want to receive notifications about complaint assignments and escalations,
so that I respond promptly to quality issues.

**Acceptance Criteria:**

1. Email notification sent when complaint is assigned: "New complaint assigned: COMP-2025-0001 for [Supplier]"
2. Email includes: Complaint number, Supplier, Title, Severity, Due date, Direct link to complaint
3. Email notification sent when complaint reassigned: "Complaint COMP-2025-0001 reassigned to you"
4. Reminder email sent when complaint is 50% through due date window (based on severity)
5. Urgent reminder email sent when complaint is 1 day from due date
6. Escalation email sent to quality manager + admin when complaint becomes overdue
7. Email notification sent when CAPA action assigned to responsible party
8. Reminder for CAPA action sent 3 days before target date
9. Notification sent when complaint status changes to Resolved or Closed
10. Notification sent to reporter when their complaint is resolved/closed
11. In-app notification center shows complaint-related notifications with count badge
12. User preferences allow opting out of reminders but not assignment notifications
13. Background job (BullMQ) checks daily for complaint due dates and CAPA action due dates
14. Admin dashboard shows complaint response metrics: Avg time to first response, Overdue count, Resolution rate
15. Escalation rules configurable per tenant: Auto-escalate critical complaints after X days

### Story 4.11: Complaint Impact Analysis & Reporting

As a **quality manager**,
I want to analyze complaint impacts and generate reports,
so that I can quantify costs and demonstrate improvement to leadership.

**Acceptance Criteria:**

1. Complaint detail page displays "Impact" section showing all recorded impacts
2. Impact section shows: Financial impact (total cost), Operational impact (description), Customer impact, Regulatory impact
3. Can add multiple impacts per complaint with "Add Impact" button
4. Impact form: Type (Financial/Operational/Customer/Regulatory), Description, Estimated cost (if financial)
5. Financial impacts aggregated: Show total cost across all impacts for the complaint
6. Supplier detail "Complaints" tab shows total financial impact: "Total cost of quality issues: $45,000"
7. Complaints list view includes "Impact" column showing financial impact if recorded
8. "Reports" section in Complaints page includes complaint analytics dashboard
9. Dashboard metrics: Total complaints (period), Resolution rate (%), Avg resolution time, Total financial impact
10. Trend chart shows complaint volume over time with trend line
11. Supplier ranking table: Suppliers sorted by complaint count, avg severity, total impact
12. Category analysis shows most frequent categories with cost breakdown
13. Time-to-resolution histogram: Distribution of resolution times by severity
14. Filter all reports by date range, supplier, category, severity
15. "Generate Executive Report" button creates PDF with all analytics, charts, and key insights
16. Report includes: Period summary, Top issues, Supplier performance, Cost analysis, Improvement trends
17. Mobile-responsive dashboard with scrollable charts

## Epic 5: Analytics, Reporting & API Platform

**Epic Goal:** Provide executives and managers with actionable insights through role-specific dashboards, enable data export capabilities for external analysis, and deliver a complete REST API with documentation for integrations. This epic transforms raw data into business intelligence and enables enterprise customers to integrate Supplex with their existing systems.

### Story 5.1: Executive Dashboard

As an **executive**,
I want a high-level dashboard showing key supplier metrics,
so that I can quickly assess supplier management health and identify issues.

**Acceptance Criteria:**

1. Dashboard page accessible from main navigation with "Dashboard" menu item
2. Role-based dashboard routing: Executives see Executive Dashboard, others see role-specific views
3. Header displays: "Executive Dashboard", Date range selector (Last 30 days, Last quarter, Last year, Custom), Auto-refresh toggle
4. KPI cards section displays: Total active suppliers, Suppliers by status (Approved/Conditional/Blocked counts with %), Active qualifications (in progress), Open complaints (with critical count)
5. Each KPI card shows: Current value (large), Trend indicator (↑/↓/→), Change from previous period (+5, -2, etc.), Color-coded based on health (green=good, yellow=warning, red=alert)
6. Supplier status distribution chart: Donut chart showing breakdown by status (Approved, Conditional, Blocked, Prospect, Qualified)
7. Performance tier distribution: Bar chart showing High/Medium/Low performers with counts
8. Recent activity feed: Last 10 significant events (new suppliers, qualifications completed, complaints registered, evaluations submitted)
9. Activity feed items clickable to navigate to relevant detail pages
10. Top performers widget: List of top 5 suppliers by evaluation score with scores and trend
11. At-risk suppliers widget: List of suppliers with recent performance drops or critical complaints
12. Upcoming actions widget: Next 5 due items (evaluations due, qualification reviews pending, CAPA actions due)
13. All charts filterable by date range from header selector
14. "Export Dashboard" button generates PDF snapshot with all widgets and current data
15. Dashboard data refreshes automatically every 5 minutes if auto-refresh enabled
16. Mobile-responsive with widgets stacking vertically and charts adapting to smaller screens

### Story 5.2: Procurement Dashboard

As a **procurement manager**,
I want a dashboard focused on procurement metrics and tasks,
so that I can manage supplier relationships and qualification pipelines effectively.

**Acceptance Criteria:**

1. Procurement managers automatically land on Procurement Dashboard (role-based routing)
2. Header displays: "Procurement Dashboard", Tenant name, Date range selector, Export button
3. KPI cards: Total suppliers managed, New suppliers added (this period), Qualifications pending review, Average qualification time (days)
4. My tasks section prominently displayed: Qualification reviews assigned to me (count), Evaluations assigned to me (count), Overdue items (highlighted)
5. Task list shows next 10 items requiring action with: Type (Qualification/Evaluation), Supplier name, Due date, Days pending, "Take Action" button
6. Supplier acquisition funnel chart: Stages = Prospect → Qualification → Approved, with conversion rates between stages
7. Qualification pipeline chart: Bar chart showing qualifications by stage (Draft, Stage 1, Stage 2, Stage 3, Approved, Rejected)
8. Supplier distribution by category: Pie chart showing supplier counts per category (Raw Materials, Logistics, etc.)
9. Recent supplier additions: List of last 10 suppliers added with status and date
10. Document expiration alerts: Certificates/documents expiring within 30 days with supplier name, document type, expiration date
11. Performance summary: Average supplier score across all active suppliers, Distribution of scores (histogram)
12. Quick actions panel: "Add Supplier", "Start Qualification", "Create Evaluation" buttons
13. All charts support drill-down: Click segment to see detailed list
14. Mobile-responsive with priority on "My Tasks" section at top

### Story 5.3: Quality Dashboard

As a **quality manager**,
I want a dashboard focused on quality metrics and supplier issues,
so that I can monitor quality performance and respond to problems quickly.

**Acceptance Criteria:**

1. Quality managers automatically land on Quality Dashboard (role-based routing)
2. Header displays: "Quality Dashboard", Date range selector, "Generate Quality Report" button
3. KPI cards: Total complaints (open + closed), Open complaints, Critical complaints, Average resolution time (days), CAPA completion rate (%)
4. Quality alerts section: Critical complaints overdue, Suppliers with multiple recent complaints, Evaluations showing declining trends
5. Each alert clickable with direct link to relevant page
6. Complaint trend chart: Line chart showing complaint volume over time (by month), Color-coded by severity
7. Complaints by category: Horizontal bar chart showing top 5 complaint categories with counts
8. Complaints by supplier: Table showing top 10 suppliers by complaint count with severity breakdown
9. CAPA effectiveness metrics: Total CAPA actions, Completed on time (%), Overdue actions (count), Average time to complete
10. Supplier quality tier distribution: Donut chart showing performance tiers (High/Medium/Low) with percentages
11. Quality cost analysis: Total financial impact of complaints (current period), Cost by supplier (top 5), Cost trend over time
12. Recent quality events: Last 10 activities (complaints registered, CAPA completed, evaluations submitted) with timestamps
13. Evaluation completion tracker: % of suppliers evaluated in current quarter, Overdue evaluations count, Next evaluations due (list)
14. All metrics compare current period vs. previous period with trend indicators
15. "Export Quality Report" generates comprehensive PDF with all quality metrics and trends
16. Mobile-responsive with alerts section prioritized at top

### Story 5.4: Data Export Capabilities

As a **user**,
I want to export data to CSV and PDF formats,
so that I can analyze data externally and share reports with stakeholders.

**Acceptance Criteria:**

1. All list views include "Export" dropdown button with options: CSV, PDF, Excel (xlsx)
2. CSV export includes all columns from current view plus any hidden metadata fields
3. CSV respects current filters and sorting (exports what user sees)
4. PDF export generates formatted document with: Report title, Date/time generated, User name, Filters applied, Data table with pagination
5. Excel export includes formatted spreadsheet with: Header row (bold), Frozen header, Auto-filter enabled, Column widths auto-sized
6. Large datasets (>1000 rows) trigger background job with email notification when ready: "Your export is ready for download"
7. Export progress indicator displays for large datasets: "Exporting... 45% complete"
8. Downloaded files named with convention: `{entity}_{date}_{time}.{format}` (e.g., `suppliers_2025-10-13_14-30.csv`)
9. Dashboard exports (PDF) include: All visible widgets, Charts as images, KPI values, Export timestamp, Tenant branding
10. Supplier scorecard export (PDF) includes: Supplier header, All performance charts, Evaluation history table, Complaints summary, Professional formatting
11. Complaint report export (PDF) includes: Executive summary, Complaint details, CAPA action status, Impact analysis, Charts and graphs
12. All exports respect tenant data isolation (only exports data user has access to)
13. Export rate limiting: Max 10 exports per user per hour (prevents abuse)
14. Export history tracked in admin logs: User, Entity type, Format, Timestamp, Row count
15. Mobile devices trigger download or "Share" dialog based on platform capabilities

### Story 5.5: REST API Foundation & Documentation

As a **developer (external)**,
I want a well-documented REST API,
so that I can integrate Supplex with other systems.

**Acceptance Criteria:**

1. RESTful API endpoints created for all core entities: Suppliers, Qualifications, Evaluations, Complaints, CAPA Actions
2. API base URL: `https://api.supplex.com/v1/` (or tenant subdomain pattern)
3. API versioning in URL path: `/v1/` prefix for all endpoints
4. Standard HTTP methods: GET (list/detail), POST (create), PUT/PATCH (update), DELETE (soft delete)
5. Consistent response format: `{ "success": true/false, "data": {...}, "meta": {...}, "errors": [...] }`
6. Pagination for list endpoints: Query params `page`, `limit` (default 20, max 100), Response includes `total`, `page`, `totalPages`
7. Filtering via query params: `?status=approved&category=raw_materials` with standard operators
8. Sorting via query param: `?sort=created_at:desc` (field:direction format)
9. Field selection: `?fields=id,name,status` returns only specified fields (reduces payload)
10. OpenAPI 3.0 specification auto-generated from ElysiaJS routes (using Swagger plugin)
11. Swagger UI hosted at `/api/docs` with interactive API explorer
12. API documentation includes: Endpoint descriptions, Request/response examples, Authentication requirements, Error codes, Rate limits
13. All API responses include standard headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
14. Error responses follow RFC 7807 problem details format with clear error messages
15. API playground allows testing endpoints directly from documentation with authentication

### Story 5.6: API Authentication & Authorization

As a **developer (external)**,
I want secure API authentication,
so that I can access Supplex data programmatically without compromising security.

**Acceptance Criteria:**

1. API supports two authentication methods: JWT tokens (for user context), API keys (for service accounts)
2. JWT authentication uses same tokens from Supabase Auth (httpOnly cookies or Authorization header)
3. API key authentication via `X-API-Key` header or `api_key` query parameter
4. API Keys page in Settings shows list of API keys for tenant
5. "Generate API Key" button creates new key with: Key name (required), Description, Permissions (read-only, read-write, admin), Expiration date (optional)
6. Generated key displayed once with warning: "Copy this key now. You won't be able to see it again."
7. API key list shows: Key name, Permissions, Last used date, Expiration date, Created date, "Revoke" button
8. Revoked keys immediately invalid for all API requests
9. API key permissions enforced at endpoint level: Read-only keys cannot POST/PUT/DELETE
10. All API requests validate tenant context from JWT or API key (enforces multi-tenancy)
11. Rate limiting per API key: 1000 requests/hour (configurable per tenant), 429 status when exceeded
12. Rate limit headers in response: `X-RateLimit-Limit: 1000`, `X-RateLimit-Remaining: 847`, `X-RateLimit-Reset: 1697234567`
13. API requests logged: Timestamp, API key/user, Endpoint, Method, Response status, Response time
14. Admin can view API usage dashboard: Requests per day chart, Top endpoints, Top API keys, Error rate
15. Failed auth returns 401 with clear error: `{ "error": "Invalid API key" }` or `{ "error": "JWT token expired" }`
16. Audit log records API key creation, usage, and revocation

### Story 5.7: API Endpoints - Suppliers & Qualifications

As a **developer (external)**,
I want API endpoints for suppliers and qualifications,
so that I can integrate supplier data with external systems.

**Acceptance Criteria:**

1. **GET /v1/suppliers** - List all suppliers with pagination, filtering, sorting
2. **GET /v1/suppliers/{id}** - Get supplier detail including contacts, documents, status
3. **POST /v1/suppliers** - Create new supplier (requires write permissions)
4. **PUT /v1/suppliers/{id}** - Update supplier (requires write permissions)
5. **DELETE /v1/suppliers/{id}** - Soft delete supplier (requires admin permissions)
6. **GET /v1/suppliers/{id}/qualifications** - List qualifications for specific supplier
7. **GET /v1/suppliers/{id}/evaluations** - List evaluations for specific supplier
8. **GET /v1/suppliers/{id}/complaints** - List complaints for specific supplier
9. **GET /v1/qualifications** - List all qualifications with filters: status, supplier, date range
10. **GET /v1/qualifications/{id}** - Get qualification detail including stages, documents, approvals
11. **POST /v1/qualifications** - Initiate new qualification workflow
12. **PUT /v1/qualifications/{id}/stages/{stageNumber}** - Approve or reject qualification stage
13. **POST /v1/qualifications/{id}/documents** - Upload document to qualification checklist
14. All endpoints validate tenant context and return only tenant-specific data
15. Supplier response includes: id, name, status, contacts, categories, created_at, updated_at, metadata
16. Qualification response includes: id, supplier_id, status, current_stage, risk_score, stages array, timeline
17. All write operations return created/updated resource in response body
18. Validation errors return 422 with detailed field-level error messages

### Story 5.8: API Endpoints - Evaluations & Complaints

As a **developer (external)**,
I want API endpoints for evaluations and complaints,
so that I can integrate quality and performance data with external systems.

**Acceptance Criteria:**

1. **GET /v1/evaluations** - List all evaluations with filters: supplier, period, status, score range
2. **GET /v1/evaluations/{id}** - Get evaluation detail including dimension scores, comments, evidence
3. **POST /v1/evaluations** - Create new evaluation
4. **PUT /v1/evaluations/{id}** - Update evaluation scores and submit
5. **GET /v1/complaints** - List all complaints with filters: supplier, status, severity, category, date range
6. **GET /v1/complaints/{id}** - Get complaint detail including CAPA actions, impacts, timeline
7. **POST /v1/complaints** - Register new complaint
8. **PUT /v1/complaints/{id}** - Update complaint status, assign, add comments
9. **GET /v1/complaints/{id}/capa-actions** - List CAPA actions for complaint
10. **POST /v1/complaints/{id}/capa-actions** - Add corrective or preventive action
11. **PUT /v1/complaints/{id}/capa-actions/{actionId}** - Update CAPA action status, complete, verify
12. Evaluation response includes: id, supplier_id, period, overall_score, dimensions array (with scores, weights, comments), status, evaluator
13. Complaint response includes: id, supplier_id, complaint_number, title, description, severity, category, status, reported_by, due_date, capa_summary
14. CAPA action response includes: id, complaint_id, action_type, description, responsible_party, status, target_date, completion_date
15. All write operations trigger appropriate notifications (emails) just like UI actions
16. Webhook support (Phase 2) documented as future enhancement in API docs
17. All endpoints include example requests/responses in OpenAPI spec
18. Rate limiting applies per endpoint (some endpoints may have lower limits)

### Story 5.9: API Client Library & Type Safety

As a **developer (external)**,
I want a type-safe API client library,
so that I can integrate with Supplex easily and catch errors at compile time.

**Acceptance Criteria:**

1. Eden Treaty client library auto-generated from ElysiaJS API (provides end-to-end type safety)
2. NPM package published: `@supplex/api-client` with TypeScript types included
3. Package documentation includes: Installation instructions, Authentication setup, Usage examples, Type definitions
4. Client library supports both API key and JWT authentication
5. Example usage in docs: `const client = new SupplexClient({ apiKey: 'xxx' }); const suppliers = await client.suppliers.list();`
6. Client library handles: Automatic retries (3 attempts with exponential backoff), Rate limit handling (waits and retries), Error parsing and typing
7. Type-safe request/response objects: `CreateSupplierRequest`, `SupplierResponse`, `ListSuppliersResponse`
8. Pagination helper: `client.suppliers.list().paginate()` returns async iterator for all pages
9. Filter builder for complex queries: `client.suppliers.list({ filter: { status: 'approved', category: ['raw_materials'] } })`
10. React hooks package (optional): `@supplex/react-hooks` with `useSuppliers()`, `useSupplier(id)`, etc.
11. Code examples repository on GitHub with common integration patterns
12. Postman collection available for download from API docs page
13. Error handling includes typed error classes: `SupplexAPIError`, `SupplexAuthError`, `SupplexRateLimitError`
14. Client library version aligned with API version (v1.x.x for API v1)
15. Changelog maintained for client library with breaking changes clearly marked

### Story 5.10: Analytics & Reporting API Endpoints

As a **developer (external)**,
I want API endpoints for analytics and aggregated data,
so that I can build custom dashboards and reports in external BI tools.

**Acceptance Criteria:**

1. **GET /v1/analytics/suppliers/summary** - Aggregate supplier metrics: Total count, By status, By category, By performance tier
2. **GET /v1/analytics/qualifications/summary** - Qualification metrics: Total count, By status, Avg completion time, Conversion rates
3. **GET /v1/analytics/evaluations/summary** - Evaluation metrics: Total count, Avg scores, Score distribution, Completion rate
4. **GET /v1/analytics/complaints/summary** - Complaint metrics: Total count, By severity, By category, Resolution rate, Avg resolution time
5. **GET /v1/analytics/suppliers/{id}/scorecard** - Complete supplier scorecard data: Scores, Trends, Evaluations, Complaints
6. **GET /v1/analytics/performance-trends** - Time series data: Supplier scores over time, Complaint volumes, Qualification throughput
7. All analytics endpoints support date range filters: `?start_date=2025-01-01&end_date=2025-12-31`
8. Group by support: `?group_by=month` or `?group_by=category` for aggregated results
9. Response includes both raw data and pre-calculated insights/recommendations
10. Analytics responses optimized for charting: Include labels array, values array, colors for visualization
11. Comparison mode: `?compare=previous_period` returns current vs. previous period data
12. Export format support: `?format=json` (default) or `?format=csv` for direct BI tool import
13. Analytics endpoints have higher rate limits: 5000 requests/hour (more read-heavy usage expected)
14. Caching headers included: `Cache-Control: public, max-age=300` (5 min cache for analytics)
15. All calculations match dashboard metrics exactly (consistency between UI and API)
16. Example BI tool integrations documented: Tableau, Power BI, Looker, Metabase
17. Real-time metrics vs. cached metrics clearly indicated in documentation

## Checklist Results Report

### Executive Summary

**Overall PRD Completeness:** 95%  
**MVP Scope Appropriateness:** Just Right (with minor optimization opportunities)  
**Readiness for Architecture Phase:** ✅ **READY**

**Key Strengths:**

- Comprehensive requirements documentation with 28 FRs + 25 NFRs
- 51 well-structured user stories across 5 logically sequenced epics
- Clear technical constraints and architecture guidance
- Strong alignment with Project Brief goals and 4-month timeline
- Excellent coverage of cross-cutting concerns (security, testing, mobile-first)

**Most Critical Concerns:**

1. **Scope risk:** 51 stories is ambitious for 4 months—recommend prioritization framework for potential cuts
2. **Technical risk:** Bun/ElysiaJS maturity requires Week 1-2 POC validation (documented, but critical)
3. **Testing debt risk:** 70%/60% coverage targets are aggressive—may slip under pressure

### Category Analysis

| Category                         | Status | Critical Issues                                                      |
| -------------------------------- | ------ | -------------------------------------------------------------------- |
| 1. Problem Definition & Context  | PASS   | None - Excellent alignment with Project Brief                        |
| 2. MVP Scope Definition          | PASS   | Minor: Consider Epic 5 Stories 5.9-5.10 as Phase 2 candidates        |
| 3. User Experience Requirements  | PASS   | None - Comprehensive UI goals and interaction paradigms              |
| 4. Functional Requirements       | PASS   | Minor: FR22-24 (API) could be Phase 2 if timeline pressured          |
| 5. Non-Functional Requirements   | PASS   | None - Excellent tech stack documentation                            |
| 6. Epic & Story Structure        | PASS   | Minor: Epic 4 has 11 stories vs. 10 in others (slight imbalance)     |
| 7. Technical Guidance            | PASS   | Minor: Bun/ElysiaJS fallback plan mentioned but not fully documented |
| 8. Cross-Functional Requirements | PASS   | None - Data, integration, operational needs well covered             |
| 9. Clarity & Communication       | PASS   | None - Clear, consistent, well-structured documentation              |

### Top Recommendations

**HIGH Priority (Should Address):**

1. **Bun/ElysiaJS Fallback Plan:** Document Node.js/NestJS fallback with effort estimate (2-week pivot target)
2. **Scope Prioritization Framework:** Identify 5-8 "flex scope" stories that can be cut if timeline slips

**MEDIUM Priority (Would Improve Clarity):** 3. **Entity Relationship Diagram:** Add high-level ERD showing core entities and relationships 4. **API Scope Refinement:** Consider Epic 5 Stories 5.9-5.10 as "Phase 1.5" (post-launch enhancements)

### MVP Scope Assessment

**Timeline Analysis:**

- 51 stories × 2-4 days = 102-204 dev-days
- 5-7 person team × 16 weeks = 80-112 team-weeks (400-560 dev-days available)
- **Utilization: 18-51%** (accounting for meetings, planning, bugs, rework)

**Verdict:** Feasible but tight. Recommend buffer of 2-3 weeks for hardening and identifying 8-10 stories as "Phase 1.5" contingency.

**Recommended Phase 1.5 Candidates:**

- Story 3.9: Comparative Supplier Analysis (power user feature)
- Story 4.11: Complaint Impact Analysis & Reporting (analytics enhancement)
- Story 5.9: API Client Library (can launch with OpenAPI docs only)
- Story 5.10: Analytics API Endpoints (can launch with basic CRUD API only)

### Final Decision

✅ **READY FOR ARCHITECT**

The PRD and epics are comprehensive, properly structured, and ready for architectural design.

**Confidence Level:** 95%

**Next Steps:**

1. Address 2 HIGH priority items (Bun fallback plan, scope prioritization) - 2-4 hours effort
2. Hand off to Architect for technical design
3. Schedule Week 1-2 for Bun/ElysiaJS POC and team ramp-up

## Next Steps

### UX Expert Prompt

**Prompt for UX/Design Architect:**

> I've completed a comprehensive PRD for Supplex, a multi-tenant SaaS supplier management platform. The PRD includes complete UI Design Goals (UX vision, interaction paradigms, core screens, accessibility requirements, Midday-inspired branding) and 51 detailed user stories across 5 epics.
>
> Please review the PRD at `docs/prd.md` and create a complete UX/Design Architecture document that includes:
>
> - High-fidelity wireframes for all core screens identified in the UI Design Goals section
> - Component library specification based on Midday design system (shadcn/ui)
> - Interaction patterns and user flow diagrams for primary workflows (qualification, evaluation, complaints)
> - Mobile-responsive breakpoint specifications and mobile-specific interaction patterns
> - WCAG AA accessibility implementation guidelines
> - Design tokens and Tailwind configuration for Midday-inspired theme
>
> Focus on creating a design system that developers can implement directly from your specifications. The platform must feel professional and trustworthy for mid-market manufacturing companies while remaining modern and efficient.

### Architect Prompt

**Prompt for Technical Architect:**

> I've completed a comprehensive PRD for Supplex, a multi-tenant SaaS supplier management platform with 51 user stories across 5 epics, targeting 4-month MVP delivery.
>
> Please review the PRD at `docs/prd.md` and Project Brief at `docs/brief.md`, then create a complete Technical Architecture document that includes:
>
> **Critical Requirements:**
>
> - Multi-tenant architecture with Supabase RLS + Drizzle ORM (hybrid query strategy as documented)
> - Monorepo structure: Remix (frontend) + ElysiaJS/Bun (backend) + shared packages
> - Complete database schema with RLS policies ensuring tenant isolation
> - Authentication architecture: Supabase Auth + ElysiaJS RBAC middleware
> - Mobile-first responsive architecture meeting <2s page load, <500ms API response targets
>
> **Week 1-2 POC Requirements:**
>
> - Validate Bun/ElysiaJS production readiness
> - Prove Remix + ElysiaJS integration works seamlessly
> - Verify Supabase RLS + Drizzle hybrid approach is secure and performant
> - Document Node.js/NestJS fallback plan with 2-week pivot estimate if POC fails
>
> **Deliverables:**
>
> - High-level architecture diagram (Remix → ElysiaJS → Supabase flow)
> - Complete database schema (ERD) for all 5 epics with indexes and RLS policies
> - API design patterns and endpoint structure (/v1/ REST + OpenAPI)
> - CI/CD pipeline architecture (GitHub Actions → Vercel + Fly.io)
> - Security architecture (multi-tenancy, auth, OWASP Top 10 mitigation)
> - File storage strategy (Supabase Storage with RLS)
> - Email notification architecture (Resend.com + BullMQ)
> - Performance optimization strategy (caching, CDN, query optimization)
>
> The architecture must support 99%+ uptime, 50+ concurrent users, and 1000+ suppliers while maintaining strict tenant data isolation. All technical decisions should reference the constraints documented in the Technical Assumptions section.
