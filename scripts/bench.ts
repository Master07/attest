import { spawnSync } from "node:child_process";
import type { SpawnSyncReturns } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { launchBrowser } from "../src/browser.js";
import type { BrowserSession } from "../src/browser.js";
import { normalizePath } from "../src/checks.js";
import { loadConfig } from "../src/config.js";
import { runProof } from "../src/proof.js";
import type { Receipt } from "../src/receipt.js";
import { startWorkspace } from "../src/workspace.js";
import type { Workspace } from "../src/workspace.js";

// Benchmark driver. `build` creates one branch per variant, `check` runs the deterministic
// probe and the bad-fix tests (no model calls), and `run` executes Attest (the only API command).
// --root/--prefix let the generated set live beside the hand-written one without touching it.

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
if (existsSync(join(repoRoot, ".env"))) process.loadEnvFile(join(repoRoot, ".env"));

const GIT_FALLBACK = "C:\\Program Files\\Git\\cmd\\git.exe";
const DEFAULT_ROOT = "examples/bench";
const DEFAULT_PREFIX = "bench";

type Variant = "base" | "bad-fix" | "fix";
const VARIANTS: Variant[] = ["base", "bad-fix", "fix"];

interface BenchOptions {
  root: string;      // relative to repoRoot
  prefix: string;    // branch prefix
}

type ProbeStep =
  | { kind: "wait"; ms: number }
  | { kind: "click"; selector: string }
  | { kind: "fill"; selector: string; text: string };

interface Probe {
  path: string;
  steps: ProbeStep[];
  expect: { url: string; text?: { selector: string; equals: string } };
}

interface Scenario {
  dir: string;
  id: string;
  title: string;
  category: string;
  outside: boolean;
  shell: string | null;
  recipe: string | null;
  badFixTest: "unit" | "source" | null;
  probe: Probe;
}

interface ProbeResult {
  ok: boolean;
  url: string;
  failures: string[];
}

interface PhaseOutcome {
  result: string;
  votes: Record<string, string> | null;
}

interface ScenarioResult {
  id: string;
  title: string;
  category: string;
  outside_app_dir: boolean;
  verdict: string;
  phases: Record<string, PhaseOutcome>;
  badfix_tests_passed: boolean | null;
  receipt: string | null;
  reasons: string[];
}

interface ScenarioCheck {
  scenario: Scenario;
  basePass: boolean;
  fixPass: boolean;
  badFixPass: boolean;
  testsPass: boolean;
  valid: boolean;
  failures: string[];
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`expected a mapping, got ${JSON.stringify(value)}`);
  }
  return value as Record<string, unknown>;
}

function parseStep(raw: unknown): ProbeStep {
  const step = asRecord(raw);
  if (typeof step["wait"] === "number") return { kind: "wait", ms: step["wait"] };
  if (typeof step["click"] === "string") return { kind: "click", selector: step["click"] };
  if (typeof step["fill"] === "string" && typeof step["text"] === "string") {
    return { kind: "fill", selector: step["fill"], text: step["text"] };
  }
  throw new Error(`unsupported probe step: ${JSON.stringify(raw)}`);
}

function parseOptions(args: string[]): { options: BenchOptions; rest: string[] } {
  let root = DEFAULT_ROOT;
  let prefix = DEFAULT_PREFIX;
  const rest: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--root") {
      const value = args[++i];
      if (value === undefined || value === "") throw new Error("--root needs a directory");
      root = value;
    } else if (arg === "--prefix") {
      const value = args[++i];
      if (value === undefined || value === "") throw new Error("--prefix needs a name");
      prefix = value;
    } else {
      rest.push(arg ?? "");
    }
  }
  if (!/^[A-Za-z0-9._-]+$/.test(prefix)) throw new Error(`--prefix must be a simple name, got "${prefix}"`);
  return { options: { root, prefix }, rest };
}

