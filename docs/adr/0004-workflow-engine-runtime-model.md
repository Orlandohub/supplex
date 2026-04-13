# ADR 0004: Workflow Engine Runtime Model

## Status

Accepted — 2026-04-13

## Context

Supplex outgrew qualification-specific workflow thinking. The product needs workflows, forms, tasks, and document interactions that can support more than one process family. A more domain-agnostic runtime model was required.

## Decision

Supplex models workflow execution around runtime entities such as:

- `process_instance`
- `step_instance`
- runtime form and task entities around those process and step instances

This replaces the idea that the system should be centered on qualification-only workflow tables. Workflow execution is treated as a generic engine capability that can support supplier qualification and other multi-step processes.

## Consequences

### Positive

- Workflow execution can support more than one product flow
- Runtime behavior is easier to reason about across forms, tasks, and step progression
- The engine can evolve independently from any one business process label

### Negative

- The model is more abstract than qualification-only tables
- Contributors need to understand engine concepts before changing runtime behavior

### Neutral

- Detailed table structure belongs in `packages/db/src/schema/` rather than separate long-form schema documents

## Alternatives Considered

### Qualification-specific workflow model

Simpler for the original flow, but too narrow for the broader workflow/template direction.

### Separate bespoke models per process family

Could reduce abstraction locally, but would fragment workflow logic and increase duplication.
