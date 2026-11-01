import test from "node:test";
import assert from "node:assert/strict";
import { soon } from "./public/soon.js";

test("schedules a callback", () => {
  const timer = soon(() => {});
  assert.ok(timer !== null);
  clearTimeout(timer);
});
