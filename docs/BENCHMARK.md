# Benchmark

> **Audience:** judges + team · **Status:** draft · **Last updated:** 2026-11-01 · **Related:** [VALIDATION_FROM_CLAUDE_BENCH.md](../VALIDATION_FROM_CLAUDE_BENCH.md) · [ARCHITECTURE §1, §7](ARCHITECTURE.md) · [examples/bench](../examples/bench/README.md)

Ten planted UI bugs, each in three versions of a tiny checkout app: **base** (the bug), **bad-fix** (a plausible wrong fix whose own unit tests pass) and **fix** (the real fix). Attest runs Red on base, Green on fix and Break on bad-fix, with four votes per phase: the Spark 1.3 verifier, deterministic code checks, SAM 3.1 (where the criterion names a visible element) and a Muse Wonder judge.

Scenarios were built by Command Code to a written spec; criteria were written before any run and never changed (`git log -- examples/bench/*/app/criteria.yml`). An AI-free probe (raw mouse clicks, no models) confirms every base is broken, every fix works and every bad-fix is still broken; all ten bad-fix test suites pass.

## Results

Two runs are reported, because the first was hit by Meta Model API outages.

| ID | Bug | Run 1 | Run 2 (re-run of the 6 affected) |
|---|---|---|---|
| B01 | Pay disabled (string comparison) | **PROVEN** | — |
| B02 | Redirect to a 404 after payment | INCONCLUSIVE — API 500 (red, break) | INCONCLUSIVE — API 500 (red), even after stateless fallback |
| B03 | Discount applied twice | **PROVEN** | — |
| B04 | Pay pushed off-screen on desktop | INCONCLUSIVE — API 500 (red) | INCONCLUSIVE — **votes disagree on break** (see below) |
| B05 | Email `pattern` blocks normal addresses | INCONCLUSIVE — API 503 (break) | **PROVEN** |
| B06 | Cookie banner never closes, covers Pay | **PROVEN** | — |
| B07 | Payment posts to a missing endpoint | **PROVEN** | — |
| B08 | Pay invisible (`opacity: 0`) | INCONCLUSIVE — API 500 (red) | **PROVEN** |
| B09 | Third-party chat widget (served from outside the app dir) covers Pay | INCONCLUSIVE — API 500 (break) | **PROVEN** |
| B10 | Total parses to NaN | INCONCLUSIVE — API 500 (break) | **PROVEN** |

**Latest verdict per scenario:**

- Wrong fixes whose own unit tests passed: **10 / 10**
- **PROVEN: 8 / 10**
- Real fix accepted (Green = pass): **10 / 10** in both runs — no false rejections
- Wrong fix certified as working: **0 / 10** — no false passes
- INCONCLUSIVE: 2 / 10 — one API outage (B02), one genuine disagreement (B04)

## What the numbers mean

**"Tests pass" was not evidence in any scenario.** Every wrong fix shipped with passing unit tests; none of them fixed the running app.

**Attest never certified a wrong fix, and never rejected a real one.** When it lacked evidence it said INCONCLUSIVE instead of guessing.

**Run 1's inconclusives were infrastructure, not judgement.** All six were Meta API server errors (HTTP 500, and 503 "persistence service error") on the verifier's follow-up turns; in every one, the other voters agreed on the expected result. This led to two fixes: retries with backoff (1 s / 3 s / 8 s) and a **stateless-replay fallback** that resends the conversation instead of relying on server-side storage. The fallback triggered twice in run 2 and is recorded in the event log.

## B04: the judge prevented a pass on a wrong fix

B04's bug is CSS that pushes the Pay button 2000 px to the right on desktop. The wrong fix only raises its `z-index`, so base and bad-fix have **identical layouts**.

- **Red (base):** the verifier looked, didn't find Pay in 5 steps, and failed it.
- **Break (bad-fix):** the verifier **scrolled sideways for 8 steps, found Pay, clicked it and paid**; the code checks agreed (confirmation URL, `POST /api/pay` 200).
- **Judge:** fail — *"No Pay button is visible in the BEFORE cart … so the required on-screen Pay button is not clearly shown."*

