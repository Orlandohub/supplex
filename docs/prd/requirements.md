# Requirements

## Functional

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

## Non Functional

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
