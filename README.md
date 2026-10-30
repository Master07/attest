# Attest

> **Proof-of-fix for AI pull requests.** A verifier that never sees the code reproduces the bug, confirms the fix in the running app, proves it would catch a broken fix, and seals it all into a receipt anyone can check.

[![demo](docs/assets/demo.gif)](docs/assets/demo.gif)

---

## The problem

Coding agents in 2026 generate code fast, but their tests are weak. Frontier agents' own tests catch **fewer than 55% of logical mutants** ([nielstron, 2026](https://x.com/nielstron/status/2109651666790445209)). The result is green CI and a broken UI: code that passes every check and still doesn't work.

Maintainers and reviewers are left with AI-written PRs that look right, pass CI, and still don't work. A passing check isn't proof.

## What Attest does

Point Attest at any pull request — from Muse Code, a person, or another agent. Against human-approved acceptance criteria, a **blind** computer-use verifier (it never sees the code, the diff, or the agent's reasoning) drives the running app and produces a three-part proof:

| Step | Build | Must show |
|---|---|---|
| **Red** | Base | The bug actually happens |
| **Green** | Pull request | The same flow now works |
| **Break** | A deliberately wrong fix | The verifier fails it — it isn't rubber-stamping |

The criteria, results and screenshots are sealed into a **tamper-evident receipt** posted on the PR. `attest verify receipt.json` checks it without trusting Attest. Stretch: start from a screen recording of the bug.

## Built on Meta's models

Muse Spark 1.3 computer use drives the app; Spark's video input turns a recording into a reproduction; SAM 3.1 confirms on-screen elements; Muse Spark Open (open weights, via Baseten) is an independent second judge. See [`docs/MODEL_STRATEGY.md`](docs/MODEL_STRATEGY.md) and [ADR 0005](docs/adr/0005-narrow-to-proof-of-fix.md) for why the scope is narrow.

## Quickstart

```bash
# 1. Install the agent
curl -fsSL https://dev.meta.ai/install.sh | sh   # macOS/Linux
# irm https://dev.meta.ai/install.ps1 | iex      # Windows (PowerShell)

# 2. Authenticate
muse --version        # verify the CLI

# 3. Run Attest against a repo
cd /path/to/your/repo
attest run "fix the failing checkout test and prove it works in the browser"
```

Full setup: [`docs/SETUP.md`](docs/SETUP.md).

## Documentation

| Doc | What it covers |
|---|---|
| [PITCH](docs/PITCH.md) | The 2-minute narrative |
| [ARCHITECTURE](docs/ARCHITECTURE.md) | Components, data flow, trust boundaries |
| [AGENT_DESIGN](docs/AGENT_DESIGN.md) | Planning, fan-out, concurrency, escalation |
| [VERIFICATION](docs/VERIFICATION.md) | The computer-use verifier loop |
| [MODEL_STRATEGY](docs/MODEL_STRATEGY.md) | Which model for which role + cost |
| [EVENT_LOG_AND_REPLAY](docs/EVENT_LOG_AND_REPLAY.md) | The JSONL audit trail |
| [DEMO_SCRIPT](docs/DEMO_SCRIPT.md) | Timed shot list |
| [SUBMISSION](docs/SUBMISSION.md) | Hackathon writeup |
| [JUDGING_MAP](docs/JUDGING_MAP.md) | Feature → judging criteria |
| [COMPETITIVE_LANDSCAPE](docs/COMPETITIVE_LANDSCAPE.md) | Who we compete with, and where we're exposed |
| [STRATEGIC_OUTLOOK](docs/STRATEGIC_OUTLOOK.md) | Enterprise walls and world-level problems |
| [GTM_BRIEF](docs/GTM_BRIEF.md) | Beachhead, buyer, pricing, first 90 days |
| [SETUP](docs/SETUP.md) | Runbook |
| [COST](docs/COST.md) | Credit budget and per-run spend |
| [ROADMAP](docs/ROADMAP.md) | Post-hackathon |
| [FEEDBACK](docs/FEEDBACK.md) | Outside review: strategic concerns, code-vs-docs gaps, demo plan, hackathon strategy |
| [BRAINSTORM](docs/BRAINSTORM.md) | Feature, demo, alternative-project, and naming ideas |
| [Model reference](docs/reference/muse-models.md) | Full Muse model matrix |
| [HACKATHON_RULES](HACKATHON_RULES.md) | Hackathon rules summary: deadline, rubric, submission checklist |
| [DISCORD_NOTES](docs/DISCORD_NOTES.md) | Hackathon Discord map, announcements, sessions, open questions |

## Development

The loop is scaffolded in TypeScript and runs end-to-end against a **mock harness** — no API key or Muse Code install needed — so you can watch the plan → fan-out → verify → attest flow execute.

```bash
npm install
npm run typecheck     # tsc --noEmit
npm run demo          # runs the loop, writes an event log under evidence/
```

The real integration swaps `MockHarness` (`src/harness.ts`) for an adapter over the Muse Code SDK, and `CuaVerifier` (`src/verifier.ts`) is the seam where the live computer-use driver plugs in. Model routing lives in `src/models.ts`. See [ARCHITECTURE](docs/ARCHITECTURE.md).

## Status

Hackathon build. The loop is scaffolded in TypeScript and runs against a mock harness; swapping in the Muse Code SDK is the next step. See [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Open-source dependencies

| Package | Use | License |
|---|---|---|
| [`typescript`](https://www.npmjs.com/package/typescript) | Compiler (dev) | Apache-2.0 |
| [`tsx`](https://www.npmjs.com/package/tsx) | TypeScript runner (dev) | MIT |
| [`@types/node`](https://www.npmjs.com/package/@types/node) | Node type definitions (dev) | MIT |
| `@muse-code/sdk` | Muse Code integration (optional, not yet wired) | Check the package's license on install |

## License

MIT — see [LICENSE](LICENSE).
