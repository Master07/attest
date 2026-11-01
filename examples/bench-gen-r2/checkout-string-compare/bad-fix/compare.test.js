import test from "node:test";
import assert from "node:assert/strict";
import { compare } from "./public/compare.js";

test("compares numbers", () => {
  assert.equal(compare(9, 10), false);
});
