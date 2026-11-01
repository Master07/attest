import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("the control is raised above the late layer", () => {
  const text = readFileSync(new URL("./public/app.js", import.meta.url), "utf8");
  assert.match(text, /zIndex = "1000"/);
});
