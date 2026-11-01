# Real-world proof: an AI-assisted fix — California clock-change dates when the 1st is a Sunday

The app: [simonw/tools](https://github.com/simonw/tools) (Apache-2.0 licence) — `california-clock-change.html`, one self-contained page. Credit to its author, Simon Willison.

The bug: [issue #247](https://github.com/simonw/tools/issues/247), the page "generates the wrong date for months that start on a Sunday". The fix: commit [`181166f`](https://github.com/simonw/tools/commit/181166fe79f697569e96f05e44f71d9a652146ff) (PR [#251](https://github.com/simonw/tools/pull/251)) by Simon Willison; **its commit message cites Claude Code sessions, so we label it AI-assisted** — the author is a person, and we don't know how much of the change the assistant wrote.

| Ref | Commit | What it is |
|---|---|---|
| base (Red) | [`92feecd`](https://github.com/simonw/tools/commit/92feecd50241700199cb28f2862edcd346a4dea8) | The fix's parent — has the bug |
| fix (Green) | [`181166f`](https://github.com/simonw/tools/commit/181166fe79f697569e96f05e44f71d9a652146ff) | Treats Sunday as day 7 in both the March and November formulas (plus in-page tests) |
| bad-fix (Break) | local commit on top of base | A plausible wrong fix **we wrote**: only the March formula fixed — the reported example — November left as it was |

**Hand check** (click "Pretend I am in California anyway", read the two dates):

| Tree | Most recent change | Next change |
|---|---|---|
| base | Sunday, March 15, 2026 | Sunday, November 8, 2026 |
| fix | **Sunday, November 1, 2026** | **Sunday, March 14, 2027** |
| bad-fix (ours) | Sunday, March 8, 2026 | Sunday, November 8, 2026 |

**Date-dependent:** the page reads the real clock. The criterion names the dates the fix shows on 1–2 November 2026, and it stays discriminating until the next change in March 2027.

**Found by** a search for small, permissively licensed web apps with a public bug report and a public fix (research agent), then **hand-checked by us** before this commit (Edge, 1280×720, real mouse and keyboard, state read from the page, screenshots compared).

## Runs

Each run is reported here whatever its verdict; a re-run would be numbered and reported too.

| # | Criteria | Change before the run | Red | Green | Break | Verdict | Receipt |
|---|---|---|---|---|---|---|---|
| 1 | `criteria.yml` (frozen in `532408f`, with the wrong fix) | none | fail | pass | fail | **PROVEN** | [proofs/realworld/simonw-tools-251-run1](../../../proofs/realworld/simonw-tools-251-run1/) |

**Run 1, live, first attempt: PROVEN** (run on 2026-11-01, inside the window this criterion is valid for). Red (the PR's parent): *"most recent change as Sunday, March 15, 2026 and next change as Sunday, November 8, 2026."* Green (the fix): *"most recent change as Sunday, November 1, 2026 and next change clocks springing forward on Sunday, March 14, 2027."* Break (ours: only the March formula fixed): *"most recent as Sunday March 8 2026 and next as Saturday November 7 / Sunday November 8 2026."* The March date is now right and November is still wrong, exactly the half-fix. The judge agreed in every phase.

The code checks and SAM had nothing to check (the criterion names no URL, network call or on-screen element) and abstained, so each phase rests on the verifier (Muse Spark 1.3, computer use) and the independent judge (Muse Spark Open on Baseten, screenshots only) agreeing.

**What this shows, and what it doesn't.** The fix shows the right dates in the running page, and Attest rejects a fix that corrects one of the two formulas. The result depends on the date it runs on; re-running after March 2027 needs a new criterion. The wrong fix is ours, labelled, and committed before the run.

## Reproduce

```bash
git fetch --depth 1 https://github.com/simonw/tools 92feecd50241700199cb28f2862edcd346a4dea8:refs/heads/rw/dst251/base
git fetch --depth 1 https://github.com/simonw/tools 181166fe79f697569e96f05e44f71d9a652146ff:refs/heads/rw/dst251/fix
# bad-fix: in base's california-clock-change.html, replace the March line with `const marchDay = new Date(y, 2, 1).getDay() || 7; const springForward = new Date(y, 2, 1 + (14 - marchDay));` and leave the November line; commit it on a new branch rw/dst251/bad-fix.

npm run attest -- prove --app . --config-dir examples/realworld/simonw-dst-sunday \
  --base rw/dst251/base --pr rw/dst251/fix --break rw/dst251/bad-fix
```

`attest.yml` serves the checked-out tree with `serve.cjs` (a dependency-free static server kept here). Nothing is installed from the third-party repo, and the app gets no API keys.
