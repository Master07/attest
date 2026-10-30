import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launchBrowser } from "../src/browser.js";
import type { BrowserSession } from "../src/browser.js";
import { loadConfig } from "../src/config.js";
import { startWorkspace, WorkspaceError } from "../src/workspace.js";
import type { Workspace } from "../src/workspace.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const appPath = "examples/checkout-demo";
const config = loadConfig(join(repoRoot, appPath));
const refs = ["demo/base", "demo/bad-fix", "demo/fix"];

function worktreeCount(): number {
  const args = ["worktree", "list", "--porcelain"];
  let result = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8" });
  if (result.error !== undefined && (result.error as NodeJS.ErrnoException).code === "ENOENT") {
    result = spawnSync("C:\\Program Files\\Git\\cmd\\git.exe", args, { cwd: repoRoot, encoding: "utf8" });
  }
  if (result.status !== 0) throw new Error(`git worktree list failed: ${result.stderr ?? result.error?.message}`);
  return (result.stdout ?? "").split(/\r?\n/).filter((line) => line.startsWith("worktree ")).length;
}

for (const ref of refs) {
  let workspace: Workspace | undefined;
  let browser: BrowserSession | undefined;

  try {
    workspace = await startWorkspace({ repoRoot, appPath, ref, phase: "smoke", config });

    browser = await launchBrowser(config.browser.viewport);
    await browser.open(`${workspace.url}/cart`);

    const point = await browser.locate("#pay");
    if (point === null) throw new Error(`could not locate "#pay" on ${ref}`);

    await browser.act({ type: "click", x: point.x, y: point.y });
    await browser.act({ type: "wait", ms: 1500 });

    const finalPath = new URL(browser.currentUrl()).pathname;
    const pay = browser.network().find((record) => record.method === "POST" && record.path === "/api/pay");

    console.log(JSON.stringify({ ref, sha: workspace.sha, finalPath, payRequest: pay?.status ?? null }));
  } finally {
    if (browser !== undefined) await browser.close();
    if (workspace !== undefined) await workspace.stop();
  }
}

const before = worktreeCount();
try {
  await startWorkspace({ repoRoot, appPath, ref: "demo/does-not-exist", phase: "smoke", config });
  console.log(JSON.stringify({ ref: "demo/does-not-exist", error: "no error thrown", ok: false }));
  process.exitCode = 1;
} catch (err) {
  const after = worktreeCount();
  const ok = err instanceof WorkspaceError && after === before;
  console.log(
    JSON.stringify({
      ref: "demo/does-not-exist",
      error: err instanceof WorkspaceError ? "WorkspaceError" : String(err),
      newWorktrees: after - before,
      ok,
    }),
  );
  if (!ok) process.exitCode = 1;
}
