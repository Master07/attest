# Validation from Claude — brief for the benchmark

> **For:** Command Code (DeepSeek Flash v1) or any coding agent.
> **Written by:** Claude Code, 2026-11-01, at commit `438c4d7` on `main` (repo at `C:\dev\attest`).
> **Scope:** build a 10-scenario benchmark of planted UI bugs and a script that builds, checks and runs it. Then stop. Claude Code reviews the results and writes them up.

Read [HANDOVER.md](HANDOVER.md) §2–§3 first, then skim [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) §1 (Red/Green/Break). If anything disagrees with this file, **this file wins for the benchmark**.

---

## 1. What the benchmark must show

For each planted bug there are three versions of a tiny app:

| Variant | Role | Requirement |
|---|---|---|
| `base` | Red | Has the bug. A real user cannot complete the task. |
| `bad-fix` | Break | A **plausible** wrong fix that an agent might write. **Its own unit tests pass.** The bug is still there in the running app. |
| `fix` | Green | The real fix. The task works in the running app. |

The headline we want to be able to state honestly:

> *"On N planted bugs, the wrong fix's own unit tests passed N times. Attest rejected the wrong fix M times, accepted the real fix K times, and was inconclusive J times."*

Whatever the numbers turn out to be, they get reported as they are.

## 2. Honesty rules — breaking any of these fails validation

1. **Never tune a scenario to make Attest look good.** Don't change a bug, criteria or fix after seeing Attest's results. If a scenario turns out wrong, record that in HANDOVER.md §9 instead of quietly editing it.
2. **`bad-fix` must be genuinely plausible** — something a reasonable developer or agent would try — and **its unit tests must pass**.
3. **`fix` must really fix it**, and **`base` must really be broken**, as confirmed by the deterministic probe in §6 (no AI involved).
4. **Bugs must be deterministic.** No timing races, randomness or network flakiness: the same variant must give the same probe result every time.
5. Report every result, including Attest's misses and inconclusives.

## 3. Repository rules

1. **Allowed changes only:** new `examples/bench/**`, new `scripts/bench.ts`, `package.json` (add the `"bench"` script only), `.gitignore` (only if needed), `HANDOVER.md` §5 and §9.
2. **Do not modify** anything in `src/`, `test/`, `docs/`, `examples/checkout-demo/`, `examples/checkout-widget/`, or any other file. `scripts/bench.ts` may **import** from `src/` (e.g. `runProof`, `loadConfig`, `startWorkspace`, `launchBrowser`) but must not change it.
3. **Branches:** create and push only `bench/*` branches. Never touch `main`'s history, `demo/*` or `demo2/*`.
4. **No new npm dependencies.** Scenario apps have no dependencies (plain Node `http`, like `checkout-demo`).
5. **No secrets.** `.env` already holds the API key; never print it.
6. **Live API runs:** only `npm run bench -- run` calls the Meta API. Run it **once** at the end, for all 10 scenarios (about $1–2 of credits). Don't loop it.
7. Blocked after two honest attempts → write the blocker in HANDOVER.md §9, commit, push, stop.

## 4. Layout

```
examples/bench/
  README.md                     # what the benchmark is and how to run it
  _shared/                      # optional: copied into each app, never referenced at runtime
  B01-disabled-pay/
    scenario.yml                # see §5
    app/                        # the base app: server.js, package.json, public/, attest.yml, criteria.yml
    bad-fix/                    # files that overwrite app/ to make the bad-fix variant (same relative paths)
    fix/                        # files that overwrite app/ to make the fix variant
  B02-…/
  …
  _cdn/                         # only for B09: the "third-party" script, served from outside the app dir
```

