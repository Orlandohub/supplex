# Frontend Guidance

This document captures the contributor-facing UI and interaction guidance for the Supplex web app.

## UX Principles

- Clarity over cleverness
- Progressive disclosure over overloaded screens
- Consistent component and interaction patterns
- Immediate feedback for user actions
- Accessibility by default

## Primary Users

- Procurement users managing suppliers and qualification tasks
- Quality users reviewing documents, workflows, complaints, and CAPA
- Technical/admin users managing configuration and integrations

The interface should support data-heavy workflows without feeling like an ERP.

## Core Interaction Model

- Dashboard-first navigation
- Strong supplier list and detail flows
- Workflow-oriented progression for approvals, tasks, and forms
- Search, filtering, and data-density optimized for operational users
- Responsive behavior across mobile, tablet, desktop, and wide layouts

## Navigation Expectations

- Desktop: persistent sidebar navigation
- Mobile: compact navigation with reduced visual clutter
- Deep screens should preserve context with breadcrumb or back-navigation patterns
- Tabs and URL state should be used intentionally and consistently

## Critical User Journeys

- Authentication and protected-route entry
- Supplier list to detail to edit flow
- Supplier qualification and approval progression
- Dynamic template-driven workflow execution
- Evaluation flow
- Complaint and CAPA flow

Contributors should verify whether a journey is already covered by browser tests before changing it.

## Accessibility

Target WCAG 2.1 AA behavior across user-facing features.

Key expectations:

- visible focus indicators
- keyboard-accessible interactive elements
- semantic structure and screen reader support
- color contrast that does not depend on color alone
- touch targets sized appropriately for mobile use

## Responsiveness

- Mobile-first layout behavior
- Smooth adaptation between phone, tablet, desktop, and wide desktop layouts
- Tables should degrade gracefully on smaller screens
- Content priority should be explicit on smaller screens

## UI Component Direction

- Reuse existing app patterns before inventing new ones
- Prefer shadcn/ui-style primitives and Midday-inspired interaction patterns
- Keep forms, tables, badges, dialogs, toasts, and navigation behavior visually consistent

## Frontend Performance Expectations

- SSR-first route loading
- Route-level and component-level code splitting where useful
- Avoid unnecessary revalidation or client-side refetching
- Preserve responsive, fast-feeling interactions for forms, navigation, and tabbed/detail screens

## When To Use This Document

Use this file when deciding:

- how a new screen should behave
- how to preserve consistency with existing UX patterns
- what level of accessibility and responsiveness a change must maintain
- whether a UX change should trigger browser-level regression testing
