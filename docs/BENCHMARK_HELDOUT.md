# Held-out benchmark: unfamiliar projects, hidden labels

> **Audience:** judges + devs · **Status:** final for runs 1 and 2 · **Last updated:** 2026-11-03 · **Related:** [manifest](../examples/heldout/MANIFEST.md) · [run plan 1](../examples/heldout/RUN_PLAN.md) · [run plan 2](../examples/heldout/RUN_PLAN_2.md) · [unsealed labels](../examples/heldout/unsealed/) · [generated benchmark](BENCHMARK_GENERATED.md) · [receipts](../proofs/heldout/)

**Small, but independent.** Every earlier benchmark was built by the people who built Attest, so we knew which fixes were right. Here an AI selector that took no other part in the evaluation picked the cases and sealed the labels. The criteria were written without seeing any fix, and Attest ran without the labels. The question is the one a reviewer cares about: **how often does Attest accept a fix that is actually wrong?**

## Headline

**Attest accepted 3 of 5 wrong fixes.** It never rejected a correct one. Each accepted wrong fix breaks only on a path that the bug report names but the criterion doesn't test. In all three, the verifier's observations on the tested path match the app.

| | Run 1 (as frozen) | Run 2 (key map fixed) |
|---|---|---|
| Correct fixes accepted, workflow A | 5/5 | 5/5 |
| Correct fixes PROVEN, workflow B | 3/5 (2 INCONCLUSIVE) | 4/5 (1 INCONCLUSIVE) |
| Correct fixes rejected | **0/10** | **0/10** |
| Wrong fixes rejected | 2/5 | 2/5 |
| **Wrong fixes accepted** | **2/5** (1 INCONCLUSIVE) | **3/5** |

Workflows A and B gave the same accept/reject decision on every wrong fix. Break didn't help here, because each Break build also failed on the tested path.

- **Rejected correctly: C03 and C11.** Each of these wrong fixes fails on the path the criterion tests.
- **Accepted wrongly: C01, C06 and C12.** Each one works on the tested path and fails on another path the report names:

| Candidate | Bug | Criterion tests | Wrong fix fails on (from the sealed ground truth) |
|---|---|---|---|
| C01 | deck.js: arrow keys in fields | Right arrow in the single-line input | Textarea and contenteditable editing |
| C06 | impress.js: substeps one at a time | One Next reveals one point | Previous hides exactly one point |
| C12 | impress.js: shortcuts while typing | Space in an input with no `type` attribute | Other characters and other input types |

  The criteria author flagged exactly these three criteria as "one reported path tested, not every path" in their hand-off, before any run.
- **The lesson is about criteria, not the verifier.** Attest proves what the criterion states. If the criterion covers one path of a multi-path bug, a fix that covers only that path passes. The remedy is one criterion per path the report names. The sealed ground truth says each of the three wrong fixes fails such a path, but we haven't run Attest with those criteria, so we don't claim it would catch them.
- **Run 1 vs run 2:** run 1's key-map bug made p3/b1's Red pass (C01-A/B, C05-B), which turned C01 into INCONCLUSIVE instead of a wrong acceptance. The bug hid a miss rather than causing one. With it fixed, both p3/b1 bugs reproduced in every run.
- **The INCONCLUSIVE correct fix (C07-B, both runs):** the separate Break build passed the criterion, so Attest refused to certify. Like the misses above, that Break build fails only on an untested path: going back with Previous.
- **No outages.** No Meta API 5xx occurred, so nothing was re-run. All 40 receipts verify. Run 1 ran 03:27–04:35 IST and run 2 04:35–05:34 IST on Nov 3.

The full table, one row per candidate, run and workflow, comes from `node scripts/score-heldout.mjs <zip> <labels.json> proofs/heldout/run-1 proofs/heldout/run-2`.

## The cases

- **3 projects** Attest had never used, all MIT: reveal.js, impress.js and deck.js. Each runs as a small local page around the upstream library at a historical commit, with no build step ([manifest](../examples/heldout/MANIFEST.md)).
- **6 historical UI bugs**, each from a real upstream issue or fix commit, and **12 candidate fixes**, numbered in random order. Some are correct, some are plausible wrong fixes; the mix is sealed.
- **A separate wrong fix per bug** for Break (workflow B), which is never one of the candidates.
- **Ground truth:** the selector's own Playwright tests in Microsoft Edge, run on every build, with positive controls. They are independent of Attest. They are sealed with the labels.

## Who knew what

| Role | Agent | Saw | Kept from (by instruction) |
|---|---|---|---|
| Selector | Codex | the cases, the candidate diffs, the labels | Attest's prompts, the criteria |
| Criteria author | Command Code | bug reports, base builds | candidates, Break builds, labels |
| Runner | Claude Code | criteria, refs, Attest's output | labels, ground-truth tests, candidate diffs |

The labels are in a zip outside the repository whose SHA-256 was committed before any run ([`SEALED.sha256`](../examples/heldout/SEALED.sha256)). The scorer refuses to score if the zip doesn't match. The separation between agents is procedural, on one machine, not cryptographic.

## Protocol

- **Frozen before any run:** manifest, seal, harnesses, criteria, run order, step cap (25) and model IDs, at tag [`heldout-freeze`](https://github.com/Master07/attest/tree/heldout-freeze). Both freeze tags were pushed while run 1 was in progress, before unsealing.
- **Two workflows per candidate:** A runs Red and Green only, so the best verdict is PROVEN_UNCHECKED. B adds Break, so the best verdict is PROVEN.
- **Exclusion before the freeze:** the p1/b1 bug (C02, C08) needed a real Shift+`?` keypress, which Attest's key map couldn't send. Both candidates were dropped before any run, with the reason stated.
- **Labels revised once, before any run:** the selector's first ground truth missed some rendered-visibility and native-editing checks. It strengthened the tests, revised the mapping, re-sealed, and kept the old hash in git history.
- **Run 1** used Attest exactly as frozen. **Run 2** ([plan](../examples/heldout/RUN_PLAN_2.md), tag [`heldout-freeze-2`](https://github.com/Master07/attest/tree/heldout-freeze-2)) repeats it with one fix. Run 1 showed that Attest's key map rejected `ArrowRight`, so C01-A's Red phase passed on keys that were never pressed. Run 2 was registered after 4 of run 1's 20 verdicts had been seen, and covers every candidate. Both are reported.
- **Re-runs:** only for a Meta API 5xx or outage, and then published next to the original. Nothing else.

## Limits

- **Small:** 10 candidates in 5 bugs. Treat the numbers as an independent spot check, not an accuracy rate.
- **One domain:** all three are presentation libraries, shown through minimal pages the selector wrote.
- **The ground truth comes from an AI selector**, not a person, and no person has reproduced the cases yet.
- **Each criterion tests one reported path.** For example, the arrow-key bug is checked in a single-line input, not in a textarea. A fix that covers only the tested path can pass.
