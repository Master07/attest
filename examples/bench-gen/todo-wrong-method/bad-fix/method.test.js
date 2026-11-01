import test from "node:test";
import assert from "node:assert/strict";
import { methodFor } from "./public/methodFor.js";

test("returns the expected method", () => {
  assert.equal(methodFor(), "POST");
});
