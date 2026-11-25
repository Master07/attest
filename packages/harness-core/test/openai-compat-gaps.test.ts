// G3: the four minor T-004a gaps for the core openai-compat provider.
//
// 1. Late abort on every path: after a completed 4xx, a no-vote reply, a malformed reply and a
//    plain fetch rejection, advancing the timers past timeoutMs fires no abort and schedules no
//    new request.
// 2. timeoutMs must be a positive integer: 0, -1, 1.5 and NaN throw a clear error at construction.
// 3. A slow backoff fails instead of hanging: the timer-driven tests carry a node:test timeout,
//    so a forgotten tick (a hang) fails fast with a message rather than stalling the suite.

import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";

const CORE_MODULE = "@corbet/harness-core";
const KEY = "sk-test-NOT-REAL-core-gaps-3c1a";
const MODEL = "non-meta/vision-model";
const INSTRUCTIONS = "Return judge votes as JSON.";
const TASK = "Acceptance criteria:\n- id: c-1\n  then: the saved state is visible";
const PNG_1 = "data:image/png;base64,ZnJhbWUtMQ==";
const PASS_VOTE = { id: "c-1", result: "pass", reason: "The saved state is visible." } as const;

type JudgeVote = { id: string; result: "pass" | "fail"; reason: string };
type JudgeOutcome = { votes: JudgeVote[] } | { vote: null; error: string };
type JudgeRequest = {
  model: string;
  instructions: string;
  task: string;
  criteriaIds: string[];
  images: { label: string; dataUrl: string }[];
};
type Provider = { judge(request: JudgeRequest): Promise<JudgeOutcome> };
type Factory = (options: {
  baseUrl: string;
  apiKey: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
}) => Provider;

const REQUEST: JudgeRequest = {
  model: MODEL,
  instructions: INSTRUCTIONS,
  task: TASK,
  criteriaIds: ["c-1"],
  images: [{ label: "FRAME 1 of 1:", dataUrl: PNG_1 }],
};

interface RecordedRequest {
  url: string;
  init: RequestInit;
  headers: Headers;
}

function stubFetch(handler: (call: RecordedRequest, count: number) => Response | Promise<Response>): RecordedRequest[] {
  const calls: RecordedRequest[] = [];
  (globalThis as Record<string, unknown>).fetch = async (input: string | URL | Request, init: RequestInit = {}): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const call = { url, init, headers: new Headers(init.headers) };
    calls.push(call);
    return handler(call, calls.length);
  };
  return calls;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function replyResponse(text: string, status = 200): Response {
  return jsonResponse({ choices: [{ message: { content: text } }] }, status);
}

function validReply(): string {
  return JSON.stringify({ criteria: [PASS_VOTE] });
}

async function makeProvider(options: Parameters<Factory>[0]): Promise<Provider> {
  const mod = await import(CORE_MODULE) as Record<string, unknown>;
  assert.equal(
    typeof mod["createOpenAICompatProvider"],
    "function",
    "not implemented: @corbet/harness-core createOpenAICompatProvider",
  );
  return (mod["createOpenAICompatProvider"] as Factory)(options);
}

type ConsoleName = "debug" | "info" | "log" | "warn" | "error";

function collectLeakedText(value: unknown, parts: string[], seen: Set<object>): void {
  if (typeof value === "string") {
    parts.push(value);
    return;
  }
  if (value === null || (typeof value !== "object" && typeof value !== "function")) {
    parts.push(String(value));
    return;
  }
  if (seen.has(value)) return;
  seen.add(value);
  if (value instanceof Error) {
    parts.push(value.name, value.message, value.stack ?? "");
    if ("cause" in value) collectLeakedText(value.cause, parts, seen);
  }
  for (const key of Object.keys(value)) {
    parts.push(key);
    if (value instanceof Error && (key === "name" || key === "message" || key === "stack")) continue;
    collectLeakedText((value as Record<string, unknown>)[key], parts, seen);
  }
}

function leakedText(value: unknown): string {
  const parts: string[] = [];
  collectLeakedText(value, parts, new Set());
  return parts.join(" ");
}

async function withHarness(t: TestContext, run: (logs: string[]) => Promise<void>): Promise<void> {
  const realFetch = globalThis.fetch;
  (globalThis as Record<string, unknown>).fetch = async (): Promise<Response> => {
    throw new Error("unexpected fetch without an explicit test stub");
  };
  const savedEnv = { ...process.env };
  const logs: string[] = [];
  const savedConsole = new Map<ConsoleName, unknown>();
  for (const name of ["debug", "info", "log", "warn", "error"] as const) {
    savedConsole.set(name, console[name]);
    console[name] = (...args: unknown[]): void => {
      logs.push(args.map(leakedText).join(" "));
    };
  }
  t.mock.timers.enable({ apis: ["setTimeout"] });
  try {
    await run(logs);
  } finally {
    t.mock.timers.reset();
    globalThis.fetch = realFetch;
    for (const [name, method] of savedConsole) Object.assign(console, { [name]: method });
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env, savedEnv);
  }
}

