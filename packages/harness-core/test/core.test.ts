// Tests for @corbet/harness-core itself: the moved event log, hash chain,
// signing and generic receipt verifier. Attest's golden tests in
// test/harness-golden.test.ts remain the byte-identical contract for the wrappers.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  canonicalBytes,
  canonicalJson,
  createSignature,
  EventLog,
  GENESIS,
  hashArtifact,
  hashEntry,
  hashEvent,
  keyFingerprint,
  verifyChain,
  verifyChainText,
  verifyReceipt,
  verifySignature,
} from "../src/index.js";
import { ed25519PublicKeyDerBase64, generateEd25519PrivateKeyPem } from "../src/adapters/node.js";

function withTempDir(run: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "attest-harness-core-"));
  try {
    run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("canonical bytes are utf8 of the canonical json", () => {
  assert.equal(canonicalJson({ b: 1, a: [3, { z: 0, y: 1 }] }), '{"a":[3,{"y":1,"z":0}],"b":1}');
  assert.deepEqual(Buffer.from(canonicalBytes({ b: 1 })), Buffer.from('{"b":1}', "utf8"));
});

test("hashEvent chains after prev and matches an independent sha256", () => {
  const event = { seq: 1, ts: "2026-11-24T00:00:00.000Z", phase: null, kind: "run_start", data: {} };
  const expected = `sha256:${createHash("sha256").update(canonicalJson({ ...event, prev: GENESIS }), "utf8").digest("hex")}`;
  assert.equal(hashEvent(GENESIS, event), expected);
  assert.equal(hashEntry({ ...event, prev: GENESIS }), expected);
});

test("event log round-trips through the core verifier", () => {
  withTempDir((dir) => {
    const path = join(dir, "events.jsonl");
    const log = EventLog.create(path);
    const first = log.append("run_start");
    const second = log.append("phase_result", { result: "pass" }, "red");
    assert.equal(second.seq, 2);
    assert.equal(second.prev, first.hash);
    assert.deepEqual(verifyChain(path), { ok: true, entries: 2, head: log.head });
    assert.deepEqual(verifyChainText(readFileSync(path, "utf8")), verifyChain(path));
  });
});

test("tampering breaks the core chain at that line", () => {
  withTempDir((dir) => {
    const path = join(dir, "events.jsonl");
    const log = EventLog.create(path);
    log.append("a");
    log.append("b");
    const lines = readFileSync(path, "utf8").split("\n");
    lines[1] = (lines[1] ?? "").replace('"kind":"b"', '"kind":"c"');
    writeFileSync(path, lines.join("\n"));
    const check = verifyChain(path);
    assert.equal(check.ok, false);
    assert.equal(check.error?.line, 2);
    assert.equal(check.entries, 1);
  });
});

test("signatures verify and fail on a changed body", () => {
  const pem = generateEd25519PrivateKeyPem();
  const body = { hello: "world" };
  const signature = createSignature(body, pem);
  assert.equal(signature.alg, "ed25519");
  assert.equal(verifySignature(body, signature), true);
  assert.equal(verifySignature({ hello: "changed" }, signature), false);
  assert.equal(keyFingerprint(signature.public_key), keyFingerprint(ed25519PublicKeyDerBase64(pem)));
});

test("hashArtifact pins bytes in sha256 hex form", () => {
  assert.equal(hashArtifact(new TextEncoder().encode("abc")), `sha256:${createHash("sha256").update("abc").digest("hex")}`);
});

test("core verifyReceipt checks signature, chain and artifacts with hooks", () => {
  withTempDir((dir) => {
    const pem = generateEd25519PrivateKeyPem();
    const log = EventLog.create(join(dir, "events.jsonl"));
    log.append("run_start");
    writeFileSync(join(dir, "artifact.txt"), "evidence");
    // Sign the body without the signature, as the wrapper does.
    const unsigned = {
      verdict: "PROVEN" as const,
      log: { path: "events.jsonl", head: log.head, entries: log.length },
      artifacts: { "artifact.txt": hashArtifact(new TextEncoder().encode("evidence")) },
    };
    const signed = { ...unsigned, signature: createSignature(unsigned, pem) };
    const deps = {
      dir,
      loadEvents: (abs: string) => readFileSync(abs, "utf8"),
      loadArtifact: (abs: string) => {
        try {
          return new Uint8Array(readFileSync(abs));
        } catch {
          return null;
        }
      },
      extraSteps: () => [{ check: "criteria", ok: true, detail: "criteria hash matches" }],
      recompute: () => ({ verdict: "PROVEN" as const, mismatches: [] as string[] }),
    };
    const clean = verifyReceipt(signed, deps);
    assert.equal(clean.ok, true);
    assert.deepEqual(clean.steps.map((s) => s.check), ["signature", "event log", "artifacts", "criteria", "verdict"]);
    writeFileSync(join(dir, "artifact.txt"), "tampered");
    const dirty = verifyReceipt(signed, deps);
    assert.equal(dirty.ok, false);
    assert.deepEqual(dirty.steps.filter((s) => !s.ok).map((s) => s.check), ["artifacts"]);
  });
});
