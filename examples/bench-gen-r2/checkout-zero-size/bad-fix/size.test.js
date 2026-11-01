import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("the panel has a minimum width", () => {
  const text = readFileSync(new URL("./public/styles.css", import.meta.url), "utf8");
  assert.match(text, /min-width:\s*40px/);
});
