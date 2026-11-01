# Real-world proof: GitHub Copilot's merged fix — eu-reporter's day strip jumps back after each click

The app: [g-koziol/eu-reporter](https://github.com/g-koziol/eu-reporter) (MIT licence, © 2026 Grzegorz Kozioł) — the same static calendar as the [eu-reporter#48 proof](../eu-reporter-typing/README.md), a different bug. Its interface is in Polish. Credit to its author.

The fix: [g-koziol/eu-reporter#54](https://github.com/g-koziol/eu-reporter/pull/54), **written by GitHub Copilot** and merged on 2026-09-29, for [issue #53](https://github.com/g-koziol/eu-reporter/issues/53) "Day navigation section resets after each selection". In the PR's words: "Selecting a day reset the navigation strip to its starting position."

| Ref | Commit | What it is |
|---|---|---|
| base (Red) | [`80a03c0`](https://github.com/g-koziol/eu-reporter/commit/80a03c0ac0864533391d9afd301f5f2ecee08727) | The fix's parent — has the bug |
| fix (Green) | [`227ccfd`](https://github.com/g-koziol/eu-reporter/commit/227ccfd7264b95445798f22a9b78fa71263273dc) | Copilot's fix: highlight the clicked day in place instead of calling `render()` |
| bad-fix (Break) | local commit on top of base | A plausible wrong fix **we wrote**: Copilot's highlight block added, but the old `render()` kept, so the strip is still rebuilt |

**Hand check** (scroll the strip right with the mouse wheel, click the last visible day, 30):

| Tree | Strip scroll before → after the click | Day 30 still visible |
|---|---|---|
| base | 1112 → **0** | no |
| fix | 1112 → 1112 | yes |
| bad-fix (ours) | 1112 → **0** | no |

**Found by** a search for small, permissively licensed web apps with a public bug report and a public fix (research agent), then **hand-checked by us** before this commit (Edge, 1280×720, real mouse and keyboard, state read from the page, screenshots compared).

## Runs

Each run is reported here whatever its verdict; a re-run would be numbered and reported too.

| # | Criteria | Change before the run | Red | Green | Break | Verdict | Receipt |
|---|---|---|---|---|---|---|---|
| 1 | `criteria.yml` (frozen in `532408f`, with the wrong fix) | none | fail | pass | fail | **PROVEN** | [proofs/realworld/eu-reporter-54-run1](../../../proofs/realworld/eu-reporter-54-run1/) |

**Run 1, live, first attempt: PROVEN.** Red (the PR's parent): *"After clicking day 30 the day strip reset to show days 01-16 with day 30 no longer visible."* Green (Copilot's fix): *"day 30 remained visible and selected at the right end of the row."* Break (ours: Copilot's highlight code added, the full re-render kept): *"the day strip reset to show days 01-16 so day 30 was no longer visible, and a repeat click confirmed the same reset."* The judge agreed in every phase, judging the first frame after the click.

The code checks and SAM had nothing to check (the criterion names no URL, network call or on-screen element) and abstained, so each phase rests on the verifier (Muse Spark 1.3, computer use) and the independent judge (Muse Spark Open on Baseten, screenshots only) agreeing.

**What this shows, and what it doesn't.** Copilot's fix keeps the strip in place, and Attest rejects a fix that adds the right-looking highlight code but still rebuilds the strip. The wrong fix is ours, labelled, and committed before the run.

## Reproduce

```bash
git fetch --depth 1 https://github.com/g-koziol/eu-reporter 80a03c0ac0864533391d9afd301f5f2ecee08727:refs/heads/rw/eu54/base
git fetch --depth 1 https://github.com/g-koziol/eu-reporter 227ccfd7264b95445798f22a9b78fa71263273dc:refs/heads/rw/eu54/fix
# bad-fix: in base's index.html, in the [data-day-nav] click handler, insert Copilot's three-line `navStrip.querySelectorAll("[data-day-nav]")…classList.toggle("active", …)` block before the existing `render();`; commit it on a new branch rw/eu54/bad-fix.

npm run attest -- prove --app . --config-dir examples/realworld/eu-reporter-day-strip \
  --base rw/eu54/base --pr rw/eu54/fix --break rw/eu54/bad-fix
```

`attest.yml` serves the checked-out tree with `serve.cjs` (a dependency-free static server kept here). Nothing is installed from the third-party repo, and the app gets no API keys.
