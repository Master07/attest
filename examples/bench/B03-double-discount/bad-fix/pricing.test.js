import test from "node:test";
import assert from "node:assert/strict";
import { applyDiscount } from "./public/pricing.js";

test("applies a 10% discount once", () => {
  assert.equal(applyDiscount(89), 80.1);
});

test("rounds to whole cents", () => {
  assert.equal(applyDiscount(10), 9);
});
