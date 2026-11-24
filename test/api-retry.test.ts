import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError, postResponses, setRetrySleep } from "../src/api.js";

// Pins Attest's production retry policy (src/api.ts, matching main's postLive):
// network errors and 5xx are retried with delays [1000, 3000, 8000]; 4xx —
// including 429 — is never retried; the last error is rethrown when the schedule
// runs out. fetch is stubbed and the retry sleep faked; the delays, predicate
// and attempt counts below go through the real postResponses.

const okBody = (id: string): unknown => ({ id, output_text: "hi" });

function stubFetch(handler: () => Response | Promise<Response>): () => number {
  const realFetch = globalThis.fetch;
  let calls = 0;
  (globalThis as Record<string, unknown>).fetch = async (): Promise<Response> => {
    calls += 1;
    return handler();
  };
  return () => calls;
}

function restoreFetch(realFetch: typeof fetch): void {
  globalThis.fetch = realFetch;
}

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

async function withHarness(
  run: (waits: number[]) => Promise<void>,
): Promise<void> {
  const realFetch = globalThis.fetch;
  const savedRecord = process.env.ATTEST_RECORD;
  const savedReplay = process.env.ATTEST_REPLAY;
  const waits: number[] = [];
  delete process.env.ATTEST_RECORD;
  delete process.env.ATTEST_REPLAY;
  setRetrySleep(async (ms) => {
    waits.push(ms);
  });
  try {
    await run(waits);
  } finally {
    restoreFetch(realFetch);
    setRetrySleep(undefined);
    if (savedRecord === undefined) delete process.env.ATTEST_RECORD;
    else process.env.ATTEST_RECORD = savedRecord;
    if (savedReplay === undefined) delete process.env.ATTEST_REPLAY;
    else process.env.ATTEST_REPLAY = savedReplay;
  }
}

test("5xx is retried with the exact production delays, then the final error is thrown", async () => {
  await withHarness(async (waits) => {
    const calls = stubFetch(() => json(503, { error: "persistence service error" }));
    await assert.rejects(postResponses("https://x/v1", "k", { model: "muse-spark-1.3" }), (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.status, 503);
      return true;
    });
    assert.equal(calls(), 4); // 1 initial attempt + 3 retries
    assert.deepEqual(waits, [1000, 3000, 8000]);
  });
});

test("network errors are retried like 5xx", async () => {
  await withHarness(async (waits) => {
    const calls = stubFetch(() => {
      throw new Error("connection reset");
    });
    await assert.rejects(postResponses("https://x/v1", "k", { model: "muse-spark-1.3" }), (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.status, null);
      return true;
    });
    assert.equal(calls(), 4);
    assert.deepEqual(waits, [1000, 3000, 8000]);
  });
});

test("a transient failure followed by success returns the response", async () => {
  await withHarness(async (waits) => {
    let n = 0;
    const calls = stubFetch(() => {
      n += 1;
      return n < 3 ? json(500, { error: "boom" }) : json(200, okBody("r1"));
    });
    const response = await postResponses("https://x/v1", "k", { model: "muse-spark-1.3" });
    assert.equal(response.id, "r1");
    assert.equal(calls(), 3);
    assert.deepEqual(waits, [1000, 3000]);
  });
});

for (const status of [400, 429]) {
  test(`HTTP ${status} is never retried`, async () => {
    await withHarness(async (waits) => {
      const calls = stubFetch(() => json(status, { error: "bad request" }));
      await assert.rejects(postResponses("https://x/v1", "k", { model: "muse-spark-1.3" }), (err: unknown) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.status, status);
        return true;
      });
      assert.equal(calls(), 1);
      assert.deepEqual(waits, []);
    });
  });
}
