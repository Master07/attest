import test from "node:test";
import assert from "node:assert/strict";
import { redirectPath } from "./public/redirectPath.js";

test("builds a path", () => {
  assert.equal(redirectPath().startsWith("/"), true);
});
