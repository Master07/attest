import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { keyFingerprint } from "../src/receipt.js";
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

// ---- Evidence UI: content corrections and the no-script / escaping guarantees ----

const phase = (name: "red" | "green" | "break", result: "pass" | "fail" | "inconclusive", over: Partial<Receipt["phases"][number]> = {}): Receipt["phases"][number] => ({
  phase: name, ref: `demo/${name}`, sha: "abcdef1234567", status: "completed", error: null, steps: 2, model: "muse-spark-1.3", prompt_sha256: "p",
  criteria: [{ id: "c", votes: { cua: result === "inconclusive" ? "missing" : result, checks: "n/a", sam: "n/a", judge: result === "inconclusive" ? "fail" : result }, result, reason: "", observation: "saw it", evidence: [] }],
  result, reason: "", ...over,
});

const full = (over: Partial<Receipt> = {}): Receipt => ({
  ...receipt("PROVEN", "x"),
  phases: [phase("red", "fail"), phase("green", "pass"), phase("break", "fail")],
  models: [{ role: "verifier", provider: "meta", model: "muse-spark-1.3" }, { role: "judge", provider: "baseten", model: "meta-models/muse-spark-open" }],
  ...over,
});

test("every verdict renders its word and stamp class", () => {
  const cases: [Receipt["verdict"], string, string][] = [
    ["PROVEN", "ok", "Proven"], ["PROVEN_UNCHECKED", "warn", "Proven, unchecked"], ["REJECTED", "bad", "Rejected"], ["INCONCLUSIVE", "warn", "Inconclusive"],
  ];
  for (const [verdict, cls, word] of cases) {
    const html = renderReport(full({ verdict }), "/nonexistent");
    assert.match(html, new RegExp(`class="stamp ${cls}">${verdict.replace("_", " ")}<`));
    assert.match(html, new RegExp(`class="vword ${cls}">${word}<`));
  }
});

test("phase tiles state expected vs observed; inconclusive is not a mismatch mark", () => {
  const html = renderReport(full({ verdict: "INCONCLUSIVE", phases: [phase("red", "inconclusive", { error: "HTTP 500", steps: 1 }), phase("green", "pass"), phase("break", "pass")] }), "/nonexistent");
  assert.match(html, /1 of 3 phases as expected/);
  assert.match(html, /! inconclusive/);
  assert.match(html, /✗ not as expected/);          // break passed: a real mismatch
  assert.match(html, /Phase error\.<\/b> HTTP 500/);
  assert.match(html, /no vote — error/);
  assert.match(html, /1 verifier step ·/);
  assert.ok(!/1 verifier steps/.test(html));
});

test("voter labels come from the receipt's models (C3)", () => {
  const wonder = renderReport(full({ models: [{ role: "verifier", provider: "meta", model: "muse-spark-1.3" }, { role: "judge", provider: "meta", model: "muse-wonder-1.0" }] }), "/nonexistent");
  assert.match(wonder, /Judge · Muse Wonder/);
  assert.match(wonder, />Element check</);
  assert.ok(!wonder.includes("Judge · Muse Spark Open"));
  const open = renderReport(full({ models: [...full().models, { role: "ui", provider: "meta", model: "sam-3.1" }] }), "/nonexistent");
  assert.match(open, /Judge · Muse Spark Open/);
  assert.match(open, /Element check · SAM 3\.1/);
  assert.match(open, /class="badge">open weights</);
  assert.match(open, /not applicable/);
});

test("app '.' reads as the repository root, and the repo is labelled 'Run from' (C1, C2)", () => {
  const root = renderReport(full({ subject: { ...full().subject, app: ".", repo: "https://example.test/x.git" } }), "/nonexistent");
  assert.match(root, /Proof-of-fix receipt · repository root/);
  assert.match(root, /<dt>Run from<\/dt>/);
  assert.ok(!root.includes("receipt · .<"));
  assert.match(renderReport(full(), "/nonexistent"), /Proof-of-fix receipt · examples\/x/);
});

