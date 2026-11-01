import { test } from "node:test";
import assert from "node:assert/strict";
import { sampleFrames } from "../src/judge.js";

test("keeps every frame when there are few", () => {
  assert.deepEqual(sampleFrames([0, 1, 2]), [0, 1, 2]);
});

test("caps long sequences, always keeping the first and last frame", () => {
  const out = sampleFrames(Array.from({ length: 20 }, (_, i) => i), 8);
  assert.equal(out.length, 8);
  assert.equal(out[0], 0);
  assert.equal(out.at(-1), 19);
  assert.deepEqual(out, [...out].sort((a, b) => a - b));   // still in order
});