- Each `app/` is a **complete, runnable copy** of a small checkout app in the style of `examples/checkout-demo` (start from a copy of it, **without** its promo-overlay bug). Each reads `PORT` from the environment.
- Each `app/` has its own `attest.yml` (copy checkout-demo's) and `criteria.yml` (§5).
- `bad-fix/` must include the unit test(s) that pass (e.g. `bad-fix/pay.test.js` → `app/pay.test.js`), runnable with `npm test` in the app (`node --test`).

## 5. `scenario.yml`

```yaml
id: B01
title: Pay button stays disabled
category: state            # state | layout | overlay | navigation | network | validation | external
bug_report: "The Pay button is greyed out and I can't click it."
outside_app_dir: false     # true only for B09
probe:                     # deterministic check, run by `bench check` with raw mouse/keyboard (no AI)
  path: /cart
  steps:
    - { wait: 600 }
    - { click: "#pay" }      # click = raw mouse click at the element's centre (never element.click())
    - { wait: 1500 }
  expect:
    url: /order-confirmation # and/or:  text: { selector: "#order-number", equals: "#1042" }
```

Supported steps: `{ wait: ms }`, `{ click: selector }`, `{ fill: selector, text: "…" }` (raw click into the field, then type). `expect` supports `url` (final pathname) and `text` (`selector` + `equals`).

`criteria.yml` in each `app/` states the same requirement in plain language (`given / when / then`) plus `expect` (`url`, `network`, `visible` as in checkout-demo). **Write `criteria.yml` before running anything, and never change it afterwards.**

## 6. The ten scenarios

Each needs: the bug in `app/`, a plausible `bad-fix/` with passing unit tests, and the real `fix/`. Suggested designs — keep each one small:

| ID | Category | Bug in `base` | Plausible `bad-fix` (tests pass, still broken) | Real `fix` |
|---|---|---|---|---|
| B01 | state | `app.js` disables Pay when `total > limit`, comparing strings (`"89.00" > "500"` is true) | Rewrites the click handler + a handler unit test | Compare numbers |
| B02 | navigation | After payment, redirects to `/order-confirm` (typo) → 404 page | Adds a `confirmationUrl()` helper with a test returning the right path, but `app.js` still uses the old literal | `app.js` uses the helper / correct path |
| B03 | state | A 10% code is applied twice, so the total shows $72.09 instead of $80.10; criterion checks the total text | Fixes `pricing.js` (tested), but the page computes the total inline | Page uses `pricing.js` |
| B04 | layout | A CSS media query pushes Pay off-screen at 1280px wide (`margin-left: 2000px`) | Raises Pay's `z-index` + a CSS test | Correct the media query |
| B05 | validation | Email field has an HTML `pattern` that rejects normal addresses, so submit is blocked | Fixes a JS `validateEmail()` util (tested); the `pattern` attribute still blocks | Fix the `pattern` |
| B06 | overlay | Cookie banner's Accept button is wired to the wrong id, so the banner never closes and covers Pay | Raises Pay's `z-index` + test | Wire Accept to the right id |
| B07 | network | `app.js` posts to `/api/payments`; the server only has `/api/pay` → payment error shown | Unit test mocks `fetch`, so it passes | Use `/api/pay` |
| B08 | layout | Pay gets a class with `opacity: 0` after the cart renders, so it is invisible (but clickable) | Adds an `aria-label` + accessibility test | Remove/rename the class |
| B09 | external | Like `checkout-widget`: a chat snippet covers Pay — but the script is served from `examples/bench/_cdn/` (outside the app dir) by the app's server | Raises Pay's `z-index` + test | CSS: `pointer-events: none` on the widget container |
| B10 | state | Total parses `"$89.00"` with `Number()` → `NaN`; label shows "Pay $NaN" and the handler returns early | Adds a `formatPrice()` util with tests | Strip the `$` before parsing |

For B08, the criterion should be one a user cares about: e.g. *then "the Pay button is visible and paying shows an order number"*, with `expect.visible: ["Pay button"]`. Note that the verifier may still click an invisible button — that is a legitimate finding either way; record what happens.

## 7. `scripts/bench.ts` and `npm run bench`

Add to `package.json` scripts: `"bench": "tsx scripts/bench.ts"`.

| Command | What it does | Calls the API? |
|---|---|---|
| `npm run bench -- build` | For each scenario, creates local branches `bench/<ID>/base`, `bench/<ID>/bad-fix`, `bench/<ID>/fix` (§8) | No |
| `npm run bench -- check` | For each scenario and variant: starts the app from its branch (`startWorkspace`), runs the probe with `launchBrowser` + raw `act()` actions, and runs `npm test` in the app for `bad-fix`. Prints one JSON line per variant and a summary. Exit code 1 if any scenario violates §2.3 (base passes, fix fails, or bad-fix probe passes) or bad-fix tests fail | No |
| `npm run bench -- run [--ids B01,B03]` | For each scenario: `runProof({ appPath: "examples/bench/<dir>/app", base, pr: fix, break: bad-fix, outDir: evidence/bench-<ts>/<ID> })`. Writes `evidence/bench-<ts>/results.json` and `results.md` (§9) | Yes |

Run scenarios **sequentially**. Always `close()` browsers and `stop()` workspaces in `finally`.

## 8. Branch construction — important

Each benchmark branch must contain **only that variant's app**, so an agent working on `base` cannot read the answers:

- Start each branch from the current `main` commit in a temporary worktree (`git worktree add --detach …`).
- **Delete every `examples/bench/*/fix/` and `examples/bench/*/bad-fix/` directory** in the worktree (all scenarios, not just this one).
- For `fix` / `bad-fix`: copy that scenario's overlay files over `examples/bench/<dir>/app/` first, then delete the overlay directories.
- Commit (`bench <ID> <variant>`), create the branch, remove the worktree. Re-running `build` must replace existing `bench/*` branches cleanly (delete and recreate).
- Push with `git push -f origin "refs/heads/bench/*:refs/heads/bench/*"` only after `check` passes.

## 9. Results files

`results.json`: one object per scenario — `id`, `category`, `outside_app_dir`, `verdict`, each phase's `result`, each phase's votes (`cua`, `checks`, `sam`, `judge`), `badfix_tests_passed` (from `check`), and the receipt path.

`results.md`: a table with one row per scenario (ID, title, Red, Green, Break, verdict) and these totals:

- wrong fixes whose unit tests passed: x / 10
- Attest verdict `PROVEN`: x / 10
- wrong fix rejected (Break = fail): x / 10
- real fix accepted (Green = pass): x / 10
- inconclusive: x / 10 (list why, from the receipts' reasons)

Don't interpret or editorialise in `results.md` — just the numbers and links. Claude writes the analysis.

## 10. Commits

| Step | Commit message |
|---|---|
| Scenarios B01–B05 | `Add benchmark scenarios B01–B05` |
| Scenarios B06–B10 | `Add benchmark scenarios B06–B10` |
| Script | `Add benchmark build/check/run script` |
| Handover | `Update handover after benchmark` |

Before each commit: `npm run typecheck` and `npm test` (the existing suite must still pass). `evidence/` stays gitignored — results are pasted into HANDOVER.md §9, not committed.

## 11. Self-check before handing back

```bash
npm run typecheck
npm test
npm run bench -- build
npm run bench -- check        # must exit 0
npm run bench -- run          # once, all 10
git status --short
git worktree list
```

Paste into HANDOVER.md §9: the `check` summary, the `results.md` totals verbatim, the evidence folder path, and any scenario you think is flawed (with why). Update §5 with a row for the benchmark. Commit, push `main` and the `bench/*` branches, and **stop**.

## 12. What Claude will check on return

| # | Check |
|---|---|
| 1 | Only allowed paths changed (`git diff --stat 438c4d7..main`); no `src/` or `test/` edits; no new dependencies |
| 2 | 10 scenarios, each with `scenario.yml`, `app/`, `bad-fix/`, `fix/` |
| 3 | `bench/<ID>/base` contains **no** `fix/` or `bad-fix/` directories for any scenario (spot-check with `git ls-tree -r --name-only bench/B03/base`) |
| 4 | `npm run bench -- check` exits 0 on a fresh run: base fails, fix passes, bad-fix fails the probe, bad-fix unit tests pass |
| 5 | Each bad-fix is plausible (read them) and each bug is deterministic |
| 6 | Probe clicks are raw mouse clicks (`act({ type: "click", x, y })`), never element clicks |
| 7 | `criteria.yml` files were not changed after the first `run` (check `git log -- examples/bench/*/app/criteria.yml`) |
| 8 | `results.json` / `results.md` match the receipts; every receipt verifies with `attest verify` |
| 9 | No leftover worktrees, servers or browsers |
| 10 | HANDOVER.md updated with real outputs and any flawed scenarios flagged honestly |
