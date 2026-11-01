import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("the control is raised above other layers", () => {
  const text = readFileSync(new URL("./public/styles.css", import.meta.url), "utf8");
  assert.match(text, /z-index:\s*1000/);
});
