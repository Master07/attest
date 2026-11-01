import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { phaseVideoDir } from "../src/proof.js";

test("records phase video by default", () => {
  assert.equal(phaseVideoDir("/run", "red", {}), join("/run", "videos", "red-raw"));
  assert.equal(phaseVideoDir("/run", "red", { ATTEST_VIDEO: "1" }), join("/run", "videos", "red-raw"));
});

test("ATTEST_VIDEO=0 disables the phase video", () => {
  assert.equal(phaseVideoDir("/run", "red", { ATTEST_VIDEO: "0" }), undefined);
  assert.equal(phaseVideoDir("/run", "break", { ATTEST_VIDEO: "0" }), undefined);
});
