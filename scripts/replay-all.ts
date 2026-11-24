// Replays the two in-repo cassettes (checkout-widget, checkout-demo) with model hosts
// blocked, prints one fingerprint line per cassette, and checks the lines against the
// committed baseline (docs/harness/replay-baseline.txt). Exit 0 when they match, non-zero
// with the expected and actual lines when they do not.
//
// Model hosts are blocked by replay mode: the cassette answers every model call in recorded
// order and a missing recording throws instead of falling through to the network. Any model
// keys and per-role route overrides are scrubbed from the environment too — case-insensitively,
// so a Windows `Model_Api_Key` or `Openai_Api_Key` is caught — so a leftover developer
// environment cannot change which model a call is routed to. The repo's `.env` is refused
// (src/index.ts reloads it, which could restore the keys just scrubbed — fail closed; CI has
// no .env). The signing key is written to a path inside each run's temp dir, never the repo or
// ~/.attest. The browser, workspace and checks still run for real — only model API calls are
// stubbed. See docs/harness/BASELINE.md.
//
// Each cassette runs in its own child process (`attest prove --replay`): the replay queue in
// src/api.ts is a single process-wide singleton loaded once from the first cassette path and
// never reset, so two cassettes cannot share a process. Every child must exit 0 independently of
// the fingerprint comparison: a child that crashes after writing a matching events.jsonl still
// fails the script, with the child's exit code and the last stderr lines printed.
//
// Usage: npx tsx scripts/replay-all.ts [baselinePath]
//   baselinePath defaults to docs/harness/replay-baseline.txt; pass a copy to exercise the
//   mismatch path without touching the committed file.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Replay never reaches the network for a model call, and no keys are needed. Scrub them and any
// per-role overrides from the environment handed to each replay, case-insensitively so a Windows
// `Model_Api_Key` or `Openai_Api_Key` is caught. ATTEST_KEY_PATH is scrubbed here and then set
// to a fresh path inside each run's temp dir (below), so signing never touches the repo or
// ~/.attest. ATTEST_RECORD is scrubbed so a leftover record flag cannot write a cassette.
const SCRUB = [
  /^MODEL_API_KEY$/i,
  /^BASETEN_API_KEY$/i,
  /OPENAI_COMPAT/i,
  /^ATTEST_ROUTE_/i,
  /^OPENAI_/i,
  /^OPENROUTER_/i,
  /^ATTEST_RECORD$/i,
  /^ATTEST_KEY_PATH$/i,
];

function scrubEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const clean: NodeJS.ProcessEnv = {};
  for (const [name, value] of Object.entries(env)) {
    if (value !== undefined && !SCRUB.some((re) => re.test(name))) clean[name] = value;
  }
  return clean;
}

interface Cassette {
  readonly name: string;
  readonly appPath: string;
  readonly base: string;
  readonly pr: string;
  readonly breakRef: string;
  readonly cassette: string;
}

// The two cassettes that exercise the whole pipeline without a third-party fetch. The four
// real-world cassettes need network and hand-built bad fixes, so they stay out (BASELINE.md).
const CASSETTES: readonly Cassette[] = [
  {
    name: "checkout-widget",
    appPath: "examples/checkout-widget",
    base: "demo2/base",
    pr: "demo2/fix",
    breakRef: "demo2/bad-fix",
    cassette: "examples/checkout-widget/cassette.jsonl",
  },
  {
    name: "checkout-demo",
    appPath: "examples/checkout-demo",
    base: "demo/base",
    pr: "demo/fix",
    breakRef: "demo/bad-fix",
    cassette: "examples/checkout-demo/cassette.jsonl",
  },
];

// Fingerprint definition, copied verbatim from docs/harness/BASELINE.md. For each event it
// keeps only the fields a refactor must not change; run-specific fields (timestamps, ports,
// screenshot hashes) are ignored, which is why this is stable where log.head is not.
type ReplayEvent = { seq: number; phase: string | null; kind: string; data: any };

function pick(e: ReplayEvent): unknown {
  const d = e.data ?? {};
  switch (e.kind) {
    case "cua_step": return { step: d.step, actions: d.actions, errors: d.errors };
    case "cua_result": return { status: d.status, verdicts: (d.verdicts ?? []).map((v: any) => [v.id, v.result]) };
    case "checks": return (d.results ?? []).map((r: any) => [r.id, r.result, (r.outcomes ?? []).map((o: any) => [o.kind, o.result])]);
    case "judge": return { model: d.model, votes: (d.votes ?? []).map((v: any) => [v.id, v.result]) };
    case "phase_result": return d.result;
    case "verdict": return d.verdict;
    case "phase_start": return d.ref;
    default: return null;
  }
}

