# Benchmark

> **Audience:** judges + team · **Status:** draft · **Last updated:** 2026-11-01 · **Related:** [ARCHITECTURE §1, §7](ARCHITECTURE.md) · [examples/bench](../examples/bench/README.md)

Ten planted UI bugs, each in three versions of a tiny checkout app: **base** (the bug), **bad-fix** (a plausible wrong fix whose tests pass) and **fix** (the real fix). Attest runs Red on base, Green on fix and Break on bad-fix, with four votes per phase: the Spark 1.3 verifier, deterministic code checks, SAM 3.1 (where the criterion names a visible element) and a Muse Wonder judge (the judge at the time; it now runs on Muse Spark Open).

Every receipt is committed in [proofs/benchmark](../proofs/benchmark/); `npm run verify-proofs` checks them without a key.

Scenarios were built by Command Code to a written spec; criteria were written before any run and never changed (`git log -- examples/bench/*/app/criteria.yml`). An AI-free probe (raw mouse clicks, no models) confirms every base is broken, every fix works and every bad-fix is still broken; all ten bad-fix test suites pass.

## Results

Two runs are reported, because the first was hit by Meta Model API outages.

| ID | Bug | Wrong fix's test | Run 1 | Run 2 (re-run of the 6 affected) |
|---|---|---|---|---|
| B01 | Pay disabled (string comparison) | unit test of the handler | [**PROVEN**](../proofs/benchmark/run-1/B01/) | — |
| B02 | Redirect to a 404 after payment | unit test of the URL builder | [INCONCLUSIVE](../proofs/benchmark/run-1/B02/) — API 500 (red, break) | [INCONCLUSIVE](../proofs/benchmark/run-2/B02/) — API 500 (red), even after stateless fallback |
| B03 | Discount applied twice | unit test of the pricing function | [**PROVEN**](../proofs/benchmark/run-1/B03/) | — |
| B04 | Pay pushed off-screen on desktop | CSS check (`z-index` present) | [INCONCLUSIVE](../proofs/benchmark/run-1/B04/) — API 500 (red) | [INCONCLUSIVE](../proofs/benchmark/run-2/B04/) — **votes disagree on break** (see below) |
| B05 | Email `pattern` blocks normal addresses | unit test of the validator | [INCONCLUSIVE](../proofs/benchmark/run-1/B05/) — API 503 (break) | [**PROVEN**](../proofs/benchmark/run-2/B05/) |
| B06 | Cookie banner never closes, covers Pay | CSS check (`z-index` present) | [**PROVEN**](../proofs/benchmark/run-1/B06/) | — |
| B07 | Payment posts to a missing endpoint | unit test of the payment client | [**PROVEN**](../proofs/benchmark/run-1/B07/) | — |
| B08 | Pay invisible (`opacity: 0`) | HTML check (`aria-label` present) | [INCONCLUSIVE](../proofs/benchmark/run-1/B08/) — API 500 (red) | [**PROVEN**](../proofs/benchmark/run-2/B08/) |
| B09 | Third-party chat widget (served from outside the app dir) covers Pay | CSS check (`z-index` present) | [INCONCLUSIVE](../proofs/benchmark/run-1/B09/) — API 500 (break) | [**PROVEN**](../proofs/benchmark/run-2/B09/) |
| B10 | Total parses to NaN | unit test of the formatter | [INCONCLUSIVE](../proofs/benchmark/run-1/B10/) — API 500 (break) | [**PROVEN**](../proofs/benchmark/run-2/B10/) |

**Latest verdict per scenario:**

- Wrong fixes whose tests passed: **10 / 10** — 6 behavioural unit tests, 4 source checks (CSS or HTML) on the visual bugs
- **PROVEN: 8 / 10**
- Real fix accepted (Green = pass): **10 / 10** in both runs — no false rejections
- Wrong fix certified as working: **0 / 10** — no false passes
- INCONCLUSIVE: 2 / 10 — one API outage (B02), one genuine disagreement (B04)

## What the numbers mean

**"Tests pass" was not evidence in any scenario.** Every wrong fix shipped with passing tests; none of them fixed the running app. Six are real unit tests of the changed function — they pass because the function is fine and the bug is elsewhere. For the four visual bugs (B04, B06, B08, B09), the test checks the CSS or HTML source, because that is the only test you can write without a browser; it passes while the button stays covered, off-screen or invisible. That is the gap Attest fills, not a strong test it beats.

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

## Real-world: an AI agent's merged fix (shizukutanaka/Board#921)

Found by searching merged pull requests written by AI coding agents (GitHub Copilot's coding agent, Devin) for UI-interaction fixes, then keeping only permissively licensed web apps that run locally without accounts or a backend: of 291 PRs in 237 repos, about 81 repos were permissively licensed and one candidate passed every filter. [Board#921](https://github.com/shizukutanaka/Board/pull/921) (MIT), by Devin: Enter on a focused toolbar button also stamped a shape on the canvas.

The criterion was written from the PR's description and committed before any run. **Run 1, first attempt: PROVEN_UNCHECKED** — Red fail, Green pass, verifier and Muse Spark Open judge agreeing in both phases; no Break, because no wrong fix exists. Receipt: [proofs/realworld/board-921-run1](../proofs/realworld/board-921-run1/); write-up: [examples/realworld/board-enter](../examples/realworld/board-enter/README.md).

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
- **Planted bugs.** Real bugs are messier; the two real-world proofs above (Board, TodoMVC) are single cases, not a measure of accuracy.
- **The verifier is non-deterministic** (B04). Repeat runs and the judge reduce false passes; they don't eliminate them.
- **Scenario metadata names the bug.** The `// BUG:` comments and the vendor banner are gone (branches rebuilt and pushed 2026-11-01), but `scenario.yml` and the benchmark README still sit in each base branch. Harmless for the verifier, which never reads code; an agent under test can read them (see the B09 loop confound above).
- **Costs:** check the Meta billing page for the exact spend of both runs before quoting a cost per proof.

## Reproduce

```bash
npm run bench -- build     # create bench/<ID>/{base,bad-fix,fix} branches
npm run bench -- check     # AI-free probe; must exit 0
npm run bench -- run       # live proofs; writes evidence/bench-<id>/results.md
npm run attest -- verify evidence/bench-<id>/<ID>/receipt.json
```

The two runs reported above are committed as [proofs/benchmark/run-1](../proofs/benchmark/run-1/) and [run-2](../proofs/benchmark/run-2/) (copied unchanged from the local `evidence/` folder); `npm run verify-proofs` checks every receipt.
