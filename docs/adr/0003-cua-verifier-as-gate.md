# 0003 — The computer-use verifier is the only gate to "done"

- **Status:** Accepted
- **Date:** 2026-10-27
- **Related:** [ARCHITECTURE](../ARCHITECTURE.md)

## Context

Agents' own tests miss most defects; a task can pass CI and still be broken for the user. If Attest trusts worker-reported success, it inherits the same failure mode it exists to fix.

## Decision

A task is **done only when a computer-use verifier** has driven the running app and observed the expected behaviour. The producing agent cannot self-declare success; verification runs as a separate agent (test-time scaling), and a failed check reopens the task.

## Alternatives considered

- **Trust worker tests** — the status quo; the exact problem we're solving.
- **Human review only** — correct but not automatable at fan-out speed; kept as the final step, not the gate.
- **Static checks only** — cheap, but can't confirm behaviour.

## Consequences

- Strong correctness guarantee at the user level; a real differentiator.
- Higher cost/latency per task (booting and driving the app).
- Requires the app to be runnable in the sandbox; desktop paths are a stretch goal.
