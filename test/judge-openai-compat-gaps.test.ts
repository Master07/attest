// G3: the late-abort gap through Attest's runJudge wiring, plus a node:test timeout so a
// forgotten tick fails fast. After a completed 4xx, a no-vote reply, a malformed reply and a
// plain fetch rejection, runJudge returns a JudgeResult (votes: [], error: <message>) and
// advancing the timers past timeoutMs fires no abort and schedules no new request.

import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import type { CriteriaFile } from "../src/criteria.js";

const KEY = "sk-test-NOT-REAL-attest-gaps-b52c81";
const BASE_URL = "https://openrouter.ai:8443/api/v1";
const MODEL = "non-meta/vision-model";
const ROUTE = `openai-compat:${MODEL}`;

const CRITERIA: CriteriaFile = {
  id: "openai-compat-gaps",
  sha256: "unused",
  path: "unused.yml",
  criteria: [{ id: "c-1", given: "a saved item", when: "the page reloads", then: "the saved item is visible" }],
};

type Vote = { id: string; result: "pass" | "fail"; reason: string };
type JudgeResult = {
  model: string;
  provider: string;
  votes: Vote[];
  promptSha256: string;
  error: string | null;
};
type RunJudge = (criteria: CriteriaFile, screenshots: Buffer[], env?: NodeJS.ProcessEnv) => Promise<JudgeResult>;

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

function attestationEnv(): NodeJS.ProcessEnv {
  return {
    ATTEST_ROUTE_JUDGE: ROUTE,
    ATTEST_OPENAI_COMPAT_BASE_URL: BASE_URL,
    OPENAI_COMPAT_API_KEY: KEY,
  };
}

async function loadRunJudge(): Promise<RunJudge> {
  const mod = await import("../src/judge.js") as Record<string, unknown>;
  assert.equal(typeof mod["runJudge"], "function", "not implemented: ../src/judge.js runJudge");
  return mod["runJudge"] as RunJudge;
}

type ConsoleName = "debug" | "info" | "log" | "warn" | "error";

async function withHarness(t: TestContext, run: () => Promise<void>): Promise<void> {
  const realFetch = globalThis.fetch;
  (globalThis as Record<string, unknown>).fetch = async (): Promise<Response> => {
    throw new Error("unexpected fetch without an explicit test stub");
  };
  const savedEnv = { ...process.env };
  // Clear ambient replay/record flags so a developer shell cannot change routing during a test.
  delete process.env.ATTEST_REPLAY;
  delete process.env.ATTEST_RECORD;
  const savedConsole = new Map<ConsoleName, unknown>();
  for (const name of ["debug", "info", "log", "warn", "error"] as const) {
    savedConsole.set(name, console[name]);
    console[name] = (...args: unknown[]): void => { void args; };
  }
  t.mock.timers.enable({ apis: ["setTimeout"] });
  try {
    await run();
  } finally {
    t.mock.timers.reset();
    globalThis.fetch = realFetch;
    for (const [name, method] of savedConsole) Object.assign(console, { [name]: method });
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env, savedEnv);
  }
}

async function flush(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
  await new Promise<void>((resolve) => setImmediate(resolve));
}

async function tickFlush(t: TestContext, ms: number): Promise<void> {
  t.mock.timers.tick(ms);
  await flush();
}

async function assertNoLateAbort(t: TestContext, calls: RecordedRequest[]): Promise<void> {
  const count = calls.length;
  await tickFlush(t, 60_001);
  assert.equal(calls.length, count, "a completed judge attempt scheduled another request");
  for (const call of calls) assert.equal(call.init.signal?.aborted, false, "a completed judge attempt aborted late");
}

test("runJudge: after a completed 4xx, advancing past timeoutMs fires no abort", { timeout: 10_000 }, async (t) => {
  await withHarness(t, async () => {
    const calls = stubFetch(() => new Response(JSON.stringify({ error: KEY }), { status: 400 }));
    const runJudge = await loadRunJudge();
    const judge = await runJudge(CRITERIA, [Buffer.from("frame-1")], attestationEnv());
    assert.equal(calls.length, 1);
    assert.equal(judge.provider, "openai-compat");
    assert.deepEqual(judge.votes, []);
    assert.equal(judge.error, "openai-compat HTTP 400");
    assert.equal((judge.error ?? "").includes(KEY), false);
    await assertNoLateAbort(t, calls);
  });
});

test("runJudge: after a no-vote reply, advancing past timeoutMs fires no abort", { timeout: 10_000 }, async (t) => {
  await withHarness(t, async () => {
    const calls = stubFetch(() => jsonResponse({ choices: [{ message: {} }] }));
    const runJudge = await loadRunJudge();
    const judge = await runJudge(CRITERIA, [Buffer.from("frame-1")], attestationEnv());
    assert.equal(calls.length, 1);
    assert.deepEqual(judge.votes, []);
    assert.equal(judge.error, "openai-compat judge returned no choice text");
    await assertNoLateAbort(t, calls);
  });
});

test("runJudge: after a malformed reply, advancing past timeoutMs fires no abort", { timeout: 10_000 }, async (t) => {
  await withHarness(t, async () => {
    const calls = stubFetch(() => replyResponse(`not JSON ${KEY}`));
    const runJudge = await loadRunJudge();
    const judge = await runJudge(CRITERIA, [Buffer.from("frame-1")], attestationEnv());
    assert.equal(calls.length, 1);
    assert.deepEqual(judge.votes, []);
    assert.equal(judge.error, "openai-compat judge reply contained no JSON");
    assert.equal((judge.error ?? "").includes(KEY), false);
    await assertNoLateAbort(t, calls);
  });
});

test("runJudge: after a plain fetch rejection, advancing past timeoutMs fires no abort", { timeout: 10_000 }, async (t) => {
  await withHarness(t, async () => {
    const calls = stubFetch(() => {
      const error = new Error(`socket failed with ${KEY}`, { cause: new Error(`nested ${KEY}`) });
      Object.assign(error, { details: { responseBody: KEY } });
      return Promise.reject(error);
    });
    const runJudge = await loadRunJudge();
    const judge = await runJudge(CRITERIA, [Buffer.from("frame-1")], attestationEnv());
    assert.equal(calls.length, 1);
    assert.deepEqual(judge.votes, []);
    assert.equal(judge.error, "openai-compat request failed");
    assert.equal((judge.error ?? "").includes(KEY), false);
    await assertNoLateAbort(t, calls);
  });
});
