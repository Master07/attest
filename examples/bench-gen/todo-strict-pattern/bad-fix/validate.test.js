import test from "node:test";
import assert from "node:assert/strict";
import { itemOk } from "./public/validate.js";

test("accepts another valid value", () => {
  assert.equal(itemOk("Buy milk now"), true);
});
