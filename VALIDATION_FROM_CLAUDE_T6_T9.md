# Validation from Claude — brief for T6 and T9

> **For:** Command Code (DeepSeek Flash v1) or any coding agent.
> **Written by:** Claude Code, 2026-10-31, at commit `2a6c81f` on `main` (repo at `C:\dev\attest`).
> **Scope:** **T6** (deterministic checks), **T9** (hash-chained event log), and retiring the old mock modules that T9 would otherwise break. Then stop. Claude Code does T7, T8 and T10.

Read [HANDOVER.md](HANDOVER.md) §2–§3 and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) §7 and §9 first. If they disagree with this file, **this file wins for T6/T9**.

---

## 1. Context

Attest already drives the example app with a real Spark verifier (T5). Two pieces are needed before the proof runner can exist:

- **T6:** code-side checks that don't involve any model — did the browser end on the expected URL, and did the expected network request happen with the expected status.
- **T9:** an append-only event log where every line carries the hash of the previous line, so editing, deleting or inserting any line is detectable.

## 2. Rules — breaking any of these fails validation

1. **Work in `C:\dev\attest` only.** Never touch `%USERPROFILE%\OneDrive\Documents\attest` (retired copy).
2. **Allowed changes, and nothing else:**
   - new: `src/checks.ts`, `test/checks.test.ts`, `test/eventlog.test.ts`
   - rewrite: `src/eventlog.ts`, `src/index.ts` (placeholder, §5)
   - delete: `src/harness.ts`, `src/orchestrator.ts`, `src/attestation.ts`, `src/verifier.ts` (the old mock design)
   - `package.json`: remove the `"demo"` script only
   - `HANDOVER.md`: §5 and §9 only
3. **Do not modify** `src/cua.ts`, `src/prompt.ts`, `src/models.ts`, `src/config.ts`, `src/criteria.ts`, `src/workspace.ts`, `src/browser.ts`, `src/types.ts`, `scripts/`, `docs/`, `examples/`, or any other file.
4. **Never commit to or push** the `demo/*` branches.
5. **No new dependencies.** Use `node:crypto`, `node:fs`, `node:path` only.
6. **No model or network calls** in T6/T9 code or tests.
7. **No secrets.** Don't read or print `.env`.
8. Blocked after two honest attempts → write the blocker in HANDOVER.md §9, commit, push, stop.

## 3. Environment

Same as last time (HANDOVER.md §3): Windows 11, PowerShell 5.1, Node 24, strict TypeScript ESM (`import type` for types, `.js` suffix on relative imports, `noUncheckedIndexedAccess`). Tests use `node:test` via `npm test`. Git may need its full path: `C:\Program Files\Git\cmd\git.exe`.

## 4. Specifications

Match these signatures exactly — T7, T8 and T10 depend on them.

### T6 — `src/checks.ts`

```ts
import type { NetworkRecord } from "./browser.js";
import type { Criterion } from "./criteria.js";

export type CheckResult = "pass" | "fail" | "n/a";

export interface CheckOutcome {
  kind: "url" | "network";
  result: "pass" | "fail";
  expected: string;   // human-readable, e.g. "/order-confirmation" or "POST /api/pay → 200"
  observed: string;   // human-readable, e.g. "/cart" or "no POST /api/pay request"
}

export interface CriterionChecks {
  id: string;                 // criterion id
  result: CheckResult;        // "n/a" if no url/network expectation; "fail" if any outcome fails; else "pass"
  outcomes: CheckOutcome[];   // one per expectation present, url first then network
}

export interface BrowserRecords {
  finalUrl: string;           // BrowserSession.currentUrl() at the end of the phase
  urlHistory: string[];       // BrowserSession.urlHistory()
  network: NetworkRecord[];   // BrowserSession.network()
}

export function runChecks(criterion: Criterion, records: BrowserRecords): CriterionChecks;
export function runAllChecks(criteria: Criterion[], records: BrowserRecords): CriterionChecks[];
export function normalizePath(path: string): string;
```

