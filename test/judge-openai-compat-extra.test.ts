/*
 * T-004 fix round 2: the base URL is validated at route-resolve time, and the
 * judge identity is always the slash form (host form with a valid URL, hostless
 * without one; never the colon form).
 *
 * Same harness style as judge-openai-compat.test.ts: stub `fetch`, fail closed,
 * fake timers, and restore `process.env`. This file must not edit the golden file.
 */

import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { credentialChecks } from "../src/doctor.js";
import { MODEL_IDS } from "../src/models.js";

const KEY = "[REDACTED]";
const BASE_URL = "https://openrouter.ai/api/v1";
const MODEL = "non-meta/vision-model";
const ROUTE = `openai-compat:${MODEL}`;
const DISPLAY_MODEL = `openai-compat/${MODEL} @ openrouter.ai`;
const HOSTLESS_MODEL = `openai-compat/${MODEL}`;

const CRITERIA = {
  id: "openai-compat-extra-test",
  sha256: "unused-by-run-judge",
  path: "unused-by-run-judge.yml",
  criteria: [{
    id: "c-1",
    given: "a saved item",
    when: "the page reloads",
    then: "the saved item is visible",
  }],
};

type Vote = { id: string; result: "pass" | "fail"; reason: string };
type JudgeResult = {
  model: string;
  provider: string;
  votes: Vote[];
  promptSha256: string;
  error: string | null;
};
type RunJudge = (criteria: typeof CRITERIA, screenshots: Buffer[], env?: NodeJS.ProcessEnv) => Promise<JudgeResult>;
type ModelsModule = {
  pickRoute(role: "judge", contributor?: boolean, env?: NodeJS.ProcessEnv): { provider: string; model: string };
};

interface RecordedRequest {
  url: string;
  init: RequestInit;
  headers: Headers;
}

type ConsoleName = "debug" | "info" | "log" | "warn" | "error";

function stubFetch(): RecordedRequest[] {
  const calls: RecordedRequest[] = [];
  (globalThis as Record<string, unknown>).fetch = async (input: string | URL | Request, init: RequestInit = {}): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    calls.push({ url, init, headers: new Headers(init.headers) });
    throw new Error("unexpected fetch without an explicit test stub");
  };
  return calls;
}

async function loadRunJudge(): Promise<RunJudge> {
  const mod = await import("../src/judge.js") as Record<string, unknown>;
  assert.equal(typeof mod["runJudge"], "function", "not implemented: ../src/judge.js runJudge");
  return mod["runJudge"] as RunJudge;
}