function rootPaths(options: BenchOptions): { abs: string; rel: string } {
  const abs = resolve(repoRoot, options.root);
  const rel = relative(repoRoot, abs).split(sep).join("/");
  if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(`--root must be inside the repo, got "${options.root}"`);
  }
  return { abs, rel };
}

function loadScenarios(rootAbs: string): Scenario[] {
  const dirs = readdirSync(rootAbs)
    .filter((name) => {
      const path = join(rootAbs, name);
      return statSync(path).isDirectory() && existsSync(join(path, "scenario.yml"));
    })
    .sort();

  const scenarios = dirs.map((dir): Scenario => {
    const doc = asRecord(parse(readFileSync(join(rootAbs, dir, "scenario.yml"), "utf8")));
    const id = doc["id"];
    const title = doc["title"];
    const category = doc["category"];
    if (typeof id !== "string" || typeof title !== "string" || typeof category !== "string") {
      throw new Error(`${dir}: scenario.yml needs string id, title and category`);
    }

    const probeRaw = asRecord(doc["probe"]);
    const expectRaw = asRecord(probeRaw["expect"]);
    const expectedUrl = expectRaw["url"];
    if (typeof expectedUrl !== "string") throw new Error(`${dir}: probe.expect.url must be a string`);

    const stepsRaw = probeRaw["steps"];
    if (!Array.isArray(stepsRaw)) throw new Error(`${dir}: probe.steps must be a list`);

    let text: { selector: string; equals: string } | undefined;
    if (expectRaw["text"] !== undefined) {
      const textRaw = asRecord(expectRaw["text"]);
      const selector = textRaw["selector"];
      const equals = textRaw["equals"];
      if (typeof selector !== "string" || typeof equals !== "string") {
        throw new Error(`${dir}: probe.expect.text needs string selector and equals`);
      }
      text = { selector, equals };
    }

    const badFixTestRaw = doc["bad_fix_test"];
    return {
      dir,
      id,
      title,
      category,
      outside: doc["outside_app_dir"] === true,
      shell: typeof doc["shell"] === "string" ? doc["shell"] : null,
      recipe: typeof doc["recipe"] === "string" ? doc["recipe"] : null,
      badFixTest: badFixTestRaw === "unit" || badFixTestRaw === "source" ? badFixTestRaw : null,
      probe: {
        path: typeof probeRaw["path"] === "string" ? probeRaw["path"] : "/",
        steps: stepsRaw.map(parseStep),
        expect: text === undefined ? { url: expectedUrl } : { url: expectedUrl, text },
      },
    };
  });

  const ids = new Set(scenarios.map((s) => s.id));
  if (ids.size !== scenarios.length) throw new Error("scenario ids must be unique");
  return scenarios;
}

function appPath(scenario: Scenario, rootRel: string): string {
  return `${rootRel}/${scenario.dir}/app`;
}

function cachePath(prefix: string): string {
  return join(repoRoot, ".attest", prefix, "check.json");
}

function git(args: string[], cwd: string): SpawnSyncReturns<string> {
  let result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.error !== undefined && (result.error as NodeJS.ErrnoException).code === "ENOENT") {
    result = spawnSync(GIT_FALLBACK, args, { cwd, encoding: "utf8" });
  }
  return result;
}

function gitOk(args: string[], cwd: string): string {
  const result = git(args, cwd);
  if (result.error !== undefined) throw new Error(`git ${args.join(" ")}: ${result.error.message}`);
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout).trim();
    throw new Error(`git ${args.join(" ")} failed${detail ? `: ${detail}` : ""}`);
  }
  return result.stdout;
}

function copyOverlay(from: string, to: string): void {
  for (const name of readdirSync(from)) {
    const src = join(from, name);
    const dst = join(to, name);
    if (statSync(src).isDirectory()) {
      mkdirSync(dst, { recursive: true });
      copyOverlay(src, dst);
    } else {
      mkdirSync(dirname(dst), { recursive: true });
      writeFileSync(dst, readFileSync(src));
    }
  }
}

