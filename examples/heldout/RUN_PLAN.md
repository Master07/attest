# Held-out run plan: workflows A and B

> **Audience:** team (local pre-registration) · **Status:** draft for the freeze, pending `MANIFEST.md` · **Last updated:** 2026-11-03 · **Related:** `MANIFEST.md` (Codex), `SEALED.sha256`, `docs/BENCHMARK_HELDOUT.md`

This file fixes the run procedure **before any result is seen**. It is written without seeing
candidate diffs or labels. Candidate IDs come from `MANIFEST.md`; they are never grouped by
label in this plan or in any output path.

## Scope

- Harnesses live in `examples/heldout/<P>-<bug>/` and are written from the bug report plus the
  base build only.
- Candidates are the IDs listed in `MANIFEST.md`, in ascending ID order (`C01`, `C02`, ...).
- Two workflows, reported separately:
  - **A, no Break:** each candidate in the Green position.
  - **B, full:** the same candidate plus the bug's separate Break build.

## Run order

1. **All of workflow A first**, one candidate at a time, ascending candidate ID.
2. **Then all of workflow B**, same order.
3. One run at a time; no parallel Attest runs; no reordering after any result.

Commands (per candidate, from the repository root):

```bash
# Workflow A
npm run attest -- prove \
  --app examples/heldout/<P>-<bug> \
  --base ho/<P>/<bug>/base \
  --pr ho/<Cnn>/candidate \
  --out proofs/heldout/<Cnn>-A

# Workflow B
npm run attest -- prove \
  --app examples/heldout/<P>-<bug> \
  --base ho/<P>/<bug>/base \
  --pr ho/<Cnn>/candidate \
  --break ho/<P>/<bug>/break \
  --out proofs/heldout/<Cnn>-B

# After each run
npm run attest -- verify proofs/heldout/<Cnn>-A/receipt.json   # or -B
```

`<Cnn>` is the candidate ID from `MANIFEST.md`; `<P>-<bug>` is the harness folder for that
candidate's bug, also from `MANIFEST.md`.

## Step cap and configuration

- `verifier.max_steps: 25` per phase, the same budget as the generated benchmark.
- Viewport 1280x720, `judge: true` in every `attest.yml`.
- `ATTEST_VIDEO` stays at its default (recording on) so each receipt carries phase videos.
- No `ATTEST_ROUTE_*` overrides. If one is ever required, it is recorded in this file before the
  affected run and the run is reported as an override.

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

## Exclusion rules

1. **Meta API 5xx or an outage:** exactly one re-run of the affected run, published as run 2
   alongside run 1.
2. **An app that fails to start:** published as a setup failure. No re-run.
3. **Nothing else is a reason to re-run** — not INCONCLUSIVE, not REJECTED, not a wrong fix that
   passed, not a disagreement between voters, not a missing vote.

## Where results go

- `proofs/heldout/<Cnn>-A/` and `proofs/heldout/<Cnn>-B/` — receipt, event log, screenshots,
  phase videos and the evidence page, exactly as written by `attest prove --out`.
- Per-run `pr-comment.md` is not generated; no comments are posted.
- The write-up (`docs/BENCHMARK_HELDOUT.md`) and the README row are produced by Claude Code after
  every run finishes and the sealed bundle is unsealed.

## Freeze checklist

- [ ] `examples/heldout/MANIFEST.md` committed and merged into the harness branch.
- [ ] Every harness folder present; each base build starts and reproduces its bug by hand.
- [ ] This plan committed, with the model IDs above re-checked against `src/models.ts`.
- [ ] `SEALED.sha256` present and the sealed bundle outside the repository.
- [ ] Tag `heldout-freeze` on the commit that holds all of the above.
