// Replays the two in-repo cassettes (checkout-widget, checkout-demo) with model hosts
// blocked, prints one fingerprint line per cassette, and checks the lines against the
// committed baseline (docs/harness/replay-baseline.txt). Exit 0 when they match, non-zero
// with the expected and actual lines when they do not.
//
// Model hosts are blocked by replay mode: the cassette answers every model call in recorded
// order and a missing recording throws instead of falling through to the network. Any model
// keys and per-role route overrides are scrubbed from the environment too, so a leftover
// developer environment cannot change which model a call is routed to. The browser, workspace
// and checks still run for real — only model API calls are stubbed. See docs/harness/BASELINE.md.
//
// Each cassette runs in its own child process (`attest prove --replay`): the replay queue in
// src/api.ts is a single process-wide singleton loaded once from the first cassette path and
// never reset, so two cassettes cannot share a process.
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

// Replay never reaches the network for a model call, and no keys are needed. Scrub them and
// any per-role overrides from the environment handed to each replay, so the run is reproducible
// from a clean machine.
const SCRUB = [/^MODEL_API_KEY$/, /^BASETEN_API_KEY$/, /^OPENAI_COMPAT/, /^ATTEST_ROUTE_/];

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

// Runs `attest prove --replay <cassette> --out <dir>` in a child process. Its stdout (progress)
// is routed to our stderr so our stdout stays just the two fingerprint lines; its stderr is
// inherited for the same reason. Returns the attest exit code (0 for PROVEN/PROVEN_UNCHECKED).
function runAttest(args: string[], env: NodeJS.ProcessEnv): Promise<number> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn("npm", ["run", "attest", "--", ...args], {
      cwd: repoRoot,
      env,
      shell: true,
      stdio: ["ignore", "pipe", "inherit"],
    });
    child.stdout?.on("data", (chunk: Buffer) => {
      process.stderr.write(chunk);
    });
    child.on("error", rejectPromise);
    child.on("close", (code) => resolvePromise(code ?? 1));
  });
}

async function main(): Promise<void> {
  const baselinePath = process.argv[2] ?? join(repoRoot, "docs", "harness", "replay-baseline.txt");
  const env = scrubEnv(process.env);

  const actual: string[] = [];
  for (const c of CASSETTES) {
    // Evidence (events.jsonl, receipt, screenshots) goes under a temp dir, never inside the repo.
    const outDir = mkdtempSync(join(tmpdir(), "attest-replay-"));
    const code = await runAttest(
      ["prove", "--app", c.appPath, "--base", c.base, "--pr", c.pr, "--break", c.breakRef,
       "--replay", resolve(repoRoot, c.cassette), "--out", outDir],
      env,
    );
    const eventsPath = join(outDir, "events.jsonl");
    if (existsSync(eventsPath)) {
      actual.push(fingerprintLine(c.name, outDir));
    } else {
      process.stderr.write(`[${c.name}] no events.jsonl produced (attest exit ${code}); cannot fingerprint\n`);
      actual.push(`${c.name} · ERROR · 0 events · fp:0000000000000000`);
    }
    rmSync(outDir, { recursive: true, force: true });
  }

  for (const line of actual) process.stdout.write(`${line}\n`);

  const expected = readFileSync(baselinePath, "utf8").trim().split("\n");
  let ok = actual.length === expected.length;
  for (let i = 0; i < Math.max(actual.length, expected.length); i++) {
    const exp = expected[i];
    const act = actual[i];
    if (exp !== act) {
      ok = false;
      process.stderr.write(`line ${i + 1} differs:\n  expected: ${exp ?? "(missing)"}\n  actual:   ${act ?? "(missing)"}\n`);
    }
  }

  process.exit(ok ? 0 : 1);
}

await main();
