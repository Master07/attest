import test from "node:test";
import assert from "node:assert/strict";
import { nameOk } from "./public/validate.js";

test("accepts another valid value", () => {
  assert.equal(nameOk("Alexander"), true);
});
