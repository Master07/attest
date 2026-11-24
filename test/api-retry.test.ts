import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { ApiError, postResponses } from "../src/api.js";

// Pins Attest's production retry policy (src/api.ts, matching main's postLive):
// network errors and 5xx are retried with delays [1000, 3000, 8000]; 4xx —
// including 429 — is never retried; the last attempt's error is rethrown when the
// schedule runs out. fetch is stubbed and the retry sleep fast-forwarded with
// fake timers; the delays, predicate and attempt counts below go through the
// real postResponses, whose sleep uses setTimeout internally.

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

type Outcome =
  | { ok: true; value: unknown }
  | { ok: false; error: unknown };

// Attach handlers immediately so a rejection that settles while timers are
// mocked never counts as unhandled.
function capture(promise: Promise<unknown>): Promise<Outcome> {
  return promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
}

// Let stubbedfetch/Response microtasks and the retry continuations they schedule run.
async function flush(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
  await new Promise<void>((resolve) => setImmediate(resolve));
}

async function tickFlush(t: TestContext, ms: number): Promise<void> {
  t.mock.timers.tick(ms);
  await flush();
}

async function withHarness(t: TestContext, run: () => Promise<void>): Promise<void> {
  const realFetch = globalThis.fetch;
  const savedRecord = process.env.ATTEST_RECORD;
  const savedReplay = process.env.ATTEST_REPLAY;
  delete process.env.ATTEST_RECORD;
  delete process.env.ATTEST_REPLAY;
  t.mock.timers.enable({ apis: ["setTimeout"] });
  try {
    await run();
  } finally {
    t.mock.timers.reset();
    restoreFetch(realFetch);
    if (savedRecord === undefined) delete process.env.ATTEST_RECORD;
    else process.env.ATTEST_RECORD = savedRecord;
    if (savedReplay === undefined) delete process.env.ATTEST_REPLAY;
    else process.env.ATTEST_REPLAY = savedReplay;
  }
}

test("5xx is retried with the exact production delays, then the final error is thrown", async (t) => {
  await withHarness(t, async () => {
    // Every attempt fails differently, so the rethrown error proves the LAST
    // attempt lost — not the first — after 1 initial attempt + 3 retries.
    const failures = [
      { status: 500, tag: "boom-1" },
      { status: 502, tag: "boom-2" },
      { status: 503, tag: "boom-3" },
      { status: 504, tag: "boom-4" },
    ];
    let n = 0;
    const calls = stubFetch(() => {
      const failure = failures[n++] ?? { status: 500, tag: "boom-extra" };
      return json(failure.status, { error: failure.tag });
    });
    const outcome = capture(postResponses("https://x/v1", "k", { model: "muse-spark-1.3" }));
    await flush();
    assert.equal(calls(), 1);

    await tickFlush(t, 999);
    assert.equal(calls(), 1); // first delay is exactly 1000
    await tickFlush(t, 1);
    assert.equal(calls(), 2);

    await tickFlush(t, 2999);
    assert.equal(calls(), 2); // second delay is exactly 3000
    await tickFlush(t, 1);
    assert.equal(calls(), 3);

    await tickFlush(t, 7999);
    assert.equal(calls(), 3); // third delay is exactly 8000
    await tickFlush(t, 1);
    assert.equal(calls(), 4);
    await flush();

    const result = await outcome;
    assert.equal(result.ok, false);
    const err = (result as { ok: false; error: unknown }).error;
    assert.ok(err instanceof ApiError);
    assert.equal(err.status, 504);
    assert.match(err.body, /boom-4/);
  });
});

test("network errors are retried like 5xx, rethrowing the final failure", async (t) => {
  await withHarness(t, async () => {
    const tags = ["reset-1", "reset-2", "reset-3", "reset-4"];
    let n = 0;
    const calls = stubFetch(() => {
      throw new Error(tags[n++] ?? "reset-extra");
    });
    const outcome = capture(postResponses("https://x/v1", "k", { model: "muse-spark-1.3" }));
    await flush(); // let the first attempt fail so the first sleep is scheduled before ticking
    for (const wait of [1000, 3000, 8000]) await tickFlush(t, wait);
    await flush();
    assert.equal(calls(), 4);
    const result = await outcome;
    assert.equal(result.ok, false);
    const err = (result as { ok: false; error: unknown }).error;
    assert.ok(err instanceof ApiError);
    assert.equal(err.status, null);
    assert.match(err.message, /reset-4/);
  });
});

test("a transient failure followed by success returns the response", async (t) => {
  await withHarness(t, async () => {
    let n = 0;
    const calls = stubFetch(() => {
      n += 1;
      return n < 3 ? json(500, { error: `boom-${n}` }) : json(200, okBody("r1"));
    });
    const outcome = capture(postResponses("https://x/v1", "k", { model: "muse-spark-1.3" }));
    await flush(); // let the first attempt fail so the first sleep is scheduled before ticking
    await tickFlush(t, 1000);
    assert.equal(calls(), 2);
    await tickFlush(t, 3000);
    await flush();
    assert.equal(calls(), 3);
    const result = await outcome;
    assert.equal(result.ok, true);
    assert.equal(((result as { ok: true; value: unknown }).value as { id: string }).id, "r1");
  });
});

for (const status of [400, 429]) {
  test(`HTTP ${status} is never retried`, async (t) => {
    await withHarness(t, async () => {
      const calls = stubFetch(() => json(status, { error: "bad request" }));
      const outcome = capture(postResponses("https://x/v1", "k", { model: "muse-spark-1.3" }));
      await flush();
      assert.equal(calls(), 1);
      const result = await outcome;
      assert.equal(result.ok, false);
      const err = (result as { ok: false; error: unknown }).error;
      assert.ok(err instanceof ApiError);
      assert.equal(err.status, status);
    });
  });
}
