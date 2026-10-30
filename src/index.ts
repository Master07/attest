import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runLoop } from "./loop.js";
import { runProof } from "./proof.js";
import { verifyReceipt } from "./receipt.js";
import { writeReport } from "./report.js";

const USAGE = `usage:
  attest prove --app <path> --base <ref> --pr <ref> [--break <ref>] [--criteria <file>] [--out <dir>]
  attest loop  --app <path> --base <ref> --report "<bug report>" [--break <ref>] [--max-attempts <n>]
  attest verify <receipt.json>
  attest report <receipt.json>     (re)render the evidence page next to a receipt`;

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
if (existsSync(join(repoRoot, ".env"))) process.loadEnvFile(join(repoRoot, ".env"));

function flags(args: string[]): Map<string, string> {
  const out = new Map<string, string>();
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    const value = args[i + 1];
    if (key === undefined || !key.startsWith("--") || value === undefined) throw new Error(`bad argument near "${key ?? ""}"`);
    out.set(key.slice(2), value);
  }
  return out;
}

const [command, ...rest] = process.argv.slice(2);

try {
  if (command === "prove") {
    const f = flags(rest);
    const app = f.get("app");
    const base = f.get("base");
    const pr = f.get("pr");
    if (app === undefined || base === undefined || pr === undefined) throw new Error("prove needs --app, --base and --pr");

    const brk = f.get("break");
    const criteriaPath = f.get("criteria");
    const outDir = f.get("out");
    const { receiptPath, receipt } = await runProof({
      repoRoot,
      appPath: app,
      base,
      pr,
      ...(brk !== undefined ? { break: brk } : {}),
      ...(criteriaPath !== undefined ? { criteriaPath: resolve(criteriaPath) } : {}),
      ...(outDir !== undefined ? { outDir: resolve(outDir) } : {}),
      onProgress: (m) => console.log(`  ${m}`),
    });

    console.log(`\nverdict: ${receipt.verdict}`);
    for (const r of receipt.reasons) console.log(`  - ${r}`);
    console.log(`receipt: ${receiptPath}`);
    console.log(`evidence page: ${join(dirname(receiptPath), "index.html")}`);
    process.exitCode = receipt.verdict === "PROVEN" || receipt.verdict === "PROVEN_UNCHECKED" ? 0 : 1;
  } else if (command === "loop") {
    const f = flags(rest);
    const app = f.get("app");
    const base = f.get("base");
    const report = f.get("report");
    if (app === undefined || base === undefined || report === undefined) throw new Error("loop needs --app, --base and --report");

    const brk = f.get("break");
    const max = f.get("max-attempts");
    const result = await runLoop({
      repoRoot,
      appPath: app,
      base,
      report,
      ...(brk !== undefined ? { breakRef: brk } : {}),
      ...(max !== undefined ? { maxAttempts: Number(max) } : {}),
      onProgress: (m) => console.log(`  ${m}`),
    });

    console.log(`\noutcome: ${result.outcome}`);
    for (const a of result.attempts) {
      console.log(`  attempt ${a.attempt}: ${a.verdict ?? a.producer.error} (${a.producer.changed.join(", ") || "no changes"})`);
    }
    console.log(`evidence: ${result.dir}`);
    process.exitCode = result.outcome === "proven" ? 0 : 1;
  } else if (command === "report") {
    const path = rest[0];
    if (path === undefined) throw new Error("report needs a receipt path");
    console.log(`evidence page: ${writeReport(path)}`);
  } else if (command === "verify") {
    const path = rest[0];
    if (path === undefined) throw new Error("verify needs a receipt path");
    const result = verifyReceipt(path);
    for (const s of result.steps) console.log(`${s.ok ? "✔" : "✘"} ${s.check}: ${s.detail}`);
    console.log(result.ok ? `\nreceipt valid — verdict ${result.verdict}` : "\nreceipt INVALID");
    process.exitCode = result.ok ? 0 : 1;
  } else {
    console.log(USAGE);
    process.exitCode = command === undefined || command === "help" ? 0 : 1;
  }
} catch (err) {
  console.error(`attest: ${err instanceof Error ? err.message : String(err)}`);
  console.error(USAGE);
  process.exitCode = 1;
}
