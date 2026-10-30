import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve, sep } from "node:path";
import { launchBrowser } from "./browser.js";
import type { BrowserSession } from "./browser.js";
import { runAllChecks } from "./checks.js";
import { loadConfig } from "./config.js";
import type { AttestConfig } from "./config.js";
import { loadCriteria } from "./criteria.js";
import type { CriteriaFile } from "./criteria.js";
import { runVerifier } from "./cua.js";
import { EventLog } from "./eventlog.js";
import { pickRoute } from "./models.js";
import { sha256File, signReceipt } from "./receipt.js";
import type { CriterionRecord, PhaseRecord, Receipt, ReceiptBody } from "./receipt.js";
import { combineCriterion, combinePhase, fixVerdict } from "./verdict.js";
import type { CuaVote, PhaseName } from "./verdict.js";
import { startWorkspace } from "./workspace.js";
import type { Workspace } from "./workspace.js";

// The middle loop (ARCHITECTURE §1.2): run Red, Green and Break, record every step in the
// hash-chained log, combine votes with the pure verdict functions, and seal a signed receipt.

export interface ProofOptions {
  repoRoot: string;
  appPath: string;              // relative to repoRoot, e.g. "examples/checkout-demo"
  base: string;
  pr: string;
  break?: string;
  criteriaPath?: string;        // default: <app>/criteria.yml
  outDir?: string;              // default: <repoRoot>/evidence/run-<timestamp>
  onProgress?: (message: string) => void;
}

export interface ProofResult {
  dir: string;
  receiptPath: string;
  receipt: Receipt;
}

function gitRemote(repoRoot: string): string | null {
  for (const git of ["git", "C:\\Program Files\\Git\\cmd\\git.exe"]) {
    const r = spawnSync(git, ["remote", "get-url", "origin"], { cwd: repoRoot, encoding: "utf8" });
    if (r.error === undefined) return r.status === 0 ? r.stdout.trim() || null : null;
  }
  return null;
}

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

const rel = (dir: string, path: string): string => relative(dir, path).split(sep).join("/");

async function runPhase(
  phase: PhaseName,
  ref: string,
  ctx: { repoRoot: string; appPath: string; config: AttestConfig; criteria: CriteriaFile; dir: string; log: EventLog; progress: (m: string) => void },
): Promise<PhaseRecord> {
  const { log, dir, criteria } = ctx;
  let workspace: Workspace | undefined;
  let browser: BrowserSession | undefined;
  const record: PhaseRecord = {
    phase, ref, sha: null, status: "error", error: null, steps: 0, model: null, prompt_sha256: null,
    criteria: [], result: "inconclusive", reason: "",
  };

  log.append("phase_start", { ref }, phase);
  try {
    ctx.progress(`${phase}: starting ${ref}`);
    workspace = await startWorkspace({ repoRoot: ctx.repoRoot, appPath: ctx.appPath, ref, phase, config: ctx.config });
    record.sha = workspace.sha;
    log.append("workspace_ready", { ref, sha: workspace.sha, port: workspace.port }, phase);

    browser = await launchBrowser(ctx.config.browser.viewport);
    await browser.open(`${workspace.url}/`);

    ctx.progress(`${phase}: verifier running`);
    const shots = new Map<number, string>();
    const result = await runVerifier({
      browser,
      criteria,
      appUrl: workspace.url,
      maxSteps: ctx.config.verifier.max_steps,
      onScreenshot: (step, png) => {
        const path = join(dir, "shots", `${phase}-${String(step).padStart(2, "0")}.png`);
        writeFileSync(path, png);
        shots.set(step, rel(dir, path));
        log.append("screenshot", { step, file: rel(dir, path), sha256: sha256File(path) }, phase);
      },
    });

    log.append("prompt_sent", { model: result.model, prompt_sha256: result.promptSha256 }, phase);
    for (const s of result.steps) {
      log.append("cua_step", { step: s.step, actions: s.actions, errors: s.errors, safety_checks: s.safetyChecks.map((c) => c.code) }, phase);
    }
    log.append("cua_result", { status: result.status, verdicts: result.verdicts, error: result.error ?? null, final_text: result.finalText }, phase);

    record.status = result.status;
    record.steps = result.steps.length;
    record.model = result.model;
    record.prompt_sha256 = result.promptSha256;
    if (result.status !== "completed") record.error = result.error ?? result.status;

    const records = { finalUrl: browser.currentUrl(), urlHistory: browser.urlHistory(), network: browser.network() };
    const checks = runAllChecks(criteria.criteria, records);
    log.append("checks", { final_url: records.finalUrl, results: checks }, phase);

    const lastShot = shots.get(Math.max(...shots.keys()));
    record.criteria = criteria.criteria.map((c): CriterionRecord => {
      const v = result.verdicts.find((x) => x.id === c.id);
      const cua: CuaVote = v?.result ?? "missing";
      const votes = { cua, checks: checks.find((x) => x.id === c.id)?.result ?? "n/a", sam: "n/a" as const, judge: "n/a" as const };
      const out = combineCriterion(votes);
      const cited = v?.evidence_step != null ? shots.get(v.evidence_step) : undefined;
      const evidence = [cited ?? lastShot].filter((x): x is string => x !== undefined);
      return { id: c.id, votes, result: out.result, reason: out.reason, observation: v?.observation ?? "", evidence };
    });
  } catch (err) {
    record.error = err instanceof Error ? err.message : String(err);
    log.append("phase_error", { error: record.error }, phase);
  } finally {
    if (browser !== undefined) await browser.close();
    if (workspace !== undefined) await workspace.stop();
  }

  const outcome = combinePhase(record.criteria.map((c) => c.result), record.error ?? undefined);
  record.result = outcome.result;
  record.reason = outcome.reason;
  log.append("phase_result", { result: record.result, reason: record.reason }, phase);
  ctx.progress(`${phase}: ${record.result} (${record.reason})`);
  return record;
}

