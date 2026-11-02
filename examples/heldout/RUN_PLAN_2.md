# Held-out run plan, run 2: the same cases at the fixed key map

> **Audience:** reviewers · **Status:** pre-registered at tag `heldout-freeze-2` (2026-11-03, before unsealing) · **Last updated:** 2026-11-03 · **Related:** `RUN_PLAN.md` (run 1), `MANIFEST.md`, `SEALED.sha256`

Run 2 repeats run 1 exactly, with one change to Attest. It is reported **next to run 1, never instead of it**.

## Why there is a run 2

In run 1, C01-A's Red phase passed: the verifier sent the key `ArrowRight` twice, Attest's key map rejected both as
`unknown key`, and the step carried on without them. The screen then looked like the bug was absent, and the verifier
and the judge both passed it. The 156 earlier published proofs show 142 such rejections (mostly `-` and `F5`). This is
a defect in Attest's input handling, not in the case, the criterion or the labels.

## What changed, and nothing else

- **One code change that affects runs:** `toPlaywrightKeys` in `src/browser.ts` now accepts DOM key names
  (`ArrowRight`, `Page_Down`), F1–F12, Insert and any single printable character, adding Shift for US shifted
  characters. Commit `ef0d1d1`. Two other post-freeze commits change only `attest init` and documentation.
- **Unchanged since `heldout-freeze`:** everything under `examples/heldout/` (manifest, seal, harnesses, criteria,
  run plan), the prompts, the judge, the verdict logic, the step cap (25) and the model IDs.
  `git diff heldout-freeze heldout-freeze-2 -- examples/heldout src/models.ts src/verdict.ts src/prompt.ts src/judge.ts src/cua.ts src/proof.ts`
  is empty apart from this file.

## What the runner knew at registration

- No labels, ground-truth tests or candidate diffs. The sealed bundle is still sealed.
- Run 1 had finished four of its 20 runs, and their verdicts were seen: C01-A INCONCLUSIVE, C03-A REJECTED,
  C04-A PROVEN_UNCHECKED, C05-A PROVEN_UNCHECKED. Run 2 covers every included candidate, not a subset chosen from
  these.

## Run set, order and rules

- Candidates: `C01`, `C03`, `C04`, `C05`, `C06`, `C07`, `C09`, `C10`, `C11`, `C12`. `C02` and `C08` (p1/b1) stay
  excluded: no harness was written for them, and adding one now would not be blind to run 1.
- Starts only after run 1's 20 runs finish. Workflow A, then workflow B, ascending ID, one run at a time.
- Commands as in `RUN_PLAN.md`, from a checkout of `heldout-freeze-2`, with `--out proofs/heldout/run-2/<Cnn>-A` or
  `-B`.
- Exclusion rules as in `RUN_PLAN.md`: one re-run only for a Meta API 5xx or outage, published as well; an app that
  fails to start is a published setup failure; nothing else is a reason to re-run.
- Unsealing waits until run 2 has also finished. Both runs are scored against the same sealed labels and reported
  side by side.
