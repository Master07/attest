import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ApiError, postResponses } from "../src/api.js";
import { resolveProvider } from "../src/models.js";

test("replay answers per model, in recorded order, needs no key, and fails clearly when exhausted", async () => {
  const cassette = join(tmpdir(), `attest-cassette-${process.pid}.jsonl`);
  const line = (seq: number, model: string, id: string): string =>
    JSON.stringify({ seq, model, ms: 0, response: { id, output: [] } });
  writeFileSync(cassette, [line(1, "muse-spark-1.3", "s1"), line(2, "sam-3.1", "m1"), line(3, "muse-spark-1.3", "s2")].join("\n"));

  process.env.ATTEST_REPLAY = cassette;
  try {
    const endpoint = resolveProvider("meta", { ATTEST_REPLAY: cassette });   // no MODEL_API_KEY at all
    assert.equal(endpoint.baseUrl, "replay://");

    // Interleaving differs from the recording, but each model gets its own responses in order.
    assert.equal((await postResponses("x", "y", { model: "sam-3.1" })).id, "m1");
    assert.equal((await postResponses("x", "y", { model: "muse-spark-1.3" })).id, "s1");
    assert.equal((await postResponses("x", "y", { model: "muse-spark-1.3" })).id, "s2");

    await assert.rejects(postResponses("x", "y", { model: "muse-spark-1.3" }), (err: unknown) =>
      err instanceof ApiError && err.status === 499 && /no more responses/.test(err.message));
  } finally {
    delete process.env.ATTEST_REPLAY;
  }
});
