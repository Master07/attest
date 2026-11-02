# Held-out benchmark: unfamiliar projects, hidden labels

> **Audience:** judges + devs · **Status:** draft, results pending · **Last updated:** 2026-11-03 · **Related:** [manifest](../examples/heldout/MANIFEST.md) · [run plan 1](../examples/heldout/RUN_PLAN.md) · [run plan 2](../examples/heldout/RUN_PLAN_2.md) · [generated benchmark](BENCHMARK_GENERATED.md) · [receipts](../proofs/heldout/)

**Small, but independent.** Every earlier benchmark was built by the people who built Attest, so we knew which fixes were right. Here an AI selector that took no other part in the evaluation picked the cases and sealed the labels. The criteria were written without seeing any fix, and Attest ran without the labels. The question is the one a reviewer cares about: **how often does Attest accept a fix that is actually wrong?**

## Headline

_Pending: filled in from `scripts/score-heldout.mjs` after both runs finish and the bundle is unsealed._

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
