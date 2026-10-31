import { test } from "node:test";
import assert from "node:assert/strict";
import { filesOutside } from "../src/producer.js";

test("files inside the app dir are allowed, others are flagged", () => {
  const changed = ["examples/app/public/styles.css", "examples/app/x.test.js", "examples/other/file.js", "README.md"];
  assert.deepEqual(filesOutside(changed, "examples/app"), ["examples/other/file.js", "README.md"]);
  assert.deepEqual(filesOutside(changed, "examples\\app\\"), ["examples/other/file.js", "README.md"]);
});

test("a prefix match on a sibling folder is not 'inside'", () => {
  assert.deepEqual(filesOutside(["examples/app-two/a.js"], "examples/app"), ["examples/app-two/a.js"]);
});

test("an app at the repo root contains every file", () => {
  assert.deepEqual(filesOutside(["vanilla-examples/vanillajs/js/app.js", "README.md"], "."), []);
  assert.deepEqual(filesOutside(["a.js"], "./"), []);
});
