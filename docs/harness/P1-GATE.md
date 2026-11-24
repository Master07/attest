# P1 gate report — harness-core extraction

The P1 question: did moving Attest's core (event log, receipts, router, cassettes, budget, the
OpenAI-compatible judge) into `@corbet/harness-core` change any observable behaviour? This report
is the evidence Opus reads to verify and recommend P1 — the owner approves. Every number below was re-run locally on the branch
head; the CI run links are filled in after the branch pushes.

- **Branch:** `t/T-005` from `main` @ `8562a1c`
- **Baseline commit (pre-extraction):** `b6b9b6a5c7899e018f9d394f083b007334d4f17c`
- **Local machine:** macOS (Darwin), Node v22.22.1, Google Chrome via `ATTEST_BROWSER_CHANNEL=chrome`
- **Keys:** none set (`MODEL_API_KEY`, `BASETEN_API_KEY` unset; no `.env`); replays scrub model keys case-insensitively, refuse a repo `.env`, and confine the signing key to a temp dir

## CI run links

GitHub Actions matrix `os: [windows-latest, macos-latest, ubuntu-latest]`, job `verify`.

- Linux:   TODO(Opus): link after CI
- macOS:   TODO(Opus): link after CI
- Windows: TODO(Opus): link after CI

The workflow (`.github/workflows/verify.yml`) runs, on every OS: `npm run typecheck`, `npm test`
(which includes `packages/harness-core/test`), `npm run verify-proofs`, and
`npx tsx scripts/replay-all.ts` with `ATTEST_BROWSER_CHANNEL: chrome`. The replay step fails the
job if its output differs from `docs/harness/replay-baseline.txt`. No `secrets.` are referenced.

## Counts (before → after)

| Check | T-001 (before) | After T-004 (this branch) |
|---|---|---|
| `npm test` macOS / Linux | 152 | **252** |
| `npm test` Windows | 153 | **253** (one extra: `test/prcomment.test.ts:201`, gated on `win32`) |
| Receipts verified (`npm run verify-proofs`) | 220 of 220 | **220 of 220** (sha256 `c933813000d94457236f42b40d67c09503fa17f6ff687cc61c4f2d7357a73007` — unchanged) |
| Cassette replays (`scripts/replay-all.ts`) | not a check | **2 of 2** match the committed baseline |

Local re-run on the branch head (macOS):

```
npm run typecheck   → exit 0, no output
npm test            → 252 tests, 252 pass, 0 fail
npm run verify-proofs → 220 of 220 receipts valid (hash matches baseline)
npx tsx scripts/replay-all.ts (ATTEST_BROWSER_CHANNEL=chrome) →
  checkout-widget · PROVEN · 54 events · fp:d849ae1eb892a099
  checkout-demo   · PROVEN · 54 events · fp:795fca3dc280e5e8
  exit 0
```

Both fingerprints are byte-identical to the lines recorded at `b6b9b6a` (before any code moved),
so the extraction preserved every field the fingerprint watches: phase/kind ordering, verifier
steps, checks outcomes, judge votes, and the final verdict. `log.head` is not the baseline (it
carries timestamps, ports and screenshot hashes that change every run); the fingerprint is.

## Files in `@corbet/harness-core`

The core now has these files. Some were **extracted** from `src/eventlog.ts`, `src/receipt.ts`,
`src/models.ts` and `src/api.ts`; others are **new** (the adapters and `providers/openai-compat.ts`).
The `index.ts` barrel was added with the empty workspace before T-002:

