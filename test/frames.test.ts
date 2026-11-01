import assert from "node:assert/strict";
import { test } from "node:test";
import { planSheets } from "../src/frames.js";

const flat = (plan: number[][]): number[] => plan.flat();

test("up to 8 frames: one frame per image, unchanged from before", () => {
  assert.deepEqual(planSheets(3), [[0], [1], [2]]);
  assert.deepEqual(planSheets(8), [[0], [1], [2], [3], [4], [5], [6], [7]]);
});

test("Board#918's 19 frames all reach the judge, in order, within 8 images", () => {
  const plan = planSheets(19);
  assert.ok(plan.length <= 8);
  assert.deepEqual(flat(plan), Array.from({ length: 19 }, (_, i) => i));
  assert.ok(plan.every((g) => g.length <= 4));
});

test("32 frames fill exactly 8 sheets of 4", () => {
  const plan = planSheets(32);
  assert.equal(plan.length, 8);
  assert.ok(plan.every((g) => g.length === 4));
});

test("beyond 32 frames: evenly sampled to 32, first and last kept, still 8 images", () => {
  const plan = planSheets(100);
  const f = flat(plan);
  assert.equal(plan.length, 8);
  assert.equal(f.length, 32);
  assert.equal(f[0], 0);
  assert.equal(f.at(-1), 99);
  assert.deepEqual(f, [...f].sort((a, b) => a - b));
});

test("never more than 8 images for any length", () => {
  for (let n = 0; n <= 200; n++) assert.ok(planSheets(n).length <= 8, `n=${n}`);
});
