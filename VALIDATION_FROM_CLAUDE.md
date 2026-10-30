# Validation from Claude — brief for T2–T4

> **For:** Command Code (DeepSeek Flash v1) or any coding agent taking over from Claude Code.
> **Written by:** Claude Code, 2026-10-31, at commit `ca44ebf` on `main`.
> **Scope:** tasks **T2, T3, T4 only**. Then stop and hand back. Claude Code does T5 (the Spark computer-use loop) and validates your work against §7.

Read [HANDOVER.md](HANDOVER.md) §2 (hard rules) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) §3, §5 before starting. This file is more specific than both; if they disagree, **this file wins for T2–T4**.

---

## 1. Context in 60 seconds

Attest proves a pull request fixes a bug. It starts the app at three git refs (base, PR, wrong fix), drives each with a browser, and records what happened. T2–T4 build the plumbing: read the config files, start an app from a git ref, and drive a browser with **raw mouse/keyboard actions**.

The example app is ready: `examples/checkout-demo/`, with branches `demo/base`, `demo/bad-fix`, `demo/fix`. On `base` and `bad-fix` an invisible promo layer covers the Pay button; on `fix` it doesn't.

## 2. Rules — breaking any of these fails validation

1. **Only touch these paths:** `src/config.ts`, `src/criteria.ts`, `src/workspace.ts`, `src/browser.ts` (all new), `test/` (new), `scripts/smoke-t4.ts` (new), `package.json` + `package-lock.json` (only for the `yaml` dependency and the `test`/`smoke` scripts), `.gitignore`, `HANDOVER.md` (§5 and §9 only).
2. **Do not modify or delete** anything else — in particular `src/models.ts`, `src/types.ts`, `src/index.ts`, the old mock modules (`harness.ts`, `orchestrator.ts`, `attestation.ts`, `verifier.ts`, `eventlog.ts`), `docs/`, and anything under `examples/`.
3. **Never commit to or push** `demo/base`, `demo/bad-fix`, `demo/fix`. Work on `main` only.
4. **One new dependency only:** `yaml` (ISC licence). No other packages. No LLM SDKs.
5. **No model calls of any kind.** T2–T4 contain zero AI calls. (Hackathon rule: every runtime model must be a Meta model; that's T5's job, not yours.)
6. **In `browser.ts`, never use `locator.click()`, `page.click()`, `locator.fill()` or any element-targeted action** for executing actions. Use only `page.mouse.*` and `page.keyboard.*` at coordinates. Playwright's element click refuses covered elements, which would hide the exact bug the demo exists to catch.
7. **No secrets.** Don't create `.env`, don't print environment variables.
8. **Don't make the repo public**, don't change GitHub settings.
9. If something is blocked after 2 honest attempts, **stop**, write the blocker in HANDOVER.md §9, commit, push, and hand back. Don't work around the rules.

## 3. Environment

- Windows 11, PowerShell 5.1. Node 24, npm 11. TypeScript strict ESM: `"type": "module"`, `module: NodeNext`, `verbatimModuleSyntax` (use `import type` for types), `noUncheckedIndexedAccess` (array/record access may be `undefined` — handle it).
- Relative imports in `src/` end in `.js` (e.g. `import { loadConfig } from "./config.js"`), matching existing files.
- Run TypeScript with `tsx` (already installed). Type-check with `npm run typecheck`.
- **git may not be on PATH** in older shells. In code, run `git`; if spawning fails with `ENOENT` on Windows, retry with `C:\Program Files\Git\cmd\git.exe`.
- Playwright 1.64.1 is installed **without bundled browsers**. Launch with `channel: "msedge"` (Edge is installed). Don't run `npx playwright install`.
- npm may print `install-scripts` warnings about esbuild. They're harmless; `tsx` works.

## 4. Specifications

Match these signatures exactly — T5 depends on them. Add internal helpers freely.

### T2 — `src/config.ts`

