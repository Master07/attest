import { spawn } from "node:child_process";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import { loadConfig, type AttestConfig } from "./config.js";
import { loadCriteria, type CriteriaFile } from "./criteria.js";
import { MODEL_IDS, pickRoute } from "./models.js";
import type { ModelRole, ModelRoute } from "./types.js";
import { startWorkspace, type Workspace } from "./workspace.js";

// Preflight for `attest prove`. Reads the environment (index.ts already loaded .env) and never
// opens that file, never prints a credential, and never calls a model.

const GIT_FALLBACK = "C:\\Program Files\\Git\\cmd\\git.exe";
const SECRET_NAMES = ["MODEL_API_KEY", "BASETEN_API_KEY"] as const;
const ROLES: readonly ModelRole[] = ["worker", "reasoning", "image", "ui", "verifier", "judge"];

export interface DoctorCheck {
  ok: boolean;
  name: string;
  detail: string;
  fix?: string;
}

export interface DoctorOptions {
  repoRoot: string;
  appPath: string;
  base: string;
  pr: string;
  break?: string;
  criteriaPath?: string;
  configDir?: string;
  noStart?: boolean;
  /** Credential and route checks use this map. Defaults to process.env. */
  env?: NodeJS.ProcessEnv;
}

export interface DoctorReport {
  ok: boolean;
  checks: DoctorCheck[];
  summary: string[];
}

interface CommandResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

export interface SummaryInput {
  base: string;
  pr: string;
  breakRef?: string;
  config?: AttestConfig;
  /** True when a loaded criterion has expect.visible. "unknown" when criteria did not load. */
  needsUi?: boolean | "unknown";
  env: NodeJS.ProcessEnv;
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function lastLine(text: string): string {
  const lines = text.trim().split(/\r?\n/).filter((line) => line.trim() !== "");
  return lines[lines.length - 1] ?? "";
}

/** Drop known credential values. The values are never written back out. */
export function redactSecrets(text: string, env: NodeJS.ProcessEnv): string {
  let out = text;
  for (const name of SECRET_NAMES) {
    const value = env[name];
    if (typeof value === "string" && value.length >= 8) out = out.split(value).join("[redacted]");
  }
  return out;
}

function secretPresent(env: NodeJS.ProcessEnv, name: string): boolean {
  const value = env[name];
  return typeof value === "string" && value.trim() !== "";
}

function judgeRouteLabel(route: ModelRoute): string {
  if (route.provider === "baseten" && route.model === MODEL_IDS.sparkOpen) return "Spark Open on Baseten";
  return `${route.provider}/${route.model}`;
}

export function formatCheck(check: DoctorCheck): string {
  const mark = check.ok ? "✔" : "✘";
  if (!check.ok && check.fix !== undefined) return `${mark} ${check.name}: ${check.detail} — ${check.fix}`;
  return `${mark} ${check.name}: ${check.detail}`;
}

export function credentialChecks(env: NodeJS.ProcessEnv): DoctorCheck[] {
  const checks: DoctorCheck[] = [];
  if (secretPresent(env, "MODEL_API_KEY")) {
    checks.push({ ok: true, name: "credentials", detail: "MODEL_API_KEY set" });
  } else {
    checks.push({
      ok: false,
      name: "credentials",
      detail: "MODEL_API_KEY missing",
      fix: "set MODEL_API_KEY in the environment or .env",
    });
  }

  let judge: string;
  try {
    judge = judgeRouteLabel(pickRoute("judge", false, env));
  } catch {
    checks.push({
      ok: false,
      name: "credentials",
      detail: "judge route override is invalid",
      fix: "set ATTEST_ROUTE_JUDGE to provider:model, or unset it",
    });
    return checks;
  }

  const baseten = secretPresent(env, "BASETEN_API_KEY");
  checks.push({
    ok: true,
    name: "credentials",
    detail: baseten ? `BASETEN_API_KEY set; judge route ${judge}` : `BASETEN_API_KEY absent; judge route ${judge}`,
  });
  return checks;
}

function routeToken(role: ModelRole, env: NodeJS.ProcessEnv): string {
  try {
    const route = pickRoute(role, false, env);
    return `${role} ${route.provider}/${route.model}`;
  } catch {
    return `${role} invalid route override`;
  }
}

function requiredModels(config: AttestConfig | undefined, needsUi: boolean | "unknown"): string {
  const parts = ["verifier"];
  if (needsUi === "unknown") parts.push("ui if any criterion has expect.visible");
  else if (needsUi) parts.push("ui");
  if (config === undefined) parts.push("judge if verifier.judge is on");
  else if (config.verifier.judge) parts.push("judge");
  return parts.join(", ");
}

export function modelChecks(env: NodeJS.ProcessEnv): DoctorCheck[] {
  const bad = ROLES.filter((role) => {
    try {
      pickRoute(role, false, env);
      return false;
    } catch {
      return true;
    }
  });
  if (bad.length === 0) return [];
  return [{
    ok: false,
    name: "credentials",
    detail: `invalid route override for ${bad.join(", ")}`,
    fix: "set ATTEST_ROUTE_<ROLE> to provider:model, or unset it",
  }];
}

export function summaryLines(input: SummaryInput): string[] {
  const breakSupplied = input.breakRef !== undefined && input.breakRef.trim() !== "";
  const lines: string[] = [];
  if (breakSupplied) {
    lines.push(`what will run: Red (${input.base}), Green (${input.pr}), and Break (${input.breakRef})`);
    lines.push("Break: supplied");
  } else {
    lines.push(
      `what will run: Red (${input.base}) and Green (${input.pr}); no Break, so the best possible verdict is PROVEN_UNCHECKED`,
    );
    lines.push("Break: not supplied");
  }
  lines.push(`models required: ${requiredModels(input.config, input.needsUi ?? "unknown")}`);
  lines.push(`models: ${ROLES.map((role) => routeToken(role, input.env)).join(", ")}`);
  if (input.config !== undefined) {
    const judge = input.config.verifier.judge ? "on" : "off";
    lines.push(`steps: max_steps ${input.config.verifier.max_steps}, judge ${judge}`);
  } else {
    lines.push("steps: unavailable because attest.yml did not load");
  }
  lines.push("no model was called");
  return lines;
}

export function renderDoctor(report: DoctorReport, env: NodeJS.ProcessEnv): string {
  const lines = [
    ...report.checks.map((check) => formatCheck(check)),
    "",
    "summary:",
    ...report.summary.map((line) => `  ${line}`),
  ];
  return redactSecrets(lines.join("\n"), env);
}

function run(command: string, args: string[], cwd: string): Promise<CommandResult> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { cwd, windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", rejectPromise);
    child.on("close", (code) => resolvePromise({ code, stdout, stderr }));
  });
}

