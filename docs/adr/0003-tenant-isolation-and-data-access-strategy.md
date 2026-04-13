# ADR 0003: Tenant Isolation And Data Access Strategy

## Status

Accepted — 2026-04-13

## Context

Tenant isolation is a non-negotiable system property for Supplex. At the same time, the product spans a web app, an API, shared schema, and workflow-heavy backend behavior. The team needed a data-access strategy that balances security, contributor clarity, and implementation practicality.

## Decision

Supplex uses a hybrid tenant-isolation strategy:

- the database schema remains the source of truth for entity structure
- tenant isolation is treated as a hard requirement across all data access
- some web-facing paths may use Supabase capabilities that align with current app behavior
- backend logic uses Drizzle with explicit tenant-aware query behavior

Contributors must not assume one generic access pattern covers every execution path. Tenant isolation must be verified in the concrete code path being changed.

## Consequences

### Positive

- The system can use the strengths of both Supabase-backed and backend-managed access paths
- Tenant isolation remains visible as an explicit architectural concern
- Workflow-heavy backend logic can remain API-owned

### Negative

- The strategy requires discipline to avoid drift between access patterns
- Contributors must verify isolation behavior rather than relying on doc assumptions alone

### Neutral

- The practical source of truth is the live code plus schema, not secondary prose descriptions

## Alternatives Considered

### Database-only isolation model

Attractive for simplicity, but does not by itself answer all backend-owned workflow and orchestration needs.

### Application-only isolation model

Simpler to reason about in code, but weaker as a system-wide safety posture for a multi-tenant product.
