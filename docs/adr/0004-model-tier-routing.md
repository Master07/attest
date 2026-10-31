# 0004 — Route by role: cheap workers, expensive reasoning on demand

- **Status:** Superseded by [ADR 0005](0005-narrow-to-proof-of-fix.md) (2026-10-30)
- **Date:** 2026-10-27
- **Related:** [MODEL_STRATEGY](../MODEL_STRATEGY.md)

## Context

Using the frontier model (Muse Wonder Full) for every step is the best-quality option and the worst-cost option. Most steps are routine parallel work; only a few need deep reasoning.

## Decision

Route per role: **Spark 1.3** (or the Contributor variant) for parallel workers and tight tool loops; **Muse Wonder Full** only for merge/conflict resolution and hard reasoning; **Muse Image** and **SAM 3.1** for media. Switch with `/model`.

## Alternatives considered

- **Wonder Full for everything** — highest quality, blows the credit budget.
- **Spark for everything** — cheapest, but weak on hard merges/architecture.

## Consequences

- Best quality-per-dollar; the tier switch is itself part of the demo.
- Adds a routing component and a decision rule to maintain.
- Wonder Full requires the Power/Maximum plan; the plan gates which runs are possible.
