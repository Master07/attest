import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("the timer still disables the control", () => {
  const text = readFileSync(new URL("./public/app.js", import.meta.url), "utf8");
  assert.match(text, /\}, 100\);/);
});
