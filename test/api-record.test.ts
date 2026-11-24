import assert from "node:assert/strict";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { postResponses } from "../src/api.js";

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
