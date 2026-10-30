import { test } from "node:test";
import assert from "node:assert/strict";
import type { ClickRecord } from "../src/browser.js";
import { judgeVisibility, parseSamOutput } from "../src/sam.js";

const click = (x: number, y: number, target: string, rect: ClickRecord["rect"], interactive: boolean): ClickRecord =>
  ({ ts: "t", x, y, target, rect, interactive });

test("parses SAM box records, with and without confidence", () => {
  const text = "<0f>0<|box;x1=809;y1=404;x2=1107;y2=450;w=1280;h=720;c=0.94|><|mask;x=0;y=0;data=2,2,!ab|>,3<|box;x1=1;y1=2;x2=11;y2=22;w=1280;h=720|>";
  const boxes = parseSamOutput(text);
  assert.equal(boxes.length, 2);
  assert.deepEqual(boxes[0], { id: 0, rect: { x: 809, y: 404, width: 298, height: 46 }, confidence: 0.94 });
  assert.equal(boxes[1]?.confidence, null);
  assert.deepEqual(parseSamOutput(""), []);
});

const pay = [{ id: 0, rect: { x: 809, y: 404, width: 298, height: 46 }, confidence: 0.9 }];

test("visible and the click reaches the button → pass", () => {
  const out = judgeVisibility("Pay button", pay, [click(957, 426, "button#pay.pay", { x: 809, y: 404, width: 298, height: 46 }, true)]);
  assert.equal(out.result, "pass");
});

test("visible but the click lands on a transparent overlay → fail, names the culprit", () => {
  const out = judgeVisibility("Pay button", pay, [click(957, 426, "div#hb-root", { x: 840, y: 160, width: 440, height: 560 }, false)]);
  assert.equal(out.result, "fail");
  assert.equal(out.coveredBy, "div#hb-root");
  assert.match(out.reason, /landed on div#hb-root/);
});

test("with several matches, the clicked one is judged", () => {
  const twoButtons = [
    { id: 1, rect: { x: 1204, y: 644, width: 55, height: 55 }, confidence: 0.9 },   // chat launcher, more confident
    { id: 0, rect: { x: 809, y: 404, width: 297, height: 45 }, confidence: 0.66 },  // Pay
  ];
  const out = judgeVisibility("Pay button", twoButtons, [click(957, 426, "div#hb-root", { x: 840, y: 160, width: 440, height: 560 }, false)]);
  assert.deepEqual(out.box, { x: 809, y: 404, width: 297, height: 45 });
  assert.equal(out.result, "fail");
});

test("not found → fail; visible and not clicked → pass", () => {
  assert.equal(judgeVisibility("Pay button", [], []).result, "fail");
  assert.equal(judgeVisibility("Pay button", pay, [click(10, 10, "a", null, true)]).result, "pass");
});
