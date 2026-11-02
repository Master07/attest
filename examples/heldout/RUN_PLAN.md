# Held-out run plan: workflows A and B

> **Audience:** team (local pre-registration) · **Status:** draft for the freeze · **Last updated:** 2026-11-03 · **Related:** `MANIFEST.md` (Codex), `SEALED.sha256`, `docs/BENCHMARK_HELDOUT.md`, `HANDOFF_CC.md`

This file fixes the run procedure **before any result is seen**. It was written without seeing
candidate diffs or labels. Candidate IDs come from `MANIFEST.md`; they are never grouped by
label in this plan or in any output path.

## Harnesses and exclusions

Six bugs were selected; **five harnesses are in this branch**. `p1/b1` is excluded, so its two
candidates (`C02`, `C08`) are **not run at all**. Reason (details in `HANDOFF_CC.md`): the base
bug needs a real `Shift` + `/` keypress (`shiftKey: true`), Attest's `keypress` vocabulary accepts
only named keys and single letters/digits (`src/browser.ts`, `toPlaywrightKeys`), and its `type`
action produces `shiftKey: false`. Under Attest the base therefore looks fixed, which could
REJECT a correct candidate.

| Candidate | Bug | Harness |
|---|---|---|
| C01 | p3/b1 | `examples/heldout/p3-b1/` |
| C02 | p1/b1 | **excluded** |
| C03 | p1/b2 | `examples/heldout/p1-b2/` |
| C04 | p2/b2 | `examples/heldout/p2-b2/` |
| C05 | p3/b1 | `examples/heldout/p3-b1/` |
| C06 | p2/b2 | `examples/heldout/p2-b2/` |
| C07 | p1/b2 | `examples/heldout/p1-b2/` |
| C08 | p1/b1 | **excluded** |
| C09 | p3/b2 | `examples/heldout/p3-b2/` |
| C10 | p2/b1 | `examples/heldout/p2-b1/` |
| C11 | p3/b2 | `examples/heldout/p3-b2/` |
| C12 | p2/b1 | `examples/heldout/p2-b1/` |

## Run order

1. **Workflow A first**, one candidate at a time, ascending ID:
   `C01`, `C03`, `C04`, `C05`, `C06`, `C07`, `C09`, `C10`, `C11`, `C12`.
2. **Then workflow B**, same order.
3. One run at a time; no parallel Attest runs; no reordering after any result.
4. Total: 20 runs (10 candidates × 2 workflows). The six excluded runs are not replaced.

## Commands

Per candidate, from the repository root (every harness README also lists its own exact commands):

```bash
# Workflow A, no Break
npm run attest -- prove \
  --app examples/heldout/app \
  --config-dir examples/heldout/<P>-<bug> \
  --base ho/<P>/<bug>/base \
  --pr ho/<Cnn>/candidate \
  --out proofs/heldout/<Cnn>-A

# Workflow B, full
npm run attest -- prove \
  --app examples/heldout/app \
  --config-dir examples/heldout/<P>-<bug> \
  --base ho/<P>/<bug>/base \
  --pr ho/<Cnn>/candidate \
  --break ho/<P>/<bug>/break \
  --out proofs/heldout/<Cnn>-B

# After each run
npm run attest -- verify proofs/heldout/<Cnn>-A/receipt.json   # or -B
```

`<Cnn>` and `<P>-<bug>` come from the table above.

## Step cap and configuration

- `verifier.max_steps: 25` per phase, the same budget as the generated benchmark.
- Viewport 1280x720; `judge: true` in every `attest.yml`.
- `ATTEST_VIDEO` stays at its default (recording on), so each receipt carries phase videos.
- No `ATTEST_ROUTE_*` overrides. If one is ever required, it is recorded here before the
  affected run and that run is reported as an override.

## Models, copied from `src/models.ts`

Values at the time of writing (`src/models.ts` at commit `f94dc45`); re-check and pin them in the
freeze commit.

| Role | Provider | Model ID |
|---|---|---|
| verifier (blind computer use) | meta | `muse-spark-1.3` |
| judge (independent) | baseten | `meta-models/muse-spark-open` (when `BASETEN_API_KEY` is set) |
| judge (fallback) | meta | `muse-wonder-1.0` |
| SAM (only for `expect.visible`) | meta | `sam-3.1` |
| checks | none | deterministic, no model |

No harness uses `expect.url`, `expect.network` or `expect.visible`: the reports do not imply a
URL or network assertion, and the visibility outcomes here are relational (which of several
items is shown), which `expect.visible` cannot express. Code checks and SAM will record `n/a`.

## Exclusion rules

1. **Meta API 5xx or an outage:** exactly one re-run of the affected run, published as run 2
   alongside run 1.
2. **An app that fails to start:** published as a setup failure. No re-run.
3. **Nothing else is a reason to re-run** — not INCONCLUSIVE, not REJECTED, not a wrong fix that
   passed, not a disagreement between voters, not a missing vote.

## Where results go

- `proofs/heldout/<Cnn>-A/` and `proofs/heldout/<Cnn>-B/` — receipt, event log, screenshots,
  phase videos and evidence page, exactly as written by `attest prove --out`.
- No pull-request comments are generated or posted.
- `docs/BENCHMARK_HELDOUT.md` and the README row are produced by Claude Code after every run
  finishes and the sealed bundle is unsealed.

## Freeze checklist

- [ ] `examples/heldout/MANIFEST.md` committed and merged into the harness branch.
- [ ] Five harness folders present; each base build starts and reproduces its bug by hand.
- [ ] `p1/b1` (`C02`, `C08`) excluded, with the reason recorded in `HANDOFF_CC.md`.
- [ ] This plan committed, with the model IDs re-checked against `src/models.ts`.
- [ ] `SEALED.sha256` present and the sealed bundle outside the repository.
- [ ] Tag `heldout-freeze` on the commit that holds all of the above.
