import assert from "node:assert/strict";
import { test } from "node:test";
import { HARNESS_CORE_VERSION } from "../src/index.js";

test("harness-core exports its version", () => {
  assert.equal(HARNESS_CORE_VERSION, "0.0.0");
});
