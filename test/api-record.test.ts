import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { ApiError, postResponses } from "../src/api.js";

// Changing ATTEST_RECORD mid-process must move recording to the new file: the
// path is read on every call (as main does), not frozen from the first call.

function stubFetchOk(): void {
  (globalThis as Record<string, unknown>).fetch = async (): Promise<Response> =>
    new Response(JSON.stringify({ id: "r1", output_text: "hi" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
}

test("switching ATTEST_RECORD from A to B writes each response to the current file", async () => {
  const realFetch = globalThis.fetch;
  const savedRecord = process.env.ATTEST_RECORD;
  const savedReplay = process.env.ATTEST_REPLAY;
  stubFetchOk();
  const dir = mkdtempSync(join(tmpdir(), "attest-record-"));
  const fileA = join(dir, "a.jsonl");
  const fileB = join(dir, "b.jsonl");
  try {
    delete process.env.ATTEST_REPLAY;
    process.env.ATTEST_RECORD = fileA;
    await postResponses("https://x/v1", "k", { model: "muse-spark-1.3" });
    process.env.ATTEST_RECORD = fileB;
    await postResponses("https://x/v1", "k", { model: "muse-spark-1.3" });

    const linesA = readFileSync(fileA, "utf8").split("\n").filter((l) => l.trim());
    const linesB = readFileSync(fileB, "utf8").split("\n").filter((l) => l.trim());
    assert.equal(linesA.length, 1);
    assert.equal(linesB.length, 1);
    const entryA = JSON.parse(linesA[0] ?? "") as { model: string; response: { id: string } };
    const entryB = JSON.parse(linesB[0] ?? "") as { model: string; response: { id: string } };
    assert.equal(entryA.model, "muse-spark-1.3");
    assert.equal(entryA.response.id, "r1");
    assert.equal(entryB.model, "muse-spark-1.3");
    assert.equal(entryB.response.id, "r1");
  } finally {
    globalThis.fetch = realFetch;
    if (savedRecord === undefined) delete process.env.ATTEST_RECORD;
    else process.env.ATTEST_RECORD = savedRecord;
    if (savedReplay === undefined) delete process.env.ATTEST_REPLAY;
    else process.env.ATTEST_REPLAY = savedReplay;
  }
});

test("recording A -> B -> A keeps one global sequence counter", async () => {
  // Matches main: the seq counter is never reset when ATTEST_RECORD changes, so
  // A -> B -> A records seqs s, s+1, s+2 across the two files (A holds the 1st
  // and 3rd lines, B the 2nd). Earlier tests in this file already recorded, so
  // only consecutiveness — not the absolute values — is asserted here.
  const realFetch = globalThis.fetch;
  const savedRecord = process.env.ATTEST_RECORD;
  const savedReplay = process.env.ATTEST_REPLAY;
  stubFetchOk();
  const dir = mkdtempSync(join(tmpdir(), "attest-record-aba-"));
  const fileA = join(dir, "a.jsonl");
  const fileB = join(dir, "b.jsonl");
  try {
    delete process.env.ATTEST_REPLAY;
    process.env.ATTEST_RECORD = fileA;
    await postResponses("https://x/v1", "k", { model: "muse-spark-1.3" });
    process.env.ATTEST_RECORD = fileB;
    await postResponses("https://x/v1", "k", { model: "muse-spark-1.3" });
    process.env.ATTEST_RECORD = fileA;
    await postResponses("https://x/v1", "k", { model: "muse-spark-1.3" });

    const seqsOf = (file: string): number[] =>
      readFileSync(file, "utf8").split("\n").filter((l) => l.trim()).map((l) => (JSON.parse(l) as { seq: number }).seq);
    const seqsA = seqsOf(fileA);
    const seqsB = seqsOf(fileB);
    assert.equal(seqsA.length, 2);
    assert.equal(seqsB.length, 1);
    const [first, second, third] = [seqsA[0] ?? -1, seqsB[0] ?? -1, seqsA[1] ?? -1];
    assert.equal(second, first + 1);
    assert.equal(third, first + 2);
  } finally {
    globalThis.fetch = realFetch;
    if (savedRecord === undefined) delete process.env.ATTEST_RECORD;
    else process.env.ATTEST_RECORD = savedRecord;
    if (savedReplay === undefined) delete process.env.ATTEST_REPLAY;
    else process.env.ATTEST_REPLAY = savedReplay;
  }
});

test("replaying A -> B -> A keeps one queue from the first path", async () => {
  // Matches main: the replay queue is loaded once, from the first ATTEST_REPLAY
  // path, and consumed in order across later calls. With two-entry cassettes,
  // A -> B -> A answers A1, A2 (the B file is never loaded), then fails with 499.
  const realFetch = globalThis.fetch;
  const savedRecord = process.env.ATTEST_RECORD;
  const savedReplay = process.env.ATTEST_REPLAY;
  (globalThis as Record<string, unknown>).fetch = async (): Promise<Response> => {
    throw new Error("replay must not touch the network");
  };
  const dir = mkdtempSync(join(tmpdir(), "attest-replay-aba-"));
  const fileA = join(dir, "a.jsonl");
  const fileB = join(dir, "b.jsonl");
  const line = (seq: number, id: string): string =>
    JSON.stringify({ seq, model: "muse-spark-1.3", ms: 1, response: { id, output_text: "hi" } });
  writeFileSync(fileA, `${line(1, "A1")}\n${line(2, "A2")}\n`);
  writeFileSync(fileB, `${line(1, "B1")}\n${line(2, "B2")}\n`);
  try {
    delete process.env.ATTEST_RECORD;
    process.env.ATTEST_REPLAY = fileA;
    assert.equal((await postResponses("https://x/v1", "k", { model: "muse-spark-1.3" })).id, "A1");
    process.env.ATTEST_REPLAY = fileB;
    assert.equal((await postResponses("https://x/v1", "k", { model: "muse-spark-1.3" })).id, "A2");
    process.env.ATTEST_REPLAY = fileA;
    await assert.rejects(postResponses("https://x/v1", "k", { model: "muse-spark-1.3" }), (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.status, 499);
      return true;
    });
  } finally {
    globalThis.fetch = realFetch;
    if (savedRecord === undefined) delete process.env.ATTEST_RECORD;
    else process.env.ATTEST_RECORD = savedRecord;
    if (savedReplay === undefined) delete process.env.ATTEST_REPLAY;
    else process.env.ATTEST_REPLAY = savedReplay;
  }
});
