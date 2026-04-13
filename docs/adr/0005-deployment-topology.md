# ADR 0005: Deployment Topology

## Status

Accepted — 2026-04-13

## Context

Supplex has distinct frontend, backend, database, storage, and operational concerns. The deployment model needed to support SSR web delivery, a dedicated backend runtime, managed Postgres/auth/storage, and optional queue/cache infrastructure.

## Decision

Supplex uses this deployment topology:

- Vercel for the web application
- Fly.io for the API application
- Supabase for Postgres, auth, and storage
- Redis and BullMQ where caching or background processing is enabled
- Sentry and Vercel Analytics for observability

## Consequences

### Positive

- Each layer is deployed to a platform suited to its runtime and responsibility
- The web app and API can evolve operationally without becoming one deployment artifact
- Managed platform services reduce self-hosting overhead

### Negative

- The system spans multiple external platforms
- Operational debugging can involve multiple vendor surfaces

### Neutral

- This is a practical deployment topology, not a claim that every service must always be enabled in all environments

## Alternatives Considered

### Single hosting platform for everything

Simpler operationally, but less aligned with the distinct runtime needs of the web app and API.

### Full self-hosting

Offers more control, but increases operational burden beyond current needs.
