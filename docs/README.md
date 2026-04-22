# Supplex Docs

This is the canonical starting point for contributors.

Use the files linked here for implementation decisions. Historical delivery artifacts, QA reports, sprint notes, and handoff documents are intentionally excluded from the active docs set.

## Read This First

1. [Architecture Overview](./architecture.md)
2. [Standards](./standards.md)
3. [Frontend Guidance](./frontend.md)
4. [Deployment](./deployment.md)
5. [Troubleshooting](./troubleshooting.md)

## Reference By Concern

### Architecture And Decision History
- [Architecture Overview](./architecture.md)
- [ADR Guidelines](./adr-guidelines.md)
- [ADR Directory](./adr)
- `packages/db/src/schema/` as the database schema source of truth

### Product And UX
- [Frontend Guidance](./frontend.md)

### Delivery And Operations
- [Deployment](./deployment.md)
- [Troubleshooting](./troubleshooting.md)

### App-Specific Setup
- [API README](../apps/api/README.md)
- [Web README](../apps/web/README.md)

## Common Tasks

### Building A New Route
1. Read [Standards](./standards.md).
2. Review the routing and React Router (Framework mode) sections.
3. Compare against a current route like `apps/web/app/routes/_app.suppliers.$id.tsx`.

### Adding Or Updating API Endpoints
1. Read [Standards](./standards.md).
2. Review the API shape in [Architecture Overview](./architecture.md).
3. Use [API README](../apps/api/README.md) for app-specific setup and route context.
4. Check [Troubleshooting](./troubleshooting.md) for auth and validation pitfalls.

### Making Product Decisions
1. Start with [Architecture Overview](./architecture.md).
2. Use `tests/e2e/` for current browser journey coverage priorities.
3. Use [Frontend Guidance](./frontend.md) for UI behavior and screen-level guidance.

## Documentation Rules

- Keep `docs/` focused on contribution and implementation decisions.
- Put the main system overview in `docs/architecture.md`.
- Put contributor rules and implementation patterns in `docs/standards.md`.
- Put UI and interaction guidance in `docs/frontend.md`.
- Put operational setup and debugging guidance in `docs/deployment.md` and `docs/troubleshooting.md`.

If a doc does not help contributors decide how to build, operate, or troubleshoot the project, it should not live in the active `docs/` set.

