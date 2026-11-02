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

test("accepts the DOM key names and function keys the verifier sends", () => {
  assert.equal(toPlaywrightKeys(["ArrowRight"]), "ArrowRight");
  assert.equal(toPlaywrightKeys(["arrowleft"]), "ArrowLeft");
  assert.equal(toPlaywrightKeys(["Page_Down"]), "PageDown");
  assert.equal(toPlaywrightKeys(["F5"]), "F5");
  assert.equal(toPlaywrightKeys(["F12"]), "F12");
  assert.equal(toPlaywrightKeys(["Insert"]), "Insert");
});

test("passes punctuation through, adding Shift where a US keyboard needs it", () => {
  assert.equal(toPlaywrightKeys(["-"]), "-");
  assert.equal(toPlaywrightKeys(["CTRL", "-"]), "Control+-");
  assert.equal(toPlaywrightKeys(["/"]), "/");
  assert.equal(toPlaywrightKeys(["?"]), "Shift+?");
  assert.equal(toPlaywrightKeys(["SHIFT", "?"]), "Shift+?");
});

test("rejects unknown keys", () => {
  assert.throws(() => toPlaywrightKeys(["Buy milk"]), /unknown key/);
  assert.throws(() => toPlaywrightKeys(["F13"]), /unknown key/);
  assert.throws(() => toPlaywrightKeys(["HYPER"]), /unknown key/);
  assert.throws(() => toPlaywrightKeys([]), /must not be empty/);
  assert.throws(() => toPlaywrightKeys([" "]), /must not be empty/);
});
