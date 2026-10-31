# Real-world proof: an AI agent's merged fix in someone else's app

The app: [shizukutanaka/Board](https://github.com/shizukutanaka/Board) (MIT licence, © 2026 shizukutanaka), a single-file whiteboard. We didn't write it; it is a test subject. Credit to its author.

The fix: [shizukutanaka/Board#921](https://github.com/shizukutanaka/Board/pull/921), **written by Devin** (`devin-ai-integration`) and merged on 2026-10-08 — "focused button owns Enter/Space — no canvas double-action".

| Ref | Commit | What it is |
|---|---|---|
| base (Red) | [`d896961`](https://github.com/shizukutanaka/Board/commit/d896961a8262e635d38dfd8174168aca6418a104) | The PR's parent — has the bug |
| fix (Green) | [`f05983d`](https://github.com/shizukutanaka/Board/commit/f05983dd3c1a5a7fab3c93ad9ba21981fb5e48a3) | Devin's fix: one guard line in `index.html` (plus tests and docs) |
| Break | none | No wrong fix exists in the PR's history, so the honest ceiling is `PROVEN_UNCHECKED` |

**The bug, in the PR's words:** with a toolbar button focused, Enter "suppressed the button's native click" while the canvas shortcut ran `createShapeKbd()` — a shape "stamped at view center". So a user who activates a toolbar button from the keyboard gets a shape they never drew.

**The criterion** ([criteria.yml](criteria.yml)) was written from that description and committed **before** any Attest run. It will not be edited after a result; any change would be a new, numbered run reported below.

## Reproduce

Third-party history is fetched locally, not pushed to this repo.

```bash
git fetch --depth 1 https://github.com/shizukutanaka/Board d896961a8262e635d38dfd8174168aca6418a104:refs/heads/rw/board921/base
git fetch --depth 1 https://github.com/shizukutanaka/Board f05983dd3c1a5a7fab3c93ad9ba21981fb5e48a3:refs/heads/rw/board921/fix

npm run attest -- prove --app . --config-dir examples/realworld/board-enter \
  --base rw/board921/base --pr rw/board921/fix
```

`attest.yml` serves the checked-out tree with `serve.cjs` (a dependency-free static server kept here, outside the third-party tree) and opens `/index.html`. Nothing is installed from the third-party repo, and the app gets no API keys (see ARCHITECTURE §12).

## Runs

Every run is reported here in order, whatever its verdict.

| # | Criteria | Change before the run | Red | Green | Verdict | Receipt |
|---|---|---|---|---|---|---|
| 1 | `criteria.yml` (frozen in `a665097`) | none | fail | pass | **PROVEN_UNCHECKED** | [proofs/realworld/board-921-run1](../../../proofs/realworld/board-921-run1/) |

**Run 1, live, first attempt.** Red (the PR's parent): the verifier clicked the Ellipse button and pressed Enter — *"an ellipse shape was created with Shapes 1 and Created toast instead of the canvas staying empty"*. The independent judge (Muse Spark Open), from the screenshots alone: *"Frame 3 shows … 'Created: Ellipse @ 554,279'"* — fail. Green (Devin's fix): *"the Ellipse tool remained selected with Shapes 0 … no shape created"*; the judge agreed — pass. The code checks and SAM had nothing to check (the criterion names no URL, network call or on-screen element), so they abstained (`n/a`).

**What this proves, and what it doesn't.** The bug Devin described is real in the running app, and Devin's merged one-line fix removes it — shown by two Meta models that never saw the code, agreeing. There is no Break: the PR's history has no wrong attempt, and we did not write one, so the verdict is `PROVEN_UNCHECKED` (the fix works; whether Attest would have rejected a wrong fix wasn't tested on this app).

`proofs/realworld/board-921-run1/pr-comment.md` shows the comment Attest would post on the PR. It was **not** posted to the Board repo.

Re-run it without a key from the recorded responses (after the two `git fetch` lines above): add `--replay examples/realworld/board-enter/cassette.jsonl` — a cassette, not a live run.
