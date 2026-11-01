import assert from "node:assert/strict";
import { test } from "node:test";
import type { Receipt } from "../src/receipt.js";
import { renderProofsIndex } from "../src/report.js";

const receipt = (verdict: Receipt["verdict"], over: Partial<Receipt> = {}): Receipt => ({
  version: "attest.receipt/0.1", mode: "fix", created_at: "2026-11-01T00:22:20.794Z",
  subject: { repo: null, app: ".", refs: {}, criteria_path: "criteria.yml", criteria_sha256: "sha256:abc" },
  phases: [
    { phase: "red", ref: "b", sha: "1", status: "completed", error: null, steps: 1, model: "m", prompt_sha256: "p", criteria: [], result: "fail", reason: "" },
    { phase: "green", ref: "f", sha: "2", status: "completed", error: null, steps: 1, model: "m", prompt_sha256: "p", criteria: [], result: "pass", reason: "" },
  ],
  verdict, reasons: [], models: [{ role: "judge", provider: "baseten", model: "meta-models/muse-spark-open" }],
  artifacts: {}, log: { path: "events.jsonl", head: "sha256:00", entries: 1 },
  signature: { alg: "ed25519", public_key: "K", value: "S" },
  ...over,
});

test("lists every receipt with a link, verdict, phases and validity, grouped", () => {
  const html = renderProofsIndex([
    { path: "realworld/board-921-run2", receipt: receipt("PROVEN"), valid: true },
    { path: "benchmark/run-1/B02", receipt: receipt("INCONCLUSIVE", { models: [{ role: "judge", provider: "meta", model: "muse-wonder-1.0" }] }), valid: false },
  ]);
  assert.match(html, /href="realworld\/board-921-run2\/index\.html"/);
  assert.match(html, /href="benchmark\/run-1\/B02\/index\.html"/);
  assert.match(html, /1 of 2 valid/);
  assert.match(html, /<h2>Real-world<\/h2>[\s\S]*<h2>Benchmark<\/h2>/);
  assert.match(html, /Red ✓/);
  assert.match(html, /✗ invalid/);
  assert.match(html, /Muse Spark Open <span class="badge">open weights<\/span>/);
  assert.match(html, /Muse Wonder/);
  assert.match(html, /PROVEN · 1/);
});

test("escapes paths and loads nothing", () => {
  const bad = `x"><script>alert(1)</script>`;
  const html = renderProofsIndex([{ path: bad, receipt: receipt("PROVEN", { subject: { repo: null, app: bad, refs: {}, criteria_path: "c", criteria_sha256: "s" } }), valid: true }]);
  assert.ok(!/<script/i.test(html));
  assert.ok(!/(src|href)="(https?:)?\/\//i.test(html));
  assert.ok(html.includes("&#60;script&#62;"));
});

test("is deterministic", () => {
  const e = [{ path: "pr-1-live", receipt: receipt("PROVEN"), valid: true }];
  assert.equal(renderProofsIndex(e), renderProofsIndex(e));
});
