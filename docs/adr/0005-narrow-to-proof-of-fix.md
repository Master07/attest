# 0005 — Narrow Attest to proof-of-fix for any pull request

- **Status:** Accepted
- **Date:** 2026-10-30
- **Related:** Supersedes the orchestration scope of [0002](0002-worktree-isolation-per-worker.md) for the hackathon build

## Context

Attest was scoped as three things at once: an orchestrator (plan, worktree fan-out, merge), a computer-use verifier, and an attestation layer. With five days left:

- Fan-out is Muse Code's own feature, so it's the least original part and the costliest to build.
- Other entries already verify with computer use, and Meta ran a session on verifiable agents, so "we verify" alone isn't distinctive.
- A single passing check proves little: it can't show the bug existed, and it can't show the verifier would ever fail.
- The verifier shares a model family with the producer and could be swayed by what it reads in the code.

## Decision

Attest becomes **proof-of-fix for AI pull requests**. It takes any PR — from Muse Code, a person, or another agent — and produces a three-part proof:

1. **Red** — on the base build, the verifier reproduces the bug in the running app.
2. **Green** — on the PR build, the same flow works.
3. **Break** — on a deliberately wrong fix, the verifier fails.

Design rules:

- **Blind verifier:** it sees only the human-approved acceptance criteria and the running app — never the code, the diff, or the producer's reasoning.
- **Receipt:** criteria, Red/Green/Break results and screenshots are sealed into a hash-chained receipt that anyone can check with `attest verify`.
- **Video intake (stretch):** a screen recording of the bug becomes the Red step's reproduction.
- **Verifier model:** Spark 1.3 (the Model API's computer tool rejects Wonder); Spark Open on Baseten as an independent judge.

## Alternatives considered

- **Keep the full orchestrator** — more surface, but unbuildable in time and least differentiated.
- **Single pass/fail check** — what most entries do; can't prove the bug existed or that the verifier discriminates.
- **Different model as the only independence measure** — helps, but blindness to the code is simpler and also blocks injection via code comments.

## Consequences

- Smaller build: verifier, two builds of one app, receipt, then Break. Fan-out, merge escalation and Muse Image are out of hackathon scope.
- Model-agnostic in practice: any PR can be verified.
- The earlier orchestrator design (plan, fan-out, merge) and the worktree ADRs describe the broader vision and are no longer the hackathon scope.
- Red requires the bug to be reproducible in a runnable build; flaky or environment-specific bugs are out of scope.
