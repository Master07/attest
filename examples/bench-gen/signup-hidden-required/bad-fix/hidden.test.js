import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("the moved field is still required", () => {
  const text = readFileSync(new URL("./public/index.html", import.meta.url), "utf8");
  assert.match(text, /name="company2"[^>]*required/);
});