```ts
export interface AppConfig {
  install?: string;      // shell command, optional
  start: string;         // shell command; the app reads PORT from env
  url: string;           // may contain $PORT
  ready: string;         // path polled until HTTP 200, e.g. "/cart"
  timeout_s: number;     // default 90
}
export interface BrowserConfig { viewport: { width: number; height: number } }   // default 1280x720
export interface VerifierConfig { max_steps: number; judge: boolean }             // defaults 25, true
export interface AttestConfig { app: AppConfig; browser: BrowserConfig; verifier: VerifierConfig }

export class ConfigError extends Error {}

/** Reads <appDir>/attest.yml, applies defaults, validates types. */
export function loadConfig(appDir: string): AttestConfig;

/** Replaces every "$PORT" in a URL template. resolveUrl("http://localhost:$PORT", 4100) → "http://localhost:4100" */
export function resolveUrl(template: string, port: number): string;
```

- Errors are `ConfigError` with the **file path and field name** in the message, e.g. `examples/x/attest.yml: app.start must be a non-empty string`.
- Missing `app`, `app.start`, `app.url` or `app.ready` → error. Wrong types → error. Unknown keys → ignore.

### T2 — `src/criteria.ts`

```ts
export interface Expect {
  url?: string;                                            // path the browser must end on
  network?: { method: string; path: string; status: number };
  visible?: string[];                                      // element names, checked by SAM later
}
export interface Criterion { id: string; given: string; when: string; then: string; expect?: Expect }
export interface CriteriaFile {
  id: string;
  criteria: Criterion[];
  sha256: string;   // hex SHA-256 of the file text with CRLF normalised to LF
  path: string;     // absolute path that was loaded
}

export class CriteriaError extends Error {}
export function loadCriteria(path: string): CriteriaFile;
```

- **Hash rule (important):** read as UTF-8, replace `\r\n` with `\n`, then SHA-256 (`node:crypto`). Windows checkouts convert line endings; the hash must be identical either way.
- Validate: top-level `id` non-empty string; `criteria` is a non-empty array; every criterion has non-empty `id`, `given`, `when`, `then`; **ids are unique**; `expect`, if present, has the right types. Errors are `CriteriaError` with path and criterion id.

### T3 — `src/workspace.ts`

```ts
import type { AttestConfig } from "./config.js";

export interface Workspace {
  ref: string;        // as requested, e.g. "demo/base"
  sha: string;        // resolved full commit SHA
  dir: string;        // worktree directory (absolute)
  appDir: string;     // dir + appPath
  port: number;
  url: string;        // resolveUrl(config.app.url, port)
  logs(): string[];   // last 200 lines of the app's stdout+stderr
  stop(): Promise<void>;   // idempotent; never throws
}

export interface StartOptions {
  repoRoot: string;   // absolute path of the attest repo
  appPath: string;    // relative, e.g. "examples/checkout-demo"
  ref: string;
  phase: string;      // "red" | "green" | "break" | any label; used in the dir name
  config: AttestConfig;
  port?: number;      // default: a free port chosen by the OS
}

export class WorkspaceError extends Error {}
export async function startWorkspace(opts: StartOptions): Promise<Workspace>;
```

Behaviour, in order:

1. `git rev-parse --verify <ref>^{commit}` → `sha`. Unknown ref → `WorkspaceError`, nothing created.
2. `dir = <repoRoot>/.attest/worktrees/<phase>-<Date.now()>`; `git worktree add --detach <dir> <sha>`.
3. If `config.app.install` is set, run it in `appDir` (`shell: true`), wait for exit; non-zero exit → cleanup, then `WorkspaceError` with the last output lines.
4. Pick a free port (listen on port 0 with `node:net`, read it, close) unless `opts.port` is given.
5. Spawn `config.app.start` in `appDir` with `shell: true`, env = `process.env` + `PORT=<port>`. Keep the last 200 output lines.
6. Poll `GET <url><ready>` every 500 ms until status 200 or `timeout_s`. Use global `fetch`. Process exited early or timeout → cleanup, then `WorkspaceError` including the last 20 log lines.
7. `stop()`: kill the **whole process tree** (Windows: `taskkill /T /F /PID <pid>`; elsewhere spawn with `detached: true` and `process.kill(-pid, "SIGKILL")`), then `git worktree remove --force <dir>`, then `git worktree prune`. Safe to call twice; swallow errors.
8. **Any failure after step 2 must clean up the worktree** before throwing.

