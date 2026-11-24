import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, createPublicKey, verify } from "node:crypto";
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { canonicalJson, GENESIS, hashEntry, verifyChain } from "../src/eventlog.js";
import type { LogEntry } from "../src/eventlog.js";
import { sha256File, signReceipt, verifyReceipt } from "../src/receipt.js";
import type { Receipt, ReceiptBody } from "../src/receipt.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const fixtures = join(root, "test/fixtures/golden");
// Public, test-only private key. Always pass this path; never consult the user's signing key.
const keyPath = join(fixtures, "test-only-ed25519.pem");
const cases = [
  { name: "proven", verdict: "PROVEN", path: "proofs/benchmark/run-2/B10/receipt.json" },
  { name: "rejected", verdict: "REJECTED", path: "proofs/heldout/run-2/C11-A/receipt.json" },
  { name: "inconclusive", verdict: "INCONCLUSIVE", path: "proofs/heldout/run-1/C01-A/receipt.json" },
] as const;

function readReceipt(path: string): Receipt {
  return JSON.parse(readFileSync(path, "utf8")) as Receipt;
}

// No canonicalBytes export exists today: this is exactly signReceipt's byte conversion.
function signedBytes(body: ReceiptBody): Buffer {
  return Buffer.from(canonicalJson(body), "utf8");
}

function signatureMatches(body: ReceiptBody, signature: Receipt["signature"]): boolean {
  const key = createPublicKey({ key: Buffer.from(signature.public_key, "base64"), format: "der", type: "spki" });
  return signature.alg === "ed25519" && verify(null, signedBytes(body), key, Buffer.from(signature.value, "base64"));
}

for (const sample of cases) {
  test(`golden canonical bytes: ${sample.verdict}`, () => {
    const { signature, ...body } = readReceipt(join(root, sample.path));
    assert.equal(body.verdict, sample.verdict);
    const expected = readFileSync(join(fixtures, `${sample.name}.canonical.json`));
    assert.deepEqual(signedBytes(body), expected, sample.path);
    assert.deepEqual(signedBytes(JSON.parse(expected.toString("utf8")) as ReceiptBody), expected);
    // Confirm the captured bytes are the ones authenticated by the committed receipt.
    assert.equal(signatureMatches(body, signature), true, sample.path);
  });
}

test("golden chains: every committed events.jsonl reproduces its hashes and receipt log.head", () => {
  // Git's index defines 'committed' here, excluding ignored/untracked local proof runs.
  const paths = execFileSync("git", ["ls-files", "-z", "--", "events.jsonl", "**/events.jsonl"], {
    cwd: root, encoding: "utf8",
  }).split("\0").filter(Boolean).sort();
  assert.ok(paths.length > 0, "must discover committed event logs");
  for (const rel of paths) {
    const path = join(root, rel);
    const text = readFileSync(path, "utf8");
    const lines = text.split(/\r?\n/);
    if (lines.at(-1) === "") lines.pop();
    let head = GENESIS;
    for (const [index, line] of lines.entries()) {
      const entry = JSON.parse(line) as LogEntry;
      const label = `${rel}:${index + 1}`;
      assert.equal(entry.seq, index + 1, label);
      assert.equal(entry.prev, head, label);
      const body = { seq: entry.seq, ts: entry.ts, phase: entry.phase, kind: entry.kind, data: entry.data, prev: head };
      // Independent SHA-256 calculation also pins the algorithm behind hashEntry.
      const expected = `sha256:${createHash("sha256").update(canonicalJson(body), "utf8").digest("hex")}`;
      assert.equal(hashEntry(body), expected, label);
      assert.equal(entry.hash, expected, label);
      head = expected;
    }
    const receipt = readReceipt(join(dirname(path), "receipt.json"));
    assert.equal(join(dirname(path), receipt.log.path), path, rel);
    assert.equal(receipt.log.head, head, rel);
    assert.equal(receipt.log.entries, lines.length, rel);
    assert.deepEqual(verifyChain(path), { ok: true, entries: lines.length, head }, rel);
  }
});

