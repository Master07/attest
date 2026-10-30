# Submission

> **Audience:** judges · **Status:** draft — fill placeholders before submitting · **Last updated:** 2026-10-30 · **Related:** [PITCH](PITCH.md) · [JUDGING_MAP](JUDGING_MAP.md) · [HACKATHON_RULES](../HACKATHON_RULES.md)

## Project

**Attest — proof-of-fix for AI pull requests.** A verifier that never sees the code reproduces the bug, confirms the fix in the running app, proves it would catch a broken fix, and seals it all into a receipt anyone can check.

Built entirely during the event (Oct 26 – Nov 4, 2026).

## The problem

Coding agents write PRs faster than anyone can review them, and their own tests catch **fewer than 55% of logical mutants** ([source](https://x.com/nielstron/status/2109651666790445209)). Maintainers and reviewers get PRs that look right, pass CI, and still don't work. A passing check isn't proof.

## How it works

1. **Criteria** — a human approves plain-language acceptance criteria (stretch: drafted from a screen recording of the bug).
2. **Red** — a blind computer-use verifier reproduces the bug on the base build.
3. **Green** — the same flow works on the PR build.
4. **Break** — a deliberately wrong fix fails, proving the verifier discriminates.
5. **Receipt** — criteria, results and screenshots are sealed into a hash-chained receipt; `attest verify` checks it without trusting Attest.

The verifier is **blind**: it sees only the criteria and the running app — never the code, the diff, or the producing agent's reasoning. Detail: [ADR 0005](adr/0005-narrow-to-proof-of-fix.md) · [PITCH](PITCH.md).

## Use of Meta models & platform

| Model | Used for |
|---|---|
| Muse Spark 1.3 | Computer-use verifier (Responses API `computer` tool) |
| Muse Spark video input | Screen recording of the bug → reproduction steps (stretch) |
| SAM 3.1 | Confirming UI elements on screen |
| Muse Spark Open (Baseten) | Independent second judge on open weights |
| Muse Code | One of the agents whose PRs Attest verifies |

Detail: [MODEL_STRATEGY](MODEL_STRATEGY.md) · [COST](COST.md).

## Impact

- **Maintainers:** "Prove your PR works, or it doesn't get reviewed" — review the receipt, not every line.
- **Teams shipping agent PRs:** an evidence trail of why each change was accepted.
- **Business path:** the same receipt is the sign-off artifact for legacy migrations and regulated change control ([GTM_BRIEF](GTM_BRIEF.md)).

## Track and theme

- **Track:** Indie Developer. The Indie lens is creativity, ambition and whether it works.
- **Theme:** Push the Frontier. It names software and new machine capabilities; Attest gives coding agents the capability to prove their work.

## Deadline and portal

Submit on the [Cerebral Valley portal](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/hackathon/submit) by **Nov 4, 2026, 9:00 PM ET (Nov 5, 7:30 AM IST)**. The exact form fields are behind the portal login; check them early. See the checklist in [HACKATHON_RULES](../HACKATHON_RULES.md#submission-checklist).

## Links

- **Repo:** TODO
- **Overview artifact:** TODO (published link)
- **Demo video:** TODO
- **Docs:** [README](../README.md)

## Tech stack

- **Language/runtime:** TypeScript on Node.js (ES modules), run with `tsx`.
- **Key libraries:** `@muse-code/sdk` (Muse Code integration, in progress); dev tooling `typescript`, `tsx`, `@types/node`.
- **Entry points:** `src/index.ts` (CLI, `npm run demo`), `src/orchestrator.ts` (the loop).

## What's built vs planned

See [ROADMAP](ROADMAP.md).

## Attribution & sources

- Mutant-gap stat: [nielstron, 2026](https://x.com/nielstron/status/2109651666790445209)
- Model data: [Meta Model API docs](https://dev.meta.ai/docs/models), [Latent Space](https://latent.space/p/ainews-meta-muse-wonder-and-wonder/)