Add `.attest/` handling: it's already in `.gitignore`; don't commit anything under it.

### T4 — `src/browser.ts`

Action names mirror the computer-use tool's action types so T5 can pass them straight through.

```ts
export type Action =
  | { type: "click"; x: number; y: number; button?: "left" | "right" | "middle" }
  | { type: "double_click"; x: number; y: number }
  | { type: "move"; x: number; y: number }
  | { type: "scroll"; x: number; y: number; scroll_x: number; scroll_y: number }
  | { type: "type"; text: string }
  | { type: "keypress"; keys: string[] }            // e.g. ["CTRL", "A"] or ["ENTER"]
  | { type: "drag"; path: { x: number; y: number }[] }
  | { type: "wait"; ms?: number };                  // default 1000

export interface NetworkRecord { ts: string; method: string; url: string; path: string; status: number | null }

export interface BrowserSession {
  open(url: string): Promise<void>;                 // navigate, wait for "load"
  act(action: Action): Promise<void>;               // then wait ~300 ms for effects
  screenshot(): Promise<Buffer>;                    // PNG of the viewport
  currentUrl(): string;
  urlHistory(): string[];                           // every main-frame navigation, in order
  network(): NetworkRecord[];                       // every request with its response status (null if it failed)
  /** Test/debug only. Never expose to the verifier. Centre of the first match, or null. */
  locate(selector: string): Promise<{ x: number; y: number } | null>;
  close(): Promise<void>;                           // idempotent
}

export async function launchBrowser(viewport: { width: number; height: number }): Promise<BrowserSession>;
```

- Launch: `chromium.launch({ channel: process.env.ATTEST_BROWSER_CHANNEL ?? "msedge", headless: process.env.ATTEST_HEADLESS !== "0" })`.
- `click` → `page.mouse.click(x, y, { button })`; `double_click` → `page.mouse.dblclick`; `move` → `page.mouse.move`; `scroll` → `page.mouse.move(x, y)` then `page.mouse.wheel(scroll_x, scroll_y)`; `type` → `page.keyboard.type(text)`; `drag` → move to first point, `mouse.down()`, move through the rest, `mouse.up()`; `wait` → `page.waitForTimeout`.
- `keypress`: map names to Playwright keys and press as a chord joined with `+`. Map at least: `CTRL→Control`, `CMD/META→Meta`, `ALT→Alt`, `SHIFT→Shift`, `ENTER/RETURN→Enter`, `ESC/ESCAPE→Escape`, `TAB→Tab`, `BACKSPACE→Backspace`, `DELETE→Delete`, `SPACE→Space`, `UP/DOWN/LEFT/RIGHT→ArrowUp/…`, `PAGEUP/PAGEDOWN/HOME/END`. Single letters/digits pass through. Unknown key → throw.
- Network: record on `page.on("response")` (status) and `page.on("requestfailed")` (status `null`). `path` is the URL pathname.
- `urlHistory`: listen to `page.on("framenavigated")` for the main frame only.

### Tests — `test/`

Use the built-in runner. Add to `package.json` scripts:

```json
"test": "node --import tsx --test \"test/**/*.test.ts\"",
"smoke": "tsx scripts/smoke-t4.ts"
```

Required tests (put temp files in `os.tmpdir()`):

- `test/config.test.ts`: loads `examples/checkout-demo/attest.yml` with correct values; defaults applied when `browser`/`verifier` are missing; missing `app.start` → `ConfigError` naming the field; `resolveUrl` replaces `$PORT`.
- `test/criteria.test.ts`: loads `examples/checkout-demo/criteria.yml` (1 criterion, id `pay-completes`, `expect.url === "/order-confirmation"`); **LF and CRLF versions of the same text give the same `sha256`**; duplicate ids → `CriteriaError`; empty `criteria` → `CriteriaError`.
- `test/browser.test.ts`: keypress mapping (`["CTRL","A"]` → `"Control+A"`) as a pure exported helper `toPlaywrightKeys(keys: string[]): string`.

