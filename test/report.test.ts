import { test } from "node:test";
import assert from "node:assert/strict";
import { renderReport } from "../src/report.js";
import type { Receipt } from "../src/receipt.js";

const receipt = (verdict: Receipt["verdict"], observation: string): Receipt => ({
  version: "attest.receipt/0.1", mode: "fix", created_at: "2026-11-01T00:00:00.000Z",
  subject: { repo: null, app: "examples/x", refs: {}, criteria_path: "missing.yml", criteria_sha256: "abc" },
  phases: [{
    phase: "red", ref: "demo/base", sha: "d91557d", status: "completed", error: null, steps: 2, model: "muse-spark-1.3", prompt_sha256: "p",
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

test("escapes text from the model so it cannot inject markup", () => {
  const html = renderReport(receipt("REJECTED", `<script>alert("x")</script>`), "/nonexistent");
  assert.ok(!html.includes("<script>alert"));
  assert.match(html, /&#60;script&#62;/);
  assert.match(html, /class="stamp bad">REJECTED</);
});
