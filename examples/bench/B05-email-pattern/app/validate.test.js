import test from "node:test";
import assert from "node:assert/strict";
import { validateEmail } from "./public/validate.js";

test("accepts a normal address", () => {
  assert.equal(validateEmail("buyer@example.com"), true);
});

test("rejects an address without a domain", () => {
  assert.equal(validateEmail("buyer@"), false);
});