export async function runProof(opts: ProofOptions): Promise<ProofResult> {
  const repoRoot = resolve(opts.repoRoot);
  const appDir = join(repoRoot, opts.appPath);
  const config = loadConfig(appDir);
  const criteria = loadCriteria(opts.criteriaPath ?? join(appDir, "criteria.yml"));
  const dir = resolve(opts.outDir ?? join(repoRoot, "evidence", `run-${Date.now()}`));
  const progress = opts.onProgress ?? (() => undefined);

  mkdirSync(join(dir, "shots"), { recursive: true });
  const criteriaCopy = join(dir, basename(criteria.path));
  copyFileSync(criteria.path, criteriaCopy);

  const log = EventLog.create(join(dir, "events.jsonl"));
  const refs: Partial<Record<PhaseName, string>> = { red: opts.base, green: opts.pr };
  if (opts.break !== undefined) refs.break = opts.break;
  log.append("run_start", { mode: "fix", app: opts.appPath, refs, criteria_sha256: criteria.sha256 });

  const ctx = { repoRoot, appPath: opts.appPath, config, criteria, dir, log, progress };
  const phases: PhaseRecord[] = [];
  for (const phase of ["red", "green", "break"] as const) {
    const ref = refs[phase];
    if (ref !== undefined) phases.push(await runPhase(phase, ref, ctx));
  }

  const outcome = fixVerdict(Object.fromEntries(phases.map((p) => [p.phase, p.result])));
  log.append("verdict", { verdict: outcome.verdict, reasons: outcome.reasons });
  log.append("sealed", { artifacts: listFiles(dir).filter((p) => !p.endsWith("events.jsonl")).length });

  const artifacts: Record<string, string> = {};
  for (const path of listFiles(dir)) {
    const r = rel(dir, path);
    if (r !== "events.jsonl" && r !== "receipt.json") artifacts[r] = sha256File(path);
  }

  const verifier = pickRoute("verifier");
  const body: ReceiptBody = {
    version: "attest.receipt/0.1",
    mode: "fix",
    created_at: new Date().toISOString(),
    subject: {
      repo: gitRemote(repoRoot),
      app: opts.appPath,
      refs: Object.fromEntries(phases.map((p) => [p.phase, { ref: p.ref, sha: p.sha }])),
      criteria_path: rel(dir, criteriaCopy),
      criteria_sha256: criteria.sha256,
    },
    phases,
    verdict: outcome.verdict,
    reasons: outcome.reasons,
    models: [{ role: "verifier", provider: verifier.provider, model: verifier.model }],
    artifacts,
    log: { path: "events.jsonl", head: log.head, entries: log.length },
  };

  const receipt = signReceipt(body);
  const receiptPath = join(dir, "receipt.json");
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  return { dir, receiptPath, receipt };
}
