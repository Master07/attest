import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import type { AttestConfig } from "./config.js";
import { resolveUrl } from "./config.js";

export interface Workspace {
  ref: string;
  sha: string;
  dir: string;
  appDir: string;
  port: number;
  url: string;
  logs(): string[];
  stop(): Promise<void>;
}

export interface StartOptions {
  repoRoot: string;
  appPath: string;
  ref: string;
  phase: string;
  config: AttestConfig;
  port?: number;
  env?: Record<string, string>;   // extra environment for install/start (e.g. ATTEST_CONFIG_DIR)
}

export class WorkspaceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspaceError";
  }
}

const GIT_FALLBACK = "C:\\Program Files\\Git\\cmd\\git.exe";
const MAX_LOG_LINES = 200;

interface RunResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function spawnOnce(
  command: string,
  args: string[],
  options: { cwd: string; env?: NodeJS.ProcessEnv; shell?: boolean },
): Promise<RunResult> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      shell: options.shell ?? false,
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      rejectPromise(err);
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      resolvePromise({ code, stdout, stderr });
    });
  });
}

async function git(args: string[], cwd: string): Promise<RunResult> {
  try {
    return await spawnOnce("git", args, { cwd });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT" && process.platform === "win32") {
      return spawnOnce(GIT_FALLBACK, args, { cwd });
    }
    throw err;
  }
}

function freePort(): Promise<number> {
  return new Promise((resolvePromise, rejectPromise) => {
    const server = createServer();
    server.on("error", rejectPromise);
    server.listen(0, () => {
      const address = server.address();
      const port = typeof address === "object" && address !== null ? address.port : 0;
      server.close(() => {
        if (port === 0) rejectPromise(new Error("could not allocate a free port"));
        else resolvePromise(port);
      });
    });
  });
}

function hasExited(child: ChildProcess): boolean {
  return child.exitCode !== null || child.signalCode !== null;
}

async function killTree(child: ChildProcess): Promise<void> {
  if (hasExited(child)) return;
  const pid = child.pid;
  if (pid === undefined) return;

  if (process.platform === "win32") {
    await new Promise<void>((resolvePromise) => {
      const killer = spawn("taskkill", ["/T", "/F", "/PID", String(pid)], { windowsHide: true });
      killer.on("error", () => resolvePromise());
      killer.on("close", () => resolvePromise());
    });
  } else {
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      try {
        child.kill("SIGKILL");
      } catch {
        // already gone
      }
    }
  }

  if (hasExited(child)) return;
  await Promise.race([
    new Promise<void>((resolvePromise) => child.once("exit", () => resolvePromise())),
    delay(3000),
  ]);
}

function joinUrl(base: string, path: string): string {
  return new URL(path, base.endsWith("/") ? base : `${base}/`).toString();
}

export async function startWorkspace(opts: StartOptions): Promise<Workspace> {
  const repoRoot = resolve(opts.repoRoot);

  const revision = await git(["rev-parse", "--verify", `${opts.ref}^{commit}`], repoRoot);
  if (revision.code !== 0) {
    const detail = revision.stderr.trim().split(/\r?\n/).pop() ?? "git rev-parse failed";
    throw new WorkspaceError(`unknown ref "${opts.ref}" in ${repoRoot}: ${detail}`);
  }
  const sha = revision.stdout.trim();
  if (!sha) throw new WorkspaceError(`could not resolve "${opts.ref}" to a commit`);

  const worktreesRoot = join(repoRoot, ".attest", "worktrees");
  const dir = join(worktreesRoot, `${opts.phase}-${Date.now()}`);
  const appDir = join(dir, opts.appPath);

  let child: ChildProcess | undefined;
  let stopped = false;

  const removeWorktree = async (): Promise<void> => {
    try {
      await git(["worktree", "remove", "--force", dir], repoRoot);
    } catch {
      // best effort
    }
    try {
      await rm(dir, { recursive: true, force: true });
    } catch {
      // best effort
    }
    try {
      await git(["worktree", "prune"], repoRoot);
    } catch {
      // best effort
    }
  };

  const stop = async (): Promise<void> => {
    if (stopped) return;
    stopped = true;
    if (child !== undefined) {
      try {
        await killTree(child);
      } catch {
        // best effort
      }
      child = undefined;
    }
    await removeWorktree();
  };

  try {
    await mkdir(worktreesRoot, { recursive: true });

    const added = await git(["worktree", "add", "--detach", dir, sha], repoRoot);
    if (added.code !== 0) {
      const detail = (added.stderr || added.stdout).trim().split(/\r?\n/).slice(-20).join("\n");
      throw new WorkspaceError(`git worktree add failed for ${opts.ref}: ${detail}`);
    }

    if (opts.config.app.install !== undefined) {
      const installed = await spawnOnce(opts.config.app.install, [], {
        cwd: appDir,
        env: { ...process.env, ...opts.env },
        shell: true,
      });
      if (installed.code !== 0) {
        const detail = (installed.stderr || installed.stdout).trim().split(/\r?\n/).slice(-20).join("\n");
        throw new WorkspaceError(
          `install failed for ${opts.ref} (exit ${installed.code}): ${detail}`,
        );
      }
    }

    const port = opts.port ?? (await freePort());
    const url = resolveUrl(opts.config.app.url, port);

    const lines: string[] = [];
    let partial = "";
    const record = (chunk: Buffer): void => {
      partial += chunk.toString();
      const parts = partial.split(/\r?\n/);
      partial = parts.pop() ?? "";
      for (const line of parts) lines.push(line);
      if (lines.length > MAX_LOG_LINES) lines.splice(0, lines.length - MAX_LOG_LINES);
    };

    let exited = false;
    let exitDetail = "app exited early";

    const app = spawn(opts.config.app.start, [], {
      cwd: appDir,
      env: { ...process.env, ...opts.env, PORT: String(port) },
      shell: true,
      windowsHide: true,
      detached: process.platform !== "win32",
    });
    child = app;

    app.stdout?.on("data", record);
    app.stderr?.on("data", record);
    app.on("error", (err) => {
      exited = true;
      exitDetail = `could not start app: ${err.message}`;
    });
    app.on("exit", (code, signal) => {
      exited = true;
      exitDetail = signal ? `app exited on signal ${signal}` : `app exited with code ${code}`;
    });

    const readyUrl = joinUrl(url, opts.config.app.ready);
    const deadline = Date.now() + opts.config.app.timeout_s * 1000;
    let ready = false;

    while (Date.now() < deadline) {
      if (exited) break;
      try {
        const response = await fetch(readyUrl, { signal: AbortSignal.timeout(2000) });
        if (response.status === 200) {
          ready = true;
          break;
        }
      } catch {
        // not up yet
      }
      await delay(500);
    }

    if (!ready) {
      const tail = lines.slice(-20).join("\n");
      const reason = exited
        ? `${exitDetail} before ${readyUrl} returned 200`
        : `timed out after ${opts.config.app.timeout_s}s waiting for ${readyUrl}`;
      throw new WorkspaceError(`${reason}${tail ? `\n${tail}` : ""}`);
    }

    return {
      ref: opts.ref,
      sha,
      dir,
      appDir,
      port,
      url,
      logs: () => [...lines],
      stop,
    };
  } catch (err) {
    await stop();
    if (err instanceof WorkspaceError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    throw new WorkspaceError(`failed to start workspace for "${opts.ref}": ${message}`);
  }
}
