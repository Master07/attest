/*
 * T-004a contract for the new core API (implemented later by Muse):
 *
 * @corbet/harness-core exports:
 *
 *   createOpenAICompatProvider(options: {
 *     baseUrl: string;
 *     apiKey: string;
 *     timeoutMs?: number;       // default 60_000; must be a positive integer
 *     fetch?: typeof fetch;     // default globalThis.fetch; no environment access
 *   }): {
 *     judge(request: {
 *       model: string;
 *       instructions: string;
 *       task: string;
 *       criteriaIds: string[];
 *       images: { label: string; dataUrl: string }[]; // PNG data URLs; maximum 8
 *     }): Promise<
 *       | { votes: { id: string; result: "pass" | "fail"; reason: string }[] }
 *       | { vote: null; error: string }
 *     >;
 *   }
 *
 * judge() builds the endpoint from the parsed URL's origin and pathname (trailing slashes
 * trimmed) plus /chat/completions, never by concatenating the raw input, and POSTs:
 *   { method: "POST", redirect: "error", signal: <AbortSignal>,
 *     headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
 *     body: JSON.stringify({ model, messages: [
 *       { role: "system", content: instructions },
 *       { role: "user", content: [
 *         { type: "text", text: task },
 *         ...images.flatMap(({ label, dataUrl }) => [
 *           { type: "text", text: label },
 *           { type: "image_url", image_url: { url: dataUrl } },
 *         ]),
 *       ] },
 *     ] }) }
 * More than 8 images rejects with "openai-compat: at most 8 images are allowed" before fetching.
 *
 * A base URL must parse and use https:, except that http: is allowed only for hostname
 * 127.0.0.1 (a port and path are allowed). Invalid URLs throw
 * "openai-compat: invalid base URL"; other schemes/hosts throw
 * "openai-compat: base URL must use https: (http: is allowed only for 127.0.0.1)".
 * Empty credentials throw "openai-compat: apiKey is required". At factory time, credentials,
 * a query string or a fragment in the base URL throw
 * "openai-compat: base URL must not contain credentials, a query or a fragment".
 *
 * The OpenAI Chat Completions response is { choices: [{ message: { content: string } }] }.
 * `content` uses the current judge grammar: an object with a `criteria` array, allowing the
 * same prose/code-fence wrapping as parseJudgeReply. Votes with unknown criterion IDs or
 * results other than pass/fail are discarded; a missing reason becomes "". A usable response
 * returns { votes } (possibly an empty array), including accepted fail votes. Every occurrence
 * of apiKey in a model-returned reason is replaced with [redacted] in the returned votes.
 *
 * Empty/missing choices or non-string content returns
 * { vote: null, error: "openai-compat judge returned no choice text" }.
 * Unparseable outer response JSON returns
 * { vote: null, error: "openai-compat response JSON did not parse" }.
 * Reply text with no JSON object returns
 * { vote: null, error: "openai-compat judge reply contained no JSON" };
 * invalid extracted JSON returns
 * { vote: null, error: "openai-compat judge reply JSON did not parse" };
 * a missing/non-array criteria member returns
 * { vote: null, error: "openai-compat judge reply has no \"criteria\" array" }.
 * These are no-vote results, never transports errors and never synthetic pass votes.
 *
 * HTTP >= 500 receives one retry through the core budget's transientRetry allowance. Success
 * on that retry is returned. Persistent 5xx throws "openai-compat HTTP <status>". Other
 * non-2xx statuses throw the same error immediately, without a retry. Response bodies, fetch
 * exception messages, and reply parse details are never included in thrown errors or logs.
 * Each attempt has an abort deadline that fake timers can drive; a timeout rejects with
 * "openai-compat request timed out after <ms> ms". A completed attempt has no late abort.
 * Other fetch rejections throw "openai-compat request failed" without a retry. The API key
 * must occur only in the outgoing Authorization header: never in an error, log, or result.
 */

import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";

