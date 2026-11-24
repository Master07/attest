import assert from "node:assert/strict";
import { test } from "node:test";
import { Budget, createBudget, withRetries } from "../src/budget.js";

test("spend/exhausted counts steps against the cap", () => {
  const budget = createBudget({ maxSteps: 2, maxRetries: 3, transientRetry: 1 });
  assert.equal(budget.exhausted(), false);
  budget.spend();
  assert.equal(budget.exhausted(), false);
  budget.spend();
  assert.equal(budget.exhausted(), true);
});

test("useTransientRetry allows exactly transientRetry retries", () => {
  const budget = createBudget({ maxSteps: 25, maxRetries: 3, transientRetry: 1 });
  assert.equal(budget.useTransientRetry(), true);
  assert.equal(budget.useTransientRetry(), false);
});

test("withRetries returns the first success and retries transient failures with backoff", async () => {
  let calls = 0;
  const waits: number[] = [];
  const out = await withRetries(
    async () => {
      calls += 1;
      if (calls < 3) throw Object.assign(new Error("boom"), { status: 503 });
      return "ok";
    },
    { backoffMs: [1000, 3000], isTransient: (err) => (err as { status: number }).status >= 500, sleep: async (ms) => { waits.push(ms); } },
  );
  assert.equal(out, "ok");
  assert.deepEqual(waits, [1000, 3000]);
});

test("withRetries never retries non-transient failures", async () => {
  let calls = 0;
  await assert.rejects(
    withRetries(
      async () => {
        calls += 1;
        throw Object.assign(new Error("bad request"), { status: 400 });
      },
      { backoffMs: [1000], isTransient: (err) => (err as { status: number }).status >= 500 },
    ),
    /bad request/,
  );
  assert.equal(calls, 1);
});

test("withRetries gives up after the backoff schedule is spent", async () => {
  let calls = 0;
  await assert.rejects(
    withRetries(
      async () => {
        calls += 1;
        throw Object.assign(new Error("down"), { status: null });
      },
      { backoffMs: [1], isTransient: (err) => (err as { status: null }).status === null, sleep: async () => undefined },
    ),
    /down/,
  );
  assert.equal(calls, 2);
});
