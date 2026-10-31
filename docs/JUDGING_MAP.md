# Judging Map

> **Audience:** team · **Status:** draft · **Last updated:** 2026-10-30 · **Related:** [PITCH](PITCH.md) · [SUBMISSION](SUBMISSION.md) · [HACKATHON_RULES](../HACKATHON_RULES.md)

Mapped to the official rubric of the Meta Global AI Developer Hackathon (see [HACKATHON_RULES](../HACKATHON_RULES.md)). Submissions are due **Nov 4, 2026, 9:00 PM ET (Nov 5, 7:30 AM IST)**.

## Rubric

| Criterion | Weight | What judges look for | How Attest answers it | Where to point |
|---|---|---|---|---|
| **Impact** | 30% | Real-world potential, who benefits, whether people would use it, fit with a theme | Maintainers and reviewers drowning in AI-written PRs that pass CI and don't work: "prove your PR works, or it doesn't get reviewed." Backed by a mini benchmark (agent tests vs. Attest on planted bugs). Theme: *Push the Frontier* (software, new machine capabilities). | [PITCH](PITCH.md), [STRATEGIC_OUTLOOK](STRATEGIC_OUTLOOK.md) |
| **Use of Meta AI tooling** | 25% | Creative use beyond a basic integration; surfacing unexpected model capabilities | Spark 1.3 computer use as a blind verifier; Spark video input turning a bug recording into a reproduction; SAM 3.1 confirming on-screen elements; Spark Open (open weights) as an independent second judge; Muse Code as one of the producing agents. | [MODEL_STRATEGY](MODEL_STRATEGY.md), [ADR 0005](adr/0005-narrow-to-proof-of-fix.md) |
| **Demo** | 25% | A working, impressive demo that **holds up live**, plus a high-quality video | Bug recording → **Red** reproduces it → agent's fix passes its own tests but stays Red → real fix goes **Green** → wrong fix goes **Break** → receipt sealed → live tamper check fails `attest verify`. | [PITCH §Demo](PITCH.md), [DEMO_SCRIPT](DEMO_SCRIPT.md) |
| **Technical depth & execution** | 20% | Sound, refined engineering that shows real craft | Red/Green/Break across two builds, a verifier isolated from the code, a hash-chained receipt with an independent `attest verify`, and a second-model judge. | [ADR 0005](adr/0005-narrow-to-proof-of-fix.md), [VERIFICATION](VERIFICATION.md) |

Track lens (Indie): creativity, ambition, and **does it work**.

## Current gaps against the rubric

| Criterion | Gap | Fix |
|---|---|---|
*Updated 2026-11-01.* The original gaps (no real model calls, no working run, no hash chain) are closed. Remaining:

| Criterion | Gap | Fix |
|---|---|---|
| Demo | The 3-minute video isn't recorded yet | Follow [DEMO_SCRIPT](DEMO_SCRIPT.md); use the per-phase videos as footage |
| Use of Meta AI tooling | No open-weight model in the runtime path yet | Judge on Muse Spark Open via your own Baseten account (`ATTEST_ROUTE_JUDGE`) |
| Impact | Agent "fails first, Attest catches, agent retries" hasn't happened honestly — Muse Code fixed every demo bug first try | Say so plainly; the wrong fixes shown are ours; the real-world TodoMVC proof carries the impact story |
| Technical depth | Verifier and judge are non-deterministic (benchmark B04, TodoMVC run 3) | Disagreement already yields INCONCLUSIVE; repeat-run majority is a roadmap item |

## The one-screen differentiators

1. **Red · Green · Break** — a proof, not a check: the bug existed, the fix works, and the verifier would have caught a wrong fix.
2. **Blind verifier** — it never sees the code, so the code can't talk it into passing.
3. **A receipt anyone can check** — hash-chained; `attest verify` needs no trust in Attest.
4. **Any agent's PR** — Muse Code, a person, or another agent.

## What to avoid claiming

- Don't claim benchmark wins beyond what's sourced — see [reference/muse-models](reference/muse-models.md).
- Don't claim enterprise readiness; this is a hackathon build.
- Don't claim "end-to-end, not a mock" until a real run exists.
