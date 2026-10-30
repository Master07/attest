// Runs one verifier phase against the real Meta API.
// Usage: npm run phase -- [ref] [label]      e.g. npm run phase -- demo/base red
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launchBrowser } from "../src/browser.js";
import type { BrowserSession } from "../src/browser.js";
import { loadConfig } from "../src/config.js";
import { loadCriteria } from "../src/criteria.js";
import { runVerifier } from "../src/cua.js";
import { startWorkspace } from "../src/workspace.js";
import type { Workspace } from "../src/workspace.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
if (existsSync(join(repoRoot, ".env"))) process.loadEnvFile(join(repoRoot, ".env"));

const ref = process.argv[2] ?? "demo/base";
const label = process.argv[3] ?? "red";
const appPath = "examples/checkout-demo";
const config = loadConfig(join(repoRoot, appPath));
const criteria = loadCriteria(join(repoRoot, appPath, "criteria.yml"));
const outDir = join(repoRoot, "evidence", `phase-${Date.now()}`, label);

let workspace: Workspace | undefined;
let browser: BrowserSession | undefined;

try {
  await mkdir(outDir, { recursive: true });
  workspace = await startWorkspace({ repoRoot, appPath, ref, phase: label, config });
  browser = await launchBrowser(config.browser.viewport);
  await browser.open(`${workspace.url}/`);

  const result = await runVerifier({
    browser,
    criteria,
    appUrl: workspace.url,
    maxSteps: config.verifier.max_steps,
    onScreenshot: (step, png) => writeFile(join(outDir, `step-${String(step).padStart(2, "0")}.png`), png),
  });

  const finalPath = new URL(browser.currentUrl()).pathname;
  const pay = browser.network().find((r) => r.method === "POST" && r.path === "/api/pay");
  const record = { ref, sha: workspace.sha, label, criteriaSha256: criteria.sha256, ...result, finalPath, payRequest: pay?.status ?? null };
  await writeFile(join(outDir, "result.json"), JSON.stringify(record, null, 2));

  console.log(JSON.stringify({
    ref,
    status: result.status,
    model: result.model,
    steps: result.steps.length,
    verdicts: result.verdicts,
    error: result.error ?? null,
    finalPath,
    payRequest: pay?.status ?? null,
    evidence: outDir,
  }, null, 2));
  if (result.status !== "completed") process.exitCode = 1;
} finally {
  if (browser !== undefined) await browser.close();
  if (workspace !== undefined) await workspace.stop();
}
