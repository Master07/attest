# 0001 — Build on the Muse Code SDK, not a bespoke agent loop

- **Status:** Superseded by [ADR 0005](0005-narrow-to-proof-of-fix.md) (2026-10-30)
- **Date:** 2026-10-27
- **Related:** [ARCHITECTURE](../ARCHITECTURE.md) · [MODEL_STRATEGY](../MODEL_STRATEGY.md)

## Context

Attest needs multi-agent fan-out, computer-use, worktree isolation, an event log, and model switching. Building those from scratch is weeks of work and would re-implement primitives the harness already ships.

## Decision

Build Attest as an orchestration layer on the **Muse Code SDK** (`@muse-code/sdk` for TypeScript, `muse-code-sdk` for Python), keeping the harness as the execution substrate.

## Alternatives considered

- **Raw Meta Model API agent loop** — maximum control, but re-implements the scheduler, worktrees, event log, and computer-use.
- **Other terminal agents** — lose the co-trained model + harness integration and the worktree/event-log primitives.

## Consequences

- Fast to a working demo; we spend effort on the *verification gate* (our differentiator), not plumbing.
- Coupled to Muse Code's release cadence and its model lineup.
- Requires Muse Code installed and authenticated in the environment.