test("the signing key is shown as the shared fingerprint, the full key in a tooltip (C4)", () => {
  const html = renderReport(full({ signature: { alg: "ed25519", public_key: "MCowBQYDK2VwAyEAkeyA", value: "S" } }), "/nonexistent");
  assert.ok(html.includes(keyFingerprint("MCowBQYDK2VwAyEAkeyA")));
  assert.match(html, /title="MCowBQYDK2VwAyEAkeyA"/);
});

test("replay banner and 'Run' row appear only for replayed receipts", () => {
  const live = renderReport(full(), "/nonexistent");
  assert.ok(!live.includes('class="replay"'));
  assert.match(live, /<dt>Run<\/dt><dd>live<\/dd>/);
  const replayed = renderReport(full({ replay: { cassette: "c.jsonl", sha256: "sha256:abc" } }), "/nonexistent");
  assert.match(replayed, /class="replay"/);
  assert.match(replayed, /replay of a recorded run/);
});

test("the page loads nothing and runs nothing", () => {
  const html = renderReport(full({ replay: { cassette: "c.jsonl", sha256: "sha256:abc" } }), "/nonexistent");
  assert.ok(!/<script/i.test(html));
  assert.ok(!/(src|href)="(https?:)?\/\//i.test(html), "no external resource or link");
  assert.ok(!/@import|url\(\s*['"]?https?:/i.test(html));
});

test("every receipt-sourced field is escaped", () => {
  const bad = "<img src=x onerror=1>";
  const r = full({
    reasons: [bad],
    subject: { ...full().subject, app: bad, repo: bad },
    models: [{ role: bad, provider: bad, model: bad }],
    phases: [phase("red", "fail", { ref: bad, error: bad, model: bad, criteria: [{ id: bad, votes: { cua: "fail", checks: "n/a", sam: "n/a", judge: "fail" }, result: "fail", reason: bad, observation: bad, evidence: [bad], notes: [bad] }] })],
  });
  const html = renderReport(r, "/nonexistent");
  assert.ok(!html.includes(bad));
  assert.ok(html.includes("&#60;img src=x onerror=1&#62;"));
});

test("criteria from the file are escaped and laid out as given/when/then", () => {
  const dir = mkdtempSync(join(tmpdir(), "attest-report-"));
  writeFileSync(join(dir, "criteria.yml"), 'id: t\ncriteria:\n  - id: a\n    given: "<b>cart</b>"\n    when: user clicks Pay\n    then: order shows\n');
  const html = renderReport(full({ subject: { ...full().subject, criteria_path: "criteria.yml" } }), dir);
  assert.match(html, /<dt>Given<\/dt><dd>&#60;b&#62;cart&#60;\/b&#62;<\/dd>/);
  assert.match(html, /<dt>When<\/dt><dd>user clicks Pay<\/dd>/);
});

test("rendering is deterministic", () => {
  assert.equal(renderReport(full(), "/nonexistent"), renderReport(full(), "/nonexistent"));
});

test("a judge that errored reads 'no vote — error', not 'not applicable', with a summary line", () => {
  const errored = phase("red", "fail", { criteria: [{ id: "c", votes: { cua: "fail", checks: "n/a", sam: "n/a", judge: "n/a" }, result: "fail", reason: "", observation: "o", evidence: [], notes: ["Judge could not vote: HTTP 400 Too many images"] }] });
  const html = renderReport(full({ phases: [errored, phase("green", "pass"), phase("break", "fail")] }), "/nonexistent");
  assert.match(html, /Judge · Muse Spark Open<\/span><span class="vv"><span class="mark" aria-hidden="true">!<\/span>no vote — error/);
  assert.match(html, /Judge did not vote in 1 of 3 phases\./);
  const clean = renderReport(full(), "/nonexistent");
  assert.ok(!clean.includes("Judge did not vote"));
});

test("a judge vote that was simply not applicable still reads 'not applicable'", () => {
  const html = renderReport(full({ phases: [phase("red", "fail", { criteria: [{ id: "c", votes: { cua: "fail", checks: "n/a", sam: "n/a", judge: "n/a" }, result: "fail", reason: "", observation: "o", evidence: [] }] })] }), "/nonexistent");
  assert.ok(!html.includes("Judge did not vote"));
  assert.ok(!/Judge · Muse Spark Open<\/span><span class="vv"><span class="mark" aria-hidden="true">!/.test(html));
});
