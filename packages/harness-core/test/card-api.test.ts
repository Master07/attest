// Pinning tests for the T-002 round-1 fixes: the original signature and chain
// behaviour, plus the card API added to the core (byte-level sign/verify,
// EventLog.read, events-based verifyChain).
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  EventLog,
  GENESIS,
  createSignature,
  sign,
  verifyChain,
  verifyChainFile,
  verifyReceipt,
  verifySignature,
} from "../src/index.js";
import type { ReceiptSignature } from "../src/index.js";
import { ed25519PublicKeyDerBase64, generateEd25519PrivateKeyPem, utf8Bytes } from "../src/adapters/node.js";

function withTempDir(run: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "attest-harness-core-card-"));
  try {
    run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function fileDeps(dir: string): {
  dir: string;
  loadEvents: (abs: string) => string;
  loadArtifact: (abs: string) => Uint8Array | null;
} {
  return {
    dir,
    loadEvents: (abs: string) => readFileSync(abs, "utf8"),
    loadArtifact: (abs: string) => {
      try {
        return new Uint8Array(readFileSync(abs));
      } catch {
        return null;
      }
    },
  };
}

function badAlgSignature(): ReceiptSignature {
  return { alg: "rsa", public_key: "", value: "AA==" } as unknown as ReceiptSignature;
}

test("wrong alg with an unreadable key reports the key error, as before extraction", () => {
  withTempDir((dir) => {
    const log = EventLog.create(join(dir, "events.jsonl"));
    log.append("run_start");
    const receipt = {
      verdict: "PROVEN",
      log: { path: "events.jsonl", head: log.head, entries: log.length },
      artifacts: {} as Record<string, string>,
      signature: badAlgSignature(),
    };
    const result = verifyReceipt(receipt, fileDeps(dir));
    const step = result.steps.find((s) => s.check === "signature");
    assert.equal(step?.ok, false);
    assert.equal(step?.detail, "Failed to read asymmetric key");
  });
});

test("wrong alg with a readable key fails as a mismatch without throwing", () => {
  withTempDir((dir) => {
    const pem = generateEd25519PrivateKeyPem();
    const log = EventLog.create(join(dir, "events.jsonl"));
    log.append("run_start");
    const unsigned = {
      verdict: "PROVEN",
      log: { path: "events.jsonl", head: log.head, entries: log.length },
      artifacts: {} as Record<string, string>,
    };
    const good = createSignature(unsigned, pem);
    const receipt = { ...unsigned, signature: { ...good, alg: "rsa" } as unknown as ReceiptSignature };
    const result = verifyReceipt(receipt, fileDeps(dir));
    const step = result.steps.find((s) => s.check === "signature");
    assert.equal(step?.ok, false);
    assert.equal(step?.detail, "signature does not match the receipt body");
  });
});

test("non-finite event data propagates out of verifyReceipt", () => {
  withTempDir((dir) => {
    const logPath = join(dir, "events.jsonl");
    EventLog.create(logPath);
    writeFileSync(
      logPath,
      `{"seq":1,"ts":"2026-11-24T00:00:00.000Z","phase":null,"kind":"run_start",` +
        `"data":{"x":1e999},"prev":"${GENESIS}","hash":"sha256:00"}\n`,
      "utf8",
    );
    // A valid signature gets past step 1 so verification reaches the event log.
    const pem = generateEd25519PrivateKeyPem();
    const unsigned = {
      verdict: "PROVEN",
      log: { path: "events.jsonl", head: GENESIS, entries: 1 },
      artifacts: {} as Record<string, string>,
    };
    const signed = { ...unsigned, signature: createSignature(unsigned, pem) };
    assert.throws(() => verifyReceipt(signed, fileDeps(dir)), /canonicalJson: non-finite number Infinity/);
  });
});

test("an unreadable log is a failed event-log step, not a throw", () => {
  withTempDir((dir) => {
    const pem = generateEd25519PrivateKeyPem();
    const unsigned = {
      verdict: "PROVEN",
      log: { path: "missing.jsonl", head: GENESIS, entries: 0 },
      artifacts: {} as Record<string, string>,
    };
    const signed = { ...unsigned, signature: createSignature(unsigned, pem) };
    const result = verifyReceipt(signed, fileDeps(dir));
    assert.equal(result.ok, false);
    const step = result.steps.find((s) => s.check === "event log");
    assert.equal(step?.ok, false);
    assert.match(step?.detail ?? "", /^chain broken at line 0: cannot read .*missing\.jsonl: /);
  });
});

test("byte-level sign and verifySignature round-trip", () => {
  const pem = generateEd25519PrivateKeyPem();
  const publicKey = ed25519PublicKeyDerBase64(pem);
  const bytes = utf8Bytes('{"hello":"world"}');
  const value = sign(bytes, pem);
  assert.equal(verifySignature(bytes, value, publicKey), true);
  assert.equal(verifySignature(utf8Bytes('{"hello":"changed"}'), value, publicKey), false);
  const otherKey = ed25519PublicKeyDerBase64(generateEd25519PrivateKeyPem());
  assert.equal(verifySignature(bytes, value, otherKey), false);
});

test("EventLog.read returns the appended entries and head stays a property", () => {
  withTempDir((dir) => {
    const path = join(dir, "events.jsonl");
    const log = EventLog.create(path);
    const first = log.append("run_start");
    const second = log.append("phase_result", { result: "pass" }, "red");
    assert.deepEqual(log.read(), [first, second]);
    assert.deepEqual(
      log.read(),
      readFileSync(path, "utf8").trim().split("\n").map((line) => JSON.parse(line)),
    );
    assert.equal(typeof log.head, "string");
    assert.equal(log.head, second.hash);
  });
});

test("EventLog.read on an empty log returns no entries", () => {
  withTempDir((dir) => {
    const path = join(dir, "events.jsonl");
    const log = EventLog.create(path);
    assert.deepEqual(log.read(), []);
  });
});

test("events-based verifyChain reports ok and the 1-based brokenAt line", () => {
  withTempDir((dir) => {
    const path = join(dir, "events.jsonl");
    const log = EventLog.create(path);
    const first = log.append("a");
    const second = log.append("b");
    assert.deepEqual(verifyChain([first, second]), { ok: true });
    assert.deepEqual(verifyChain([]), { ok: true });

    const tampered = { ...second, kind: "c" };
    assert.deepEqual(verifyChain([first, tampered]), { ok: false, brokenAt: 2 });

    // brokenAt is the same number Attest reports for the file form.
    const lines = readFileSync(path, "utf8").split("\n");
    lines[1] = (lines[1] ?? "").replace('"kind":"b"', '"kind":"c"');
    writeFileSync(path, lines.join("\n"));
    const fileCheck = verifyChain(path);
    assert.equal(fileCheck.ok, false);
    if (fileCheck.ok) throw new Error("unreachable");
    assert.equal(fileCheck.error?.line, 2);
    assert.deepEqual(verifyChainFile(path), fileCheck);
  });
});
