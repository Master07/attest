/*
 * T-004 fix round 2: the abort deadline covers the request AND the response body.
 * A 200 whose body stream never ends must still time out; a normal completion
 * must read the body under the deadline with no late abort.
 *
 * Same harness style as openai-compat.test.ts: stub `fetch`, fail closed, fake
 * timers, and restore `process.env`. This file must not edit the golden file.
 */

import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";

const CORE_MODULE = "@corbet/harness-core";
const KEY = "[REDACTED]";
const MODEL = "non-meta/vision-model";
const INSTRUCTIONS = "Return judge votes as JSON.";
const TASK = "Acceptance criteria:\n- id: c-1\n  then: the saved state is visible";
const PNG_1 = "data:image/png;base64,ZnJhbWUtMQ==";

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

const PASS_VOTE = { id: "c-1", result: "pass", reason: "The saved state is visible." } as const;

interface RecordedRequest {
  url: string;
  init: RequestInit;
  headers: Headers;
}

type FetchHandler = (call: RecordedRequest, count: number) => Response | Promise<Response>;
type ConsoleName = "debug" | "info" | "log" | "warn" | "error";

function stubFetch(handler: FetchHandler): RecordedRequest[] {
  const calls: RecordedRequest[] = [];
  (globalThis as Record<string, unknown>).fetch = async (input: string | URL | Request, init: RequestInit = {}): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const call = { url, init, headers: new Headers(init.headers) };
    calls.push(call);
    return handler(call, calls.length);
  };
  return calls;
}

function replyResponse(text: string, status = 200): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content: text } }] }), {
    status,
    headers: { "content-type": "application/json" },
  });
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

test("a response body that never ends still hits the timeout and aborts the signal", async (t) => {
  await withHarness(t, async (logs) => {
    // Headers arrive at once (fetch resolves); the body stream never produces a chunk.
    const calls = stubFetch(() => new Response(new ReadableStream({}), { status: 200 }));
    const provider = await makeProvider({ baseUrl: "https://openrouter.ai/api/v1", apiKey: KEY, timeoutMs: 10 });
    let done = false;
    const outcome = capture(provider.judge(REQUEST)).then((settled) => {
      done = true;
      return settled;
    });
    await flush();
    // Before the deadline the stalled body is still pending, not failed.
    await tickFlush(t, 9);
    assert.equal(done, false, "a stalled body must stay pending until the deadline");
    assert.equal(calls[0]?.init.signal?.aborted, false);
    // Past the deadline the attempt aborts and rejects with the contract's timeout error.
    await tickFlush(t, 1);
    const settled = await outcome;
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.init.signal?.aborted, true);
    assert.equal(settled.ok, false);
    if (!settled.ok) {
      assert.equal((settled.error as Error).message, "openai-compat request timed out after 10 ms");
      assertSecretFree(logs, settled.error);
    }
  });
});

test("a normal completion reads the body under the deadline with no late abort", async (t) => {
  await withHarness(t, async (logs) => {
    const calls = stubFetch(() => replyResponse(JSON.stringify({ criteria: [PASS_VOTE] })));
    const provider = await makeProvider({ baseUrl: "https://openrouter.ai/api/v1", apiKey: KEY, timeoutMs: 10 });
    const result = await provider.judge(REQUEST);
    assert.deepEqual(result, { votes: [PASS_VOTE] });
    assertSecretFree(logs, result);
    // Well past the deadline: no retry was scheduled and the signal never aborted late.
    const count = calls.length;
    await tickFlush(t, 60_000);
    assert.equal(calls.length, count, "a completed judge attempt scheduled another request");
    for (const call of calls) assert.equal(call.init.signal?.aborted, false, "a completed judge attempt aborted late");
  });
});
