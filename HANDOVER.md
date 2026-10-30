# Handover

> **Read this first** if you are an AI coding agent (Claude Code, Command Code, Muse Code, or another) picking up Attest. It is the single source of truth for current state, rules, and the next task. **Update the Progress log at the end of every work session**, and keep "Current state" accurate.

- **Repo:** https://github.com/Master07/attest (private; must be **public** before submission)
- **Local path:** `C:\dev\attest` (Windows 11, PowerShell 5.1). Moved out of OneDrive on 2026-10-31 because OneDrive locks git worktree metadata; the old `%USERPROFILE%\OneDrive\Documents\attest` copy is retired — don't work there.
- **Deadline:** **Nov 4, 2026, 9:00 PM ET** (Nov 5, 7:30 AM IST) — Meta Global AI Developer Hackathon, **Indie** track, theme **Push the Frontier**
- **Last updated:** 2026-10-31 by Claude Code

## 1. What Attest is (one paragraph)

**Proof-of-fix for AI pull requests.** Given a base build, a PR build, a deliberately wrong build ("break") and human-approved acceptance criteria, Attest drives each running build with a **blind** computer-use verifier (Muse Spark 1.3) and produces a three-part proof — **Red** (bug reproduces on base), **Green** (works on PR), **Break** (wrong fix fails) — sealed into a signed, hash-chained **receipt** that `attest verify` can check without calling any model.

Read, in this order: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (the design — authoritative), [docs/adr/0005-narrow-to-proof-of-fix.md](docs/adr/0005-narrow-to-proof-of-fix.md) (why), [docs/DISCORD_NOTES.md](docs/DISCORD_NOTES.md) (platform facts), [HACKATHON_RULES.md](HACKATHON_RULES.md).

## 2. Hard rules — do not break these

**Hackathon**
1. **Every model Attest calls at runtime must be a Meta model** (Meta Model API or Meta open weights). No OpenAI/Claude/Gemini calls in the product, no non-Meta TTS. Coding tools used to *write* the code don't matter.
2. **Only work done Oct 26 – Nov 4** in this repo. Don't paste in pre-existing code from elsewhere.
3. **No secrets in git.** Keys live only in `.env` (gitignored). Never print keys in logs, docs or commits.
4. Repo must be **public** at submission with a working **3-minute demo video** and all team members listed.

**Design invariants** (see ARCHITECTURE §1–§8)
5. **Blind verifier:** only `src/prompt.ts` builds verifier input, and it takes criteria + app URL only — never code, diffs, commit messages or producer output.
6. **Models perceive and act; deterministic code decides.** The final verdict comes from a pure function in `src/verdict.ts`. Disagreement between votes is never a pass.
7. **Honest claims.** Not-reproduced ≠ fake (ARCHITECTURE §13). The receipt proves integrity after capture, not honesty of capture. Don't write "can't be faked". Label anything not built as roadmap.
8. **Gate:** no expansion work (closed loop, benchmark, videos, modes) until Red/Green/Break runs end to end against the real Spark API.

**Repo conventions** (CONTRIBUTING.md)
9. No unsourced quantitative claims. Docs start with the `Audience · Status · Last updated · Related` header. Architectural decisions get an ADR in `docs/adr/`.
10. Small commits with imperative subjects. Run `npm run typecheck` before committing. Commit email is the GitHub noreply address (already set in repo config).

## 3. Environment facts

- Node v24, npm 11. TypeScript ESM (`"type": "module"`, `NodeNext`), strict, `noUncheckedIndexedAccess`, `verbatimModuleSyntax` (use `import type`). Run with `tsx`.
- **Git and GitHub CLI were installed on Oct 31.** Old terminals may not find them; open a new terminal, or use full paths: `C:\Program Files\Git\cmd\git.exe`, `C:\Program Files\GitHub CLI\gh.exe`. `gh` is logged in as **Master07**.
- `.env.example` lists every variable. Copy to `.env` and fill in `MODEL_API_KEY` (and `BASETEN_API_KEY` if Baseten credits were granted).
- Meta workshops recommend macOS/Linux; Windows works for Node + Playwright, but kill child processes with `taskkill /T /F /PID <pid>` (no POSIX process groups).