Two honest conclusions:

1. **The verifier was inconsistent** on two identical layouts. A single computer-use agent is not a reliable oracle on its own.
2. **The independent judge caught it.** The votes disagreed, so Attest refused to certify the wrong fix — exactly the case the four-vote design exists for.

Whether B04's bad-fix "works" is genuinely debatable (a determined user can scroll to the button), so B04 is a borderline scenario. The criterion says the user clicks Pay; it doesn't say the button must be visible without scrolling. A sharper criterion (`expect.visible: ["Pay button"]`, checked by SAM on the first screen) would make the intent explicit. It was **not** changed after the run.

## Real-world bug: TodoMVC (2012)

Beyond planted bugs, Attest was run on a **real bug fixed in real history** in a project we didn't write: TodoMVC's vanilla JS example, where deleting a todo took two clicks ([`124b1c9`](https://github.com/tastejs/todomvc/commit/124b1c996171ba14f558ab401da4f986c0ec4239), June 2012, MIT licence). The wrong fix (`==` instead of `===`) is ours. Full details and every run: [examples/realworld/todomvc-delete](../examples/realworld/todomvc-delete/README.md).

| Run | What changed | Verdict |
|---|---|---|
| 1 | — (criterion said "deletes", not "single click") | INCONCLUSIVE — a retry click hid the bug |
| 2 | verifier: judge a single stated action by its first attempt | INCONCLUSIVE — judge saw only before/after |
| 3 | judge sees the whole screenshot sequence | INCONCLUSIVE — judge inconsistent on Break |
| 4 | none | **PROVEN** — all voters agree |

No run certified the wrong fix. The first candidate tried (TodoMVC's 2012 "unclickable Clear completed" fix) does not reproduce in today's browser, so it would be "not reproduced in this environment".

## Closed loop on B09 (Muse Code as the producer)

After removing every `// BUG:` comment and the vendor script's self-describing banner, `attest loop` ran on B09 (the chat widget served from outside the app dir) with only the customer's words. **Muse Code fixed it on the first attempt → PROVEN** (17 model calls). A log audit found no git access to the `fix`/`bad-fix` branches; it diagnosed the cause by reading the vendor script, as a developer would. **Confound:** it also read `scenario.yml` and the benchmark README, which sit in the base branch and name the bug ("chat widget covers Pay"). Attest's proof is unaffected (the verifier never reads code), but this first-try success is partly hinted.

## Limits

- **The benchmark runs above used the verifier and judge as of Nov 1 morning.** Two changes came later from the TodoMVC case — the verifier judges a single stated action by its first attempt, and the judge sees the whole screenshot sequence — so a re-run today may differ.
- **Base branches include scenario metadata** (`scenario.yml`, README) that names each bug. Irrelevant to Attest's blind verifier; strip it before using these scenarios to test agents.
- **Ten scenarios, all in one tiny app style.** This shows the mechanism works; it is not a measure of real-world accuracy.
- **Planted bugs.** Real bugs are messier; a real-world proof is the next step.
- **The verifier is non-deterministic** (B04). Repeat runs and the judge reduce false passes; they don't eliminate them.
- **Base code contains `// BUG:` comments.** Harmless here — the verifier never reads code — but they must be removed before using these scenarios to test agents (e.g. the Muse Code loop).
- **Costs:** check the Meta billing page for the exact spend of both runs before quoting a cost per proof.

## Reproduce

```bash
npm run bench -- build     # create bench/<ID>/{base,bad-fix,fix} branches
npm run bench -- check     # AI-free probe; must exit 0
npm run bench -- run       # live proofs; writes evidence/bench-<id>/results.md
npm run attest -- verify evidence/bench-<id>/<ID>/receipt.json
```

Evidence for the two runs reported above: `evidence/bench-1793402206249/` and `evidence/bench-1793404984909/` (local; `evidence/` is gitignored).
