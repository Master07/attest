import test from "node:test";
import assert from "node:assert/strict";
import { normalize } from "./public/normalize.js";

test("returns the value unchanged", () => {
  assert.equal(normalize(178), 178);
});
