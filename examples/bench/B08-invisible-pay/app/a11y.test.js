import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("the Pay button has an accessible name", () => {
  const html = readFileSync(new URL("./public/cart.html", import.meta.url), "utf8");
  assert.match(html, /aria-label="Pay"/);
});
