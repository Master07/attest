# Pitch

> **Audience:** judges · **Status:** draft · **Last updated:** 2026-10-30 · **Related:** [SUBMISSION](SUBMISSION.md) · [JUDGING_MAP](JUDGING_MAP.md) · [ADR 0005](adr/0005-narrow-to-proof-of-fix.md)

> **Attest: proof-of-fix for AI pull requests.** A verifier that never sees the code reproduces the bug, confirms the fix in the running app, proves it would catch a broken fix, and seals it all into a receipt anyone can check.

## The 2-minute narrative

### Problem

Coding agents now write pull requests faster than anyone can review them, and their own tests are weak: frontier agents' tests catch **fewer than 55% of logical mutants** ([source](https://x.com/nielstron/status/2109651666790445209)). Open-source maintainers and team reviewers are left with PRs that look right, pass CI, and still don't work. Reviewing them line by line doesn't scale.

### Insight

A passing check isn't proof. Proof needs three things:

1. **Red** — show the bug actually happens on the original code.
2. **Green** — show the same flow works with the fix.
3. **Break** — show the checker would have failed a wrong fix.

And the checker must be **blind**: if it never sees the code, the code can't talk it into passing.

### What Attest does

Point Attest at any pull request — from Muse Code, a person, or another agent:

- A human approves plain-language acceptance criteria (or Attest drafts them from a screen recording of the bug).
- A **blind computer-use verifier** on Muse Spark 1.3 drives the running app: Red on the base build, Green on the PR, Break on a deliberately wrong fix.
- SAM 3.1 confirms what's on screen; Muse Spark Open acts as an independent second judge.
- Everything is sealed into a **tamper-evident receipt** posted on the PR. Anyone can run `attest verify` to check it without trusting Attest.

### Demo

A 10-second screen recording shows a Pay button that can't be clicked. Attest reproduces it — **Red**. An agent's "fix" passes all 12 of its own tests, but Attest drives the app and it's still broken — **Red again, rejected**. The real fix goes **Green**, the deliberately broken variant goes **Break**, and the receipt is sealed. Edit one line of the receipt and `attest verify` fails.

### Impact

- **For maintainers:** "Prove your PR works, or it doesn't get reviewed." Review the receipt, not every line.
- **For teams shipping agent PRs:** an evidence trail of why each change was accepted.
- **For the business:** the same receipt is the sign-off artifact for legacy migrations and regulated change control (see [GTM_BRIEF](GTM_BRIEF.md)).

### Why Meta's stack

- **Muse Spark 1.3 computer use** drives the real app.
- **Muse Spark video input** turns a screen recording into a reproduction.
- **SAM 3.1** confirms UI elements on screen.
- **Muse Spark Open** (open weights, via Baseten) is the independent judge.
- **Muse Code** is one of the agents whose PRs Attest verifies.

### The ask

Show that proof-of-fix is buildable today, and open the receipt format so any agent or CI system can produce and check it.

## See also

- [SUBMISSION](SUBMISSION.md) — the formal writeup
- [JUDGING_MAP](JUDGING_MAP.md) — feature → criteria
- [ADR 0005](adr/0005-narrow-to-proof-of-fix.md) — why the scope narrowed
