import test from "node:test";
import assert from "node:assert/strict";
import { endpoint } from "./public/endpoint.js";

test("builds an API path", () => {
  assert.equal(endpoint().startsWith("/api/"), true);
});