## 4. Platform facts (from the hackathon Discord — details in docs/DISCORD_NOTES.md)

- **Computer use:** Responses API with `tools: [{"type": "computer"}]` and screenshots as `input_image`. **Works on `muse-spark-1.3`; `muse-wonder-1.0` returns `400 Unsupported tool type`.** `truncation: "auto"` reportedly works on Spark. Participants hit an occasional `500` on follow-up turns — retry once.
- **Confirmed from Meta's docs (dev.meta.ai/docs/computer-use) and a live run:** base URL `https://api.meta.ai/v1` (default in `src/models.ts`); each `computer_call` carries an ordered **batch** in `actions`; the model finishes by replying with a message and no `computer_call`; screenshots go back as `computer_call_output` → `output: {type: "computer_screenshot", image_url: <base64 data URL>}`; `pending_safety_checks` must be echoed in `acknowledged_safety_checks` to proceed.
- **Baseten:** model ID `meta-models/muse-spark-open-1026` (official FAQ); the hackathon key serves **only** Muse Spark Open. One report says the `-1026` ID 404s on personal accounts — use the ID from Baseten's email. Base URL in `src/models.ts` is a guess; override with `BASETEN_BASE_URL`.
- **Credits:** $150 Meta credits; a card is required; Indian cards sometimes show "account restricted" after a failed hold. Muse Code consumes these credits if linked to the API account — protect them for Attest's runtime.

## 5. Current state (as of the last update)