Semantics:

- **`expect.url`** → pass iff `normalizePath(pathname of finalUrl) === normalizePath(expect.url)`. Compare the **final** URL only; ignore query string and hash. `observed` = the final pathname.
- **`normalizePath`**: strip a trailing `/` unless the path is exactly `/`; leave case unchanged. `"/order-confirmation/"` → `"/order-confirmation"`, `"/"` → `"/"`.
- **`expect.network`** → pass iff **any** record has `method` equal ignoring case, `normalizePath(path)` equal, and `status` equal to the expected status. `observed`: if matching method+path records exist, list their statuses (e.g. `"POST /api/pay → 500"`, or `"POST /api/pay → failed"` for `status: null`); otherwise `"no POST /api/pay request"`.
- **`expect.visible`** is **ignored here** (SAM checks it later). Don't create an outcome for it.
- A criterion with no `expect`, or an `expect` with only `visible`, → `result: "n/a"`, `outcomes: []`.
- Pure functions: no I/O, no clocks, no randomness.

### T9 — `src/eventlog.ts` (full rewrite)

```ts
export interface LogEntry {
  seq: number;                      // 1, 2, 3, … with no gaps
  ts: string;                       // new Date().toISOString()
  phase: string | null;             // "red" | "green" | "break" | null for run-level events
  kind: string;                     // e.g. "run_start", "cua_action", "phase_result"
  data: Record<string, unknown>;    // JSON values only
  prev: string;                     // hash of the previous entry, or GENESIS for seq 1
  hash: string;                     // "sha256:<64 hex>" over the canonical form of all fields above
}

export const GENESIS: string;       // "sha256:" + "0".repeat(64)

export function canonicalJson(value: unknown): string;
export function hashEntry(entry: Omit<LogEntry, "hash">): string;

export class EventLog {
  /** Creates a new log file (and parent directories). Throws if the file already exists. */
  static create(path: string): EventLog;
  /** Appends one entry and writes it to disk before returning (appendFileSync). */
  append(kind: string, data?: Record<string, unknown>, phase?: string | null): LogEntry;
  get head(): string;               // hash of the last entry, or GENESIS when empty
  get length(): number;             // number of entries
  get path(): string;
}

export interface ChainCheck {
  ok: boolean;
  entries: number;                  // entries read (up to the first failure)
  head: string;                     // hash of the last valid entry, or GENESIS
  error?: { line: number; reason: string };   // 1-based line number of the first bad line
}

export function verifyChain(path: string): ChainCheck;
```

Rules:

- **`canonicalJson`**: JSON with **object keys sorted** recursively and no whitespace; arrays keep their order. Throw on `undefined`, functions, symbols, `BigInt`, `NaN`/`Infinity`, and non-plain objects (e.g. `Buffer`, `Date`) — callers must pass plain JSON values.
- **`hashEntry`**: `"sha256:" + hex(sha256(canonicalJson({ seq, ts, phase, kind, data, prev })))`.
- **File format**: one entry per line, `JSON.stringify` of the entry with keys in the order `seq, ts, phase, kind, data, prev, hash`, followed by `\n`. UTF-8, no BOM.
- **`append`**: computes `seq`, `ts`, `prev` (= current head), `hash`; writes the line with `appendFileSync`; returns the entry. Default `data = {}`, `phase = null`.
- **`verifyChain`**: read the file; split on `\n`, accepting `\r\n`; ignore one trailing empty line. For each line, in order, fail at the first of: invalid JSON; missing/wrong-type field; `seq !== index + 1`; `prev !== previous hash` (GENESIS for line 1); recomputed `hashEntry` ≠ stored `hash`. An empty file is `ok: true, entries: 0, head: GENESIS`. A missing file → `ok: false` with `line: 0`.

## 5. Retire the old mock modules

The old `EventLog` API (`new EventLog(path, sessionId)`, `.flush()`, `.all()`) is used only by the mock fan-out design, which ADR 0005 retired.

