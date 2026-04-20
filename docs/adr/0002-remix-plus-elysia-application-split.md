# ADR 0002: Remix Plus Elysia Application Split

## Status

Accepted — 2026-04-13

> **Partially superseded by [ADR 0007: Adopt React Router v7 (Framework Mode) For The Web App](./0007-react-router-v7.md) (2026-04-19).** The "Remix" framework choice has been replaced by React Router v7 in Framework mode. The SSR web app + Elysia API split described below is unchanged and still authoritative.

## Context

Supplex needs both a strong user-facing web experience and a backend that can own cross-cutting business logic, workflow execution, and operational capabilities. The system could have been built as a single app layer or as more isolated services, but the team needed a practical middle ground.

## Decision

Supplex uses:

- Remix for the web application and user-facing route composition
- ElysiaJS on Bun for backend API endpoints and backend business logic

The web app owns SSR, route loaders, actions, and UX flow. The API owns domain logic that should not live in UI routes, especially workflow execution, document operations, admin operations, and backend-centric integrations.

## Consequences

### Positive

- Clear split between user experience and backend business logic
- Good fit for SSR-first web UX with a dedicated API layer
- Eases future expansion of API consumers beyond the Remix app

### Negative

- Some concerns must be coordinated across two application layers
- Contributors need to understand where behavior belongs before making changes

### Neutral

- This is not a microservice architecture; it is a two-app monorepo with clear boundaries

## Alternatives Considered

### Single fullstack application only

Simpler deployment and fewer layers, but would blur the line between page composition and reusable backend logic.

### More distributed services

Could isolate domains further, but would add coordination and operational overhead beyond current needs.