| Area | State |
|---|---|
| Docs / design | Complete for the hackathon scope (ARCHITECTURE §1–§15, ADR 0005, ROADMAP tiers) |
| `src/models.ts` | **Done.** Role → provider routing (`worker`, `reasoning`, `image`, `ui`, `verifier`, `judge`), `ATTEST_ROUTE_<ROLE>` overrides, `resolveProvider()` |
| `src/config.ts` | **Done (T2).** `loadConfig()` + `resolveUrl()`; defaults 90 s / 1280×720 / 25 steps / judge on; errors name the file and field; unknown keys ignored |
| `src/criteria.ts` | **Done (T2).** `loadCriteria()`; SHA-256 over LF-normalised text (CRLF-stable); unique ids; typed `expect` |
| `src/workspace.ts` | **Done (T3).** detached worktree per ref under `.attest/worktrees/`, install, OS-assigned port, readiness poll, `taskkill /T /F` + worktree removal on every failure path |
| `src/browser.ts` | **Done (T4).** raw `page.mouse.*` / `page.keyboard.*` actions only (a covered element still receives the click), PNG screenshots, URL history, network records |
| `src/checks.ts` | **Done (T6).** `runChecks()` / `runAllChecks()` evaluate `expect.url` (final pathname only, query/hash ignored, trailing slash normalised) and `expect.network` (method compared case-insensitively, any matching status passes) from browser records; `expect.visible` is left to SAM. Pure — no I/O, clocks or randomness |
| `test/` | **Done.** 40 `node:test` tests over config, criteria, key mapping, deterministic checks (T6) and the hash chain (T9) (`npm test`) |
| `scripts/smoke-t4.ts` | **Done.** `npm run smoke` drives all three demo branches plus the bad-ref failure path |
| `src/types.ts` | Partly reusable (`ModelRole`, `Provider`, `ModelRoute`); the rest belongs to the old design |
| `src/eventlog.ts` | **Done (T9).** Append-only JSONL, written with `appendFileSync` before `append()` returns; each line carries `seq`, `prev` and `sha256:` hash over the key-sorted canonical JSON. `verifyChain()` reports the first bad line (1-based) for edited, deleted, reordered or forged lines; CRLF-stable |
| `src/harness.ts`, `src/orchestrator.ts`, `src/attestation.ts`, `src/verifier.ts` | **Deleted.** Old mock fan-out design (ADR 0005); replaced by `proof.ts`/`verdict.ts` (T7/T8) and `receipt.ts` (T10) |
| `src/index.ts` | **Done (T8/T10).** CLI: `npm run attest -- prove --app <path> --base <ref> --pr <ref> [--break <ref>] [--criteria <file>] [--out <dir>]` and `npm run attest -- verify <receipt.json>`. Loads `.env` |
| `src/verdict.ts` | **Done (T7).** Pure: `combineCriterion` (every applicable vote must pass; verifier pass + hard-check fail → fail; verifier fail + check pass → inconclusive; judge disagreement → inconclusive), `combinePhase`, `fixVerdict` (`PROVEN` / `PROVEN_UNCHECKED` / `REJECTED` / `INCONCLUSIVE`) |
| `src/proof.ts` | **Done (T8).** `runProof()` runs Red/Green/Break, logs every screenshot, step, check and result to `events.jsonl`, stores shots + a criteria copy in `evidence/run-<id>/`, seals and signs `receipt.json`. SAM and judge votes are recorded as `n/a` (not built yet) |
| `src/receipt.ts` | **Done (T10).** Ed25519 signing (key auto-created at `~/.attest/signing-key.pem`, override `ATTEST_KEY_PATH`; never commit it). `verifyReceipt` checks signature, log chain + pinned head/count (catches truncation), every artifact hash, the criteria hash, and re-derives the verdict from recorded votes. Tolerates a BOM |
| `src/prompt.ts` | **Done (T5).** `buildVerifierPrompt(criteria, appUrl)` — the only builder of verifier input; criteria `given/when/then` + URL only (no `expect`, no code); returns `instructions`, `task`, `sha256` |
| `src/cua.ts` | **Done (T5).** `runVerifier()` — Responses API loop on `pickRoute("verifier")` (`muse-spark-1.3`), batch `actions` per `computer_call`, `previous_response_id` chaining, `truncation: "auto"` with fallback, one retry on 5xx/network, step cap, verdict JSON parsing. Safety checks are acknowledged **only for localhost apps** (Meta raises `computer_action_requires_confirmation` on the Pay click) |
| `scripts/run-phase.ts` | `npm run phase -- <ref> <label>` runs one phase against the real API and writes screenshots + `result.json` to `evidence/` (gitignored). Opens the app at `/` (v0 limitation: the app's root must lead to the `given` state) |
| Real Meta API calls | **Working.** Red/Green/Break all correct on the example app (see §9, 2026-10-31) |
| `ui/evidence.html` | Static mockup of an evidence page (Oct 28) — reuse its styling for `report.ts` |
| `examples/checkout-demo/` | **T1 done.** No-dependency Node app (`server.js`, `public/`), `attest.yml`, `criteria.yml`. Branches `demo/base`, `demo/bad-fix`, `demo/fix` (pushed). `main` holds the base version |
| Playwright | `playwright` 1.64.1 is a root devDependency. **No bundled browser downloaded** — launch with `channel: "msedge"` (Edge is installed on this PC) |

## 6. Next tasks, in order

Each task lists what "done" means. Do them in order; tick them in the Progress log.

> **Status (2026-11-01):** **Gate passed; closed loop, SAM 3.1 and the Wonder judge done.** Both demos return `PROVEN` with all four voters agreeing in every phase. **Next:** evidence page (`report.ts`, reuse `ui/evidence.html`) → benchmark incl. a bug whose cause is outside the repo → proof videos → replay mode → README GIF + demo video. Judge moves to Spark Open if a Baseten key arrives (`ATTEST_ROUTE_JUDGE`).

### Day 1 (Nov 1) — core plumbing

**T1. Example app** — `examples/checkout-demo/`
- Tiny Node HTTP app, no framework: `GET /cart` (one item, a **Pay** button), `POST /api/pay` → 200 `{order: 1042}`, `GET /order-confirmation` shows "Order #1042". Reads `PORT` from env.
- Three git branches that differ **only** inside `examples/checkout-demo/`:
  - `demo/base` — a transparent promo banner overlaps the Pay button, so clicks never reach it.
  - `demo/bad-fix` — the click handler is "fixed" and a unit test passes, but the overlay is still there.
  - `demo/fix` — overlay no longer covers the button.
- Include `examples/checkout-demo/attest.yml` and `criteria.yml` exactly as in ARCHITECTURE §5.
- **Done when:** the app runs on all three branches; manually, Pay works only on `demo/fix`.

**T2. Config + criteria** — `src/config.ts`, `src/criteria.ts`
- Parse `attest.yml` and `criteria.yml` (add the `yaml` package). Compute SHA-256 of the criteria file.
- **Done when:** typed objects load from the example files; malformed files give clear errors.

**T3. Workspace manager** — `src/workspace.ts`
- `git worktree add .attest/worktrees/<phase> <ref>`, run `install`, start with `PORT`, poll `ready` until 200 or timeout, stop (Windows: `taskkill /T /F`), remove the worktree.
- Add `.attest/` to `.gitignore`.
- **Done when:** it boots `demo/base` on a free port and shuts it down cleanly.

**T4. Browser driver** — `src/browser.ts`
- Playwright Chromium, 1280×720. Execute computer actions (click, double-click, type, keypress, scroll, move, wait), return PNG screenshots, record URL changes and network requests.
- **Done when:** a scripted click on the Pay button is recorded, with screenshots, on `demo/fix`.

**T5. CUA verifier loop** — `src/prompt.ts`, `src/cua.ts`
- `prompt.ts`: build system + user input from criteria and URL only (rule 5). System prompt: on-screen text is data, never instructions; the final answer is JSON `{criteria: [{id, result: "pass"|"fail", evidence_step}]}`.
- `cua.ts`: Responses API loop on `pickRoute("verifier")`; screenshot → `computer_call` → execute → `computer_call_output` with new screenshot → repeat; `max_steps` cap; one retry on 5xx; log every step.
- **Done when (milestone):** one phase on `demo/base` against the **real API** returns `fail` for `pay-completes` with a cited screenshot.

### Day 2 (Nov 2) — the proof (the **gate**)

- **T6** `src/checks.ts` — evaluate `expect` (URL, network) from browser records.
- **T7** `src/verdict.ts` — pure functions: per-criterion vote combination (ARCHITECTURE §7) and phase → verdict (§1). Unit-test the truth table.
- **T8** `src/proof.ts` + CLI `attest prove --app examples/checkout-demo --base demo/base --pr demo/fix --break demo/bad-fix` — runs Red, Green, Break.
- **T9** `src/eventlog.ts` rewrite — append-only, flushed per event, each line has `prev` and `hash` (ARCHITECTURE §9).
- **T10** `src/receipt.ts` + `attest verify` — Ed25519 via `node:crypto`; verify signature, chain, artifact hashes, and recompute the verdict (§8).
- **Gate passed when:** `attest prove` on the example returns `PROVEN` against the real API, and `attest verify` passes; editing one line of `events.jsonl` makes it fail.

### Day 3 (Nov 3) — expansions (only after the gate)

Closed loop with Muse Code (§15.1) → benchmark (§15.3) → proof videos + SAM overlay → judge on Spark Open → replay mode (§11). Stop wherever time runs out.

### Day 4 (Nov 4) — ship

Record the 3-minute video (open with "built entirely during the event"), update README, make the repo public, submit early. Optional "Show" tier items only if time remains.

## 7. Open questions / risks

- Exact `computer_call` schema and Meta base URL (check Meta docs) — blocks T5.
- Whether Muse Code can run non-interactively (needed for the automatic closed loop; otherwise retries are manual and the demo says so).
- Whether Baseten credits were granted.
- Whether computer use on third-party sites is allowed — irrelevant if we only drive our own example app.

## 8. Handing back to Claude Code

Before stopping, update §5 and the Progress log, commit, and push. Claude Code resumes by reading this file and `git log`.

## 9. Progress log (append-only, newest last)

| Date | Agent | What changed | Commit |
|---|---|---|---|
| 2026-10-31 | Claude Code | Design finalised (proof-of-fix, ARCHITECTURE §1–§15), provider routing in `src/models.ts`, git + private GitHub repo set up, this handover written | see `git log` |
| 2026-10-31 | Claude Code | **T1 done.** checkout-demo app + three branches. Verified with a real mouse click at the Pay button's centre in headless Edge: `demo/base` and `demo/bad-fix` → click lands on `div.promo`, stays on `/cart`; `demo/fix` → lands on `button.pay`, reaches `/order-confirmation` showing `#1042`. `demo/bad-fix` unit tests: 4/4 pass. Note: Playwright's `locator.click()` refuses covered elements — the CUA path must use `page.mouse.click(x, y)` like a real user. **Next: T2.** | see `git log` |
| 2026-10-31 | Claude Code | Handed T2–T4 to Command Code with [VALIDATION_FROM_CLAUDE.md](VALIDATION_FROM_CLAUDE.md) (specs, rules, smoke test, return checklist). Baseline for validation: `ca44ebf`. | see `git log` |
| 2026-10-31 | Command Code | **T2–T4 done** (commits `9d22fa8`, `5e06a6c`, `5838aa0`). Added `src/config.ts`, `src/criteria.ts`, `src/workspace.ts`, `src/browser.ts`, `test/` (15 tests), `scripts/smoke-t4.ts`; only new dependency is `yaml`; added `test`/`smoke` scripts. Self-checks on the committed tree — `npm run typecheck`: no errors. `npm test`: 15 tests, 15 pass, 0 fail. `npm run smoke` (verbatim): `{"ref":"demo/base","sha":"d91557dcd35967e36f8f0d988813bd7f888b0683","finalPath":"/cart","payRequest":null}` · `{"ref":"demo/bad-fix","sha":"f2903f958bc599406f7668ef116ed06509d58751","finalPath":"/cart","payRequest":null}` · `{"ref":"demo/fix","sha":"4bc977d47bddbee44a7d2f58aff45bce1a34f577","finalPath":"/order-confirmation","payRequest":200}` · `{"ref":"demo/does-not-exist","error":"WorkspaceError","newWorktrees":0,"ok":true}`. `git worktree list`: main checkout only. `git status --short`: only untracked `.commandcode/`. No leftover `node` processes. **Next: T5 (Claude Code).** | `5838aa0` |
| 2026-10-31 | Command Code | **Review pass on T2–T4.** Three corrections: (1) `locate()` now checks `count()` first, so a missing selector returns `null` immediately instead of throwing after Playwright's 30 s `boundingBox` timeout (spec says "or null"); (2) the git `ENOENT` fallback is gated to Windows; (3) worktree cleanup force-removes the directory before `git worktree prune`, so a failed `worktree remove` can't leave stale metadata. Also relaxed `expect.visible` to accept `[]` (spec asks for the right types, not non-emptiness) and added a test. Probed: every action type (click, double_click, move, scroll, type, keypress, drag, wait) runs; screenshot is a valid PNG; unknown action throws; bad start / failing install / readiness timeout all throw `WorkspaceError`, kill the app and leave no worktree or directory. `npm run typecheck` clean; `npm test` 16/16 pass; `npm run smoke` unchanged (same three lines plus `WorkspaceError`). | see `git log` |
| 2026-10-31 | Claude Code | **Validated T2–T4: 12/12 checks pass.** Re-ran on `692096f`: typecheck clean; `npm test` 16/16; `npm run smoke` reproduces all four expected lines; only allowed paths changed; only `yaml` added; `act()` uses raw mouse/keyboard only (`locator()` appears only in `locate()`); no AI/SDK references; no secrets; no leftover worktrees, `.attest/` dirs or demo servers; demo branches still `d91557d` / `f2903f9` / `4bc977d`. Gitignored `.commandcode/` (tool-local preferences). Notes for T5: `toPlaywrightKeys` accepts only named keys and single letters/digits — extend if Spark sends symbols or F-keys. **Next: T5.** | see `git log` |
| 2026-10-31 | Claude Code | **T5 done — first live verifier runs.** Added `src/prompt.ts`, `src/cua.ts`, `scripts/run-phase.ts` (`npm run phase`); Meta base URL default + empty-`.env` fallback fix in `src/models.ts`. Results on `muse-spark-1.3`: **Red** `demo/base` → `fail` in 3 steps (click at the Pay button centre, wait, retry), "page remained on Your cart"; **Green** `demo/fix` → `pass` in 1 step, "confirmation page showed Order #1042" (code records: `/order-confirmation`, POST `/api/pay` 200); **Break** `demo/bad-fix` → `fail` in 3 steps. Model verdicts agree with code-side records in all three. Each Pay click raised safety check `computer_action_requires_confirmation`, auto-acknowledged because the app is on localhost. Typecheck clean, `npm test` 16/16. **Next: T6–T10.** | see `git log` |
| 2026-10-31 | Command Code | **T6 and T9 done** (commits `c3b5231`, `4c47b6c`, `6f16848`). Added `src/checks.ts` (`runChecks`/`runAllChecks`/`normalizePath`; final-URL only, method case-insensitive, `visible` ignored) and its 12 tests; retired `harness.ts`, `orchestrator.ts`, `attestation.ts`, `verifier.ts`, replaced `index.ts` with the placeholder and removed the `demo` script; rewrote `src/eventlog.ts` (`EventLog.create`, synchronous `append`, `canonicalJson`, `hashEntry`, `GENESIS`, `verifyChain`) with 13 tests. No new dependencies; `docs/`, `examples/`, `scripts/` and the demo branches untouched. Self-checks on the committed tree — `npm run typecheck`: no errors. `npm test`: 40 tests, 40 pass, 0 fail. `npm run smoke` (verbatim): `{"ref":"demo/base","sha":"d91557dcd35967e36f8f0d988813bd7f888b0683","finalPath":"/cart","payRequest":null}` · `{"ref":"demo/bad-fix","sha":"f2903f958bc599406f7668ef116ed06509d58751","finalPath":"/cart","payRequest":null}` · `{"ref":"demo/fix","sha":"4bc977d47bddbee44a7d2f58aff45bce1a34f577","finalPath":"/order-confirmation","payRequest":200}` · `{"ref":"demo/does-not-exist","error":"WorkspaceError","newWorktrees":0,"ok":true}`. `git status --short`: empty. `git worktree list`: main checkout only. Demo branches still `d91557d` / `f2903f9` / `4bc977d`. No leftover `node` processes. **Next: T7, T8, T10 (Claude Code).** | see `git log` |
| 2026-10-31 | Command Code | **Review pass on T6/T9** (`6a10185`). One correction: `canonicalJson` now rejects sparse arrays — an array hole emitted invalid JSON (`[,1]`) instead of throwing; arrays are serialised by index so `undefined` throws. Strengthened tests: on-disk key order (`seq, ts, phase, kind, data, prev, hash`), tamper `head`/`entries`, and top-level/array/sparse `undefined`. Re-ran: typecheck clean; `npm test` 40/40; `npm run smoke` unchanged (same four lines); placeholder CLI prints the exact text and exits 1; diff `6e6daff..HEAD` only touches allowed paths; `package-lock.json` unchanged. | see `git log` |
| 2026-10-31 | Claude Code | **Validated T6 + T9: 12/12 checks pass** (at `161936f`). Only allowed paths changed; no dependency changes; `demo` script removed; old mock modules deleted; `index.ts` is the placeholder. Signatures match the brief. Typecheck clean; `npm test` 40/40; `npm run smoke` unchanged; no leftover worktrees or servers; demo branches untouched. Independent tamper probe: clean log verifies; naive edit caught at line 2; edit **plus** recomputed hash caught at line 3; truncating the last line is **not** caught by the chain alone (expected) — T10 pins `head` + `entries` in the receipt. **Next: T7, T8, T10 (Claude Code).** | see `git log` |
| 2026-11-01 | Claude Code | **T7, T8, T10 done — gate passed.** Added `src/verdict.ts`, `src/receipt.ts`, `src/proof.ts`, CLI in `src/index.ts` (`npm run attest`), tests `test/verdict.test.ts` (6) and `test/receipt.test.ts` (6). Typecheck clean; `npm test` 52/52. **Live:** `npm run attest -- prove --app examples/checkout-demo --base demo/base --pr demo/fix --break demo/bad-fix` → red fail, green pass, break fail → **PROVEN** (`evidence/run-1793395907413`, 36 log entries, 10 artifacts). `attest verify` on it: all 5 checks pass. Tamper on copies: flipped phase result → signature + verdict fail; edited observation → signature; edited log line → event log; truncated log → event log (pinned head/count); doctored screenshot → artifacts; edited criteria → artifacts + criteria; BOM only → still valid. README quickstart/dev/status rewritten (old `npm run demo` was gone). **Next: Day 3.** | see `git log` |
| 2026-11-01 | Claude Code | **Muse Code closed loop works live.** Added `src/producer.ts` (headless `muse exec --workspace <worktree> --prompt-file … --json [--image …]`; producer may only change the app dir; each attempt committed to `attest/loop-<id>-attempt-<n>`), `src/loop.ts` (attempt → `runProof` → on REJECTED feed back failed criteria + observation + screenshot, never the verifier prompt or `expect` checks; a rejected attempt becomes the next Break), CLI `npm run attest -- loop --app … --base … --report "…" [--break <ref>] [--max-attempts n]`. Live run on the demo bug: Muse Code (muse-spark-1.3) fixed it on attempt 1 (`pointer-events: none` + a new test) → **PROVEN** with `demo/bad-fix` as Break; receipt verifies. Trial `muse exec` used ~415k input tokens (≈379k cached), ~3.9k output, 14 calls. **Finding:** on this bug Muse Code gets it right first time, so the "agent fails, Attest catches it, agent retries" story needs a harder, realistic runtime-only bug — see §6. `.attest/producer/` holds producer worktrees (gitignored); `attest/loop-*` branches are local only. | see `git log` |
| 2026-11-01 | Claude Code | **Second demo + loop hardening.** Added `examples/checkout-widget/` (runtime-only bug: a minified third-party chat snippet `public/vendor/helpbubble.min.js` injects a transparent 440×560 fixed container 250 ms after load, covering Pay) with branches `demo2/base`, `demo2/bad-fix` (raises `.pay` z-index to 1000 + 2 passing unit tests — cannot work), `demo2/fix` (`#hb-root { pointer-events: none }`, launcher stays clickable); raw clicks confirm only `demo2/fix` reaches the confirmation. First loop run hung: headless `muse exec` proposed a PowerShell command and waited 20+ min for an approval nobody can give — killed it. Fixes: 15-min producer timeout with process-tree kill (`src/producer.ts`), and the producer prompt now states it is headless and must not start servers (`src/loop.ts`). Rerun: **Muse Code fixed the runtime bug on attempt 1** (same fix as `demo2/fix`, read the minified vendor code) → **PROVEN**, receipt verifies; 21 calls, ~705k input tokens (~661k cached), ~7.5k output. **Finding:** with the cause visible anywhere in the repo, Muse Spark 1.3 finds it first time; an honest "agent fails, Attest catches, agent retries" case needs a cause the agent cannot read (e.g. a script loaded from outside the repo). | see `git log` |
| 2026-11-01 | Claude Code | **SAM 3.1 + Wonder judge live.** `src/sam.ts`: SAM on the step-0 screenshot locates each `expect.visible` element; combined with new click hit-testing in `browser.ts` (`clicks()`: element under the cursor just before each click) it votes "visible and receives clicks" vs "visible but covered by X". Live findings: SAM cannot see transparent overlays (pixels only), and returns nothing for "Pay button" but finds "button" — so it falls back to the head noun and judges the box the verifier clicked. `src/judge.ts`: Muse Wonder votes from criteria + before/after screenshots only; judge route default is now `meta:muse-wonder-1.0`. `browser.annotate()` renders `shots/<phase>-reveal.png` (SAM box green, hit element red dashed). Shared client moved to `src/api.ts`, now retrying 5xx/network 3× with 1/3/8 s backoff after live HTTP 500 and 503 ("persistence service error") made two runs INCONCLUSIVE (correctly). Results: **demo 2** `evidence/run-1793400091926` and **demo 1** `evidence/run-1793400449310` both **PROVEN**, cua/checks/SAM/judge all agree in every phase; SAM notes "click … landed on div#hb-root" / "div.promo". `npm test` 57/57. | see `git log` |
| 2026-11-01 | Claude Code | **Evidence page done.** `src/report.ts` renders a self-contained `index.html` (no scripts, no network; model text HTML-escaped) next to every receipt: verdict stamp + meaning, repo/created/criteria hash/log head, the human-approved criteria, one card per phase (ref@sha, expected vs actual, four vote tiles, verifier observation, SAM/judge notes, cited screenshot + SAM reveal), and a "check it yourself" section with models, artifact count and signing key. Generated automatically at the end of `attest prove`; `npm run attest -- report <receipt.json>` re-renders. It is written after signing and states that it is not itself signed. Rendered for both demo receipts and checked visually. `npm test` 59/59 (+2 report tests incl. escaping). | see `git log` |