| File | Moved by | Provenance | What it is |
|---|---|---|---|
| `eventlog.ts` | T-002 (#4) | extracted from `src/eventlog.ts` | Append-only hash-chained event log + chain verification |
| `receipt.ts` | T-002 (#4) | extracted from `src/receipt.ts` | Ed25519 signing + the generic receipt verifier |
| `adapters/node.ts` | T-002 (#4) | new | Node crypto/fs backing (sha256, file I/O, Ed25519) |
| `router.ts` | T-003 (#5) | extracted from `src/models.ts` | Model router: role → provider + model, env-overridable |
| `cassette.ts` | T-003 (#5) | extracted from `src/api.ts` | Record-once / replay-with-no-calls cassette |
| `budget.ts` | T-003 (#5) | extracted from `src/api.ts` | Step caps + retry budget |
| `adapters/cassette-node.ts` | T-003 (#5) | new | Node file backing for `Cassette` |
| `providers/openai-compat.ts` | T-004 (#6) | new | OpenAI-compatible Chat Completions judge provider |

`src/` keeps the product surface (CLI, `proof.ts`, `cua.ts`, `judge.ts`, `sam.ts`, `browser.ts`,
`workspace.ts`, `models.ts`) and now imports the core types and helpers from `@corbet/harness-core`.

## Public API of `@corbet/harness-core`

Every export of the package (`packages/harness-core/src/index.ts`), one line each. `HARNESS_CORE_VERSION`
is `"0.0.0"`.

`eventlog.ts` (exported via `export *`):
- `HARNESS_CORE_VERSION` — package version string (declared in `index.ts`)
- `LogEntry` — one hashed line of the event log (seq, ts, phase, kind, data, prev, hash)
- `GENESIS` — the initial `prev`/`head` (`sha256:` + 64 zeros)
- `canonicalJson(value)` — JSON with recursively sorted keys and no whitespace
- `canonicalBytes(value)` — the exact bytes a value is signed/hashed as
- `hashEvent(prev, event)` — `sha256:` hash of one event chained after `prev`
- `hashEntry(entry)` — `hashEvent` over an `Omit<LogEntry,"hash">`
- `EventLog` — append-only log: `create(path)`, `append(kind, data, phase?)`, `read()`, `.head`, `.length`, `.path`
- `ChainCheck` — result of verifying log text at a path
- `EventsChainCheck` — result of verifying already-parsed events (`ok`, `brokenAt?`)
- `verifyChainText(text)` — verify log text already in memory
- `verifyChain(input)` — verify a path (string) or parsed events (`LogEntry[]`); overloaded
- `verifyChainFile(path)` — path-based chain verification under an explicit name

`receipt.ts` (exported via `export *`):
- `ReceiptSignature` — `{ alg: "ed25519", public_key, value }`
- `ReceiptLogRef` — `{ path, head, entries }` pinning the event log
- `VerifiableReceipt<V>` — the core-shaped part a verifier reads
- `VerifyStep` — one check result `{ check, ok, detail }`
- `VerifyResult<V>` — `{ ok, verdict, steps }`
- `VerifyReceiptDeps<R, V>` — caller-supplied `dir`, `loadEvents`, `loadArtifact`, `extraSteps?`, `recompute?`
- `hashArtifact(bytes)` — `sha256:<hex>` of artifact bytes
- `keyFingerprint(publicKey)` — short `sha256:` id for a signing key
- `createSignature(body, privateKeyPem)` — Ed25519 signature object over a canonical body
- `sign(bytes, privateKeyPem)` — base64 Ed25519 signature over raw bytes
- `verifySignature(body, signature)` / `verifySignature(bytes, value, publicKey)` — verify; overloaded
- `verifyReceipt(receipt, deps)` — signature → chain → artifacts → caller steps → verdict

`router.ts`:
- `createRouter(options)` — build a `Router`
- `Router` — `resolve(role, opts?)` and `resolveProvider(provider, env?)`
- `RouterOptions` — `envPrefix`, `routes`, `providers`, `replayEnvVar`, `openWeights?`, `contributorVariant?`
- `ResolveOptions` — `{ contributor?, env? }`
- `ResolvedRoute` — `ModelRoute` + `source`
- `ModelRoute` — `{ provider, model }`
- `RouteSource` — `"default" | "env" | "cassette"`
- `ProviderConfig` — `{ apiKeyEnv, baseUrlEnv, defaultBaseUrl? }`
- `ProviderEndpoint` — `{ baseUrl, apiKey }`
- `OpenWeightsRule` — a role that prefers `route` when its provider key is set or replaying
- `ContributorVariant` — a role's contributor model variant

`cassette.ts`:
- `Cassette` — `emptyReplay(path, io, opts?)`, `replay(path, io, opts?)`, `record(path, io)`, `load()`, `nextResponse(model)`, `appendResponse(model, response, ms?)`
- `CassetteExhaustedError` — thrown when a replay has no recording left for a model
- `ReplayOptions` — `{ wait?, defaultMs?, maxMs?, sleep? }`
- `CassetteLine` — `{ seq, model, ms?, response }`
- `CassetteIo` — `{ readText(path), appendText(path, text) }`

`adapters/cassette-node.ts`:
- `nodeCassetteIo` — `CassetteIo` backed by `node:fs` `readFileSync`/`appendFileSync`

`providers/openai-compat.ts`:
- `createOpenAICompatProvider(options)` — build an `OpenAICompatProvider`
- `OpenAICompatProvider` — `judge(request): Promise<OpenAICompatJudgeOutcome>`
- `OpenAICompatProviderOptions` — `{ baseUrl, apiKey, timeoutMs?, fetch? }`
- `OpenAICompatJudgeRequest` — `{ model, instructions, task, criteriaIds, images }`
- `OpenAICompatImage` — `{ label, dataUrl }`
- `OpenAICompatVote` — `{ id, result: "pass"|"fail", reason }`
- `OpenAICompatJudgeOutcome` — `{ votes: OpenAICompatVote[] }` or `{ vote: null, error }`

`budget.ts`:
- `Budget` — `spend()`, `exhausted()`, `useTransientRetry()`, `retryPolicy(backoffMs, isTransient, sleep?)`; `maxSteps`, `maxRetries`, `transientRetry`
- `createBudget(opts)` — construct a `Budget`
- `withRetries(send, opts)` — retry transient failures with backoff; throw on anything else
- `BudgetOptions` — `{ maxSteps, maxRetries, transientRetry }`
- `RetryOptions` — `{ backoffMs, maxRetries?, isTransient, sleep? }`
- `RetryPolicy` — `RetryOptions` with a required `maxRetries` (from a `Budget`)

## Replay check design

`scripts/replay-all.ts` runs each cassette in its **own child process** (`node --import tsx
src/index.ts prove --replay … --out <tmpdir>`, no shell, so paths with spaces work on every OS):
the replay queue in `src/api.ts` is a process-wide singleton loaded once from the first cassette
path and never reset, so two cassettes cannot share a process. Each child must exit 0
**independently** of the fingerprint check — a child that crashes after writing a matching
`events.jsonl` still fails the script, with the exit code and the last stderr lines printed. Each
run writes its evidence and signing key under a temp directory (never the repo or `~/.attest`;
`ATTEST_KEY_PATH` points there), with `MODEL_API_KEY`, `BASETEN_API_KEY`, any `OPENAI_COMPAT*`,
`OPENAI_*`, `OPENROUTER_*`, any `ATTEST_ROUTE_*`, `ATTEST_RECORD` and `ATTEST_KEY_PATH` removed
case-insensitively from the child environment (so a Windows `Model_Api_Key` is caught). A repo
root `.env` is refused outright — `src/index.ts:28` reloads it and could restore the scrubbed
keys (CI has none). The script then reads `events.jsonl`, computes the BASELINE.md fingerprint,
prints `name · verdict · <n> events · fp:<16 hex>`, and compares the printed lines against
`docs/harness/replay-baseline.txt` exactly (CRLF/CR normalised to LF, no trim: a missing or extra
line, a blank line, or stray whitespace on any line all fail). Temp dirs are removed on success.
When a replay finishes but its fingerprint or exit code is wrong, they are kept and their paths
printed; an earlier failure (a spawn error, a malformed `events.jsonl`, an unreadable baseline file)
throws before that point, still exits non-zero, but may not print the temp paths.

## Replay check self-test

Run locally on the branch head (macOS, Chrome), each with `ATTEST_BROWSER_CHANNEL=chrome`:

- **A mismatched baseline line fails.** A copy of the baseline with one fingerprint hex digit
  changed (`fp:d849ae1eb892a09X`) is passed as the baseline path; the two real replays still
  produce the correct fingerprints, and the exact comparison catches the one-char difference:
  ```
  line 1 differs:
    expected: checkout-widget · PROVEN · 54 events · fp:d849ae1eb892a09X
    actual:   checkout-widget · PROVEN · 54 events · fp:d849ae1eb892a099
  ```
  exit 1.
- **An extra blank line fails.** A copy of the baseline with one trailing blank line added is
  passed as the baseline path; the no-trim comparison sees a third expected line with no matching
  actual line:
  ```
  line 3 differs:
    expected: 
    actual:   (missing)
  ```
  exit 1.
- **A child that exits non-zero fails.** `ATTEST_REPLAY_SELFTEST=bad-app` (read only by
  `replay-all.ts`, never by `src/`) points the first cassette at `does/not/exist`, so the child
  throws in `loadConfig` and exits 1 before any evidence is written. The exit-code check fires
  independently of the fingerprint:
  ```
  [checkout-widget] child exited 1
  [checkout-widget] last stderr lines:
    attest: …/does/not/exist/attest.yml: cannot read attest.yml (ENOENT: no such file or directory, open '…/does/not/exist/attest.yml')
  ```
  The second cassette still runs (PROVEN); the script exits 1 and keeps the temp dirs.

The normal run (`ATTEST_BROWSER_CHANNEL=chrome npx tsx scripts/replay-all.ts`) prints the two
baseline lines and exits 0; `git status` is clean afterwards (no key written in the repo, temp
dirs removed on success). Left for Opus: the CI links above, and the card's throwaway-branch check
(a one-byte edit to a committed cassette must make CI fail; the branch is deleted afterwards).

## Known gaps

- **The four real-world cassettes are not replayed.** `examples/realworld/{board-enter,
  board-focus-trap,jspaint-attributes-focus,roadmap-pulls}/cassette.jsonl` each need a fetch of a
  third-party repo (and some a hand-built bad fix, and internet for CDN page components), so they
  cannot replay with the network restricted to the app under test. Their committed receipts are
  among the 220 that `verify-proofs` checks (signatures, hash chains, artifact hashes, recomputed
  verdicts). The two in-repo cassettes exercise the whole pipeline (workspace, browser, verifier,
  checks, SAM, judge, verdict, receipt).
- **Existing clones must run `npm install` again after pulling.** `packages/harness-core` is a new
  npm workspace (`"workspaces": ["packages/*"]`); a stale `node_modules` will not resolve
  `@corbet/harness-core`. CI runs `npm ci` so it is always fresh.
- **T-004a minor test gaps** (commit `0eac356`, "tests first for the openai-compat judge
  provider"), left for later: (1) the late-abort check is not on every path; (2) no test that
  `timeoutMs` must be a positive integer; (3) a >60 s backoff would hang rather than fail; (4)
  ambient `ATTEST_REPLAY` in the shell is not cleared.
- **The Muse sandbox cannot run browser replays**, so Opus runs the two cassette replays locally
  (Chrome) and posts the result; the CI step reproduces them on GitHub runners, which ship Chrome.
- **CI links are `TODO(Opus)`** because the branch has not pushed yet; Opus fills them in and
  re-runs every line before recommending the owner's sign-off. The owner approves P1.
