import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { postResponses } from "../src/api.js";

// Matches main (measured on main's code: SyntaxError, then P1): entries parsed
// before the bad line stay queued, so the next call serves them.
//
// This test needs a fresh process (the replay state is process-wide and sticky),
// so it lives in its own file.
test("one valid entry then invalid JSON throws SyntaxError, then serves the partial queue", async () => {
  const realFetch = globalThis.fetch;
  const savedReplay = process.env.ATTEST_REPLAY;
  (globalThis as Record<string, unknown>).fetch = async (): Promise<Response> => {
    throw new Error("replay must not touch the network");
  };
  const dir = mkdtempSync(join(tmpdir(), "attest-replay-partial-"));
  const fileP = join(dir, "p.jsonl");
  writeFileSync(
    fileP,
    `${JSON.stringify({ seq: 1, model: "muse-spark-1.3", ms: 1, response: { id: "P1", output_text: "hi" } })}\n{not valid json\n`,
  );
  try {
    process.env.ATTEST_REPLAY = fileP;
    // The bad line surfaces as a SyntaxError on the first call, as main does.
    await assert.rejects(postResponses("https://x/v1", "k", { model: "muse-spark-1.3" }), (err: unknown) => {
      assert.ok(err instanceof SyntaxError, `expected SyntaxError, got ${String(err)}`);
      return true;
    });
    // The entry parsed before the failure is still queued.
    assert.equal((await postResponses("https://x/v1", "k", { model: "muse-spark-1.3" })).id, "P1");
  } finally {
    globalThis.fetch = realFetch;
    if (savedReplay === undefined) delete process.env.ATTEST_REPLAY;
    else process.env.ATTEST_REPLAY = savedReplay;
  }
});
