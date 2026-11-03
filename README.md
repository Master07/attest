# Attest — proof-of-fix for AI pull requests

[![verify](https://github.com/Master07/attest/actions/workflows/verify.yml/badge.svg)](https://github.com/Master07/attest/actions/workflows/verify.yml) <sub>Every push re-checks the types, the tests and all 220 committed receipts on Windows, macOS and Linux, with no keys and no model calls.</sub>

A verifier that never sees the code reproduces the bug, confirms the fix in the running app, shows it would reject a wrong fix, and seals it all into a receipt anyone can check.

**▶ [Demo video (2:40)](https://youtu.be/P0roiXTdXa8)** · recorded evidence from the receipts in this repo, synthetic voice, captions burned in.

*Built entirely during the **Meta Global AI Hackathon 2026** (the Meta Global AI Developer Hackathon, Oct 26 – Nov 4, 2026) · Indie track · Push the Frontier.* <sub>Design docs were written Oct 26–30; git was set up on Oct 31, so the first commit contains them.</sub>

![SAM 3.1 finds the Pay button; the click actually landed on an invisible chat-widget container](docs/assets/sam-reveal.png)

<sub>A real run ([receipt](proofs/pr-1-live/)). The wrong fix's test passed — it checks the CSS, not the click; Attest drove the app and found why paying still fails: SAM 3.1 locates the Pay button (green), but the click lands on an invisible 440×560 container from a third-party chat widget (red).</sub>

## The problem

AI agents now write pull requests faster than anyone can review them, and a green test suite isn't proof: even from a detailed specification, frontier agents' tests catch **fewer than 55% of logical mutants** (TestSuiteBench, Oct 2026 — [summary by a co-author](https://x.com/nielstron/status/2109651666790445209)). UI bugs are worse: a test without a browser can check the code, not what the user sees, so in CI a fix that works and a fix that doesn't look the same.

The reviewer's real question — *does this actually fix the bug?* — still means pulling the branch, starting the app and clicking through it. That is the step that gets skipped.

**Attest does that step and leaves evidence either way.** If the fix works, the reviewer gets a proof instead of a manual QA session; if it doesn't, they get the screenshot of where the click actually landed. Who wrote the fix doesn't matter — a coding agent, a person, or Muse Code in Attest's own loop.

<sub>Honest note: in our runs Muse Code fixed every demo bug on the first try. The wrong fixes in the Break phase are ones we wrote, so that it has something to catch. Board#913 below is different: a real AI-written change that Attest rejected.</sub>

## What Attest does

A person approves one plain-language requirement (*given a cart, when the user clicks Pay, then the order confirmation shows an order number*). Attest then runs three experiments on the **running app**:

| Phase | Build | Must show |
|---|---|---|
| **Red** | Original code | The bug really happens |
| **Green** | The fix | It now works |
| **Break** | A wrong fix | Attest rejects it — otherwise its "yes" means nothing |

Each phase gets **up to four independent votes**, and disagreement is never a pass:

1. **Muse Spark 1.3** drives a real browser with computer use. It is **blind**: it never sees the code, diff or the producing agent's reasoning.
2. **Code checks** — the final URL and network calls, no AI involved.
3. **SAM 3.1** — is the element visible, and did the click actually reach it?
4. **A Muse Spark Open judge** (open weights, on Baseten) — sees only the requirement and the screenshots in order — no actions, no code.

Code checks and SAM vote only when the criterion names a URL, a network call or a visible element; otherwise they record `n/a`. On the real-world proofs below they don't apply, so those verdicts rest on **two Meta models agreeing** (Spark 1.3 and Spark Open). All four vote only where the criterion names a visible element: on the demo PR ([receipt](proofs/pr-1-live/)) and, in the [10-bug planted benchmark](docs/BENCHMARK.md), on B08 and B09 (12 of its 48 criterion results). SAM never applies in the generated benchmark.

Everything — votes, screenshots, a hash-chained event log — is sealed into a **signed receipt** plus an evidence page. `attest verify` checks it without calling any model, and rejects any edit made after sealing. The signature shows the receipt wasn't changed; it doesn't prove who ran the proof (the key is created on the machine that ran it). Every result below is a committed receipt: `npm run verify-proofs` checks all of them ([proofs/](proofs/)).

![The evidence page for the PROVEN receipt on Devin's Board#921 fix: verdict, three phases as expected, integrity panel](docs/assets/evidence-page.png)

## Results

> **Held-out, with labels sealed by a separate AI selector:** as pre-registered, Attest accepted **3 of 5** wrong fixes, each broken only on a path its criterion didn't test. With one criterion per path the bug report names, it rejected **all 5**. No correct fix was rejected in any run. The second result comes from run 3, which is exploratory: its criteria were written after unsealing. [Details](#held-out-with-hidden-labels) · [write-up](docs/BENCHMARK_HELDOUT.md) · [all 220 receipts, live dashboard](https://master07.github.io/attest/proofs/)

**On real, merged pull requests in other people's apps**, each criterion committed before its run, live, the verifier and the open-weights judge agreeing in every phase, neither seeing the code. The bugs and the fixes are real; **every wrong fix (Break) is one we wrote**. Every run is reported, first attempt included:

| Fix (licence) | Written by | Verdict | Receipt · write-up |
|---|---|---|---|
| [shizukutanaka/Board#913](https://github.com/shizukutanaka/Board/pull/913) (MIT) | **Devin** | **REJECTED**: Escape closed the find box *before* this change and no longer does after it | [receipt](proofs/realworld/board-913-run1/) · [write-up](examples/realworld/board-find-esc/README.md) |
| [shizukutanaka/Board#914](https://github.com/shizukutanaka/Board/pull/914) (MIT), the follow-up | **Devin** | **PROVEN_UNCHECKED** (no wrong fix exists for it, so Break was left out) | [receipt](proofs/realworld/board-914-run1/) · same |
| [pankosmia/roadmap#361](https://github.com/pankosmia/roadmap/pull/361) (MIT) | **GitHub Copilot** | **PROVEN** | [receipt](proofs/realworld/roadmap-361-run1/) · [write-up](examples/realworld/roadmap-pulls/README.md) |
| [g-koziol/eu-reporter#48](https://github.com/g-koziol/eu-reporter/pull/48) (MIT) | **GitHub Copilot** | **PROVEN** | [receipt](proofs/realworld/eu-reporter-48-run1/) · [write-up](examples/realworld/eu-reporter-typing/README.md) |
| [g-koziol/eu-reporter#54](https://github.com/g-koziol/eu-reporter/pull/54) (MIT) | **GitHub Copilot** | **PROVEN** | [receipt](proofs/realworld/eu-reporter-54-run1/) · [write-up](examples/realworld/eu-reporter-day-strip/README.md) |
| [kq4cin/cheshy-mess#4](https://github.com/kq4cin/cheshy-mess/pull/4) (MIT) | **GitHub Copilot** | **PROVEN** | [receipt](proofs/realworld/cheshy-4-run1/) · [write-up](examples/realworld/cheshy-typing/README.md) |
| [shizukutanaka/Board#919](https://github.com/shizukutanaka/Board/pull/919) (MIT) | **Devin** | **PROVEN** | [receipt](proofs/realworld/board-919-run1/) · [write-up](examples/realworld/board-find-over-help/README.md) |
| [shizukutanaka/Board#921](https://github.com/shizukutanaka/Board/pull/921) (MIT) | **Devin** | run 1 **PROVEN_UNCHECKED** (no wrong fix supplied), run 2 **PROVEN** | [run 1](proofs/realworld/board-921-run1/) · [run 2](proofs/realworld/board-921-run2/) · [write-up](examples/realworld/board-enter/README.md) |
| [shizukutanaka/Board#918](https://github.com/shizukutanaka/Board/pull/918) (MIT) | **Devin** | run 1 **INCONCLUSIVE**, run 2 PROVEN (verifier only), run 3 **PROVEN** | [release download](https://github.com/Master07/attest/releases/tag/proofs-board918-2026-11-01) · [write-up](examples/realworld/board-focus-trap/README.md) |
| [simonw/tools#251](https://github.com/simonw/tools/pull/251) (Apache-2.0) | AI-assisted (its commit credits Claude Code) | **PROVEN** | [receipt](proofs/realworld/simonw-tools-251-run1/) · [write-up](examples/realworld/simonw-dst-sunday/README.md) |
| *Fixed by people:* [1j01/jspaint](https://github.com/1j01/jspaint) issue [#311](https://github.com/1j01/jspaint/issues/311), fix [`98bc205`](https://github.com/1j01/jspaint/commit/98bc20554d97b82f2eae8ee2ad0cea3a7783503f) (MIT) | the maintainer | **PROVEN** | [receipt](proofs/realworld/jspaint-311-run1/) · [write-up](examples/realworld/jspaint-radio-circle/README.md) |
| *Fixed by people:* [janavipandole/Cara#2677](https://github.com/janavipandole/Cara/pull/2677) (MIT) | a contributor | **PROVEN** | [receipt](proofs/realworld/cara-2677-run1/) · [write-up](examples/realworld/cara-theme-toggle/README.md) |

Every criterion was committed before its first run. For the nine runs of Nov 2 (Board#913, #914, #919, eu-reporter#48, #54, cheshy-mess#4, simonw/tools#251, jspaint, Cara) the expected verdict was committed too, and all nine came out as expected on the first attempt. Code checks and SAM abstain on these (the criteria name no URL, request or element), so each verdict rests on two Meta models agreeing. Twelve fixes in seven apps are not a measure of accuracy; they show what a reviewer gets.

**Exploratory runs, not pre-registered** (each criterion written before its run but committed after it), reported separately: [hypenosys](examples/realworld/hypenosys-lightbox/README.md), where the wrong fix Attest rejected is **a real merged fix by Google's Jules** that didn't open the lightbox, run on a page with an injected card and stand-in CSS because the app needs a GitHub login (PROVEN); [jspaint #313](examples/realworld/jspaint-attributes-focus/README.md), a maintainer's fix (PROVEN in two live runs and a replay); [list.js](examples/realworld/listjs-clear/README.md), a 2014 fix by its author, run on a page we wrote (PROVEN_UNCHECKED); and an [earlier eu-reporter#48 run](examples/realworld/eu-reporter-typing/README.md#exploratory-run-not-pre-registered) (PROVEN_UNCHECKED).

**The REJECTED one matters most.** Devin's Board#913 said Escape left the find box open. In a real browser it already closed; after #913 it didn't. The verifier: *"A single Escape press cleared 'rect' to the Search placeholder but the find box remained visible."* The judge agreed from the screenshots alone. Devin's own follow-up, #914, repaired it, and Attest proved that one with the same frozen criterion.

Details on three of them:

- [pankosmia/roadmap#361](https://github.com/pankosmia/roadmap/pull/361) (MIT), written by **GitHub Copilot**, fixed a "Pull requests" button that did nothing. Attest reproduced the dead button on the PR's parent, showed Copilot's fix opens the dialog, and rejected a wrong fix (**ours**) that silences the console error but leaves the button dead ([receipt](proofs/realworld/roadmap-361-run1/) · [write-up](examples/realworld/roadmap-pulls/README.md)).
- [shizukutanaka/Board#921](https://github.com/shizukutanaka/Board/pull/921) (MIT), written by **Devin**, fixed "Enter on a focused toolbar button also stamps a shape". Attest reproduced it on the PR's parent, showed Devin's fix removes it, and rejected a half-fix (Space only, **ours**) ([receipt](proofs/realworld/board-921-run2/) · [write-up](examples/realworld/board-enter/README.md)). An earlier run without a wrong fix gave the honest PROVEN_UNCHECKED ([receipt](proofs/realworld/board-921-run1/)).
- [shizukutanaka/Board#918](https://github.com/shizukutanaka/Board/pull/918) (MIT), **Devin**'s keyboard fix: Tab past the Share dialog's last control no longer leaves the dialog. **PROVEN on run 3**, verifier and judge agreeing — after run 1 came out **INCONCLUSIVE** (the judge saw 8 of 19 frames and missed the one where focus left the dialog; the votes disagreed, so nothing was certified) and run 2 rested on the verifier alone (the judge's provider rejected more than 8 images). The fix: the judge now sees every frame as labelled contact sheets. All three runs are reported ([write-up](examples/realworld/board-focus-trap/README.md) · [receipts, release download](https://github.com/Master07/attest/releases/tag/proofs-board918-2026-11-01)).

They were found by searching merged pull requests for fixes in permissively licensed web apps that run locally without accounts or a backend; few qualify (the first search: 4 of 981 AI-agent PRs in 598 repos). We also looked for a merged AI fix that did **not** work. The first one found was in a repository with no licence, so we did not use it; Board#913 then turned out to be one, and Attest rejected it. The two fixes by people are labelled as such.

**As a pull-request comment:** on our own demo PR [Master07/attest#1](https://github.com/Master07/attest/pull/1), Attest proved the fix live, rejected a wrong fix, and posted the proof as a comment ([receipt](proofs/pr-1-live/)).

On a [benchmark of 10 planted UI bugs](docs/BENCHMARK.md), each with a plausible wrong fix ([receipts](proofs/benchmark/)):

- **Every wrong fix came with a passing check:** 6 with behavioural unit tests; for the 4 visual bugs (covered, off-screen or invisible button), a source check on the CSS or HTML — not a behavioural test, but the kind of check you can write without a browser, which is exactly why it passes while the button stays covered.
- **8 / 10** real fixes **PROVEN**; the other 2 INCONCLUSIVE (one Meta API outage, one disagreement between voters).
- **0** wrong fixes certified as working. **0** real fixes rejected.
- When one verifier run scrolled its way to a pass on a wrong fix, the independent judge disagreed and Attest refused to certify it ([B04 receipt](proofs/benchmark/run-2/B04/)).

Ten planted bugs show the mechanism works; they are not a measure of real-world accuracy.

**A larger, pre-registered benchmark: 102 generated planted bugs** in five small apps, each with a real fix and a wrong fix that comes with a passing check, frozen and checked without AI before any model ran ([write-up](docs/BENCHMARK_GENERATED.md) · [receipts](proofs/bench-gen/)):

- **Run 1: 55 PROVEN, 47 INCONCLUSIVE, 0 REJECTED.** No real fix was rejected and **no wrong fix was certified**. Of the 47 wrong fixes that came with a passing behavioural test, Attest certified none. Here each wrong fix sits in the Break position, where passing blocks PROVEN by design, so this is not a measured false-pass rate on candidate fixes; the held-out set below tests wrong fixes as the candidate.
- **Every INCONCLUSIVE is listed with its reason.** 10 were our own mistake: the checkout page showed quantity 9 against a criterion saying "one item", and the judge rightly refused. The weak spot is layout bugs (clipped, off-screen, invisible or zero-size controls): 3 of 25 PROVEN. On those, Attest refused to certify rather than pass a wrong fix.
- **Run 2**, pre-registered with only the quantity fixed, re-ran checkout: **17 of 19 PROVEN** (run 1: 8 of 20). Both runs are reported.

<a id="held-out-with-hidden-labels"></a>**Held-out, with hidden labels: as pre-registered, Attest accepted 3 of 5 wrong fixes. With one criterion per reported path, it rejected all 5.** An AI selector picked 10 candidate fixes for 5 historical bugs in reveal.js, impress.js and deck.js, and sealed which were correct. The criteria were written without seeing any fix, and everything was frozen before the first run ([write-up](docs/BENCHMARK_HELDOUT.md) · [receipts](proofs/heldout/)):

- **0 of 5 correct fixes rejected**, in every run and both workflows.
- **Run 1: 2 wrong fixes accepted, 1 INCONCLUSIVE, 2 rejected. Run 2: 3 accepted, 2 rejected.** Each accepted wrong fix works on the one path its criterion tests and fails on another path the bug report names. Attest proves what the criterion says; a criterion that covers one path of a multi-path bug lets a partial fix through. The criteria author had flagged exactly these three as single-path before any run.
- **Run 3 (exploratory, after unsealing): one criterion per path the report names.** On the same builds, Attest rejected all 5 wrong fixes, and still no correct fix. More criteria cost decisive verdicts: 4 of 10 correct-fix receipts were INCONCLUSIVE, from Meta API errors and a step cap sized for one criterion. One outage re-run turned PROVEN.
- The run also found a bug in Attest: its key map dropped `ArrowRight`, so a phase could pass on keys never pressed. It's fixed, and run 2 re-ran everything at the fix, pre-registered before unsealing.

**A real bug, too:** Attest proved TodoMVC's real 2012 fix for "deleting a todo takes two clicks" — in a project we didn't write — after four honestly reported runs: an ambiguous requirement and two blind spots in Attest (a retry hiding the bug, a judge that saw only the final frame) surfaced and were fixed, and no run certified the wrong fix. [Every run →](examples/realworld/todomvc-delete/README.md) · [signed receipt (release download)](examples/realworld/todomvc-delete/README.md#check-the-receipt)

## Try it — no API key needed

Requires Node 22+ and git; step 2 also needs Microsoft Edge or Chrome (`ATTEST_BROWSER_CHANNEL=chrome` for Chrome).

**1. Check the proofs — seconds, no key, no model calls.** Every result above is a signed receipt committed in [proofs/](proofs/), from a **live** run except the one jspaint replay, which is labelled as one (TodoMVC's, at 101 MB, is a release download). This checks each signature, hash chain, screenshot and video, and recomputes each verdict from the recorded votes:

```bash
git clone https://github.com/Master07/attest.git && cd attest
npm install
npm run verify-proofs
start proofs/index.html                                     # dashboard of every proof (macOS: open)
```

**2. Re-run a proof yourself — about 2 minutes, from a cassette.** The app, browser, clicks, code checks and receipt are real; the model answers come from a **cassette recorded in a live run**, so no key is needed. The receipt and evidence page are marked as a replay.

```bash
git branch demo2/base origin/demo2/base; git branch demo2/bad-fix origin/demo2/bad-fix; git branch demo2/fix origin/demo2/fix
npm run attest -- prove --app examples/checkout-widget --base demo2/base --pr demo2/fix --break demo2/bad-fix --replay examples/checkout-widget/cassette.jsonl
npm run attest -- verify evidence/run-<id>/receipt.json
```

Optional: `npx playwright install ffmpeg` (a few MB) adds a screen recording of every phase to the evidence page; without it, everything else still runs.

**Before a live run: preflight, no model calls.** `attest doctor` checks refs, config, the browser, that `MODEL_API_KEY` is set (it prints "set", never the value), and that the base ref becomes ready. Without `--break` the best possible verdict is PROVEN_UNCHECKED. `--no-start` skips booting the app.

```bash
npm run attest -- doctor --app examples/checkout-demo --base demo/base --pr demo/fix --break demo/bad-fix
```

`attest init --app <path>` writes a draft `attest.yml` and `criteria.yml` (defaults match the loader) and never overwrites existing files. A person reviews the draft before any run.

**3. Live, with your own keys:** `cp .env.example .env`, set `MODEL_API_KEY` (and `BASETEN_API_KEY` for the open-weights judge; without it the judge uses Muse Wonder), and drop `--replay …`.
**Let Muse Code write the fix**, then prove it: `npm run attest -- loop --app examples/checkout-widget --base demo2/base --break demo2/bad-fix --report "I click Pay and nothing happens."`
**Start from a recorded bug report**: `npm run attest -- draft --video examples/checkout-widget/bug-report/bug.webm --audio examples/checkout-widget/bug-report/narration.wav --out my-draft.yml` drafts criteria from a screen recording and narration for you to review ([sample](examples/checkout-widget/bug-report/README.md)).

### Prove a pull request

With `gh` authenticated, run the proof on a PR's base and head and write a GitHub-Markdown comment:

```bash
npm run attest -- pr 42 --app examples/checkout-widget --break demo2/bad-fix
npm run attest -- comment evidence/run-<id>/receipt.json
```

`attest pr` fetches `attest/pr-42/{base,head}`, runs Red / Green / Break (live, or with `--replay`), verifies the receipt, and writes `pr-comment.md` beside it. Add `--post` to publish it with `gh pr comment`.

## Built on Meta's models

| Model | Role in Attest |
|---|---|
| **Muse Spark 1.3** | The blind verifier — Responses API `computer` tool driving the browser — and, with video input, drafts criteria from a bug recording |
| **Muse Voice Transcribe** | Transcribes the user's spoken bug report for `attest draft` |
| **SAM 3.1** | Locates on-screen elements; combined with click hit-testing to show what really received a click |
| **Muse Spark Open** (open weights, via Baseten) | Independent judge from the screenshot sequence (no actions or code); falls back to **Muse Wonder** without a Baseten key. [Provenance](docs/MODEL_STRATEGY.md#open-weights-provenance) |
| **Muse Code** | Writes fixes headlessly in `attest loop`; Attest proves or rejects them |

Every model Attest calls at runtime is a Meta model. Details: [MODEL_STRATEGY](docs/MODEL_STRATEGY.md).

**Open-weights provenance:** Muse Spark Open runs from the maintainer's own Baseten account. Its use is on record, not just claimed: each live receipt names the judge (`judge: baseten/meta-models/muse-spark-open`) and keeps its verbatim vote and reason per phase — see [Board#921 run 2](proofs/realworld/board-921-run2/), [Board run 1](proofs/realworld/board-921-run1/) and [PR #1](proofs/pr-1-live/) — and the committed cassettes (`examples/checkout-demo/`, `examples/checkout-widget/`, `examples/realworld/board-enter/`) hold its recorded responses.

## Documentation

| Doc | What it covers |
|---|---|
| [ARCHITECTURE](docs/ARCHITECTURE.md) | The proof, the blind verifier, vote combining, the receipt, threats and limits |
| [BENCHMARK](docs/BENCHMARK.md) | Ten planted bugs, two runs, what the numbers do and don't mean |
| [BENCHMARK_GENERATED](docs/BENCHMARK_GENERATED.md) | 102 pre-registered generated bugs: every result, every INCONCLUSIVE with its reason, run 2 side by side |
| [BENCHMARK_HELDOUT](docs/BENCHMARK_HELDOUT.md) | Held-out cases with sealed labels: 3 of 5 wrong fixes accepted as pre-registered, 0 of 5 with one criterion per path (run 3), 0 correct rejected |
| [Real-world: Copilot's roadmap#361 fix](examples/realworld/roadmap-pulls/README.md) | GitHub Copilot's merged fix in someone else's app |
| [Real-world: Devin's Board#918 keyboard fix](examples/realworld/board-focus-trap/README.md) | Three reported runs: INCONCLUSIVE, then the judge fixed, then PROVEN |
| [Real-world: Devin's Board#921 fix](examples/realworld/board-enter/README.md) | An AI agent's merged fix in someone else's app, both runs |
| [Real-world: Devin's Board#913 / #914](examples/realworld/board-find-esc/README.md) | A merged AI change Attest REJECTED, and the follow-up it proved |
| [Real-world: Devin's Board#919](examples/realworld/board-find-over-help/README.md) | Find box drawn over the Help dialog |
| [Real-world: Copilot's eu-reporter#48](examples/realworld/eu-reporter-typing/README.md) · [#54](examples/realworld/eu-reporter-day-strip/README.md) | Focus lost while typing; day strip jumping back |
| [Real-world: Copilot's cheshy-mess#4](examples/realworld/cheshy-typing/README.md) | Focus jumping out of a text field (a Vite app) |
| [Real-world: simonw/tools#251](examples/realworld/simonw-dst-sunday/README.md) | Wrong clock-change dates (AI-assisted fix) |
| [Real-world: jspaint](examples/realworld/jspaint-radio-circle/README.md) · [Cara#2677](examples/realworld/cara-theme-toggle/README.md) | Two fixes by people: an unclickable radio circle, a dead theme button |
| [Real-world: TodoMVC 2012](examples/realworld/todomvc-delete/README.md) | A real historical bug and its real fix, all four runs |
| [Proofs](proofs/README.md) | Every committed receipt and how to check it |
| [MODEL_STRATEGY](docs/MODEL_STRATEGY.md) | Which Meta model does what, and why |
| [ROADMAP](docs/ROADMAP.md) | Built / shown / planned |
| [Decision records](docs/adr/) | Including [ADR 0005](docs/adr/0005-narrow-to-proof-of-fix.md): why Attest is proof-of-fix, not an orchestrator |

## Development

```bash
npm run typecheck                    # tsc --noEmit
npm test                             # unit tests, no network
npm run smoke                        # boots the demo branches, raw-mouse clicks Pay
npm run bench -- check               # AI-free check of the 10 benchmark scenarios
```

| Module | Role |
|---|---|
| `src/proof.ts` | Runs Red / Green / Break, collects votes, seals the receipt |
| `src/cua.ts`, `src/prompt.ts` | The blind computer-use verifier (with stateless-replay fallback) |
| `src/checks.ts`, `src/sam.ts`, `src/judge.ts` | Code checks, SAM 3.1 visibility, the independent judge |
| `src/verdict.ts` | Pure vote and verdict logic |
| `src/eventlog.ts`, `src/receipt.ts`, `src/report.ts` | Hash-chained log, signed receipt + `verify`, evidence page |
| `src/workspace.ts`, `src/browser.ts` | A git worktree per ref; Playwright with raw mouse/keyboard and click hit-testing |
| `src/producer.ts`, `src/loop.ts` | Muse Code headless producer and the closed loop |
| `src/prcomment.ts` | `attest pr` / `attest comment`: the proof as a GitHub pull-request comment |
| `scripts/verify-proofs.ts` | Verifies every committed receipt; `--write-index` writes the proofs dashboard |
| `src/api.ts` | Responses API client with retries and record/replay |

## Limits

- The bug must reproduce in an app Attest can start locally; production-only bugs are out of scope.
- "Not reproduced" is not "fake": Attest refuses to certify, it doesn't rule on the report.
- The verifier is a model and can be inconsistent. Agreement between independent votes is evidence, not a guarantee: it reduces false passes, it doesn't eliminate them.
- **Break needs a wrong fix you supply.** On someone else's PR, without one the strongest honest verdict is `PROVEN_UNCHECKED` (the fix works; Attest's ability to reject a wrong one wasn't tested). Generating wrong fixes automatically is roadmap.
- **Attest proves what the criterion says, not the whole bug.** If a report names several paths and the criterion tests one, a fix that covers only that path passes: on the held-out set, 3 of 5 wrong fixes got through this way. Write one criterion per path the report names: with that, run 3 rejected all 5.
- Only fix mode is built; regression and equivalence modes are designed, not implemented.
- If Attest can't perform a browser action the verifier asked for, the phase is `INCONCLUSIVE` (receipt version 0.3), even if the screenshots look right: a key that never reached the page can fake a pass or a reproduction. Earlier receipts didn't apply this rule (held-out run 1's C01, before the key-map fix) and re-verify unchanged.
- If the judge is on but can't vote — say its endpoint is down — the criterion is `INCONCLUSIVE` (receipt version 0.2), so one model alone never certifies. Receipts before 0.2 let the remaining votes decide (Board#918 run 2); they re-verify unchanged and are labelled. Disagreement is never a pass.
- The receipt proves nothing changed after capture, not that the capture environment was honest. The signature detects a later edit; it is made with a key created on the machine that ran the proof.
- The app under test never sees Attest's API keys, but it does run as your user — run unfamiliar repos in a VM or container.

More in [ARCHITECTURE §12–13](docs/ARCHITECTURE.md).

## How it was built

One developer, during the hackathon, with AI coding agents: **Claude Code** and **Command Code** wrote much of the code under the developer's design and review, and commits they co-wrote carry `Co-authored-by` trailers. Their work was checked the way Attest checks any agent's work — against written acceptance criteria, with tests and independent validation, misses recorded. At runtime, every model Attest calls is a Meta model.

## Open-source dependencies

| Package | Use | License |
|---|---|---|
| [`playwright`](https://www.npmjs.com/package/playwright) | Browser driver | Apache-2.0 |
| [`yaml`](https://www.npmjs.com/package/yaml) | Config and criteria parsing | ISC |
| [`typescript`](https://www.npmjs.com/package/typescript) | Compiler (dev) | Apache-2.0 |
| [`tsx`](https://www.npmjs.com/package/tsx) | TypeScript runner (dev) | MIT |
| [`@types/node`](https://www.npmjs.com/package/@types/node) | Node type definitions (dev) | MIT |

Muse Code is driven through its CLI (`muse exec`); no SDK dependency.

## License

MIT — see [LICENSE](LICENSE).