- Delete `src/harness.ts`, `src/orchestrator.ts`, `src/attestation.ts`, `src/verifier.ts`.
- Replace `src/index.ts` with a placeholder that prints this and exits with code 1 for any command:

  ```
  attest: the CLI is being rebuilt.
    npm run phase -- <ref> <label>   run one verifier phase (T5)
    npm run smoke                    plumbing smoke test (T4)
  `attest prove` and `attest verify` arrive with T8/T10.
  ```
- Remove the `"demo"` script from `package.json`.
- Leave `src/types.ts` alone even though some of its types become unused.

## 6. Tests

- `test/checks.test.ts`, at least:
  - url pass (`finalUrl` `http://localhost:4100/order-confirmation?order=1042` vs `/order-confirmation`)
  - url fail (`/cart`), with `observed: "/cart"`
  - trailing-slash normalisation
  - network pass (`POST /api/pay` 200 among other records)
  - network fail: no request → `observed` contains `"no POST /api/pay request"`
  - network fail: status 500 → `observed` contains `500`
  - method compared case-insensitively
  - `status: null` (failed request) → fail, `observed` contains `failed`
  - no `expect` → `"n/a"`; `expect` with only `visible` → `"n/a"`
  - both expectations present, one fails → criterion `"fail"`, two outcomes, url first
- `test/eventlog.test.ts` (temp files under `os.tmpdir()`), at least:
  - three appends → `verifyChain` ok, `entries: 3`, `head` equals the log's `head`
  - first entry's `prev` is `GENESIS`; `seq` is 1, 2, 3
  - `create` on an existing file throws
  - **tamper: edit one value in line 2 → `ok: false`, `error.line: 2`**
  - **delete line 2 → fails at line 2**
  - **reorder lines 2 and 3 → fails**
  - forged extra line with a wrong `prev` → fails at that line
  - CRLF line endings still verify
  - `canonicalJson({b:1,a:{d:2,c:3}})` → `{"a":{"c":3,"d":2},"b":1}`; throws on `undefined` and on a `Buffer`
  - empty file → ok with `GENESIS`; missing file → `ok: false`, `line: 0`

## 7. Commits

| Step | Commit message |
|---|---|
| T6 + tests | `Add deterministic checks (T6)` |
| §5 retirement | `Retire the mock orchestrator` |
| T9 + tests | `Rewrite event log with a hash chain (T9)` |
| Handover | `Update handover after T6 and T9` |

Before each commit: `npm run typecheck` and `npm test` must pass. Push with `git push origin main` after the last commit.

## 8. Self-check

Run, and paste the actual outputs (summaries are fine; include test counts) into HANDOVER.md §9:

```bash
npm run typecheck
npm test
npm run smoke
git status --short
```

Expected: typecheck clean; all tests pass (the earlier 16 plus yours); smoke still prints the same four lines as before; `git status --short` empty. Then update HANDOVER.md §5 (rows for `checks.ts`, `eventlog.ts`, the retired modules and `index.ts`) and §9, commit, push, and **stop**.

## 9. What Claude will check on return

| # | Check |
|---|---|
| 1 | `git diff --stat 2a6c81f..main` shows only the allowed paths (§2) |
| 2 | No dependency changes; `"demo"` script removed |
| 3 | Signatures match §4 exactly |
| 4 | `checks.ts` is pure; compares the final URL only; ignores `visible` |
| 5 | `canonicalJson` sorts keys and throws on non-JSON values |
| 6 | `append` writes synchronously before returning |
| 7 | All four tamper tests exist and pass (edit, delete, reorder, forged line) |
| 8 | `verifyChain` reports the first bad line, 1-based |
| 9 | Old mock modules deleted; `index.ts` is the placeholder; typecheck clean |
| 10 | `npm run smoke` unchanged |
| 11 | No secrets, no model/network calls, demo branches untouched |
| 12 | HANDOVER.md §5 and §9 updated with real outputs |