function assertSecretFree(logs: string[], ...values: unknown[]): void {
  const captured = [...logs, ...values.map(leakedText)].join("\n");
  assert.equal(captured.includes(KEY), false, "API key or nested API-key-bearing error data leaked");
}

type Settled = { ok: true; value: JudgeOutcome } | { ok: false; error: unknown };

function capture(promise: Promise<JudgeOutcome>): Promise<Settled> {
  return promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
}

async function flush(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
  await new Promise<void>((resolve) => setImmediate(resolve));
}

async function tickFlush(t: TestContext, ms: number): Promise<void> {
  t.mock.timers.tick(ms);
  await flush();
}

// Advance past the default 60_000 ms timeout: a completed attempt must have cleared its timer,
// so this fires no abort and schedules no new request.
async function assertNoLateAbort(t: TestContext, calls: RecordedRequest[]): Promise<void> {
  const count = calls.length;
  await tickFlush(t, 60_001);
  assert.equal(calls.length, count, "a completed judge attempt scheduled another request");
  for (const call of calls) assert.equal(call.init.signal?.aborted, false, "a completed judge attempt aborted late");
}

test("after a completed 4xx, advancing past timeoutMs fires no abort", { timeout: 10_000 }, async (t) => {
  await withHarness(t, async (logs) => {
    const calls = stubFetch(() => new Response(JSON.stringify({ error: KEY }), { status: 400 }));
    const provider = await makeProvider({ baseUrl: "https://openrouter.ai/api/v1", apiKey: KEY });
    const settled = capture(provider.judge(REQUEST));
    await flush();
    const result = await settled;
    assert.equal(calls.length, 1);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal((result.error as Error).message, "openai-compat HTTP 400");
      assertSecretFree(logs, result.error);
    }
    await assertNoLateAbort(t, calls);
  });
});

test("after a no-vote reply, advancing past timeoutMs fires no abort", { timeout: 10_000 }, async (t) => {
  await withHarness(t, async (logs) => {
    const calls = stubFetch(() => jsonResponse({ choices: [{ message: {} }] }));
    const provider = await makeProvider({ baseUrl: "https://openrouter.ai/api/v1", apiKey: KEY });
    const result = await provider.judge(REQUEST);
    assert.equal(calls.length, 1);
    assert.deepEqual(result, { vote: null, error: "openai-compat judge returned no choice text" });
    assertSecretFree(logs, result);
    await assertNoLateAbort(t, calls);
  });
});

test("after a malformed reply, advancing past timeoutMs fires no abort", { timeout: 10_000 }, async (t) => {
  await withHarness(t, async (logs) => {
    const calls = stubFetch(() => replyResponse(`not JSON ${KEY}`));
    const provider = await makeProvider({ baseUrl: "https://openrouter.ai/api/v1", apiKey: KEY });
    const result = await provider.judge(REQUEST);
    assert.equal(calls.length, 1);
    assert.deepEqual(result, { vote: null, error: "openai-compat judge reply contained no JSON" });
    assertSecretFree(logs, result);
    await assertNoLateAbort(t, calls);
  });
});

test("after a plain fetch rejection, advancing past timeoutMs fires no abort", { timeout: 10_000 }, async (t) => {
  await withHarness(t, async (logs) => {
    const calls = stubFetch(() => {
      const error = new Error(`socket failed with ${KEY}`, { cause: new Error(`nested ${KEY}`) });
      Object.assign(error, { details: { responseBody: KEY } });
      return Promise.reject(error);
    });
    const provider = await makeProvider({ baseUrl: "https://openrouter.ai/api/v1", apiKey: KEY });
    const settled = capture(provider.judge(REQUEST));
    await flush();
    const result = await settled;
    assert.equal(calls.length, 1);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal((result.error as Error).message, "openai-compat request failed");
      assertSecretFree(logs, result.error);
    }
    await assertNoLateAbort(t, calls);
  });
});

test("timeoutMs must be a positive integer: 0, -1, 1.5 and NaN throw at construction", async () => {
  for (const bad of [0, -1, 1.5, Number.NaN]) {
    await assert.rejects(
      makeProvider({ baseUrl: "https://openrouter.ai/api/v1", apiKey: KEY, timeoutMs: bad }),
      { message: "openai-compat: timeoutMs must be a positive integer" },
    );
  }
});

test("a 5xx retry resolves without an unbounded backoff, bounded by the test timeout", { timeout: 5_000 }, async (t) => {
  await withHarness(t, async (logs) => {
    const calls = stubFetch((_call, count) =>
      count === 1 ? jsonResponse({ error: "temporary" }, 503) : replyResponse(validReply()));
    const provider = await makeProvider({ baseUrl: "https://openrouter.ai/api/v1", apiKey: KEY });
    const outcome = capture(provider.judge(REQUEST));
    await flush();
    const settled = await outcome;
    assert.equal(calls.length, 2);
    assert.deepEqual(settled, { ok: true, value: { votes: [PASS_VOTE] } });
    assertSecretFree(logs, settled);
    await assertNoLateAbort(t, calls);
  });
});
