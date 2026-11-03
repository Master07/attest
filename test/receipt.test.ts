import { test } from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadCriteria } from "../src/criteria.js";
import { EventLog } from "../src/eventlog.js";
import { sha256File, signReceipt, verifyReceipt } from "../src/receipt.js";
import type { PhaseRecord, ReceiptBody } from "../src/receipt.js";

const keyPath = join(tmpdir(), `attest-test-key-${process.pid}.pem`);

function phase(name: PhaseRecord["phase"], cua: "pass" | "fail", checks: "pass" | "fail"): PhaseRecord {
  const result = cua === "pass" && checks === "pass" ? "pass" : "fail";
  return {
    phase: name, ref: `demo/${name}`, sha: "abc", status: "completed", error: null, steps: 2,
    model: "muse-spark-1.3", prompt_sha256: "x",
    criteria: [{ id: "pay-completes", votes: { cua, checks, sam: "n/a", judge: "n/a" }, result, reason: "", observation: "", evidence: ["shots/a.png"] }],
    result, reason: "",
  };
}

function bundle(): { dir: string; receipt: string } {
  const dir = join(tmpdir(), `attest-receipt-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(join(dir, "shots"), { recursive: true });
  copyFileSync("examples/checkout-demo/criteria.yml", join(dir, "criteria.yml"));
  writeFileSync(join(dir, "shots", "a.png"), "fake-png");
  const log = EventLog.create(join(dir, "events.jsonl"));
  log.append("run_start", { mode: "fix" });
  log.append("phase_result", { result: "fail" }, "red");
  log.append("verdict", { verdict: "PROVEN" });

  const body: ReceiptBody = {
    version: "attest.receipt/0.1", mode: "fix", created_at: "2026-11-01T00:00:00.000Z",
    subject: { repo: null, app: "examples/checkout-demo", refs: {}, criteria_path: "criteria.yml", criteria_sha256: loadCriteria(join(dir, "criteria.yml")).sha256 },
    phases: [phase("red", "fail", "fail"), phase("green", "pass", "pass"), phase("break", "fail", "fail")],
    verdict: "PROVEN", reasons: [], models: [],
    artifacts: { "criteria.yml": sha256File(join(dir, "criteria.yml")), "shots/a.png": sha256File(join(dir, "shots", "a.png")) },
    log: { path: "events.jsonl", head: log.head, entries: log.length },
  };
  const receipt = join(dir, "receipt.json");
  writeFileSync(receipt, JSON.stringify(signReceipt(body, keyPath), null, 2));
  return { dir, receipt };
}

const failed = (path: string): string[] => verifyReceipt(path).steps.filter((s) => !s.ok).map((s) => s.check);

test("a clean receipt verifies", () => {
  const { receipt } = bundle();
  const result = verifyReceipt(receipt);
  assert.equal(result.ok, true, JSON.stringify(result.steps));
  assert.equal(result.verdict, "PROVEN");
});

test("editing the verdict breaks the signature and the verdict check", () => {
  const { receipt } = bundle();
  const r = JSON.parse(readFileSync(receipt, "utf8"));
  r.verdict = "REJECTED";
  writeFileSync(receipt, JSON.stringify(r));
  assert.deepEqual(failed(receipt), ["signature", "verdict"]);
});

test("a changed screenshot is detected", () => {
  const { dir, receipt } = bundle();
  writeFileSync(join(dir, "shots", "a.png"), "doctored");
  assert.deepEqual(failed(receipt), ["artifacts"]);
});

test("a truncated event log is detected via the pinned head and length", () => {
  const { dir, receipt } = bundle();
  const lines = readFileSync(join(dir, "events.jsonl"), "utf8").trimEnd().split("\n");
  writeFileSync(join(dir, "events.jsonl"), `${lines.slice(0, 2).join("\n")}\n`);
  assert.deepEqual(failed(receipt), ["event log"]);
});

test("an edited event log line is detected", () => {
  const { dir, receipt } = bundle();
  const path = join(dir, "events.jsonl");
  writeFileSync(path, readFileSync(path, "utf8").replace('"result":"fail"', '"result":"pass"'));
  assert.deepEqual(failed(receipt), ["event log"]);
});

test("a signed receipt whose verdict doesn't follow from its votes is caught", () => {
  const { dir } = bundle();
  const r = JSON.parse(readFileSync(join(dir, "receipt.json"), "utf8"));
  delete r.signature;
  r.phases[1].criteria[0].votes.checks = "fail";   // green's code check failed…
  const path = join(dir, "inconsistent.json");
  writeFileSync(path, JSON.stringify(signReceipt(r, keyPath)));  // …but it still claims PROVEN, validly signed
  assert.deepEqual(failed(path), ["verdict"]);
});

test("judge failures: 0.2 receipts record missing; 0.1 receipts abstained", async () => {
  const { judgeErrored, judgeAbstained } = await import("../src/receipt.js");
  const base = { id: "c", result: "inconclusive" as const, reason: "", observation: "", evidence: [] };
  const v02 = { ...base, votes: { cua: "pass" as const, checks: "n/a" as const, sam: "n/a" as const, judge: "missing" as const } };
  const v01 = { ...base, votes: { cua: "pass" as const, checks: "n/a" as const, sam: "n/a" as const, judge: "n/a" as const }, notes: ["Judge could not vote: 503"] };
  const notAsked = { ...v01, notes: [] };
  assert.equal(judgeErrored(v02), true);
  assert.equal(judgeErrored(v01), true);
  assert.equal(judgeErrored(notAsked), false);
  const phase = (c: typeof v01 | typeof v02) => ({ phase: "green", criteria: [c] }) as unknown as PhaseRecord;
  assert.equal(judgeAbstained({ phases: [phase(v01)] }), true);
  assert.equal(judgeAbstained({ phases: [phase(v02)] }), false);
});

test("recompute: action errors are part of the verdict from 0.3; receipts without them are unchanged", async () => {
  const { recomputeVerdict } = await import("../src/receipt.js");
  const red = phase("red", "fail", "fail"), brk = phase("break", "fail", "fail");
  const green = phase("green", "pass", "pass");
  assert.equal(recomputeVerdict([red, green, brk]).verdict, "PROVEN");
  // A 0.3 receipt that records a failed action in Green but still claims the phase passed is caught.
  const claimed = { ...green, action_errors: ["step 2: keypress: unknown key \"Foo\""] };
  const out = recomputeVerdict([red, claimed, brk]);
  assert.equal(out.verdict, "INCONCLUSIVE");
  assert.match(out.mismatches.join(" "), /green: recorded pass, criteria give inconclusive/);
  // Recorded honestly, it verifies.
  assert.deepEqual(recomputeVerdict([red, { ...claimed, result: "inconclusive" }, brk]).mismatches, []);
  // An empty list is the same as none.
  assert.equal(recomputeVerdict([red, { ...green, action_errors: [] }, brk]).verdict, "PROVEN");
});