function removeOverlayDirs(worktree: string, rootRel: string): void {
  const root = join(worktree, rootRel);
  for (const name of readdirSync(root)) {
    const dir = join(root, name);
    if (!statSync(dir).isDirectory()) continue;
    for (const overlay of ["fix", "bad-fix"]) {
      rmSync(join(dir, overlay), { recursive: true, force: true });
    }
  }
}

let worktreeCounter = 0;

function buildBranch(
  scenario: Scenario,
  variant: Variant,
  mainSha: string,
  rootRel: string,
  prefix: string,
): void {
  worktreeCounter += 1;
  const worktree = join(
    repoRoot,
    ".attest",
    "bench-build",
    `${prefix}-${scenario.id}-${variant}-${Date.now()}-${worktreeCounter}`,
  );
  mkdirSync(dirname(worktree), { recursive: true });

  try {
    gitOk(["worktree", "add", "--detach", worktree, mainSha], repoRoot);

    if (variant !== "base") {
      copyOverlay(
        join(worktree, rootRel, scenario.dir, variant),
        join(worktree, rootRel, scenario.dir, "app"),
      );
    }
    removeOverlayDirs(worktree, rootRel);

    gitOk(["add", "-A"], worktree);
    gitOk(["commit", "-m", `${prefix} ${scenario.id} ${variant}`], worktree);
    const sha = gitOk(["rev-parse", "HEAD"], worktree).trim();
    gitOk(["branch", "-f", `${prefix}/${scenario.id}/${variant}`, sha], repoRoot);
  } finally {
    git(["worktree", "remove", "--force", worktree], repoRoot);
    rmSync(worktree, { recursive: true, force: true });
    git(["worktree", "prune"], repoRoot);
  }
}

async function build(options: BenchOptions): Promise<void> {
  const { abs, rel } = rootPaths(options);
  const scenarios = loadScenarios(abs);
  const mainSha = gitOk(["rev-parse", "--verify", "main^{commit}"], repoRoot).trim();

  const existing = gitOk(["for-each-ref", "--format=%(refname:short)", `refs/heads/${options.prefix}/`], repoRoot)
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "");
  for (const ref of existing) gitOk(["branch", "-D", ref], repoRoot);

  for (const scenario of scenarios) {
    for (const variant of VARIANTS) {
      buildBranch(scenario, variant, mainSha, rel, options.prefix);
      console.log(`built ${options.prefix}/${scenario.id}/${variant}`);
    }
  }
  console.log(`done: ${scenarios.length * VARIANTS.length} branches from ${mainSha.slice(0, 12)}`);
}

function pathnameOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

async function runProbe(browser: BrowserSession, baseUrl: string, probe: Probe): Promise<ProbeResult> {
  const failures: string[] = [];
  let finalUrl = "";

  try {
    await browser.open(baseUrl + probe.path);

    for (const step of probe.steps) {
      if (step.kind === "wait") {
        await browser.act({ type: "wait", ms: step.ms });
        continue;
      }

      const point = await browser.locate(step.selector);
      if (point === null) {
        failures.push(`selector not found: ${step.selector}`);
        break;
      }
      // Raw mouse click at the element's centre — never locator.click().
      await browser.act({ type: "click", x: point.x, y: point.y });
      if (step.kind === "fill") await browser.act({ type: "type", text: step.text });
    }

    finalUrl = browser.currentUrl();
    const finalPath = pathnameOf(finalUrl);
    if (normalizePath(finalPath) !== normalizePath(probe.expect.url)) {
      failures.push(`url ${finalPath} != ${probe.expect.url}`);
    }

    if (probe.expect.text !== undefined) {
      const { selector, equals } = probe.expect.text;
      try {
        const found = await browser.locate(`${selector}:text-is(${JSON.stringify(equals)})`);
        if (found === null) failures.push(`text ${selector} is not ${JSON.stringify(equals)}`);
      } catch (err) {
        failures.push(`text ${selector} could not be read: ${message(err)}`);
      }
    }
  } catch (err) {
    failures.push(message(err));
  }

  return { ok: failures.length === 0, url: finalUrl === "" ? "" : pathnameOf(finalUrl), failures };
}

