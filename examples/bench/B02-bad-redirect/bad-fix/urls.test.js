import test from "node:test";
import assert from "node:assert/strict";
import { confirmationUrl } from "./public/urls.js";

test("builds the confirmation URL", () => {
  assert.equal(confirmationUrl(1042), "/order-confirmation?order=1042");
});
