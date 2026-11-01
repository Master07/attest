import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("the banner has a close button", () => {
  const text = readFileSync(new URL("./public/index.html", import.meta.url), "utf8");
  assert.match(text, /id="banner-close"/);
});
