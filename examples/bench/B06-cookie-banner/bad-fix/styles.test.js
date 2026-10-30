import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("the Pay button is raised above other layers", () => {
  const css = readFileSync(new URL("./public/styles.css", import.meta.url), "utf8");
  assert.match(css, /\.pay\s*\{[^}]*z-index:\s*1000/);
});
