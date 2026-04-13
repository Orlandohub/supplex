# ADR 0006: Documentation Architecture

## Status

Accepted — 2026-04-13

## Context

The repository had accumulated overlapping documentation layers: broad architecture narratives, duplicated planning docs, quick-reference summaries, process artifacts, and stale implementation notes. Contributors needed a simpler system that answered three questions clearly:

- what the system is
- why major architectural decisions were made
- how contributors should build within it

## Decision

The repository documentation is organized into three primary architecture-related surfaces:

- `docs/architecture.md` for the main architecture overview
- `docs/adr/` for durable architectural decisions and trade-offs
- `docs/standards.md` for contributor rules, patterns, and implementation guidance

Other documentation areas remain focused on their roles:

- `docs/frontend.md` for UI behavior and interaction guidance
- `docs/troubleshooting.md` for known issues and debugging help

## Consequences

### Positive

- Contributors have a clearer path to the right kind of documentation
- Decision history is separated from current-state explanations
- Standards can evolve without rewriting architectural history

### Negative

- Existing links and habits had to be updated
- The team must be disciplined about putting new docs in the correct surface

### Neutral

- Some older detail-heavy architecture docs were intentionally removed rather than preserved as parallel sources of truth

## Alternatives Considered

### Keep a large architecture folder as the primary navigation surface

Flexible, but prone to overlap and drift.

### Put all architecture information into ADRs

Useful for decision history, but a poor fit for standards and day-to-day contributor guidance.

### Keep one architecture overview only, with no standards layer

Simpler at first glance, but would overload the main architecture doc with rules better maintained elsewhere.
