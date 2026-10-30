# Contributing

> **Audience:** contributors · **Status:** draft · **Last updated:** 2026-10-27 · **Related:** [README](../README.md)

## The one rule

**No unsourced claims.** Any quantitative statement you add — a benchmark score, a token count, a cost — must link a source or a run-log path. Docs are held to the same standard as the product: evidence, not marketing.

## Workflow

1. Branch from `main` (kebab-case name, e.g. `feat/cua-verifier`).
2. Keep changes scoped — one concern per PR.
3. If you make an architectural decision, add an [ADR](adr/).
4. Update the relevant doc in `docs/` in the same PR — no drift.
5. Verify: the changed flow runs end-to-end, and any GIF/screenshot you add comes from a **real run**.

## Doc conventions

- Every doc opens with the header block: `Audience · Status · Last updated · Related`.
- Filenames are kebab-case; one topic per file.
- `README.md` stays under ~150 lines and links deeper.
- Assets go in `docs/assets/`, named `NN-step-name.gif`, kept under 5 MB.

## Commits

Short imperative subject, body when the "why" isn't obvious. Reference the ADR or issue where relevant.
