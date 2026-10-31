# Architecture

> **Audience:** devs + judges · **Status:** draft · **Last updated:** 2026-10-31 · **Related:** [ADR 0005](adr/0005-narrow-to-proof-of-fix.md) · [MODEL_STRATEGY](MODEL_STRATEGY.md)

Attest is **proof-of-fix for pull requests**. Given a base build, a PR build, a deliberately wrong build, and human-approved acceptance criteria, it drives each running build with a **blind** computer-use verifier and seals the outcome into a **receipt** anyone can check.

This replaces the earlier orchestrator design (plan → worktree fan-out → merge); see [ADR 0005](adr/0005-narrow-to-proof-of-fix.md).

## 1. The proof

A proof has three phases. Each runs the **same criteria** against a different build.

| Phase | Build | Expected | If not |
|---|---|---|---|
| **Red** | `base` | Criteria **fail** — the bug reproduces | `INCONCLUSIVE` ("bug not reproduced in this environment" — not a judgement that the report was false; see §13) |
| **Green** | `pr` | Criteria **pass** | `REJECTED` (the fix doesn't work) |
| **Break** | `break` (a wrong fix) | Criteria **fail** | `INCONCLUSIVE` (the verifier can't tell a wrong fix from a right one) |

Final verdict:

- **`PROVEN`** — Red failed, Green passed, Break failed.
- **`REJECTED`** — Green failed (regardless of the others).
- **`INCONCLUSIVE`** — Red passed, Break passed, or a phase couldn't run (app didn't boot, step cap hit, verifiers disagreed).

`PROVEN` without a Break build is reported as **`PROVEN (unchecked sensitivity)`**, never as plain `PROVEN`.

**Where Break comes from.** In the normal story it's the producing agent's own rejected attempt: the "fix" that passed its tests but not Attest. A self-generated mutant is a stretch goal.

### 1.1 Proof modes

The engine underneath is "run these criteria against a build and record what happened." A **mode** is just the table of expected results per build, so new modes reuse the whole pipeline and only change `verdict.ts`.

| Mode | Builds | Expected | `PROVEN` when | For |
|---|---|---|---|---|
| **Fix** (default) | base · PR · break | fail · pass · fail | All three match | Reviewing AI PRs |
| **Regression** | PR | Every previously proven criterion passes | All pass | Teams merging many agent PRs |
| **Equivalence** | old · new | Same result per criterion | Every criterion agrees | Legacy migrations |

- **Regression** reuses criteria files from earlier `PROVEN` receipts, so every proven fix becomes a standing check.
- **Equivalence** passes when old and new *agree*, whether each criterion passes or fails; any disagreement is `REJECTED`.
- The receipt records the mode and its expectation table, so `attest verify` recomputes the verdict for any mode.

Fix mode is the build target. Regression and equivalence are shown in a thin version once the core works (§15).

## 1.2 Agentic design: loops, harness, agents

### Three nested loops

```
Outer loop  (closed loop, §15.1)       Muse Code ⇄ Attest      until PROVEN or retry limit
  └─ Middle loop  (proof runner)        Red → Green → Break     one proof
       └─ Inner loop  (verifier agent)  screenshot → think → act   until verdict or step cap
```

| Loop | Module | Goal | Perceive | Act | Stops when |
|---|---|---|---|---|---|
| **Inner — verifier agent** | `cua.ts` | Satisfy or refute the criteria | Screenshot of the running app | `computer_call` (click, type, scroll) | Verdict citing a screenshot, or step cap |
| **Middle — proof** | `proof.ts` | One verdict for one change | Phase results and votes | Start builds, run the inner loop per phase | All phases done → `PROVEN` / `REJECTED` / `INCONCLUSIVE` |
| **Outer — producer ⇄ verifier** | §15.1 | A proven fix | Rejection feedback (failed criteria + screenshots) | Muse Code writes another fix | `PROVEN`, retry limit, or `INCONCLUSIVE` → human |

A person is in the loop at two points: approving the criteria before any run, and deciding what to do with an `INCONCLUSIVE` result.

### The harness: models propose, the harness disposes

Muse Code is the harness for the agent that **writes** code. Attest is the harness for the agents that **check** it.

| Harness duty | How | Module |
|---|---|---|
| Environment | One worktree per build, own port, clean start and stop | `workspace.ts` |
| Action execution | The model proposes actions; Playwright executes them and captures screen, URL, DOM and network | `browser.ts` |
| Context control | One function builds verifier input from criteria + URL only (the blind verifier) | `prompt.ts` |
| Budgets | Step cap, retry limit, one retry on transient API errors, `truncation: "auto"` | `cua.ts`, `proof.ts` |
| State and memory | Every step in the hash-chained log; replay mode reads it back | `eventlog.ts` |
| Safety | On-screen text is data; passes must cite evidence; producer feedback never includes the checks | `prompt.ts`, §6, §15.1 |
| Final decision | A pure function combines votes; **no model makes the final call** | `verdict.ts` |

The split is deliberate: **models perceive and act; deterministic code decides.** That's why `attest verify` can recompute any verdict without calling a model (§8). The earlier `Harness` interface and `MockHarness` in `src/harness.ts` belonged to the fan-out design and are retired.

### Agents and what each sees

| Agent | Model | Role | Sees | Never sees |
|---|---|---|---|---|
| Producer | Muse Code | Writes the fix | Code, bug, rejection feedback | Verifier prompts, `expect` checks, judge reasoning |
| Verifier | Spark 1.3 (computer use) | Drives the app, votes | Criteria + its own screenshots | Code, diff, producer output |
| Judge | Muse Spark Open via Baseten (Muse Wonder fallback) | Independent second vote | Criteria + the screenshot sequence (up to 8 frames) | Code, verifier's reasoning and actions |
| Perception | SAM 3.1 | Confirms elements are visible and uncovered | Screenshots | Everything else |
| Drafter *(stretch)* | Spark 1.3 (video) | Bug recording → draft criteria | The recording | Code |

This is the builder–validator pattern with **separation enforced by the harness**: the agent that builds and the agents that validate never share context.

## 2. Component map

```mermaid
flowchart TB
  subgraph IN["Inputs"]
    REPO["Target repo<br/>+ attest.yml"]
    REFS["Refs: base · pr · break"]
    CRIT["criteria.yml<br/>(human-approved)"]
    REC["Bug recording<br/>(stretch)"]
  end

  REC --> DRAFT["Criteria drafter<br/>Spark 1.3 video input"] --> CRIT

  subgraph CORE["Attest core"]
    PROOF["Proof runner<br/>Red · Green · Break"]
    WS["Workspace manager<br/>worktree · build · start · stop"]
    PB["Prompt builder<br/>(the only path to the verifier)"]
    CUA["CUA verifier loop<br/>Spark 1.3 · Responses API"]
    BR["Browser driver<br/>Playwright Chromium"]
    CHK["Deterministic checks<br/>URL · DOM · network"]
    SAM["UI confirm<br/>SAM 3.1"]
    JDG["Independent judge<br/>Spark Open · Baseten"]
    VERD["Verdict combiner<br/>(pure function)"]
  end

  subgraph OUT["Evidence"]
    LOG[("events.jsonl<br/>hash-chained")]
    RCPT["receipt.json<br/>signed"]
    SHOTS["screenshots/"]
    HTML["Evidence page"]
    PRC["PR comment"]
  end

  REPO & REFS --> WS
  CRIT --> PB
  PROOF --> WS
  WS -->|app URL| BR
  PROOF --> PB --> CUA
  CUA <-->|actions / screenshots| BR
  BR --> CHK
  BR --> SAM
  BR -->|screenshot sequence| JDG
  CRIT --> JDG
  CUA & CHK & SAM & JDG --> VERD --> PROOF
  CORE -.->|every event| LOG
  BR --> SHOTS
  PROOF --> RCPT
  LOG & SHOTS --> RCPT
  RCPT --> HTML & PRC
```

## 3. Components

| Component | Module | Responsibility | Built on |
|---|---|---|---|
| **CLI** | `src/index.ts` | `attest prove`, `attest verify`, `attest draft` | Node.js |
| **Config** | `src/config.ts` | Read `attest.yml`: install/start commands, URL, readiness check, viewport | — |
| **Criteria** | `src/criteria.ts` | Parse and hash `criteria.yml`; the hash goes in every prompt and the receipt | — |
| **Criteria drafter** *(stretch)* | `src/draft.ts` | Bug recording → draft criteria for a human to approve | Spark 1.3 video input |
| **Workspace manager** | `src/workspace.ts` | `git worktree` per ref, install, start on its own port, wait until ready, stop | git, child processes |
| **Browser driver** | `src/browser.ts` | Execute computer actions; capture screenshots, URL, DOM snapshot, network log | Playwright (Chromium) |
| **Prompt builder** | `src/prompt.ts` | Build the verifier's input from criteria + app URL **only** | — |
| **CUA verifier loop** | `src/cua.ts` | Screenshot → `computer_call` → execute → repeat until a verdict; step cap and retry | `muse-spark-1.3`, Responses API `computer` tool |
| **Deterministic checks** | `src/checks.ts` | Evaluate each criterion's `expect` block (URL, selector state, network request) | Playwright |
| **UI confirm** | `src/sam.ts` | Confirm named elements are visible and not covered | SAM 3.1 |
| **Independent judge** | `src/judge.ts` | Second vote from criteria + the screenshot sequence, no action history and no code | Muse Spark Open via Baseten (Muse Wonder fallback) |
| **Verdict combiner** | `src/verdict.ts` | Combine votes per criterion; combine phases into the final verdict (§1) | Pure function |
| **Proof runner** | `src/proof.ts` | Run Red, Green, Break; owns retries and timeouts | — |
| **Event log** | `src/eventlog.ts` | Append-only JSONL; each entry carries the previous entry's hash | `node:crypto` SHA-256 |
| **Receipt** | `src/receipt.ts` | Build, sign and verify the receipt | `node:crypto` Ed25519 |
| **Report** | `src/report.ts` | Static evidence page; PR comment markdown | — |
| **Model routing** | `src/models.ts` | Role → provider + model; endpoints from env | Meta Model API, Baseten |

Retired from the earlier design: `harness.ts`, the fan-out loop in `orchestrator.ts`, and `attestation.ts` (replaced by `receipt.ts`).

## 4. One proof, step by step

```mermaid
sequenceDiagram
  participant U as Reviewer
  participant P as Proof runner
  participant W as Workspace
  participant B as Browser
  participant V as CUA verifier (Spark 1.3)
  participant J as Judge (Spark Open)
  participant L as Event log
  U->>P: attest prove --base main --pr fix --break bad-fix
  loop for phase in Red, Green, Break
    P->>W: checkout ref, install, start, wait ready
    W-->>P: http://localhost:PORT
    P->>V: criteria + URL (no code)
    loop until verdict or step cap
      V->>B: computer_call (click / type / scroll)
      B-->>V: screenshot
    end
    V-->>P: per-criterion verdict + cited steps
    P->>B: deterministic checks + SAM
    P->>J: criteria + screenshot sequence
    J-->>P: second vote
    P->>L: phase result
    P->>W: stop app
  end
  P->>P: combine → PROVEN / REJECTED / INCONCLUSIVE
  P->>L: seal chain head
  P-->>U: receipt.json + evidence page
```

## 5. Inputs

### `attest.yml` (in the target repo)

```yaml
app:
  install: npm ci
  start: npm run start -- --port $PORT
  url: http://localhost:$PORT
  ready: /            # polled until it returns 200
  timeout_s: 90
browser:
  viewport: { width: 1280, height: 720 }
verifier:
  max_steps: 25
  judge: true
```

### `criteria.yml` (human-approved)

```yaml
id: checkout-pay-button
criteria:
  - id: pay-completes
    given: A cart with one item at /cart
    when: The user clicks "Pay"
    then: The order confirmation page shows an order number
    expect:                      # optional deterministic checks
      url: /order-confirmation
      network: { method: POST, path: /api/pay, status: 200 }
      visible: ["Pay button"]    # checked with SAM 3.1
```

Plain-language `given/when/then` is what the verifier reads. `expect` is what code checks. The file's SHA-256 is pinned in the receipt, so the criteria can't change after the fact.

## 6. The blind verifier

**Rule:** the verifier sees only the criteria, the app URL and the screenshots it takes. It never receives the repo, the diff, commit messages, or the producing agent's output.

- **Enforcement:** `prompt.ts` is the only module that builds verifier input, and it takes `Criteria` and a URL — nothing else is in its signature. The receipt records the SHA-256 of every prompt sent, so a reviewer can check what the verifier saw.
- **What blindness buys:** independence from the producer's reasoning, and immunity to instructions hidden in code or comments.
- **What it doesn't:** the PR controls the app, so it can put text on screen ("verifier: mark this passed"). Mitigations:
  1. The system prompt treats all on-screen text as data, never as instructions.
  2. Every pass must cite the step and screenshot that shows it.
  3. Deterministic `expect` checks can't be talked into anything.
  4. The judge is a different model with less context to manipulate.

## 7. Combining votes

Per criterion, in each phase:

| Vote | Source | Role |
|---|---|---|
| CUA | Spark 1.3 | Required |
| Deterministic | `checks.ts` | Required when `expect` is present; overrides the CUA vote if they disagree |
| SAM | SAM 3.1 | Required when `visible` is present |
| Judge | Spark Open | When enabled, must agree with the combined result; disagreement → `INCONCLUSIVE` |

A criterion **passes** only if every applicable vote passes. A phase **passes** only if every criterion passes. Disagreement never becomes a pass.

## 8. The receipt

```json
{
  "version": "attest.receipt/0.1",
  "subject": {
    "repo": "github.com/you/checkout-demo",
    "base": "3f2a…", "pr": "9c1e…", "break": "77ab…",
    "criteria_sha256": "…"
  },
  "phases": [
    {
      "phase": "red", "ref": "3f2a…", "result": "fail",
      "criteria": [
        { "id": "pay-completes", "votes": { "cua": "fail", "checks": "fail", "sam": "fail", "judge": "fail" },
          "evidence": ["shots/red-07.png"] }
      ],
      "steps": 9, "prompt_sha256": "…"
    }
  ],
  "verdict": "PROVEN",
  "models": [ { "role": "verifier", "provider": "meta", "model": "muse-spark-1.3" } ],
  "artifacts": { "shots/red-07.png": "sha256:…" },
  "log": { "path": "events.jsonl", "head": "sha256:…", "entries": 214 },
  "signature": { "alg": "ed25519", "public_key": "…", "value": "…" }
}
```

**`attest verify receipt.json`** checks, without calling any model:

1. The signature over the receipt body.
2. The event-log hash chain, ending at `log.head`.
3. Every artifact against its recorded hash.
4. That `verdict` follows from the recorded phase results, by re-running the pure verdict function.

**What the signature does and doesn't prove.** It proves the receipt hasn't changed since the holder of that key produced it. It doesn't prove the key holder is honest. Anchoring receipts in a public transparency log is on the roadmap.

## 9. Event log

Each line of `events.jsonl`:

```json
{ "seq": 42, "ts": "…", "phase": "green", "kind": "cua_action",
  "data": { "action": "click", "x": 640, "y": 412, "shot": "sha256:…" },
  "prev": "sha256:<hash of line 41>", "hash": "sha256:<hash of this line without .hash>" }
```

Kinds: `run_start`, `workspace_ready`, `prompt_sent`, `cua_action`, `cua_verdict`, `check_result`, `sam_result`, `judge_vote`, `phase_result`, `verdict`, `sealed`. The log is flushed after every event, so a crash leaves a valid partial chain.

## 10. Models and providers

| Role | Model | Provider | Notes |
|---|---|---|---|
| `verifier` | `muse-spark-1.3` | Meta Model API | Responses API `computer` tool; Wonder rejects it (hackathon Discord, organizer answers) |
| `ui` | `sam-3.1` | Meta Model API | Element confirmation |
| `judge` | `meta-models/muse-spark-open` | Baseten (own account) | Open weights. Without a Baseten key: `muse-wonder-1.0` on the Meta Model API |
| `drafter` *(stretch)* | `muse-spark-1.3` | Meta Model API | Video input |
| Producer *(demo only)* | Muse Code | — | Writes the fix being proven; not part of Attest's runtime |

All runtime models are Meta models, as the hackathon requires. Routing and overrides are in `src/models.ts`.

## 11. Running without keys

Judges must be able to run the public repo standalone. Two modes:

- **Replay** (`ATTEST_REPLAY=evidence/<run>`): the model clients return recorded responses from a previous run's event log; the browser and checks still run for real. No API keys needed.
- **Example app** (`examples/checkout-demo`): a tiny app with three branches — `base` (the Pay button is covered by an overlay), `bad-fix` (the click handler is fixed and tests pass, but the overlay still covers the button), `fix` (overlay removed). `attest prove` on it reproduces the demo.

## 12. Trust boundaries and threats

| Threat | Mitigation |
|---|---|
| PR code instructs the verifier via code or comments | Blind verifier (§6) |
| PR renders instructions on screen | On-screen text treated as data; cited evidence; deterministic checks; independent judge |
| PR behaves differently under test (e.g. detects automation) | All three phases use the same browser and environment, so detection affects Red and Break too; a Break that passes exposes it |
| Receipt edited afterwards | Hash chain, artifact hashes, signature; `attest verify` |
| Criteria changed afterwards | Criteria hash pinned in every prompt and in the receipt |
| Flaky model or app | Step cap, one retry on transient API errors, `INCONCLUSIVE` instead of a guess; optional repeat runs |
| API keys leaking | Keys only in `.env` (gitignored); never logged; screenshots come from the synthetic example app |
| Credit burn | Step cap, `truncation: "auto"`, replay mode for development, Spark Open on Baseten for the judge |

## 13. Limits

**Attest only certifies what it can reproduce. A recording is a lead, not evidence.**

- **"Not reproduced" is not "fake."** Many real bugs happen once and hide: race conditions, specific data, one browser, slow networks, production config, a flaky third-party service. When Red can't reproduce a bug, the receipt says **"bug not reproduced in this environment"** and the verdict is `INCONCLUSIVE`. A doctored recording gets the same result, and Attest can't tell the two apart. It refuses to certify; it doesn't rule on whether the report was true.
- **Intermittent bugs (planned).** Repeat a phase *N* times and report counts, e.g. Red "reproduced 3 of 10", Green "0 of 10". State that 0 of *N* is evidence the failure became rarer, not proof it's gone. Optionally vary conditions (network throttling, viewport, injected delays) to surface timing bugs, and use the bug recording to recover exact inputs.
- **Out of scope:** bugs that only occur in production or with real user data. Those need evidence captured when they happen (monitoring, session replay), which is a different product.
- **Re-running is only as strong as its independence.** A re-run by a different party, on a different machine, against the same refs and criteria is strong evidence; the same party re-running is the same claim again.
- **The receipt proves integrity after capture, not honesty of the capture.** Hashes and the signature show nothing changed after recording; they don't prove the capture environment was honest (see §8).
- Computer use on third-party websites hasn't been cleared by organizers; Attest targets apps you run yourself.
- The verifier is still a model. Red/Green/Break, deterministic checks and the judge reduce false passes; they don't eliminate them.

## 14. Build order

**The gate:** no expansion work starts until Red, Green and Break run end to end against the real Spark API on the example app.

| Day | Deliverable |
|---|---|
| Nov 1 | Example app with three branches; workspace manager; browser driver; CUA loop completing one phase against the real API |
| Nov 2 | Proof runner (Red/Green/Break); deterministic checks; hash-chained log; receipt + `attest verify` — **gate** |
| Nov 3 | Closed loop with Muse Code; benchmark runs; proof videos + SAM overlay; judge on Spark Open; replay mode |
| Nov 4 | Record the video; README; submit early. Then, only if time remains: regression/equivalence modes, `gh` PR comment, receipt schema |
| Stretch | Criteria from a voice + video bug report; auto-generated Break mutants |

Stop wherever time runs out; anything unbuilt moves to the Tell tier (§15.2).

## 15. Expansion: closed loop and scope tiers

### 15.1 Closed loop with Muse Code

When a fix proof is `REJECTED`, Attest hands the producing agent the evidence and lets it try again, until `PROVEN` or a retry limit (default 3).

```mermaid
flowchart LR
  BUG["Bug + criteria"] --> MC["Muse Code<br/>writes a fix"]
  MC --> PR["PR build"]
  PR --> PROVE["attest prove"]
  PROVE -->|PROVEN| DONE["Receipt sealed"]
  PROVE -->|REJECTED| FB["Feedback: failed criteria<br/>+ screenshots"]
  FB --> MC
  PROVE -->|INCONCLUSIVE| HUMAN["Stop: ask a human"]
```

- **The verifier stays blind.** Feedback flows only to the producer: failed criterion ids, their plain-language text and the cited screenshots. Never the verifier's prompts, the judge's reasoning or the `expect` checks, so the producer can't optimise against the checks themselves.
- **Rejected attempts become Break builds.** Each failed attempt is kept as a branch; the last one becomes the Break build for the final proof.
- **Every attempt is in the receipt**, so a reviewer sees the whole path: rejected, retried, proven.
- **Muse Code is the producer** because anything Attest invokes at runtime must be a Meta model (hackathon Discord, organizer answers).
- **Open risk:** it isn't confirmed that Muse Code can be driven non-interactively (SDK or headless CLI). If it can't, the demo triggers each retry by hand and says so.

### 15.2 Scope tiers

Everything outside the core is labelled by how real it is. The pitch and README use the same labels.

| Tier | Meaning | Items |
|---|---|---|
| **Build** | Real, demoed, in the repo | Fix proof (core) · closed loop with Muse Code · benchmark · proof videos · SAM overlay reveal |
| **Show** | Thin but real; run once and documented | Regression mode · equivalence mode · GitHub PR comment via `gh` · published receipt JSON schema + standalone `attest verify` |
| **Tell** | Roadmap only, never presented as built | Desktop apps · production-only bug capture · transparency log for receipts · compliance exports · GitHub Marketplace app · intermittent-bug repeat runs (§13) |

### 15.3 Benchmark

Plant 10–15 realistic UI bugs in the example app (covered buttons, wrong totals, broken redirects, disabled inputs, stale state). For each, have the producing agent write a fix and its own tests, then report:

| Measure | Meaning |
|---|---|
| Caught by the agent's tests | How many wrong fixes its own tests rejected |
| Caught by Attest | How many wrong fixes Attest rejected |
| False passes | Wrong fixes Attest marked `PROVEN` |
| Inconclusive | Runs Attest refused to certify |

Publish the raw runs and receipts alongside the numbers, including the misses. The numbers are only as broad as the planted bugs; say so.

## See also

- [ADR 0005](adr/0005-narrow-to-proof-of-fix.md) — why the scope is narrow
- [MODEL_STRATEGY](MODEL_STRATEGY.md) — routing and providers
- Platform facts this design depends on come from Meta's computer-use docs (dev.meta.ai/docs/computer-use) and organizer answers in the hackathon Discord
