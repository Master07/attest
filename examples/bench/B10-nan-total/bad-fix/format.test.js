import test from "node:test";
import assert from "node:assert/strict";
import { formatPrice } from "./public/format.js";

test("strips the currency symbol", () => {
  assert.equal(formatPrice("$89.00"), "89.00");
});

test("formats a plain number", () => {
  assert.equal(formatPrice("89"), "89.00");
});