async function loadModels(): Promise<ModelsModule> {
  const mod = await import("../src/models.js") as Record<string, unknown>;
  assert.equal(typeof mod["pickRoute"], "function", "not implemented: ../src/models.js pickRoute");
  return mod as unknown as ModelsModule;
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
  stubFetch();
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

test("pickRoute validates the base URL at route time with the exact resolveProvider messages", async (t) => {
  await withHarness(t, async () => {
    const models = await loadModels();
    assert.throws(() => models.pickRoute("judge", false, { ATTEST_ROUTE_JUDGE: ROUTE }), {
      message: "openai-compat: set ATTEST_OPENAI_COMPAT_BASE_URL",
    });
    assert.throws(() => models.pickRoute("judge", false, {
      ATTEST_ROUTE_JUDGE: ROUTE,
      ATTEST_OPENAI_COMPAT_BASE_URL: "not a URL",
    }), { message: "openai-compat: invalid base URL" });
    for (const baseUrl of ["http://example.com/v1", "http://localhost:8080/v1"]) {
      assert.throws(() => models.pickRoute("judge", false, {
        ATTEST_ROUTE_JUDGE: ROUTE,
        ATTEST_OPENAI_COMPAT_BASE_URL: baseUrl,
      }), { message: "openai-compat: base URL must use https: (http: is allowed only for 127.0.0.1)" });
    }
    for (const baseUrl of [
      `https://user:${KEY}@openrouter.ai/api/v1`,
      `${BASE_URL}?access_token=${KEY}`,
      `${BASE_URL}#${KEY}`,
    ]) {
      const error = (() => {
        try {
          models.pickRoute("judge", false, { ATTEST_ROUTE_JUDGE: ROUTE, ATTEST_OPENAI_COMPAT_BASE_URL: baseUrl });
        } catch (err) {
          return err;
        }
        return assert.fail(`accepted unsafe base URL ${baseUrl}`);
      })();
      assert.ok(error instanceof Error);
      assert.equal(error.message, "openai-compat: base URL must not contain credentials, a query or a fragment");
      assert.equal(leakedText(error).includes(KEY), false, "route error echoed the URL secret");
    }
  });
});

test("pickRoute returns the openai-compat route with a valid base URL and leaves other routes alone", async (t) => {
  await withHarness(t, async () => {
    const models = await loadModels();
    assert.deepEqual(models.pickRoute("judge", false, {
      ATTEST_ROUTE_JUDGE: ROUTE,
      ATTEST_OPENAI_COMPAT_BASE_URL: BASE_URL,
    }), { provider: "openai-compat", model: MODEL });
    assert.deepEqual(models.pickRoute("judge", false, {}), { provider: "meta", model: MODEL_IDS.wonder });
    assert.deepEqual(models.pickRoute("judge", false, { BASETEN_API_KEY: "k" }), {
      provider: "baseten",
      model: MODEL_IDS.sparkOpen,
    });
  });
});

test("a valid base URL with a missing key reports the host-form identity, never the colon form", async (t) => {
  await withHarness(t, async (logs) => {
    const runJudge = await loadRunJudge();
    const judge = await runJudge(CRITERIA, [Buffer.from("frame-1")], {
      ATTEST_ROUTE_JUDGE: ROUTE,
      ATTEST_OPENAI_COMPAT_BASE_URL: BASE_URL,
    });
    assert.equal(judge.provider, "openai-compat");
    assert.equal(judge.model, DISPLAY_MODEL);
    assert.deepEqual(judge.votes, []);
    assert.equal(judge.error, "openai-compat: set OPENAI_COMPAT_API_KEY");
    assert.equal(judge.model.includes(":"), false, "colon identity form is never used");
    assertSecretFree(logs, judge);
  });
});

test("a missing or invalid base URL reports the hostless slash identity, never the colon form", async (t) => {
  await withHarness(t, async (logs) => {
    const runJudge = await loadRunJudge();
    for (const env of [
      { ATTEST_ROUTE_JUDGE: ROUTE },
      { ATTEST_ROUTE_JUDGE: ROUTE, ATTEST_OPENAI_COMPAT_BASE_URL: "not a URL" },
    ]) {
      const judge = await runJudge(CRITERIA, [Buffer.from("frame-1")], env);
      assert.equal(judge.provider, "openai-compat");
      assert.equal(judge.model, HOSTLESS_MODEL);
      assert.deepEqual(judge.votes, []);
      assert.ok(typeof judge.error === "string" && judge.error.length > 0);
      assert.equal(judge.model.includes(":"), false, "colon identity form is never used");
      assertSecretFree(logs, judge);
    }
    const missing = await runJudge(CRITERIA, [Buffer.from("frame-1")], { ATTEST_ROUTE_JUDGE: ROUTE });
    assert.equal(missing.error, "openai-compat: set ATTEST_OPENAI_COMPAT_BASE_URL");
    const invalid = await runJudge(CRITERIA, [Buffer.from("frame-1")], {
      ATTEST_ROUTE_JUDGE: ROUTE,
      ATTEST_OPENAI_COMPAT_BASE_URL: "not a URL",
    });
    assert.equal(invalid.error, "openai-compat: invalid base URL");
  });
});

test("doctor reports an openai-compat route without a base URL as a failure without echoing it", async (t) => {
  await withHarness(t, async () => {
    for (const env of [
      { MODEL_API_KEY: KEY, ATTEST_ROUTE_JUDGE: ROUTE },
      { MODEL_API_KEY: KEY, ATTEST_ROUTE_JUDGE: ROUTE, ATTEST_OPENAI_COMPAT_BASE_URL: "http://example.com/v1" },
    ]) {
      const checks = credentialChecks(env);
      const text = JSON.stringify(checks);
      assert.equal(checks.some((check) => !check.ok && check.detail === "judge route override is invalid"), true);
      assert.equal(text.includes(ROUTE), false, "doctor echoed the route override");
      assert.equal(text.includes(KEY), false, "doctor echoed the credential");
      assert.equal(text.includes("http://example.com/v1"), false, "doctor echoed the base URL");
    }
    const ok = credentialChecks({
      MODEL_API_KEY: KEY,
      ATTEST_ROUTE_JUDGE: ROUTE,
      ATTEST_OPENAI_COMPAT_BASE_URL: BASE_URL,
    });
    assert.equal(ok.some((check) => !check.ok && check.detail === "judge route override is invalid"), false);
    assert.equal(ok.some((check) => check.ok && check.detail.includes(`judge route openai-compat/${MODEL}`)), true);
  });
});
