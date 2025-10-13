# Introduction

This document outlines the complete fullstack architecture for Supplex, a multi-tenant SaaS platform enabling mid-sized manufacturers to manage their complete supplier lifecycle from qualification through performance evaluation and complaints management. It serves as the single source of truth for AI-driven development, ensuring consistency across the entire technology stack.

This unified approach combines what would traditionally be separate backend and frontend architecture documents, streamlining the development process for modern fullstack applications where these concerns are increasingly intertwined. The architecture is designed to deliver enterprise-grade supplier management at 80-90% lower cost than solutions like SAP Ariba, with implementation in weeks rather than months.

**Key Architecture Drivers:**

- **Multi-tenant SaaS** with complete data isolation (Supabase RLS)
- **Mobile-first responsive design** inspired by Midday UI patterns
- **Hybrid query strategy** balancing security (RLS) with performance (Drizzle)
- **Modern tech stack** optimized for developer velocity and runtime performance
- **4-month MVP timeline** requiring pragmatic architectural choices
- **Compliance-ready** with audit trails, RBAC, and GDPR foundations

## Starter Template or Existing Project

**Status:** Greenfield project with direct UI component reuse from Midday

This project leverages the **Midday** financial management SaaS ([GitHub](https://github.com/midday-ai/midday)) for its complete UI/UX foundation. Specifically:

**What We're Reusing:**

- **UI Components:** Direct reuse of Midday's shadcn/ui-based component library (`/packages/ui`)
  - All presentational components (Button, Table, Dialog, Card, Form inputs, etc.)
  - Style configurations, Tailwind theming, and design tokens
  - Accessibility implementations (ARIA labels, keyboard navigation, focus management)
  - Responsive patterns and mobile-first layouts
  - Animation and micro-interaction behaviors
- **Design System:** Complete Midday visual language, typography, color palette, spacing system
- **Usability Patterns:** Proven interaction patterns for B2B SaaS data-heavy workflows

**What We're NOT Reusing:**

- **Business Logic:** All Midday-specific business logic, data models, and workflows are replaced with Supplex supplier management logic
- **Backend:** Completely custom backend with ElysiaJS + Drizzle + Supabase (vs. Midday's serverless functions)
- **Frontend Framework Routing:** Using Remix instead of Next.js (but UI components are framework-agnostic)
- **Data Fetching:** Remix loaders + ElysiaJS API (vs. Midday's approach)

**Architectural Constraints from Midday:**

- Must use shadcn/ui component primitives as-is (proven accessibility and usability)
- Tailwind CSS styling foundation (no CSS-in-JS or alternative styling)
- Component-based architecture with TypeScript
- Mobile-first responsive breakpoints and patterns
- Midday's color palette and typography system (Inter font, established token system)

**What Can Be Modified:**

- All business logic and data models (completely custom for supplier management)
- Backend architecture and API design
- Workflow orchestration and state management
- Integration patterns
- Database schema and ORM usage
- Deployment strategy

**Implementation Strategy:**

1. **Week 1:** Clone Midday `/packages/ui` directory structure into Supplex monorepo
2. **Week 1-2:** Adapt Midday Tailwind configuration, verify all components render correctly in Remix
3. **Week 2-3:** Build Supplex-specific composite components (SupplierCard, EvaluationForm) using Midday primitives
4. **Ongoing:** Reference Midday for any new UI patterns needed, maintain parity on accessibility features

## Change Log

| Date             | Version | Description                             | Author              |
| ---------------- | ------- | --------------------------------------- | ------------------- |
| October 13, 2025 | 1.0     | Initial fullstack architecture document | Winston (Architect) |

---
