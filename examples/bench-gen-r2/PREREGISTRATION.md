# Generated benchmark, run 2 (checkout only): pre-registration

> **Audience:** judges + team · **Status:** frozen · **Last updated:** 2026-11-01 · **Related:** [run 1 pre-registration](../bench-gen/PREREGISTRATION.md) · [docs/BENCHMARK.md](../../docs/BENCHMARK.md)

This note is committed **before** run 2 starts, while run 1 is still running. Run 1 is not changed, stopped or replaced: it is reported in full, and run 2 is reported next to it.

## Why there is a run 2

Partway through run 1 (36 of 102 scenarios done, 16 PROVEN, 20 INCONCLUSIVE), the receipts showed one cause behind most of the checkout INCONCLUSIVEs, and it is **our mistake in building the benchmark**:

- The checkout app shows a quantity of **9**, but its frozen criterion says **"A cart with one item"**. They have disagreed since the shells were created (`e952f92`).
- The verifier and the code checks voted pass on the real fix anyway; the independent judge (Muse Spark Open) refused, e.g. *"Frame 1 shows Quantity 9 … not the given 'one item' cart"*. Disagreement is never a pass, so those phases came out INCONCLUSIVE. **The judge was right.**
- Neither the agent that built the generator nor our pre-freeze review caught it. The other four apps were checked: their criteria match their pages.

## The one change

`examples/bench-gen-r2/_shells/checkout/app/public/index.html`: the quantity field's default `value="9"` becomes `value="1"`, so the page matches the frozen criterion. **Nothing else changes**: same criteria (the criterion is *not* edited), same recipes, same generator (`scripts/gen-bench.ts` gained only a `--root` option; regenerating run 1's folder with it reproduces run 1's files byte for byte), same verifier, judge, prompts, verdict rules, step limit (25) and `ATTEST_VIDEO=0`.

`diff -r examples/bench-gen examples/bench-gen-r2` (scenarios only) shows exactly 27 changed lines, all this quantity value, all in the 20 checkout scenarios.

**Expected side effect:** the `string-compare` recipe relied on the quantity being 9 (`"9" > "10"` as strings disables Pay). With quantity 1 that bug no longer appears, so the AI-free check should **drop** `G-checkout-string-compare` before the run. Whatever the check drops is listed with its reason, not repaired.

## The run

```
npm run gen-bench -- --root examples/bench-gen-r2      # already done; deterministic
npm run bench -- build --root examples/bench-gen-r2 --prefix bench-gen-r2
npm run bench -- check --root examples/bench-gen-r2 --prefix bench-gen-r2
ATTEST_VIDEO=0 npm run bench -- run --root examples/bench-gen-r2 --prefix bench-gen-r2 --ids <every G-checkout-* scenario the check marks valid>
```

- **Scope:** the 20 checkout scenarios only, minus any the AI-free check drops. The other four apps are not re-run.
- **When:** after run 1 and the queued real-world proofs have finished, so nothing else runs on the machine at the same time.
- **One live run per scenario, sequential.** Only a Meta API 5xx may trigger one re-run, logged.
- **Reporting:** run 1 and run 2 side by side for the checkout scenarios, every verdict, with this note's reason. Run 2 never replaces run 1's numbers.
