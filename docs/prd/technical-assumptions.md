# Technical Assumptions

## Repository Structure: Monorepo

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

## Service Architecture

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

## Testing Requirements

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

## Additional Technical Assumptions and Requests

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
