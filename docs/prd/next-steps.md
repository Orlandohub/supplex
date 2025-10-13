# Next Steps

## UX Expert Prompt

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

## Architect Prompt

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
