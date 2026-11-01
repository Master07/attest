# Real-world proof: an AI agent's merged fix in someone else's app

The app: [shizukutanaka/Board](https://github.com/shizukutanaka/Board) (MIT licence, © 2026 shizukutanaka), a single-file whiteboard. We didn't write it; it is a test subject. Credit to its author.

The fix: [shizukutanaka/Board#921](https://github.com/shizukutanaka/Board/pull/921), **written by Devin** (`devin-ai-integration`) and merged on 2026-10-08 — "focused button owns Enter/Space — no canvas double-action".

| Ref | Commit | What it is |
|---|---|---|
| base (Red) | [`d896961`](https://github.com/shizukutanaka/Board/commit/d896961a8262e635d38dfd8174168aca6418a104) | The PR's parent — has the bug |
| fix (Green) | [`f05983d`](https://github.com/shizukutanaka/Board/commit/f05983dd3c1a5a7fab3c93ad9ba21981fb5e48a3) | Devin's fix: one guard line in `index.html` (plus tests and docs) |
| Break, run 1 | none | No wrong fix exists in the PR's history, so the honest ceiling is `PROVEN_UNCHECKED` |
| Break, run 2 | local commit on top of base | A plausible half-fix **we wrote** (not Devin, not from the Board repo): Devin's guard in the same place, but for **Space only** — `if(e.target.matches?.('button')&&k===' ')return;`. The PR describes two broken keys; this fixes one. Defined and committed here **before** run 2 |

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

Run 2 adds the Break build. Create it on top of base: in `index.html`, right after the dialog block of the window keydown handler (`if(_dlg&&k!==_ES){ … return; }`, line 5987), insert the two lines below and commit as `rw/board921/bad-fix`; then add `--break rw/board921/bad-fix`.

```js
  // A focused button owns Space — do not arm the temporary hand tool over it.
  if(e.target.matches?.('button')&&k===' ')return;
```

Checked by hand before the run: on this build, Enter on the focused Ellipse button still stamps a shape ("Created: Ellipse @ 231,68").

`attest.yml` serves the checked-out tree with `serve.cjs` (a dependency-free static server kept here, outside the third-party tree) and opens `/index.html`. Nothing is installed from the third-party repo, and the app gets no API keys (see ARCHITECTURE §12).

## Runs

Every run is reported here in order, whatever its verdict.

| # | Criteria | Change before the run | Red | Green | Break | Verdict | Receipt |
|---|---|---|---|---|---|---|---|
| 1 | `criteria.yml` (frozen in `a665097`) | none | fail | pass | — | **PROVEN_UNCHECKED** | [proofs/realworld/board-921-run1](../../../proofs/realworld/board-921-run1/) |
| 2 | same, unchanged | Break added: our Space-only half-fix, defined in `4a53786` before the run | fail | pass | fail | **PROVEN** | [proofs/realworld/board-921-run2](../../../proofs/realworld/board-921-run2/) |

**Run 2, live, first attempt with a Break: PROVEN.** Same frozen criterion; the only change is a Break build — a half-fix *we* wrote, Devin's guard for Space only. Red: *"pressing Enter after clicking the Ellipse tool created a centered ellipse with Shapes 1"*. Green (Devin's fix): *"Ellipse tool is highlighted as selected … Shapes 0, so no shape was created"*. Break (our half-fix): *"an ellipse appeared on the canvas with Shapes 1 instead of staying empty"*. The Muse Spark Open judge agreed in every phase from the screenshots alone. The event log shows the same click (the Ellipse button's icon, at 26,240) followed by Enter in every phase — including Green, where the verifier batched click → wait → Enter → screenshot into one step. So Attest proved Devin's fix works **and** showed it would have rejected a fix that handles only half of the bug.

**What run 2 adds, and what it still doesn't prove.** The wrong fix is ours, labelled as ours, and committed before the run — like TodoMVC's. It shows the verifier can tell Devin's fix from a plausible half-fix on this app; it says nothing about wrong fixes we didn't think of.

<details><summary>Run 1 details (PROVEN_UNCHECKED, no Break)</summary>

**Run 1, live, first attempt.** Red (the PR's parent): the verifier clicked the Ellipse button and pressed Enter — *"an ellipse shape was created with Shapes 1 and Created toast instead of the canvas staying empty"*. The independent judge (Muse Spark Open), from the screenshots alone: *"Frame 3 shows … 'Created: Ellipse @ 554,279'"* — fail. Green (Devin's fix): *"the Ellipse tool remained selected with Shapes 0 … no shape created"*; the judge agreed — pass. The code checks and SAM had nothing to check (the criterion names no URL, network call or on-screen element), so they abstained (`n/a`).

**What this proves, and what it doesn't.** The bug Devin described is real in the running app, and Devin's merged one-line fix removes it — shown by two Meta models that never saw the code, agreeing. There is no Break: the PR's history has no wrong attempt, and we did not write one, so the verdict is `PROVEN_UNCHECKED` (the fix works; whether Attest would have rejected a wrong fix wasn't tested on this app).

**Why Attest didn't generate a wrong fix for Break.** We tried deriving one mechanically — the PR's fix minus one changed hunk — and stopped, because here it can't be meaningful. Only `index.html` runs in the app, and it has two hunks: reverting the guard line gives a build that behaves exactly like the base (and fails the PR's own tests, which pin that guard), so Break would just repeat Red; reverting the version bump gives a build that behaves exactly like the fix, so Break would pass and wrongly suggest the verifier can't tell the difference. Either way a "PROVEN" would add nothing over `PROVEN_UNCHECKED`. The one generated wrong fix that would differ from both — guarding only Space, not Enter — is a code mutation, which is roadmap. That is why run 2 uses that same half-fix **written by hand and labelled as ours**, rather than generated.

</details>

`proofs/realworld/board-921-run{1,2}/pr-comment.md` show the comment Attest would post on the PR. Neither was posted to the Board repo.

Re-run run 2 without a key from the recorded responses (after the `git fetch` lines and creating `rw/board921/bad-fix` as above): add `--break rw/board921/bad-fix --replay examples/realworld/board-enter/cassette.jsonl` — a cassette recorded in run 2, not a live run.
