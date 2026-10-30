import assert from "node:assert/strict";
import { test } from "node:test";
import { toPlaywrightKeys } from "../src/browser.js";

test("maps a modifier chord", () => {
  assert.equal(toPlaywrightKeys(["CTRL", "A"]), "Control+A");
});

test("maps multiple modifiers and named keys", () => {
  assert.equal(toPlaywrightKeys(["CTRL", "SHIFT", "ENTER"]), "Control+Shift+Enter");
  assert.equal(toPlaywrightKeys(["cmd", "esc"]), "Meta+Escape");
  assert.equal(toPlaywrightKeys(["RETURN"]), "Enter");
  assert.equal(toPlaywrightKeys(["PAGEDOWN"]), "PageDown");
});

test("passes single letters and digits through", () => {
  assert.equal(toPlaywrightKeys(["a"]), "a");
  assert.equal(toPlaywrightKeys(["Z"]), "Z");
  assert.equal(toPlaywrightKeys(["7"]), "7");
});

test("rejects unknown keys", () => {
  assert.throws(() => toPlaywrightKeys(["HYPER"]), /unknown key/);
  assert.throws(() => toPlaywrightKeys([]), /must not be empty/);
  assert.throws(() => toPlaywrightKeys([" "]), /must not be empty/);
});
