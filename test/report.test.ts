import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTimeline, renderReport } from "../src/report.js";
import type { Receipt } from "../src/receipt.js";

const receipt = (verdict: Receipt["verdict"], observation: string): Receipt => ({
  version: "attest.receipt/0.1", mode: "fix", created_at: "2026-11-01T00:00:00.000Z",
  subject: { repo: null, app: "examples/x", refs: {}, criteria_path: "missing.yml", criteria_sha256: "abc" },
  phases: [{
    phase: "red", ref: "demo/base", sha: "d83a9d0", status: "completed", error: null, steps: 2, model: "muse-spark-1.3", prompt_sha256: "p",
    criteria: [{ id: "c", votes: { cua: "fail", checks: "fail", sam: "n/a", judge: "fail" }, result: "fail", reason: "", observation, evidence: ["shots/red-reveal.png"], notes: ["SAM 3.1: landed on div#hb-root"] }],
    result: "fail", reason: "",
  }],
  verdict, reasons: ["red failed"], models: [{ role: "verifier", provider: "meta", model: "muse-spark-1.3" }],
  artifacts: {}, log: { path: "events.jsonl", head: "sha256:00", entries: 1 },
  signature: { alg: "ed25519", public_key: "KEY", value: "SIG" },
});

test("shows the verdict, votes, notes and the reveal image", () => {
  const html = renderReport(receipt("PROVEN", "Clicked Pay"), "/nonexistent");
  assert.match(html, /class="stamp ok">PROVEN</);
  assert.match(html, /landed on div#hb-root/);
  assert.match(html, /shots\/red-reveal\.png/);
  assert.match(html, /Criteria file unavailable/);
});

test("timeline pairs each click with what it actually hit, in order", () => {
  const lines = [
    { phase: "red", kind: "screenshot", data: { step: 0, file: "shots/red-00.png" } },
    { phase: "red", kind: "screenshot", data: { step: 1, file: "shots/red-01.png" } },
    { phase: "red", kind: "screenshot", data: { step: 2, file: "shots/red-02.png" } },
    { phase: "red", kind: "cua_step", data: { step: 1, actions: [{ type: "click", x: 957, y: 426 }], errors: [] } },
    { phase: "red", kind: "cua_step", data: { step: 2, actions: [{ type: "wait" }, { type: "click", x: 955, y: 426 }], errors: [] } },
    { phase: "red", kind: "clicks", data: { clicks: [
      { x: 957, y: 426, target: "div#hb-root", interactive: false },
      { x: 955, y: 426, target: "button#pay.pay", interactive: true },
    ] } },
    { phase: "green", kind: "cua_step", data: { step: 1, actions: [{ type: "click", x: 1, y: 1 }], errors: [] } },
  ];
  const steps = buildTimeline(lines, "red");
  assert.equal(steps.length, 3);
  assert.equal(steps[0]?.actions[0], "open the app");
  assert.equal(steps[1]?.actions[0], "click (957, 426) → landed on div#hb-root (not a control)");
  assert.deepEqual(steps[2]?.actions, ["wait", "click (955, 426) → landed on button#pay.pay"]);
  assert.equal(steps[2]?.screenshot, "shots/red-02.png");
});

test("escapes text from the model so it cannot inject markup", () => {
  const html = renderReport(receipt("REJECTED", `<script>alert("x")</script>`), "/nonexistent");
  assert.ok(!html.includes("<script>alert"));
  assert.match(html, /&#60;script&#62;/);
  assert.match(html, /class="stamp bad">REJECTED</);
});
