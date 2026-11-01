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

test("a 19-step keyboard flow reaches the judge whole (Board#918 had 19 screenshots)", () => {
  const frames = Array.from({ length: 19 }, (_, i) => i);
  assert.deepEqual(sampleFrames(frames), frames);
});

test("the default cap still bounds very long phases", () => {
  const out = sampleFrames(Array.from({ length: 100 }, (_, i) => i));
  assert.equal(out.length, 32);
  assert.equal(out[0], 0);
  assert.equal(out.at(-1), 99);
});