const CORE_MODULE = "@corbet/harness-core";
const KEY = "sk-test-NOT-REAL-core-7f3a9c";
const MODEL = "non-meta/vision-model";
const INSTRUCTIONS = "Return judge votes as JSON.";
const TASK = "Acceptance criteria:\n- id: c-1\n  then: the saved state is visible";
const PNG_1 = "data:image/png;base64,ZnJhbWUtMQ==";
const PNG_2 = "data:image/png;base64,ZnJhbWUtMg==";
const PASS_VOTE = { id: "c-1", result: "pass", reason: "The saved state is visible." } as const;
const FAIL_VOTE = { id: "c-1", result: "fail", reason: "The saved state is absent." } as const;

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
  images: [
    { label: "FRAME 1 of 2:", dataUrl: PNG_1 },
    { label: "FRAME 2 of 2 (end):", dataUrl: PNG_2 },
  ],
};

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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function replyResponse(text: string, status = 200): Response {
  return jsonResponse({ choices: [{ message: { content: text } }] }, status);
}

function validReply(): string {
  return JSON.stringify({
    criteria: [
      PASS_VOTE,
      { id: "unknown", result: "fail", reason: "Must be ignored." },
      { id: "c-1", result: "maybe", reason: "Must also be ignored." },
    ],
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
  delete process.env.ATTEST_REPLAY;
  delete process.env.ATTEST_RECORD;
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

async function advanceUntilRetry(t: TestContext, calls: RecordedRequest[]): Promise<void> {
  for (let elapsed = 0; elapsed < 60_000 && calls.length < 2; elapsed += 100) {
    await tickFlush(t, Math.min(100, 60_000 - elapsed));
  }
  await flush();
}

async function assertNoLateAbort(t: TestContext, calls: RecordedRequest[]): Promise<void> {
  const count = calls.length;
  await tickFlush(t, 60_000);
  assert.equal(calls.length, count, "a completed judge attempt scheduled another request");
  for (const call of calls) assert.equal(call.init.signal?.aborted, false, "a completed judge attempt aborted late");
}

test("OpenAI request carries the model, prompt, PNG image parts, auth, redirect error, and timeout signal", async (t) => {
  await withHarness(t, async (logs) => {
    const calls = stubFetch(() => replyResponse(validReply()));
    const provider = await makeProvider({ baseUrl: "https://host:8443/api/v1/", apiKey: KEY });
    const result = await provider.judge(REQUEST);

    assert.equal(calls.length, 1);
    const call = calls[0];
    assert.ok(call);
    assert.equal(call.url, "https://host:8443/api/v1/chat/completions");
    assert.equal(call.init.method, "POST");
    assert.equal(call.init.redirect, "error");
    assert.ok(call.init.signal instanceof AbortSignal, "fetch needs an AbortSignal for the timeout");
    assert.equal(call.init.signal.aborted, false);
    assert.equal(call.headers.get("authorization"), `Bearer ${KEY}`);
    assert.equal(call.headers.get("content-type"), "application/json");
    const body = JSON.parse(String(call.init.body)) as { model?: unknown; messages?: unknown };
    assert.equal(body.model, MODEL);
    assert.deepEqual(body.messages, [
      { role: "system", content: INSTRUCTIONS },
      {
        role: "user",
        content: [
          { type: "text", text: TASK },
          { type: "text", text: "FRAME 1 of 2:" },
          { type: "image_url", image_url: { url: PNG_1 } },
          { type: "text", text: "FRAME 2 of 2 (end):" },
          { type: "image_url", image_url: { url: PNG_2 } },
        ],
      },
    ]);
    assert.deepEqual(result, { votes: [PASS_VOTE] });
    assertSecretFree(logs, result);
    await assertNoLateAbort(t, calls);
  });
});

test("the provider rejects more than eight images before any request", async (t) => {
  await withHarness(t, async () => {
    const calls = stubFetch(() => replyResponse(validReply()));
    const provider = await makeProvider({ baseUrl: "https://openrouter.ai/api/v1", apiKey: KEY });
    const images = Array.from({ length: 9 }, (_, i) => ({ label: `IMAGE ${i + 1}`, dataUrl: PNG_1 }));
    await assert.rejects(provider.judge({ ...REQUEST, images }), {
      message: "openai-compat: at most 8 images are allowed",
    });
    assert.equal(calls.length, 0);
  });
});

test("base URLs require https except for an explicitly allowed loopback test endpoint", async (t) => {
  await withHarness(t, async () => {
    for (const baseUrl of ["http://example.com/v1", "http://localhost:8080/v1", "ftp://127.0.0.1/v1"]) {
      await assert.rejects(makeProvider({ baseUrl, apiKey: KEY }), {
        message: "openai-compat: base URL must use https: (http: is allowed only for 127.0.0.1)",
      });
    }
    await assert.rejects(makeProvider({ baseUrl: "not a URL", apiKey: KEY }), {
      message: "openai-compat: invalid base URL",
    });

    const calls = stubFetch(() => replyResponse(validReply()));
    const provider = await makeProvider({ baseUrl: "http://127.0.0.1:8080/v1", apiKey: KEY });
    assert.deepEqual(await provider.judge(REQUEST), { votes: [PASS_VOTE] });
    assert.equal(calls[0]?.url, "http://127.0.0.1:8080/v1/chat/completions");
    await assertNoLateAbort(t, calls);
  });
});

test("base URLs reject credentials, queries and fragments at factory time without leaking their secrets", async (t) => {
  await withHarness(t, async (logs) => {
    const calls = stubFetch(() => replyResponse(validReply()));
    for (const baseUrl of [
      `https://user:${KEY}@host/api/v1`,
      `https://host/api/v1?access_token=${KEY}`,
      `https://host/api/v1#${KEY}`,
    ]) {
      const error = await makeProvider({ baseUrl, apiKey: KEY }).then(
        () => assert.fail(`accepted unsafe base URL ${baseUrl}`),
        (reason: unknown) => reason,
      );
      assert.ok(error instanceof Error);
      assert.equal(error.message, "openai-compat: base URL must not contain credentials, a query or a fragment");
      assertSecretFree(logs, error);
    }
    assert.equal(calls.length, 0);
  });
});

test("a 5xx response receives one budgeted transient retry and a successful retry returns exact votes", async (t) => {
  await withHarness(t, async (logs) => {
    const calls = stubFetch((_call, count) => count === 1
      ? jsonResponse({ error: "temporary" }, 503)
      : replyResponse(validReply()));
    const provider = await makeProvider({ baseUrl: "https://openrouter.ai/api/v1", apiKey: KEY });
    const outcome = capture(provider.judge(REQUEST));
    await flush();
    await advanceUntilRetry(t, calls);
    const settled = await outcome;
    assert.equal(calls.length, 2);
    assert.deepEqual(settled, { ok: true, value: { votes: [PASS_VOTE] } });
    assertSecretFree(logs, settled);
    await assertNoLateAbort(t, calls);
  });
});

test("a persistent 5xx stops after the initial request and one retry, without leaking its body", async (t) => {
  await withHarness(t, async (logs) => {
    const calls = stubFetch(() => new Response(`upstream echoed ${KEY}`, { status: 500 }));
    const provider = await makeProvider({ baseUrl: "https://openrouter.ai/api/v1", apiKey: KEY });
    const outcome = capture(provider.judge(REQUEST));
    await flush();
    await advanceUntilRetry(t, calls);
    const settled = await outcome;
    assert.equal(calls.length, 2);
    assert.equal(settled.ok, false);
    if (!settled.ok) {
      assert.equal((settled.error as Error).message, "openai-compat HTTP 500");
      assertSecretFree(logs, settled.error);
    }
    await assertNoLateAbort(t, calls);
  });
});

for (const status of [400, 401, 429]) {
  test(`HTTP ${status} is not retried and cannot disclose the key from its response body`, async (t) => {
    await withHarness(t, async (logs) => {
      const calls = stubFetch(() => new Response(JSON.stringify({ error: KEY }), { status }));
      const provider = await makeProvider({ baseUrl: "https://openrouter.ai/api/v1", apiKey: KEY });
      const outcome = capture(provider.judge(REQUEST));
      await flush();
      const settled = await outcome;
      assert.equal(calls.length, 1);
      assert.equal(settled.ok, false);
      if (!settled.ok) {
        assert.equal((settled.error as Error).message, `openai-compat HTTP ${status}`);
        assertSecretFree(logs, settled.error);
      }
    });
  });
}

test("a plain fetch rejection is sanitized without retry even when nested error data contains the key", async (t) => {
  await withHarness(t, async (logs) => {
    const calls = stubFetch(() => {
      const error = new Error(`socket failed with ${KEY}`, { cause: new Error(`nested ${KEY}`) });
      Object.assign(error, { details: { responseBody: KEY } });
      return Promise.reject(error);
    });
    const provider = await makeProvider({ baseUrl: "https://openrouter.ai/api/v1", apiKey: KEY });
    const outcome = capture(provider.judge(REQUEST));
    await flush();
    const settled = await outcome;
    assert.equal(calls.length, 1);
    assert.equal(settled.ok, false);
    if (!settled.ok) {
      assert.equal((settled.error as Error).message, "openai-compat request failed");
      assertSecretFree(logs, settled.error);
    }
  });
});

test("the default timeout aborts after exactly 60 seconds and is an error, not a vote", async (t) => {
  await withHarness(t, async (logs) => {
    const calls = stubFetch((call) => new Promise<Response>((_resolve, reject) => {
      call.init.signal?.addEventListener("abort", () => reject(new Error(KEY)), { once: true });
    }));
    const provider = await makeProvider({ baseUrl: "https://openrouter.ai/api/v1", apiKey: KEY });
    const outcome = capture(provider.judge(REQUEST));
    await flush();
    await tickFlush(t, 59_999);
    assert.equal(calls[0]?.init.signal?.aborted, false);
    await tickFlush(t, 1);
    const settled = await outcome;
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.init.signal?.aborted, true);
    assert.equal(settled.ok, false);
    if (!settled.ok) {
      assert.equal((settled.error as Error).message, "openai-compat request timed out after 60000 ms");
      assertSecretFree(logs, settled.error);
    }
  });
});

test("timeoutMs overrides the default timeout", async (t) => {
  await withHarness(t, async (logs) => {
    const calls = stubFetch((call) => new Promise<Response>((_resolve, reject) => {
      call.init.signal?.addEventListener("abort", () => reject(new Error(KEY)), { once: true });
    }));
    const provider = await makeProvider({ baseUrl: "https://openrouter.ai/api/v1", apiKey: KEY, timeoutMs: 25 });
    const outcome = capture(provider.judge(REQUEST));
    await flush();
    await tickFlush(t, 24);
    assert.equal(calls[0]?.init.signal?.aborted, false);
    await tickFlush(t, 1);
    const settled = await outcome;
    assert.equal(settled.ok, false);
    if (!settled.ok) {
      assert.equal((settled.error as Error).message, "openai-compat request timed out after 25 ms");
      assertSecretFree(logs, settled.error);
    }
  });
});

test("parser accepts pass and fail votes, wrapped JSON, empty results and a missing reason exactly", async (t) => {
  await withHarness(t, async (logs) => {
    const failReply = JSON.stringify({ criteria: [FAIL_VOTE] });
    const cases: { name: string; reply: string; votes: JudgeVote[] }[] = [
      { name: "fail vote", reply: failReply, votes: [FAIL_VOTE],
      },
      { name: "missing reason", reply: JSON.stringify({ criteria: [{ id: "c-1", result: "pass" }] }), votes: [{ id: "c-1", result: "pass", reason: "" }] },
      { name: "empty criteria", reply: JSON.stringify({ criteria: [] }), votes: [] },
      {
        name: "fully filtered criteria",
        reply: JSON.stringify({ criteria: [null, { id: "unknown", result: "fail", reason: "ignored" }, { id: "c-1", result: "maybe", reason: "ignored" }] }),
        votes: [],
      },
      { name: "prose wrapped JSON", reply: `Review follows.\n${failReply}\nEnd of review.`, votes: [FAIL_VOTE] },
      { name: "code-fenced JSON", reply: `\`\`\`json\n${failReply}\n\`\`\``, votes: [FAIL_VOTE] },
    ];
    for (const item of cases) {
      const calls = stubFetch(() => replyResponse(item.reply));
      const provider = await makeProvider({ baseUrl: "https://openrouter.ai/api/v1", apiKey: KEY });
      const result = await provider.judge(REQUEST);
      assert.deepEqual(result, { votes: item.votes }, item.name);
      assertSecretFree(logs, result);
      await assertNoLateAbort(t, calls);
    }
  });
});

test("missing choices and missing or non-string message content return no choice text", async (t) => {
  await withHarness(t, async (logs) => {
    const responses = [
      {},
      { choices: [] },
      { choices: [{}] },
      { choices: [{ message: {} }] },
      { choices: [{ message: { content: [{ type: "text", text: "not a string" }] } }] },
      { choices: [{ message: { content: null } }] },
    ];
    for (const response of responses) {
      stubFetch(() => jsonResponse(response));
      const provider = await makeProvider({ baseUrl: "https://openrouter.ai/api/v1", apiKey: KEY });
      const result = await provider.judge(REQUEST);
      assert.deepEqual(result, { vote: null, error: "openai-compat judge returned no choice text" });
      assertSecretFree(logs, result);
    }
  });
});

test("missing and non-array criteria members return the no-vote criteria error", async (t) => {
  await withHarness(t, async (logs) => {
    for (const reply of ["{}", "[]", '{"criteria":null}', '{"criteria":{}}', '{"criteria":"c-1"}']) {
      stubFetch(() => replyResponse(reply));
      const provider = await makeProvider({ baseUrl: "https://openrouter.ai/api/v1", apiKey: KEY });
      const result = await provider.judge(REQUEST);
      assert.deepEqual(result, { vote: null, error: "openai-compat judge reply has no \"criteria\" array" });
      assertSecretFree(logs, result);
    }
  });
});

test("malformed outer JSON and malformed judge-reply JSON are no-vote results without key leakage", async (t) => {
  await withHarness(t, async (logs) => {
    const cases = [
      { response: new Response(`not JSON ${KEY}`, { status: 200 }), error: "openai-compat response JSON did not parse" },
      { response: replyResponse(`not JSON ${KEY}`), error: "openai-compat judge reply contained no JSON" },
      { response: replyResponse(`{"criteria":[${KEY}}`), error: "openai-compat judge reply JSON did not parse" },
    ];
    for (const item of cases) {
      stubFetch(() => item.response);
      const provider = await makeProvider({ baseUrl: "https://openrouter.ai/api/v1", apiKey: KEY });
      const result = await provider.judge(REQUEST);
      assert.deepEqual(result, { vote: null, error: item.error });
      assertSecretFree(logs, result);
    }
  });
});

test("every API-key occurrence in a successful model reason is redacted", async (t) => {
  await withHarness(t, async (logs) => {
    stubFetch(() => replyResponse(JSON.stringify({
      criteria: [{ id: "c-1", result: "pass", reason: `Before ${KEY}; repeated ${KEY}; after.` }],
    })));
    const provider = await makeProvider({ baseUrl: "https://openrouter.ai/api/v1", apiKey: KEY });
    const result = await provider.judge(REQUEST);
    assert.deepEqual(result, {
      votes: [{ id: "c-1", result: "pass", reason: "Before [redacted]; repeated [redacted]; after." }],
    });
    assertSecretFree(logs, result);
  });
});
