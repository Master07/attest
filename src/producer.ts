import { spawn, spawnSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

// The producer side of the closed loop (ARCHITECTURE §15.1): Muse Code writes a fix in its own
// worktree, headless. It sees the bug report and, on retries, Attest's feedback — never the
// verifier's prompts or the `expect` checks.

export interface AttemptOptions {
  repoRoot: string;
  appPath: string;          // the only directory the producer may change
  base: string;             // ref to branch from
  branch: string;           // new branch for this attempt
  prompt: string;
  images: string[];         // absolute paths of screenshots to attach
  model: string;
  maxSteps: number;
  logFile: string;          // Muse Code's JSONL event stream is written here
  timeoutMs?: number;       // default 15 minutes
}

export interface AttemptResult {
  branch: string;
  sha: string | null;
  changed: string[];
  summary: string;
  usage: { model: string; input_tokens: number; cached_tokens: number; output_tokens: number; calls: number }[];
  error: string | null;
}

const GIT_FALLBACK = "C:\\Program Files\\Git\\cmd\\git.exe";

function git(args: string[], cwd: string): { code: number; out: string } {
  let r = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (r.error !== undefined && process.platform === "win32") r = spawnSync(GIT_FALLBACK, args, { cwd, encoding: "utf8" });
  return { code: r.status ?? 1, out: `${r.stdout ?? ""}${r.stderr ?? ""}`.trim() };
}

function museBin(): string {
  if (process.env.MUSE_BIN) return process.env.MUSE_BIN;
  const local = join(process.env.LOCALAPPDATA ?? "", "Programs", "muse", "muse.cmd");
  return process.platform === "win32" && existsSync(local) ? local : "muse";
}

const quote = (s: string): string => (/[\s"&|<>^]/.test(s) ? `"${s.replace(/"/g, '\\"')}"` : s);

function killTree(pid: number | undefined): void {
  if (pid === undefined) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/T", "/F", "/PID", String(pid)], { windowsHide: true });
  else {
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      // already gone
    }
  }
}

/** Resolves with the exit code, or "timeout" if Muse Code ran longer than `timeoutMs` (e.g. stuck on an approval). */
function runMuse(args: string[], cwd: string, logFile: string, timeoutMs: number): Promise<number | "timeout"> {
  return new Promise((resolvePromise, reject) => {
    const out = createWriteStream(logFile);
    // muse.cmd is a batch file on Windows, so it needs a shell; arguments are quoted above.
    const child = spawn([museBin(), ...args].map(quote).join(" "), {
      cwd, shell: true, windowsHide: true, detached: process.platform !== "win32",
    });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child.pid);
    }, timeoutMs);
    child.stdout.pipe(out);
    child.stderr.pipe(out);
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      out.end(() => resolvePromise(timedOut ? "timeout" : (code ?? 1)));
    });
  });
}

function parseMuseLog(text: string): { summary: string; usage: AttemptResult["usage"] } {
  let summary = "";
  let usage: AttemptResult["usage"] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.replace(/^\uFEFF/, "").trim();
    if (!trimmed.startsWith("{")) continue;
    try {
      const e = JSON.parse(trimmed) as { payload_type?: string; payload?: { text?: string; models?: AttemptResult["usage"] } };
      if (e.payload_type === "run.terminal.completed" && typeof e.payload?.text === "string") summary = e.payload.text;
      if (e.payload_type === "run.usage" && Array.isArray(e.payload?.models)) usage = e.payload.models;
    } catch {
      // not an event line
    }
  }
  return { summary, usage };
}

export async function runProducerAttempt(opts: AttemptOptions): Promise<AttemptResult> {
  const repoRoot = resolve(opts.repoRoot);
  const dir = join(repoRoot, ".attest", "producer", opts.branch.replace(/[^\w.-]+/g, "_"));
  const result: AttemptResult = { branch: opts.branch, sha: null, changed: [], summary: "", usage: [], error: null };

  const added = git(["worktree", "add", "-q", "-b", opts.branch, dir, opts.base], repoRoot);
  if (added.code !== 0) return { ...result, error: `git worktree add failed: ${added.out}` };

  try {
    const promptFile = `${dir}.prompt.txt`;
    mkdirSync(join(repoRoot, ".attest", "producer"), { recursive: true });
    writeFileSync(promptFile, opts.prompt, "utf8");

    const args = ["exec", "--workspace", dir, "--prompt-file", promptFile, "--model", opts.model,
      "--max-model-steps", String(opts.maxSteps), "--json", ...opts.images.flatMap((p) => ["--image", p])];
    const timeoutMs = opts.timeoutMs ?? 15 * 60_000;
    const code = await runMuse(args, dir, opts.logFile, timeoutMs);

    const parsed = parseMuseLog(readFileSync(opts.logFile, "utf8"));
    result.summary = parsed.summary;
    result.usage = parsed.usage;
    if (code === "timeout") return { ...result, error: `muse exec did not finish within ${timeoutMs / 60_000} minutes` };
    if (code !== 0) return { ...result, error: `muse exec exited with ${code}` };

    git(["add", "-A"], dir);
    result.changed = git(["diff", "--cached", "--name-only"], dir).out.split(/\r?\n/).filter(Boolean);
    if (result.changed.length === 0) return { ...result, error: "the producer made no changes" };

    const outside = result.changed.filter((f) => !f.startsWith(`${opts.appPath.replace(/\\/g, "/")}/`));
    if (outside.length > 0) return { ...result, error: `the producer changed files outside ${opts.appPath}: ${outside.join(", ")}` };

    const subject = (result.summary.split(/(?<=\.)\s/)[0] ?? "Fix attempt").slice(0, 72);
    const committed = git(["commit", "-q", "-m", `Muse Code attempt: ${subject}`, "-m", result.summary], dir);
    if (committed.code !== 0) return { ...result, error: `git commit failed: ${committed.out}` };
    result.sha = git(["rev-parse", "HEAD"], dir).out;
    return result;
  } finally {
    git(["worktree", "remove", "--force", dir], repoRoot);
    git(["worktree", "prune"], repoRoot);
  }
}
