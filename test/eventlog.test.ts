import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { EventLog, GENESIS, canonicalJson, hashEntry, verifyChain } from "../src/eventlog.js";

async function withTempDir(run: (dir: string) => void | Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "attest-eventlog-"));
  try {
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function linesOf(path: string): string[] {
  const text = readFileSync(path, "utf8");
  const lines = text.split(/\r?\n/);
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

function writeLines(path: string, lines: string[]): void {
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

test("three appends verify with the right seq, prev and head", async () => {
  await withTempDir((dir) => {
    const path = join(dir, "events.jsonl");
    const log = EventLog.create(path);

    const first = log.append("run_start", { repo: "checkout-demo" });
    const second = log.append("cua_action", { x: 640, y: 412 }, "green");
    const third = log.append("phase_result", { result: "pass" }, "green");

    assert.equal(first.seq, 1);
    assert.equal(second.seq, 2);
    assert.equal(third.seq, 3);
    assert.equal(first.prev, GENESIS);
    assert.equal(second.prev, first.hash);
    assert.equal(third.prev, second.hash);
    assert.equal(second.phase, "green");
    assert.equal(first.phase, null);

    const check = verifyChain(path);
    assert.equal(check.ok, true);
    assert.equal(check.entries, 3);
    assert.equal(check.head, log.head);
    assert.equal(check.head, third.hash);
    assert.equal(log.length, 3);
    assert.equal(log.path, path);

    const firstLine = linesOf(path)[0] ?? "";
    assert.deepEqual(Object.keys(JSON.parse(firstLine) as Record<string, unknown>), [
      "seq",
      "ts",
      "phase",
      "kind",
      "data",
      "prev",
      "hash",
    ]);
  });
});

test("append writes the line to disk before returning", async () => {
  await withTempDir((dir) => {
    const path = join(dir, "events.jsonl");
    const log = EventLog.create(path);

    assert.equal(linesOf(path).length, 0);
    log.append("run_start");
    assert.equal(linesOf(path).length, 1);
  });
});

test("create refuses to overwrite an existing log", async () => {
  await withTempDir((dir) => {
    const path = join(dir, "events.jsonl");
    EventLog.create(path);
    assert.throws(() => EventLog.create(path));
  });
});

test("editing a value in line 2 breaks the chain at line 2", async () => {
  await withTempDir((dir) => {
    const path = join(dir, "events.jsonl");
    const log = EventLog.create(path);
    const first = log.append("run_start");
    log.append("cua_action", { x: 1 });
    log.append("phase_result");

    const lines = linesOf(path);
    const tampered = JSON.parse(lines[1] ?? "") as Record<string, unknown>;
    tampered["kind"] = "something_else";
    lines[1] = JSON.stringify(tampered);
    writeLines(path, lines);

    const check = verifyChain(path);
    assert.equal(check.ok, false);
    assert.equal(check.error?.line, 2);
    assert.equal(check.entries, 1);
    assert.equal(check.head, first.hash);
  });
});

test("deleting line 2 is detected at line 2", async () => {
  await withTempDir((dir) => {
    const path = join(dir, "events.jsonl");
    const log = EventLog.create(path);
    log.append("run_start");
    log.append("cua_action");
    log.append("phase_result");

    const lines = linesOf(path);
    lines.splice(1, 1);
    writeLines(path, lines);

    const check = verifyChain(path);
    assert.equal(check.ok, false);
    assert.equal(check.error?.line, 2);
  });
});

test("reordering lines 2 and 3 is detected", async () => {
  await withTempDir((dir) => {
    const path = join(dir, "events.jsonl");
    const log = EventLog.create(path);
    log.append("run_start");
    log.append("cua_action");
    log.append("phase_result");

    const lines = linesOf(path);
    const second = lines[1];
    lines[1] = lines[2] ?? "";
    lines[2] = second ?? "";
    writeLines(path, lines);

    const check = verifyChain(path);
    assert.equal(check.ok, false);
    assert.equal(check.error?.line, 2);
  });
});

test("a forged extra line with a wrong prev is detected at that line", async () => {
  await withTempDir((dir) => {
    const path = join(dir, "events.jsonl");
    const log = EventLog.create(path);
    log.append("run_start");
    log.append("cua_action");
    log.append("phase_result");

    const forgedBody = {
      seq: 4,
      ts: "2026-11-02T00:00:00.000Z",
      phase: null,
      kind: "verdict",
      data: { verdict: "PROVEN" },
      prev: GENESIS,
    };
    const forged = { ...forgedBody, hash: hashEntry(forgedBody) };
    writeFileSync(path, `${readFileSync(path, "utf8")}${JSON.stringify(forged)}\n`, "utf8");

    const check = verifyChain(path);
    assert.equal(check.ok, false);
    assert.equal(check.error?.line, 4);
    assert.equal(check.entries, 3);
  });
});

test("CRLF line endings still verify", async () => {
  await withTempDir((dir) => {
    const path = join(dir, "events.jsonl");
    const log = EventLog.create(path);
    log.append("run_start");
    log.append("phase_result", { result: "pass" }, "red");

    writeFileSync(path, readFileSync(path, "utf8").replace(/\n/g, "\r\n"), "utf8");

    const check = verifyChain(path);
    assert.equal(check.ok, true);
    assert.equal(check.entries, 2);
    assert.equal(check.head, log.head);
  });
});

test("an empty file verifies with GENESIS", async () => {
  await withTempDir((dir) => {
    const path = join(dir, "events.jsonl");
    writeFileSync(path, "", "utf8");

    assert.deepEqual(verifyChain(path), { ok: true, entries: 0, head: GENESIS });
  });
});

test("a missing file fails at line 0", async () => {
  await withTempDir((dir) => {
    const check = verifyChain(join(dir, "nope.jsonl"));
    assert.equal(check.ok, false);
    assert.equal(check.error?.line, 0);
    assert.equal(check.entries, 0);
  });
});

test("canonicalJson sorts keys recursively and keeps array order", () => {
  assert.equal(canonicalJson({ b: 1, a: { d: 2, c: 3 } }), '{"a":{"c":3,"d":2},"b":1}');
  assert.equal(canonicalJson([{ z: 1, a: 2 }, "x"]), '[{"a":2,"z":1},"x"]');
  assert.equal(canonicalJson(null), "null");
});

test("canonicalJson rejects values JSON cannot carry", () => {
  assert.throws(() => canonicalJson({ a: undefined }), /undefined/);
  assert.throws(() => canonicalJson(undefined), /undefined/);
  assert.throws(() => canonicalJson([undefined]), /undefined/);
  assert.throws(() => canonicalJson([, 1]), /undefined/);
  assert.throws(() => canonicalJson({ a: Buffer.from("hi") }), /plain object/);
  assert.throws(() => canonicalJson(new Date()), /plain object/);
  assert.throws(() => canonicalJson(Number.NaN), /non-finite/);
  assert.throws(() => canonicalJson(10n), /bigint/);
});
