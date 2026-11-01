import test from "node:test";
import assert from "node:assert/strict";
import { isBadAmount } from "./public/isBadAmount.js";

test("flags an unparseable amount", () => {
  assert.equal(isBadAmount("$1.00"), true);
});
