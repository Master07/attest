# Real-world proof: Devin's merged fix — the find box drawn over the Help dialog

The app: [shizukutanaka/Board](https://github.com/shizukutanaka/Board) (MIT licence, © 2026 shizukutanaka) — the same single-file whiteboard as the other Board proofs, a different bug. Credit to its author.

The fix: [shizukutanaka/Board#919](https://github.com/shizukutanaka/Board/pull/919), **written by Devin** (`devin-ai-integration`) and merged — "the find box folds before a modal/presentation opens". It merged into another Devin branch (stacked pull requests), not directly into `main`.

| Ref | Commit | What it is |
|---|---|---|
| base (Red) | [`37207f3`](https://github.com/shizukutanaka/Board/commit/37207f3b8c50d13394815b9404886e18fb50bf31) | Parent of the fix commit — has the bug |
| fix (Green) | [`f8a1303`](https://github.com/shizukutanaka/Board/commit/f8a1303a5fe467ef060ee7395617ee7b5dcf9a72) | Devin's fix: a `_foldSq()` helper called before the Help dialog, Share and Present open |
| bad-fix (Break) | local commit on top of the fix | A plausible wrong fix **we wrote** (not Devin, not from the repo), defined below and committed here **before** the run |

**The bug.** The find box (Ctrl+F) has a higher z-index than the modal dialogs, and nothing closed it when a dialog opened. So with the find box open, opening Help draws the "Search" field on top of the Shortcuts dialog.

**The wrong fix (Break).** Devin's change without the call on the Help path: Share and Present fold the find box, Help does not. A developer who fixes the overlays they test and misses one.

**Checked by hand before the run** (Edge, 1280×720, real input: click the canvas, Ctrl+F, click Help, read the page):

| Tree | Find box | Element on top at the find box's centre |
|---|---|---|
| base `37207f3` | shown (`display: block`) — the screenshot shows the Search field over the Shortcuts dialog | the find box |
| fix `f8a1303` | hidden | the Help dialog |
| bad-fix (ours) | shown | the find box |

**The criterion** ([criteria.yml](criteria.yml)) was written from the PR description and committed **before** any Attest run, with the wrong fix.

## Runs

Each run is reported here whatever its verdict; a re-run would be numbered and reported too.

| # | Criteria | Change before the run | Red | Green | Break | Verdict | Receipt |
|---|---|---|---|---|---|---|---|
| 1 | `criteria.yml` (frozen in `ae5ab67`, with the wrong fix) | none | fail | pass | fail | **PROVEN** | [proofs/realworld/board-919-run1](../../../proofs/realworld/board-919-run1/) |

**Run 1, live, first attempt: PROVEN.** Red (the PR's parent): *"Shortcuts dialog opened but the Search field remained visible overlapping the top edge of the dialog."* Green (Devin's fix): *"Shortcuts dialog is displayed centered with no Search field visible on top of it."* Break (ours: no fold on the Help path): *"the Search find box remains visible overlapping the top edge of the dialog."* The judge agreed in every phase.

The code checks and SAM had nothing to check (the criterion names no URL, network call or on-screen element) and abstained, so each phase rests on the verifier (Muse Spark 1.3, computer use) and the independent judge (Muse Spark Open on Baseten, screenshots only) agreeing.

**What this shows, and what it doesn't.** Devin's fix works in the running app for the path the criterion names (Ctrl+F, then Help), and Attest rejects a fix that misses that path. The wrong fix is ours, labelled, and committed before the run.

## Reproduce

```bash
git fetch --depth 1 https://github.com/shizukutanaka/Board 37207f3b8c50d13394815b9404886e18fb50bf31:refs/heads/rw/b919/base
git fetch --depth 1 https://github.com/shizukutanaka/Board f8a1303a5fe467ef060ee7395617ee7b5dcf9a72:refs/heads/rw/b919/fix
# bad-fix: check out rw/b919/fix on a new branch rw/b919/bad-fix; in index.html, in the Help toggle line
# `if(open){if(ptr.down)_cancelPointerGesture();_foldSq();this._captureFocus();...`, delete `_foldSq();`; commit.

npm run attest -- prove --app . --config-dir examples/realworld/board-find-over-help \
  --base rw/b919/base --pr rw/b919/fix --break rw/b919/bad-fix
```

`attest.yml` serves the checked-out tree with `serve.cjs` (a dependency-free static server kept here). Nothing is installed from the third-party repo, and the app gets no API keys.