Workspace and browser behaviour are covered by the smoke script, not unit tests.

### Smoke — `scripts/smoke-t4.ts`

For each of `demo/base`, `demo/bad-fix`, `demo/fix`:

1. `loadConfig("examples/checkout-demo")` (resolve against the repo root).
2. `startWorkspace({ repoRoot, appPath: "examples/checkout-demo", ref, phase: "smoke", config })`.
3. `launchBrowser(config.browser.viewport)`; `open(ws.url + "/cart")`.
4. `locate("#pay")` → `act({ type: "click", x, y })` → `act({ type: "wait", ms: 1500 })`.
5. Print one JSON line: `{ ref, sha, finalPath, payRequest }` where `finalPath` is the pathname of `currentUrl()` and `payRequest` is the status of any `POST /api/pay` in `network()` (or `null`).
6. `close()` the browser and `stop()` the workspace **in a `finally`**.

Then also check one failure path: `startWorkspace` with ref `demo/does-not-exist` must throw `WorkspaceError` and leave no new worktree.

## 5. Order of work and commits

| Step | Commit message |
|---|---|
| T2 + its tests | `Add config and criteria loaders (T2)` |
| T3 | `Add workspace manager (T3)` |
| T4 + keypress test + smoke script | `Add browser driver and T4 smoke test (T4)` |
| Handover update | `Update handover after T2–T4` |

Before **each** commit: `npm run typecheck` and `npm test` must pass. Push to `origin main` after the last commit (`git push origin main`).

## 6. Self-check before handing back

Run these and paste the **actual outputs** into HANDOVER.md §9 (a short summary is fine, but include the smoke JSON lines verbatim).

```bash
npm run typecheck
npm test
npm run smoke
git worktree list
git status --short
```

Expected:

- typecheck: no errors. `npm test`: all pass, 0 fail.
- smoke, exactly this shape (SHAs will be real):

  ```
  {"ref":"demo/base","sha":"d91557d…","finalPath":"/cart","payRequest":null}
  {"ref":"demo/bad-fix","sha":"f2903f9…","finalPath":"/cart","payRequest":null}
  {"ref":"demo/fix","sha":"4bc977d…","finalPath":"/order-confirmation","payRequest":200}
  ```
  plus a line showing the `demo/does-not-exist` failure was a `WorkspaceError`.
- `git worktree list`: only the main checkout. `git status --short`: empty.
- No leftover `node` processes from the demo app (check Task Manager or `tasklist | findstr node`).

If `demo/base` reaches `/order-confirmation`, **your click is not a raw mouse click** — re-read rule 6.

Then update HANDOVER.md §5 (state of `config.ts`, `criteria.ts`, `workspace.ts`, `browser.ts`) and §9, commit, push, and **stop. Do not start T5.**

## 7. What Claude will check on return

| # | Check | How |
|---|---|---|
| 1 | Only allowed paths changed | `git diff --stat ca44ebf..main` |
| 2 | Only `yaml` added as a dependency | `git diff ca44ebf..main -- package.json` |
| 3 | Signatures match §4 | Read the four modules |
| 4 | No element-targeted actions in `act()` | Search `browser.ts` for `.click(`, `.fill(`, `locator(` outside `locate()` |
| 5 | No AI/LLM calls or SDKs | Search for `openai`, `anthropic`, `fetch(` to non-localhost, `deepseek` |
| 6 | Criteria hash is LF/CRLF-stable | Test exists and passes |
| 7 | Cleanup on every failure path | Read `startWorkspace`; run the bad-ref case |
| 8 | Smoke reproduces the table in §6 | `npm run smoke` |
| 9 | No leftover worktrees or processes | `git worktree list`, `tasklist` |
| 10 | Demo branches untouched | `git log -1 --format=%h demo/base demo/bad-fix demo/fix` still `d91557d`, `f2903f9`, `4bc977d` |
| 11 | No secrets committed | `git grep -nIiE "(api[_-]?key|secret|token)=."` |
| 12 | HANDOVER updated with real outputs | Read §5 and §9 |

Anything that fails here gets fixed by Claude before T5 starts — so it's cheaper to get it right now.
