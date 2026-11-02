# Real-world proof: GitHub Copilot's merged fix for typing in eu-reporter

The app: [g-koziol/eu-reporter](https://github.com/g-koziol/eu-reporter) (MIT licence, © 2026 Grzegorz Koziol) — a static work-report calendar (`index.html` plus a few `src/*.js` modules, no build, no account). Its interface is in Polish. Credit to its author.

The fix: [g-koziol/eu-reporter#48](https://github.com/g-koziol/eu-reporter/pull/48), **written by GitHub Copilot** (`copilot-swe-agent`) and merged on 2026-09-27 — "Fix focus loss while typing in editable fields". Found by a search of merged AI-agent pull requests.

| Ref | Commit | What it is |
|---|---|---|
| base (Red) | [`eab1c90`](https://github.com/g-koziol/eu-reporter/commit/eab1c90de8cccb4a911ccd3d3c0f668d7b9649e4) | The PR's parent — has the bug |
| fix (Green) | [`ddb2596`](https://github.com/g-koziol/eu-reporter/commit/ddb2596f5f8fd24c1a596151b6a29342df9adad1) | Copilot's fix: one file, `index.html`. (The PR's other commit, "Initial plan", changes no files.) |
| bad-fix (Break) | local commit on top of the fix | A plausible wrong fix **we wrote** (not Copilot, not from the repo), defined below and committed here **before** the run |

**The bug.** Every text field in a day's card saves on each keystroke and then calls `render()`, which rebuilds the whole calendar. The field being typed in is replaced by a new one, so focus drops to the page after the first character. Copilot's fix calls `updateStats()` instead of `render()` in those listeners (and stops re-rendering on the settings page's fields).

**The wrong fix (Break).** Copilot's whole change except its first hunk: the custom day fields (`[data-day-field]`), the collaboration fields and the settings page are fixed, but the built-in day fields (`[data-field]`, which include "Obszar działania") still call `render()`. A developer who fixes the listeners they find and misses one.

**Checked by hand before the run** (Edge, 1280×720, real input: scroll to the first day's "Obszar działania" text area, click it, type `abcd`, read the page):

| Tree | Text area shows | Focus |
|---|---|---|
| base `eab1c90` | `a` | the page body |
| fix `ddb2596` | `abcd` | the same text area |
| bad-fix (ours) | `a` | the page body |

**The criterion** ([criteria.yml](criteria.yml)) was written from the PR description and committed **before** any Attest run, with the wrong fix. The label is quoted as shown on screen, with an English gloss.

## Runs

Each run is reported here whatever its verdict; a re-run would be numbered and reported too.

| # | Criteria | Change before the run | Red | Green | Break | Verdict | Receipt |
|---|---|---|---|---|---|---|---|
| 1 | `criteria.yml` (frozen in `e95e2bd`, with the wrong fix) | none | fail | pass | fail | **PROVEN** | [proofs/realworld/eu-reporter-48-run1](../../../proofs/realworld/eu-reporter-48-run1/) |

**Run 1, live, first attempt: PROVEN.** Red (the PR's parent): *"After clicking the Obszar dzialania textarea for the first day and typing abcd, it shows only a with a thin unfocused border."* Green (Copilot's fix): *"The Obszar dzialania text area shows abcd with a focused black border."* Break (our wrong fix, the `[data-field]` listener left as it was): *"it showed only 'a' and lost the focus outline."* The judge agreed in every phase. In Green and Break the click hit-test log shows the click landed on the `textarea` itself.

The code checks and SAM had nothing to check (the criterion names no URL, network call or on-screen element) and abstained, so each phase rests on the verifier (Muse Spark 1.3, computer use) and the independent judge (Muse Spark Open on Baseten, screenshots only) agreeing.

**What this shows, and what it doesn't.** Copilot's fix keeps focus and text while typing in the running app, and Attest tells it apart from a fix that misses one of the listeners. The wrong fix is ours, labelled, and committed before the run; the run says nothing about wrong fixes we didn't think of.

### Exploratory run (not pre-registered)

Earlier the same day, before this criterion was frozen, a separate agent ran the same PR with a differently worded criterion ([exploratory/criteria.yml](exploratory/criteria.yml): scroll to the first day and type abcd into "Obszar działania"; the field shows abcd and keeps focus). It used no wrong fix. That criterion was committed only after the run.

| Run | Red | Green | Break | Verdict | Receipt |
|---|---|---|---|---|---|
| exploratory | fail | pass | — | **PROVEN_UNCHECKED** | [proofs/realworld/eu-reporter-48-exploratory](../../../proofs/realworld/eu-reporter-48-exploratory/) |

Red: *"After typing abcd the Obszar działania field showed only a with unfocused border, and a repeat attempt showed the same."* Green: *"The Obszar dzialania textarea shows abcd with a focused black border after typing."* The judge agreed in both phases. Reproduce it with `--config-dir examples/realworld/eu-reporter-typing/exploratory` and no `--break`.

## Reproduce

```bash
git fetch --depth 1 https://github.com/g-koziol/eu-reporter eab1c90de8cccb4a911ccd3d3c0f668d7b9649e4:refs/heads/rw/eu48/base
git fetch --depth 1 https://github.com/g-koziol/eu-reporter ddb2596f5f8fd24c1a596151b6a29342df9adad1:refs/heads/rw/eu48/fix
# bad-fix: check out rw/eu48/fix on a new branch rw/eu48/bad-fix; in index.html, in the [data-field] input
# listener (the one ending `setDayField(day, field, input.value); } day.collapsed = false; saveDb();`),
# change `updateStats();` back to `render();`; commit.

npm run attest -- prove --app . --config-dir examples/realworld/eu-reporter-typing \
  --base rw/eu48/base --pr rw/eu48/fix --break rw/eu48/bad-fix
```

`attest.yml` serves the checked-out tree with `serve.cjs` (a dependency-free static server kept here). Nothing is installed from the third-party repo, and the app gets no API keys.