async function git(args: string[], cwd: string): Promise<CommandResult> {
  try {
    return await run("git", args, cwd);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT" && process.platform === "win32") {
      return run(GIT_FALLBACK, args, cwd);
    }
    throw err;
  }
}

export async function checkRef(repoRoot: string, name: string, ref: string): Promise<DoctorCheck> {
  let result: CommandResult;
  try {
    result = await git(["rev-parse", "--short", "--verify", `${ref}^{commit}`], repoRoot);
  } catch (err) {
    return {
      ok: false,
      name: "refs",
      detail: `${name} ${ref}: ${errorText(err)}`,
      fix: "install Git and ensure git is on PATH",
    };
  }
  const sha = result.stdout.trim();
  if (result.code !== 0 || sha === "") {
    const detail = lastLine(result.stderr || result.stdout) || "git rev-parse --verify failed";
    return {
      ok: false,
      name: "refs",
      detail: `${name} ${ref}: ${detail}`,
      fix: "pass a ref that resolves to a commit (git rev-parse --verify)",
    };
  }
  return { ok: true, name: "refs", detail: `${name} ${ref} ${sha}` };
}

export async function checkRefs(
  repoRoot: string,
  refs: { base: string; pr: string; break?: string },
): Promise<DoctorCheck[]> {
  const checks = [await checkRef(repoRoot, "base", refs.base), await checkRef(repoRoot, "pr", refs.pr)];
  if (refs.break === undefined || refs.break.trim() === "") {
    checks.push({
      ok: true,
      name: "refs",
      detail: "break not supplied; no Break, so the best possible verdict is PROVEN_UNCHECKED",
    });
  } else {
    checks.push(await checkRef(repoRoot, "break", refs.break));
  }
  return checks;
}

export function checkConfig(opts: {
  repoRoot: string;
  appPath: string;
  criteriaPath?: string;
  configDir?: string;
}): { checks: DoctorCheck[]; config?: AttestConfig; criteria?: CriteriaFile } {
  const dir = resolve(opts.configDir ?? join(resolve(opts.repoRoot), opts.appPath));
  const criteriaFile = opts.criteriaPath !== undefined ? resolve(opts.criteriaPath) : join(dir, "criteria.yml");
  const checks: DoctorCheck[] = [];
  let config: AttestConfig | undefined;
  let criteria: CriteriaFile | undefined;

  try {
    config = loadConfig(dir);
    checks.push({ ok: true, name: "config", detail: `loaded ${join(dir, "attest.yml")}` });
  } catch (err) {
    checks.push({
      ok: false,
      name: "config",
      detail: errorText(err),
      fix: "fix attest.yml so loadConfig() accepts it",
    });
  }

  try {
    criteria = loadCriteria(criteriaFile);
    checks.push({ ok: true, name: "config", detail: `loaded ${criteria.path}` });
  } catch (err) {
    checks.push({
      ok: false,
      name: "config",
      detail: errorText(err),
      fix: "fix the criteria file so loadCriteria() accepts it",
    });
  }

  return {
    checks,
    ...(config !== undefined ? { config } : {}),
    ...(criteria !== undefined ? { criteria } : {}),
  };
}

