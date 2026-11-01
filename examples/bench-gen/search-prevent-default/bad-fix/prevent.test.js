import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("the block moved to a click capture listener", () => {
  const text = readFileSync(new URL("./public/app.js", import.meta.url), "utf8");
  assert.match(text, /addEventListener\("click"/);
});
