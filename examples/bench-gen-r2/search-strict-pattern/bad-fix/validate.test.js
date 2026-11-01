import test from "node:test";
import assert from "node:assert/strict";
import { queryOk } from "./public/validate.js";

test("accepts another valid value", () => {
  assert.equal(queryOk("LAMP"), true);
});
