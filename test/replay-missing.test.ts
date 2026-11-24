import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ApiError, postResponses } from "../src/api.js";

// Matches main (measured on main's code: ENOENT, 499, 499): the process-wide
// replay state is initialised BEFORE the file is read, so a failed load still
// counts as "loaded once" — the second call reports an empty queue and a later
// path switch never loads the new file.
//
// This test needs a fresh process (the replay state is process-wide and sticky),
// so it lives in its own file.
test("missing cassette twice, then switching to B, keeps failing with 499", async () => {
  const realFetch = globalThis.fetch;
  const savedReplay = process.env.ATTEST_REPLAY;
  (globalThis as Record<string, unknown>).fetch = async (): Promise<Response> => {
    throw new Error("replay must not touch the network");
  };
  const dir = mkdtempSync(join(tmpdir(), "attest-replay-missing-"));
  const missing = join(dir, "missing.jsonl");
  const fileB = join(dir, "b.jsonl");
  writeFileSync(
    fileB,
    `${JSON.stringify({ seq: 1, model: "muse-spark-1.3", ms: 1, response: { id: "B1", output_text: "hi" } })}\n`,
  );
  try {
    process.env.ATTEST_REPLAY = missing;
    // First call surfaces the missing file itself, as main does.
    await assert.rejects(postResponses("https://x/v1", "k", { model: "muse-spark-1.3" }), (err: unknown) => {
      assert.ok(!(err instanceof ApiError), `expected the raw read error, got ${String(err)}`);
      assert.equal((err as NodeJS.ErrnoException).code, "ENOENT");
      return true;
    });
    // The queue is now initialised (empty), so the retry reports exhaustion.
    await assert.rejects(postResponses("https://x/v1", "k", { model: "muse-spark-1.3" }), (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.status, 499);
      assert.match(err.message, /no more responses/);
      return true;
    });
    // Switching paths never loads B: the first path won, as main does.
    process.env.ATTEST_REPLAY = fileB;
    await assert.rejects(postResponses("https://x/v1", "k", { model: "muse-spark-1.3" }), (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.status, 499);
      assert.match(err.message, /no more responses/);
      return true;
    });
  } finally {
    globalThis.fetch = realFetch;
    if (savedReplay === undefined) delete process.env.ATTEST_REPLAY;
    else process.env.ATTEST_REPLAY = savedReplay;
  }
});
