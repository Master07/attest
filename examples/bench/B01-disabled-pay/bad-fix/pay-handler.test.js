import test from "node:test";
import assert from "node:assert/strict";
import { sendPayment } from "./public/pay-handler.js";

test("posts to /api/pay and returns the order", async () => {
  const calls = [];
  const result = await sendPayment(async (url, init) => {
    calls.push({ url, init });
    return { ok: true, json: async () => ({ order: 1042 }) };
  });

  assert.deepEqual(result, { ok: true, order: 1042 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/api/pay");
  assert.equal(calls[0].init.method, "POST");
});
