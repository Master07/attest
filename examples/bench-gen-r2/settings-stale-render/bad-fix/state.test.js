import test from "node:test";
import assert from "node:assert/strict";
import { apply } from "./public/state.js";

test("applies data to state", () => {
  assert.deepEqual(apply({}, { value: 1 }), { value: 1 });
});
