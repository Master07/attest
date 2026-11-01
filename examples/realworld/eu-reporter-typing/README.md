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