function runTests(cwd: string): { ok: boolean; detail: string } {
  const result = spawnSync("npm test", { cwd, shell: true, encoding: "utf8", timeout: 120_000 });
  const ok = result.status === 0;
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`
    .trim()
    .split(/\r?\n/)
    .slice(-8)
    .join(" | ");
  return { ok, detail: ok ? "" : output };
}

function validationMarkdown(checks: ScenarioCheck[]): string {
  const total = checks.length;
  const valid = checks.filter((c) => c.valid).length;
  const dropped = checks.filter((c) => !c.valid);

  const countBy = (key: (c: ScenarioCheck) => string): string[] => {
    const counts = new Map<string, { valid: number; total: number }>();
    for (const check of checks) {
      const name = key(check);
      const entry = counts.get(name) ?? { valid: 0, total: 0 };
      entry.total += 1;
      if (check.valid) entry.valid += 1;
      counts.set(name, entry);
    }
    return [...counts.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, count]) => `| ${name} | ${count.valid} / ${count.total} |`);
  };

  const lines = [
    "# Generated benchmark validation",
    "",
    "> Generated by `npm run bench -- check --root examples/bench-gen --prefix bench-gen`. Do not edit by hand.",
    "",
    `- generated: ${total}`,
    `- valid: ${valid}`,
    `- dropped: ${dropped.length}`,
    "",
    "A scenario is valid when the base fails the probe, the fix passes it, the bad-fix fails it, and the bad-fix's own test passes.",
    "",
  ];

  if (dropped.length > 0) {
    lines.push("## Dropped", "");
    for (const check of dropped.sort((a, b) => a.scenario.id.localeCompare(b.scenario.id))) {
      lines.push(`- ${check.scenario.id}: ${check.failures.join("; ")}`);
    }
    lines.push("");
  }

  lines.push("## By shell", "", "| Shell | Valid / generated |", "|---|---|", ...countBy((c) => c.scenario.shell ?? "(none)"), "");
  lines.push("## By class", "", "| Class | Valid / generated |", "|---|---|", ...countBy((c) => c.scenario.category), "");
  lines.push("## By wrong-fix test kind", "", "| Kind | Valid / generated |", "|---|---|", ...countBy((c) => c.scenario.badFixTest ?? "(none)"), "");
  return lines.join("\n") + "\n";
}

async function check(options: BenchOptions): Promise<void> {
  const { abs, rel } = rootPaths(options);
  const scenarios = loadScenarios(abs);
  const checks: ScenarioCheck[] = [];
  const violations: string[] = [];
  const cache: Record<string, { badfix_tests_passed: boolean }> = {};

  for (const scenario of scenarios) {
    const app = appPath(scenario, rel);
    const config = loadConfig(join(abs, scenario.dir, "app"));
    let tests = { ok: false, detail: "" };
    const outcome: ScenarioCheck = {
      scenario,
      basePass: false,
      fixPass: false,
      badFixPass: false,
      testsPass: false,
      valid: false,
      failures: [],
    };

    for (const variant of VARIANTS) {
      let workspace: Workspace | undefined;
      let browser: BrowserSession | undefined;
      let probe: ProbeResult;

      try {
        workspace = await startWorkspace({
          repoRoot,
          appPath: app,
          ref: `${options.prefix}/${scenario.id}/${variant}`,
          phase: `${scenario.id}-${variant}`,
          config,
        });
        if (variant === "bad-fix") tests = runTests(workspace.appDir);
        browser = await launchBrowser(config.browser.viewport);
        probe = await runProbe(browser, workspace.url, scenario.probe);
      } catch (err) {
        probe = { ok: false, url: "", failures: [message(err)] };
      } finally {
        if (browser !== undefined) await browser.close();
        if (workspace !== undefined) await workspace.stop();
      }

      if (variant === "base") outcome.basePass = probe.ok;
      if (variant === "fix") outcome.fixPass = probe.ok;
      if (variant === "bad-fix") {
        outcome.badFixPass = probe.ok;
        outcome.testsPass = tests.ok;
      }

      const line: Record<string, unknown> = {
        id: scenario.id,
        variant,
        probe: probe.ok ? "pass" : "fail",
        url: probe.url,
        failures: probe.failures,
      };
      if (variant === "bad-fix") {
        line["tests"] = tests.ok ? "pass" : "fail";
        if (!tests.ok) line["tests_detail"] = tests.detail;
      }
      console.log(JSON.stringify(line));

      if (variant === "base" && probe.ok) outcome.failures.push("base passed the probe");
      if (variant === "fix" && !probe.ok) outcome.failures.push("fix failed the probe");
      if (variant === "bad-fix" && probe.ok) outcome.failures.push("bad-fix passed the probe");
      if (variant === "bad-fix" && !tests.ok) outcome.failures.push("bad-fix test failed");
    }

    outcome.valid = outcome.failures.length === 0;
    checks.push(outcome);
    for (const failure of outcome.failures) violations.push(`${scenario.id}: ${failure}`);
    cache[scenario.id] = { badfix_tests_passed: tests.ok };
  }

  mkdirSync(dirname(cachePath(options.prefix)), { recursive: true });
  writeFileSync(cachePath(options.prefix), `${JSON.stringify(cache, null, 2)}\n`);

  const isDefault = rel === DEFAULT_ROOT && options.prefix === DEFAULT_PREFIX;
  const valid = checks.filter((c) => c.valid).length;

  if (!isDefault) {
    writeFileSync(join(abs, "VALIDATION.md"), validationMarkdown(checks));
  }

  const summary = isDefault
    ? {
        summary: true,
        scenarios: scenarios.length,
        variants: scenarios.length * VARIANTS.length,
        badfix_tests_passed: Object.values(cache).filter((entry) => entry.badfix_tests_passed).length,
        violations,
        ok: violations.length === 0,
      }
    : {
        summary: true,
        scenarios: scenarios.length,
        variants: scenarios.length * VARIANTS.length,
        generated: scenarios.length,
        valid,
        dropped: scenarios.length - valid,
        badfix_tests_passed: Object.values(cache).filter((entry) => entry.badfix_tests_passed).length,
        violations,
        ok: valid >= 60,
      };
  console.log(JSON.stringify(summary));
  if (!summary.ok) process.exitCode = 1;
}

function readCheckCache(prefix: string): Record<string, { badfix_tests_passed: boolean }> {
  const path = cachePath(prefix);
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Record<string, { badfix_tests_passed: boolean }>;
  } catch {
    return {};
  }
}

function renderMarkdown(results: ScenarioResult[], dir: string): string {
  const cell = (result: ScenarioResult, phase: string): string => result.phases[phase]?.result ?? "—";

  const rows = results.map((result) => {
    const link = result.receipt === null ? result.id : `[${result.id}](${relative(dir, join(repoRoot, result.receipt)).split(sep).join("/")})`;
    return `| ${link} | ${result.title} | ${cell(result, "red")} | ${cell(result, "green")} | ${cell(result, "break")} | **${result.verdict}** |`;
  });

  const total = results.length;
  const testsPassed = results.filter((r) => r.badfix_tests_passed === true).length;
  const proven = results.filter((r) => r.verdict === "PROVEN").length;
  const breakFailed = results.filter((r) => r.phases["break"]?.result === "fail").length;
  const greenPassed = results.filter((r) => r.phases["green"]?.result === "pass").length;
  const inconclusive = results.filter((r) => r.verdict === "INCONCLUSIVE");

  const lines = [
    "# Benchmark results",
    "",
    "| ID | Title | Red | Green | Break | Verdict |",
    "|---|---|---|---|---|---|",
    ...rows,
    "",
    "## Totals",
    "",
    `- wrong fixes whose tests passed: ${testsPassed} / ${total}`,
    `- Attest verdict \`PROVEN\`: ${proven} / ${total}`,
    `- wrong fix rejected (Break = fail): ${breakFailed} / ${total}`,
    `- real fix accepted (Green = pass): ${greenPassed} / ${total}`,
    `- inconclusive: ${inconclusive.length} / ${total}`,
  ];

  if (inconclusive.length > 0) {
    lines.push("");
    for (const result of inconclusive) {
      lines.push(`  - ${result.id}: ${result.reasons.join("; ")}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

async function run(options: BenchOptions, rest: string[]): Promise<void> {
  const { abs, rel } = rootPaths(options);
  const all = loadScenarios(abs);
  let selected = all;

  const idsFlag = rest.indexOf("--ids");
  if (idsFlag !== -1) {
    const value = rest[idsFlag + 1];
    if (value === undefined) throw new Error("--ids needs a comma-separated list");
    const wanted = new Set(value.split(",").map((id) => id.trim()).filter((id) => id !== ""));
    const missing = [...wanted].filter((id) => !all.some((scenario) => scenario.id === id));
    if (missing.length > 0) throw new Error(`unknown scenario ids: ${missing.join(", ")}`);
    selected = all.filter((scenario) => wanted.has(scenario.id));
  }

  const cache = readCheckCache(options.prefix);
  const dir = join(repoRoot, "evidence", `${options.prefix}-${Date.now()}`);
  mkdirSync(dir, { recursive: true });

  const results: ScenarioResult[] = [];

  for (const scenario of selected) {
    console.log(`[${scenario.id}] starting: ${scenario.title}`);
    let receipt: Receipt | null = null;
    let receiptPath: string | null = null;
    let error: string | null = null;

    try {
      const proof = await runProof({
        repoRoot,
        appPath: appPath(scenario, rel),
        base: `${options.prefix}/${scenario.id}/base`,
        pr: `${options.prefix}/${scenario.id}/fix`,
        break: `${options.prefix}/${scenario.id}/bad-fix`,
        outDir: join(dir, scenario.id),
        onProgress: (progress) => console.log(`[${scenario.id}] ${progress}`),
      });
      receipt = proof.receipt;
      receiptPath = relative(repoRoot, proof.receiptPath).split(sep).join("/");
    } catch (err) {
      error = message(err);
      console.log(`[${scenario.id}] error: ${error}`);
    }

    const phases: Record<string, PhaseOutcome> = {};
    if (receipt !== null) {
      for (const phase of receipt.phases) {
        const criterion = phase.criteria[0];
        phases[phase.phase] = { result: phase.result, votes: criterion ? { ...criterion.votes } : null };
      }
    }

    const result: ScenarioResult = {
      id: scenario.id,
      title: scenario.title,
      category: scenario.category,
      outside_app_dir: scenario.outside,
      verdict: receipt?.verdict ?? "ERROR",
      phases,
      badfix_tests_passed: cache[scenario.id]?.badfix_tests_passed ?? null,
      receipt: receiptPath,
      reasons: receipt?.reasons ?? (error === null ? [] : [error]),
    };
    results.push(result);
    console.log(`[${scenario.id}] verdict: ${result.verdict}`);
  }

  writeFileSync(join(dir, "results.json"), `${JSON.stringify(results, null, 2)}\n`);
  writeFileSync(join(dir, "results.md"), renderMarkdown(results, dir));
  console.log(`results json: ${join(dir, "results.json")}`);
  console.log(`results md:   ${join(dir, "results.md")}`);
}

const [command, ...rest] = process.argv.slice(2);

try {
  const { options, rest: remaining } = parseOptions(rest);
  if (command === "build") {
    await build(options);
  } else if (command === "check") {
    await check(options);
  } else if (command === "run") {
    await run(options, remaining);
  } else {
    console.log("usage: npm run bench -- <build|check|run> [--root <dir>] [--prefix <name>] [--ids A,B]");
    process.exitCode = 1;
  }
} catch (err) {
  console.error(`bench: ${message(err)}`);
  process.exitCode = 1;
}