function fingerprintLine(name: string, eventsDir: string): string {
  const events = readFileSync(join(eventsDir, "events.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l) as ReplayEvent);
  const lines = events.map((e) => JSON.stringify([e.seq, e.phase, e.kind, pick(e)]));
  const fp = createHash("sha256").update(lines.join("\n")).digest("hex").slice(0, 16);
  const verdict = events.find((e) => e.kind === "verdict")?.data?.verdict;
  return `${name} · ${verdict} · ${events.length} events · fp:${fp}`;
}

interface ChildResult {
  readonly code: number;
  readonly stderrLines: string[];
}

// Runs `attest prove --replay <cassette> --out <dir>` as `node --import tsx src/index.ts …` with
// no shell, so paths with spaces work on every OS. Its stdout (progress) is routed to our stderr
// so our stdout stays just the two fingerprint lines. Its stderr is captured into a small ring
// buffer (not streamed) so a crashing child can be reported with its last lines. Returns the
// attest exit code (0 for PROVEN/PROVEN_UNCHECKED) and the last stderr lines.
function runAttest(args: string[], env: NodeJS.ProcessEnv): Promise<ChildResult> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", resolve(repoRoot, "src/index.ts"), ...args],
      { cwd: repoRoot, env, shell: false, stdio: ["ignore", "pipe", "pipe"] },
    );
    const stderrLines: string[] = [];
    let pending = "";
    const TAIL = 25;
    const pushLines = (text: string): void => {
      pending += text;
      const parts = pending.split("\n");
      pending = parts.pop() ?? "";
      for (const line of parts) {
        stderrLines.push(line);
        if (stderrLines.length > TAIL) stderrLines.shift();
      }
    };
    child.stdout?.on("data", (chunk: Buffer) => process.stderr.write(chunk));
    child.stderr?.on("data", (chunk: Buffer) => pushLines(chunk.toString()));
    child.on("error", rejectPromise);
    child.on("close", (code) => {
      if (pending.length > 0) {
        stderrLines.push(pending);
        if (stderrLines.length > TAIL) stderrLines.shift();
      }
      resolvePromise({ code: code ?? 1, stderrLines });
    });
  });
}

async function main(): Promise<void> {
  // src/index.ts:28 reloads the repo's .env, which could restore the keys scrubbed below. CI has
  // no .env; refuse to replay if one exists so the run stays reproducible from a clean machine.
  if (existsSync(join(repoRoot, ".env"))) {
    process.stderr.write(
      `replay-all: refusing to run: a .env file exists in the repo root (${repoRoot}).\n` +
      `src/index.ts reloads it and could restore the model keys that replay mode scrubs.\n` +
      `Remove or rename .env before replaying (CI has none).\n`,
    );
    process.exit(1);
  }

  const baselinePath = process.argv[2] ?? join(repoRoot, "docs", "harness", "replay-baseline.txt");
  const env = scrubEnv(process.env);

  // Self-test hook (read only by this script, never by src/): point the first cassette at a
  // non-existent app dir so loadConfig throws and the child exits non-zero before any evidence
  // is written — a safe way to exercise the child-exit-code check.
  const selftestBadApp = process.env.ATTEST_REPLAY_SELFTEST === "bad-app";

  const actual: string[] = [];
  const tempDirs: string[] = [];
  let childFailed = false;
  for (const c of CASSETTES) {
    // Evidence (events.jsonl, receipt, screenshots) and the signing key go under a temp dir,
    // never inside the repo or ~/.attest.
    const outDir = mkdtempSync(join(tmpdir(), "attest-replay-"));
    tempDirs.push(outDir);
    const childEnv = { ...env, ATTEST_KEY_PATH: join(outDir, "signing-key.pem") };
    const appPath = selftestBadApp && c === CASSETTES[0] ? "does/not/exist" : c.appPath;
    const { code, stderrLines } = await runAttest(
      ["prove", "--app", appPath, "--base", c.base, "--pr", c.pr, "--break", c.breakRef,
       "--replay", resolve(repoRoot, c.cassette), "--out", outDir],
      childEnv,
    );
    // A child must exit 0 regardless of the fingerprint: a crash after writing a matching
    // events.jsonl is still a failure.
    if (code !== 0) {
      childFailed = true;
      process.stderr.write(`[${c.name}] child exited ${code}\n`);
      if (stderrLines.length > 0) {
        process.stderr.write(`[${c.name}] last stderr lines:\n`);
        for (const line of stderrLines) process.stderr.write(`  ${line}\n`);
      }
    }
    const eventsPath = join(outDir, "events.jsonl");
    if (existsSync(eventsPath)) {
      actual.push(fingerprintLine(c.name, outDir));
    } else {
      process.stderr.write(`[${c.name}] no events.jsonl produced (attest exit ${code}); cannot fingerprint\n`);
      actual.push(`${c.name} · ERROR · 0 events · fp:0000000000000000`);
    }
  }

  for (const line of actual) process.stdout.write(`${line}\n`);

  // Exact comparison: the baseline is exactly N lines, each terminated by \n. Normalise CRLF/CR
  // to LF (Windows checkouts) but do not trim — a missing or extra line, a blank line, or stray
  // leading/trailing whitespace on any line must all fail. split("\n") on a well-formed file
  // yields a single trailing "" from the terminator; drop exactly that one.
  const baselineRaw = readFileSync(baselinePath, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const expected = baselineRaw.split("\n");
  if (expected.length > 0 && expected[expected.length - 1] === "") expected.pop();

  let ok = !childFailed && actual.length === expected.length;
  for (let i = 0; i < Math.max(actual.length, expected.length); i++) {
    const exp = expected[i];
    const act = actual[i];
    if (exp !== act) {
      ok = false;
      process.stderr.write(`line ${i + 1} differs:\n  expected: ${exp ?? "(missing)"}\n  actual:   ${act ?? "(missing)"}\n`);
    }
  }

  // Remove the temp dirs only on success; keep them for inspection when the script fails.
  if (ok) {
    for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  } else {
    process.stderr.write(`replay-all: keeping temp dirs for inspection:\n`);
    for (const dir of tempDirs) process.stderr.write(`  ${dir}\n`);
  }

  process.exit(ok ? 0 : 1);
}

await main();