test("golden signature: fixed body and test-only Ed25519 key reproduce the recorded signature", () => {
  const body = JSON.parse(readFileSync(join(fixtures, "signing-body.json"), "utf8")) as ReceiptBody;
  const expected = JSON.parse(readFileSync(join(fixtures, "signature.json"), "utf8")) as Receipt["signature"];
  const { signature, ...actualBody } = signReceipt(body, keyPath);
  assert.deepEqual(actualBody, body);
  assert.deepEqual(signature, expected);
  assert.equal(signatureMatches(body, expected), true);
});

function withBundle(run: (dir: string, path: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "attest-harness-golden-"));
  try {
    copyFileSync(join(fixtures, "signing-events.jsonl"), join(dir, "events.jsonl"));
    for (const name of ["criteria.yml", "artifact.txt"]) {
      copyFileSync(join(fixtures, name), join(dir, name));
    }
    const body = JSON.parse(readFileSync(join(fixtures, "signing-body.json"), "utf8")) as ReceiptBody;
    const signature = JSON.parse(readFileSync(join(fixtures, "signature.json"), "utf8")) as Receipt["signature"];
    const path = join(dir, "receipt.json");
    writeFileSync(path, JSON.stringify({ ...body, signature }));
    assert.ok(
      ["artifact.txt", "criteria.yml"].every((name) => !readFileSync(join(dir, name)).includes(0x0d)),
      "golden fixture line endings must contain no CR bytes",
    );
    const clean = verifyReceipt(path);
    assert.equal(clean.ok, true, JSON.stringify(clean.steps));
    run(dir, path);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function changeOneByte(bytes: Buffer, index: number): Buffer {
  assert.ok(index >= 0 && index < bytes.length);
  const changed = Buffer.from(bytes);
  changed[index] = bytes[index]! ^ 1;
  assert.equal(changed.length, bytes.length);
  assert.equal(changed.reduce((count, byte, i) => count + Number(byte !== bytes[i]), 0), 1);
  return changed;
}

function assertOnlyFailure(path: string, check: string): void {
  const result = verifyReceipt(path);
  assert.equal(result.ok, false);
  assert.deepEqual(result.steps.filter((step) => !step.ok).map((step) => step.check), [check]);
}

test("golden tamper: one event byte breaks chain verification at that index", () => {
  withBundle((dir, path) => {
    const logPath = join(dir, "events.jsonl");
    const bytes = readFileSync(logPath);
    const offset = bytes.indexOf("event 2");
    assert.ok(offset >= 0);
    writeFileSync(logPath, changeOneByte(bytes, offset));
    const check = verifyChain(logPath);
    const first = JSON.parse(bytes.toString("utf8").split("\n")[0]!) as LogEntry;
    assert.equal(check.ok, false);
    assert.equal(check.error?.line, 2); // current public API reports a one-based line
    assert.match(check.error?.reason ?? "", /^hash is .*expected sha256:/);
    assert.equal(check.entries, 1);
    assert.equal(check.head, first.hash);
    assertOnlyFailure(path, "event log");
  });
});

test("golden tamper: one receipt body byte fails the signature", () => {
  withBundle((_dir, path) => {
    const bytes = readFileSync(path);
    const offset = bytes.indexOf("golden-test");
    assert.ok(offset >= 0);
    writeFileSync(path, changeOneByte(bytes, offset));
    const { signature, ...body } = readReceipt(path);
    assert.equal(signatureMatches(body, signature), false);
    assertOnlyFailure(path, "signature");
  });
});

test("golden tamper: one artifact byte fails its hash check", () => {
  withBundle((dir, path) => {
    const artifactPath = join(dir, "artifact.txt");
    const expected = readReceipt(path).artifacts["artifact.txt"];
    assert.equal(sha256File(artifactPath), expected);
    writeFileSync(artifactPath, changeOneByte(readFileSync(artifactPath), 0));
    assert.notEqual(sha256File(artifactPath), expected);
    assertOnlyFailure(path, "artifacts");
    const step = verifyReceipt(path).steps.find((entry) => entry.check === "artifacts");
    assert.equal(step?.detail, "artifact.txt changed");
  });
});
