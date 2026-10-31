import test from "node:test";
import assert from "node:assert/strict";
import { sendPayment } from "./public/payment-client.js";

test("posts to the configured endpoint", async () => {
  let seen = null;
  const result = await sendPayment(async (url, init) => {
    seen = { url, init };
    return { ok: true, json: async () => ({ order: 1042 }) };
  });

  assert.deepEqual(result, { order: 1042 });
  assert.equal(seen.url, "/api/pay");
  assert.equal(seen.init.method, "POST");
});

test("throws on a failed response", async () => {
  await assert.rejects(sendPayment(async () => ({ ok: false, status: 500 })), /payment failed: 500/);
});
