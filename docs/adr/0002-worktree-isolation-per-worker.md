# 0002 — One isolated git worktree per worker

- **Status:** Accepted
- **Date:** 2026-10-27
- **Related:** [ARCHITECTURE](../ARCHITECTURE.md)

## Context

Parallel workers editing the same checkout collide: clobbered files, conflicting edits, a dirty working copy. Serialising workers would throw away the parallelism that makes Attest fast.

## Decision

Every write-capable subagent runs in its **own git worktree**, checked out from the parent's HEAD, committing on its own branch. Enable via `muse --subagent-worktree-isolation`.

## Alternatives considered

- **Single checkout, serialised writers** — safe but slow; no parallel fan-out.
- **Branch-only isolation (shared checkout)** — still races on the working tree.
- **Copy the whole repo per worker** — expensive and loses git history/tooling.

## Consequences

- Parallel workers never collide; the parent's working copy stays clean.
- Merge becomes an explicit, reviewable step (and an escalation point).
- Worktrees add disk usage and need cleanup (`cleanup_policy: remove_if_clean`).
