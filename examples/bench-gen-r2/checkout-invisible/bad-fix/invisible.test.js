import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("the control has an accessible name", () => {
  const text = readFileSync(new URL("./public/index.html", import.meta.url), "utf8");
  assert.match(text, /aria-label="Action"/);
});
