// Verifies every committed proof bundle: signature, hash chain, artifact hashes, criteria hash and
// the verdict recomputed from the recorded votes. No API key, no model calls.
// Usage: npm run verify-proofs [-- <dir>]      default dir: proofs/
import { readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyReceipt } from "../src/receipt.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(repoRoot, process.argv[2] ?? "proofs");

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
}

console.log(`\n${found.length - invalid} of ${found.length} receipts valid`);
process.exitCode = invalid === 0 ? 0 : 1;
