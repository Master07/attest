import { test } from "node:test";
import assert from "node:assert/strict";
import { submitPayment } from "./public/pay.js";

const response = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

test("returns the confirmation URL for a successful payment", async () => {
  const url = await submitPayment(async () => response(200, { order: 1042 }));
  assert.equal(url, "/order-confirmation?order=1042");
});

test("posts to /api/pay", async () => {
  let called;
  await submitPayment(async (path, init) => {
    called = { path, method: init.method };
    return response(200, { order: 1 });
  });
  assert.deepEqual(called, { path: "/api/pay", method: "POST" });
});

test("throws when the payment API fails", async () => {
  await assert.rejects(submitPayment(async () => response(500, {})), /Payment failed/);
});

test("throws when the response has no order number", async () => {
  await assert.rejects(submitPayment(async () => response(200, {})), /no order number/);
});
