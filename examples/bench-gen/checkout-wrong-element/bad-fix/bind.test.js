import test from "node:test";
import assert from "node:assert/strict";
import { bind } from "./public/bind.js";

test("binds a submit handler", () => {
  let event = "";
  const target = { addEventListener: (name) => { event = name; } };
  bind(target, () => {});
  assert.equal(event, "submit");
});