export async function checkBrowser(env: NodeJS.ProcessEnv = process.env): Promise<DoctorCheck> {
  const channel = env.ATTEST_BROWSER_CHANNEL?.trim() || "msedge";
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    browser = await chromium.launch({ channel, headless: true });
    const page = await browser.newPage();
    await page.goto("about:blank");
    return { ok: true, name: "browser", detail: `launched ${channel} headless and opened about:blank` };
  } catch (err) {
    const first = errorText(err).split(/\r?\n/)[0] ?? "could not launch the browser";
    return {
      ok: false,
      name: "browser",
      detail: redactSecrets(first, env),
      fix: `install the browser for Playwright channel "${channel}", or set ATTEST_BROWSER_CHANNEL`,
    };
  } finally {
    await browser?.close().catch(() => undefined);
  }
}

export async function checkServer(opts: {
  repoRoot: string;
  appPath: string;
  ref: string;
  config: AttestConfig;
  env: NodeJS.ProcessEnv;
}): Promise<DoctorCheck> {
  const started = Date.now();
  let workspace: Workspace | undefined;
  let check: DoctorCheck;
  try {
    workspace = await startWorkspace({
      repoRoot: opts.repoRoot,
      appPath: opts.appPath,
      ref: opts.ref,
      phase: "doctor",
      config: opts.config,
    });
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    check = { ok: true, name: "server", detail: `base ${opts.ref} ready in ${seconds}s at ${workspace.url}` };
  } catch (err) {
    check = {
      ok: false,
      name: "server",
      detail: redactSecrets(errorText(err), opts.env),
      fix: "make the base ref install and serve its ready URL, or re-run with --no-start",
    };
  }
  if (workspace !== undefined) {
    try {
      await workspace.stop();
    } catch (err) {
      check = {
        ok: false,
        name: "server",
        detail: `shutdown failed: ${redactSecrets(errorText(err), opts.env)}`,
        fix: "remove the leftover worktree under .attest/worktrees",
      };
    }
  }
  return check;
}

function baseRefOk(checks: DoctorCheck[]): boolean {
  return checks.some((check) => check.ok && check.name === "refs" && check.detail.startsWith("base "));
}

export async function runDoctor(opts: DoctorOptions): Promise<DoctorReport> {
  const env = opts.env ?? process.env;
  const repoRoot = resolve(opts.repoRoot);
  const refChecks = await checkRefs(repoRoot, {
    base: opts.base,
    pr: opts.pr,
    ...(opts.break !== undefined ? { break: opts.break } : {}),
  });
  const loaded = checkConfig({
    repoRoot,
    appPath: opts.appPath,
    ...(opts.criteriaPath !== undefined ? { criteriaPath: opts.criteriaPath } : {}),
    ...(opts.configDir !== undefined ? { configDir: opts.configDir } : {}),
  });
  const checks: DoctorCheck[] = [
    ...refChecks,
    ...loaded.checks,
    await checkBrowser(env),
    ...credentialChecks(env),
    ...modelChecks(env),
  ];

  if (opts.noStart) {
    checks.push({ ok: true, name: "server", detail: "skipped (--no-start)" });
  } else if (!baseRefOk(refChecks) || loaded.config === undefined) {
    checks.push({
      ok: false,
      name: "server",
      detail: "not started",
      fix: "fix the base ref and attest.yml, then re-run",
    });
  } else {
    checks.push(await checkServer({ repoRoot, appPath: opts.appPath, ref: opts.base, config: loaded.config, env }));
  }

  const needsUi: boolean | "unknown" = loaded.criteria === undefined
    ? "unknown"
    : loaded.criteria.criteria.some((criterion) => (criterion.expect?.visible ?? []).length > 0);
  const summary = summaryLines({
    base: opts.base,
    pr: opts.pr,
    ...(opts.break !== undefined ? { breakRef: opts.break } : {}),
    ...(loaded.config !== undefined ? { config: loaded.config } : {}),
    needsUi,
    env,
  });
  return { ok: checks.every((check) => check.ok), checks, summary };
}
