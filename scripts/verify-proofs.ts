// Verifies every committed proof bundle: signature, hash chain, artifact hashes, criteria hash and
// the verdict recomputed from the recorded votes. No API key, no model calls.
// Usage: npm run verify-proofs [-- <dir>] [-- --write-index]      default dir: proofs/
// --write-index also writes <dir>/index.html, a dashboard of every receipt; without it nothing is written.
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Receipt } from "../src/receipt.js";
import { verifyReceipt } from "../src/receipt.js";
import type { ProofIndexEntry } from "../src/report.js";
import { renderProofsIndex } from "../src/report.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const writeIndex = args.includes("--write-index");
const root = resolve(repoRoot, args.find((a) => !a.startsWith("--")) ?? "proofs");

function receipts(dir: string): string[] {
  return readdirSync(dir)
    .sort()
    .flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return receipts(path);
      return name === "receipt.json" ? [path] : [];
    });
}

const found = receipts(root);
if (found.length === 0) {
  console.error(`no receipt.json under ${relative(repoRoot, root) || "."}`);
  process.exit(1);
}

let invalid = 0;
const entries: ProofIndexEntry[] = [];
for (const path of found) {
  const result = verifyReceipt(path);
  const where = relative(repoRoot, path).split("\\").join("/");
  if (result.ok) {
    console.log(`✔ ${result.verdict?.padEnd(16)} ${where}`);
  } else {
    invalid += 1;
    const failed = result.steps.filter((s) => !s.ok).map((s) => `${s.check}: ${s.detail}`);
    console.log(`✘ INVALID          ${where}\n    ${failed.join("\n    ")}`);
  }
  const receipt = JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, "")) as Receipt;
  entries.push({ path: relative(root, dirname(path)).split("\\").join("/"), receipt, valid: result.ok });
}

console.log(`\n${found.length - invalid} of ${found.length} receipts valid`);

if (writeIndex) {
  // Real-world proofs first, then held-out, pull requests and the benchmarks; alphabetical within each.
  const ORDER = ["realworld/", "heldout/", "pr-", "benchmark/", "bench-gen"];
  const rank = (p: string): number => {
    const i = ORDER.findIndex((prefix) => p.startsWith(prefix));
    return i === -1 ? ORDER.length : i;
  };
  entries.sort((a, b) => rank(a.path) - rank(b.path) || a.path.localeCompare(b.path));
  const out = join(root, "index.html");
  writeFileSync(out, renderProofsIndex(entries));
  console.log(`dashboard: ${relative(repoRoot, out).split("\\").join("/")}`);
}

process.exitCode = invalid === 0 ? 0 : 1;
