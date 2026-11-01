# Generated benchmark: pre-registration

> **Audience:** judges + team · **Status:** frozen · **Last updated:** 2026-11-01 · **Related:** [VALIDATION.md](VALIDATION.md) · [SKIPPED.md](SKIPPED.md) · [docs/BENCHMARK.md](../../docs/BENCHMARK.md)

This note is committed **before** any Attest run on the generated scenarios. Its commit timestamp, and the commits before it, record that the shells, criteria, recipes, generator, scenarios and AI-free validation were fixed before any model saw them. Nothing in `examples/bench-gen/` or `scripts/gen-bench.ts` changes after this commit; results are reported against exactly this set.

## What was checked before the freeze

- **Generator output is deterministic:** regenerating twice produced no changes.
- **Criteria were fixed first:** each shell's criterion is unchanged since the commit that added the shells (`e952f92`), and every scenario's copy of it is byte-identical to its shell's.
- **No hints in the apps:** the base apps carry no comments or words describing the planted bug. One nit noted, not changed: an overlay's CSS class is named `.cover`.
- **Independent AI-free check** (`npm run bench -- check --root examples/bench-gen --prefix bench-gen`), re-run separately from the generating agent, matched it exactly: 103 generated, 309 variants, **102 valid, 1 dropped**, wrong-fix tests passing in 102. A scenario is valid when base fails the probe, fix passes, bad-fix fails, and the bad-fix's own test passes.
- **Dropped (not repaired):** `G-signup-strict-pattern`, because its wrong-fix test failed (the test input is mixed case). Two combinations were never generated (see [SKIPPED.md](SKIPPED.md)).
- The 10 hand-written scenarios in `examples/bench/` and their receipts are untouched.

## The run

```
ATTEST_VIDEO=0 npm run bench -- run --root examples/bench-gen --prefix bench-gen --ids <the 102 ids below>
```

- **One live run per scenario**, sequential, on local `bench-gen/*` branches (not pushed). Video recording is off for this run (`ATTEST_VIDEO=0`); screenshots, event logs and signed receipts are kept.
- **Re-runs:** only a scenario that failed with a Meta API 5xx may run once more, and every re-run is logged. No re-run for a disagreement, an INCONCLUSIVE, a miss or any other error.
- **Voters:** Muse Spark 1.3 verifier (computer use), deterministic code checks, SAM 3.1 where the criterion names a visible element, and a Muse Spark Open judge (Baseten). The older 10 scenarios used a Muse Wonder judge; the two sets are reported separately and never pooled.
- **Spend cap $30.** If the cap or repeated 5xx errors stop the run early, the scenarios that ran are reported and the rest are listed as not run.
- **Reporting:** every scenario's verdict, per shell, per recipe and per class; every INCONCLUSIVE, false pass and false reject named. Wording: "generated planted bugs", never real-world accuracy. Reported separately from the hand-written scenarios and the real-world proofs.

## The 102 scenarios to run

- `G-checkout-bad-redirect`
- `G-checkout-clipped`
- `G-checkout-delayed-enable`
- `G-checkout-double-apply`
- `G-checkout-fixed-banner`
- `G-checkout-hidden-required`
- `G-checkout-invisible`
- `G-checkout-late-overlay`
- `G-checkout-nan`
- `G-checkout-navigate-early`
- `G-checkout-no-pointer`
- `G-checkout-offscreen`
- `G-checkout-prevent-default`
- `G-checkout-stale-render`
- `G-checkout-string-compare`
- `G-checkout-transparent-overlay`
- `G-checkout-wrong-element`
- `G-checkout-wrong-endpoint`
- `G-checkout-wrong-method`
- `G-checkout-zero-size`
- `G-search-bad-redirect`
- `G-search-clipped`
- `G-search-delayed-enable`
- `G-search-double-apply`
- `G-search-fixed-banner`
- `G-search-hidden-required`
- `G-search-invisible`
- `G-search-late-overlay`
- `G-search-nan`
- `G-search-navigate-early`
- `G-search-no-pointer`
- `G-search-offscreen`
- `G-search-prevent-default`
- `G-search-stale-render`
- `G-search-strict-pattern`
- `G-search-string-compare`
- `G-search-transparent-overlay`
- `G-search-wrong-element`
- `G-search-wrong-endpoint`
- `G-search-wrong-method`
- `G-search-zero-size`
- `G-settings-bad-redirect`
- `G-settings-clipped`
- `G-settings-delayed-enable`
- `G-settings-double-apply`
- `G-settings-fixed-banner`
- `G-settings-hidden-required`
- `G-settings-invisible`
- `G-settings-late-overlay`
- `G-settings-nan`
- `G-settings-navigate-early`
- `G-settings-no-pointer`
- `G-settings-offscreen`
- `G-settings-prevent-default`
- `G-settings-stale-render`
- `G-settings-string-compare`
- `G-settings-transparent-overlay`
- `G-settings-wrong-element`
- `G-settings-wrong-endpoint`
- `G-settings-wrong-method`
- `G-settings-zero-size`
- `G-signup-bad-redirect`
- `G-signup-clipped`
- `G-signup-delayed-enable`
- `G-signup-double-apply`
- `G-signup-fixed-banner`
- `G-signup-hidden-required`
- `G-signup-invisible`
- `G-signup-late-overlay`
- `G-signup-nan`
- `G-signup-navigate-early`
- `G-signup-no-pointer`
- `G-signup-offscreen`
- `G-signup-prevent-default`
- `G-signup-stale-render`
- `G-signup-string-compare`
- `G-signup-transparent-overlay`
- `G-signup-wrong-element`
- `G-signup-wrong-endpoint`
- `G-signup-wrong-method`
- `G-signup-zero-size`
- `G-todo-bad-redirect`
- `G-todo-clipped`
- `G-todo-delayed-enable`
- `G-todo-double-apply`
- `G-todo-fixed-banner`
- `G-todo-hidden-required`
- `G-todo-invisible`
- `G-todo-late-overlay`
- `G-todo-nan`
- `G-todo-navigate-early`
- `G-todo-no-pointer`
- `G-todo-offscreen`
- `G-todo-prevent-default`
- `G-todo-stale-render`
- `G-todo-strict-pattern`
- `G-todo-string-compare`
- `G-todo-transparent-overlay`
- `G-todo-wrong-element`
- `G-todo-wrong-endpoint`
- `G-todo-wrong-method`
- `G-todo-zero-size`
