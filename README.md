# Attest

**Proof-of-fix for AI pull requests.** A verifier that never sees the code reproduces the bug, confirms the fix in the running app, proves it would catch a wrong fix, and seals it all into a receipt anyone can check.

*Built entirely during the Meta Global AI Developer Hackathon (Oct 26 – Nov 4, 2026) · Indie track · Push the Frontier.*

![SAM 3.1 finds the Pay button; the click actually landed on an invisible chat-widget container](docs/assets/sam-reveal.png)

<sub>A real run. A fix whose unit tests passed; Attest drove the app and found why paying still fails: SAM 3.1 locates the Pay button (green), but the click lands on an invisible 440×560 container from a third-party chat widget (red).</sub>

## The problem

AI agents now write pull requests faster than anyone can review them, and a green test suite isn't proof: frontier agents' own tests catch **fewer than 55% of logical mutants** ([nielstron, 2026](https://x.com/nielstron/status/2109651666790445209)). Reviewers end up approving changes that pass CI and still don't work.

## What Attest does

A person approves one plain-language requirement (*given a cart, when the user clicks Pay, then the order confirmation shows an order number*). Attest then runs three experiments on the **running app**:

| Phase | Build | Must show |
|---|---|---|
| **Red** | Original code | The bug really happens |
| **Green** | The fix | It now works |
| **Break** | A wrong fix | Attest rejects it — otherwise its "yes" means nothing |

Each phase gets **four independent votes**, and disagreement is never a pass:

1. **Muse Spark 1.3** drives a real browser with computer use. It is **blind**: it never sees the code, diff or the producing agent's reasoning.
2. **Code checks** — the final URL and network calls, no AI involved.
3. **SAM 3.1** — is the element visible, and did the click actually reach it?
4. **A Muse Wonder judge** — sees only the requirement and before/after screenshots.

Everything — votes, screenshots, a hash-chained event log — is sealed into a **signed receipt** plus an evidence page. `attest verify` checks it without calling any model, and rejects any edit.

![The evidence page for a PROVEN receipt](docs/assets/evidence-page.png)

## Results

On a [benchmark of 10 planted UI bugs](docs/BENCHMARK.md), each with a plausible wrong fix:

- **10 / 10** wrong fixes passed their own unit tests.
- **8 / 10** real fixes **PROVEN**; the other 2 INCONCLUSIVE (one Meta API outage, one disagreement between voters).
- **0** wrong fixes certified as working. **0** real fixes rejected.
- When one verifier run scrolled its way to a pass on a wrong fix, the independent judge disagreed and Attest refused to certify it.

Ten planted bugs show the mechanism works; they are not a measure of real-world accuracy.

**A real bug, too:** Attest proved TodoMVC's real 2012 fix for "deleting a todo takes two clicks" — in a project we didn't write — after four honestly reported runs: an ambiguous requirement and two blind spots in Attest (a retry hiding the bug, a judge that saw only the final frame) surfaced and were fixed, and no run certified the wrong fix. [Every run →](examples/realworld/todomvc-delete/README.md)

## Try it — no API key needed

Requires Node 22+, git, and Microsoft Edge or Chrome (`ATTEST_BROWSER_CHANNEL=chrome` for Chrome).

```bash
git clone https://github.com/Master07/attest.git && cd attest
npm install
git branch demo2/base origin/demo2/base; git branch demo2/bad-fix origin/demo2/bad-fix; git branch demo2/fix origin/demo2/fix
npm run attest -- prove --app examples/checkout-widget --base demo2/base --pr demo2/fix --break demo2/bad-fix --replay examples/checkout-widget/cassette.jsonl
```

Optional: `npx playwright install ffmpeg` (a few MB) adds a screen recording of every phase to the evidence page; without it, everything else still runs.

`--replay` answers model calls from a cassette recorded in a real run. The app, browser, clicks, code checks and receipt are all real; the receipt and page are marked as a replay. Then:

```bash
npm run attest -- verify evidence/run-<id>/receipt.json     # no key, no model calls
start evidence/run-<id>/index.html                          # the evidence page (macOS: open)
```

**Live**, with a Meta Model API key: `cp .env.example .env`, set `MODEL_API_KEY`, and drop `--replay …`.
**Let Muse Code write the fix**, then prove it: `npm run attest -- loop --app examples/checkout-widget --base demo2/base --break demo2/bad-fix --report "I click Pay and nothing happens."`
**Start from a recorded bug report**: `npm run attest -- draft --video examples/checkout-widget/bug-report/bug.webm --audio examples/checkout-widget/bug-report/narration.wav --out my-draft.yml` drafts criteria from a screen recording and narration for you to review ([sample](examples/checkout-widget/bug-report/README.md)).

## Built on Meta's models

| Model | Role in Attest |
|---|---|
| **Muse Spark 1.3** | The blind verifier — Responses API `computer` tool driving the browser — and, with video input, drafts criteria from a bug recording |
| **Muse Voice Transcribe** | Transcribes the user's spoken bug report for `attest draft` |
| **SAM 3.1** | Locates on-screen elements; combined with click hit-testing to show what really received a click |
| **Muse Wonder** | Independent judge from before/after screenshots |
| **Muse Code** | Writes fixes headlessly in `attest loop`; Attest proves or rejects them |

Every model Attest calls at runtime is a Meta model. Details: [MODEL_STRATEGY](docs/MODEL_STRATEGY.md).

## Documentation

| Start here | |
|---|---|
| [PITCH](docs/PITCH.md) | The 2-minute narrative |
| [ARCHITECTURE](docs/ARCHITECTURE.md) | The proof, the blind verifier, vote combining, the receipt, threats and limits |
| [BENCHMARK](docs/BENCHMARK.md) | Ten planted bugs, two runs, what the numbers do and don't mean |
| [SUBMISSION](docs/SUBMISSION.md) | Hackathon write-up |

<details><summary>More: design decisions, strategy, project notes</summary>

| Doc | What it covers |
|---|---|
| [ADR 0005](docs/adr/0005-narrow-to-proof-of-fix.md) | Why Attest is proof-of-fix, not an orchestrator |
| [MODEL_STRATEGY](docs/MODEL_STRATEGY.md) | Model routing and providers |
| [DEMO_SCRIPT](docs/DEMO_SCRIPT.md) | The 3-minute video script |
| [JUDGING_MAP](docs/JUDGING_MAP.md) | Features mapped to the judging rubric |
| [GTM_BRIEF](docs/GTM_BRIEF.md) | Who would pay, and how |
| [COMPETITIVE_LANDSCAPE](docs/COMPETITIVE_LANDSCAPE.md) | The market and where Attest is exposed |
| [STRATEGIC_OUTLOOK](docs/STRATEGIC_OUTLOOK.md) | The verification gap, and enterprise walls |
| [ROADMAP](docs/ROADMAP.md) | Built / shown / planned |
| [HANDOVER](HANDOVER.md) | Build log and current state |
| [DISCORD_NOTES](docs/DISCORD_NOTES.md) · [HACKATHON_RULES](HACKATHON_RULES.md) | Event facts and rules |
| [FEEDBACK](docs/FEEDBACK.md) · [BRAINSTORM](docs/BRAINSTORM.md) | Early review and idea notes |
| [AGENT_DESIGN](docs/AGENT_DESIGN.md) · [VERIFICATION](docs/VERIFICATION.md) · [EVENT_LOG_AND_REPLAY](docs/EVENT_LOG_AND_REPLAY.md) · [SETUP](docs/SETUP.md) · [COST](docs/COST.md) | Earlier design docs (partly superseded by ARCHITECTURE) |

</details>

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
| `src/api.ts` | Responses API client with retries and record/replay |

## Limits

- The bug must reproduce in an app Attest can start locally; production-only bugs are out of scope.
- "Not reproduced" is not "fake": Attest refuses to certify, it doesn't rule on the report.
- The verifier is a model and can be inconsistent; the four votes reduce false passes, they don't eliminate them.
- The receipt proves nothing changed after capture, not that the capture environment was honest.

More in [ARCHITECTURE §13](docs/ARCHITECTURE.md).

## Open-source dependencies

| Package | Use | License |
|---|---|---|
| [`playwright`](https://www.npmjs.com/package/playwright) | Browser driver | Apache-2.0 |
| [`yaml`](https://www.npmjs.com/package/yaml) | Config and criteria parsing | ISC |
| [`typescript`](https://www.npmjs.com/package/typescript) | Compiler (dev) | Apache-2.0 |
| [`tsx`](https://www.npmjs.com/package/tsx) | TypeScript runner (dev) | MIT |
| [`@types/node`](https://www.npmjs.com/package/@types/node) | Node type definitions (dev) | MIT |

`@muse-code/sdk` is listed as an optional dependency but is not used; Muse Code is driven through its CLI.

## License

MIT — see [LICENSE](LICENSE).
