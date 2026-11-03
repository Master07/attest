import { test } from "node:test";
import assert from "node:assert/strict";
import { inconclusiveCauses } from "../src/causes.js";
import type { CriterionRecord, PhaseRecord } from "../src/receipt.js";
import type { CriterionResult, CriterionVotes, PhaseName } from "../src/verdict.js";

const crit = (result: CriterionResult, reason: string, v: Partial<CriterionVotes> = {}): CriterionRecord => ({
  id: "c1", votes: { cua: "pass", checks: "n/a", sam: "n/a", judge: "pass", ...v }, result, reason, observation: "", evidence: [],
});
const phase = (name: PhaseName, result: CriterionResult, criteria: CriterionRecord[], extra: Partial<PhaseRecord> = {}): PhaseRecord =>
  ({ phase: name, ref: name, sha: null, status: "completed", error: null, steps: 3, model: null, prompt_sha256: null, criteria, result, reason: "", ...extra }) as unknown as PhaseRecord;

const kinds = (phases: PhaseRecord[]) => inconclusiveCauses({ verdict: "INCONCLUSIVE", phases }).map((c) => c.kind);

test("causes: only INCONCLUSIVE verdicts get causes", () => {
  assert.deepEqual(inconclusiveCauses({ verdict: "PROVEN", phases: [] }), []);
  assert.deepEqual(inconclusiveCauses({ verdict: "REJECTED", phases: [] }), []);
});

test("causes: each failure class is named", () => {
  assert.deepEqual(kinds([phase("red", "pass", [crit("pass", "all votes pass")])]), ["not_reproduced"]);
  assert.deepEqual(kinds([phase("break", "pass", [crit("pass", "all votes pass")])]), ["wrong_fix_passed"]);
  assert.deepEqual(kinds([phase("green", "inconclusive", [crit("inconclusive", "verifier gave no verdict", { cua: "missing" })], { status: "step_cap", error: "stopped after 25 steps" })]), ["incomplete"]);
  assert.deepEqual(kinds([phase("green", "inconclusive", [crit("inconclusive", "required judge gave no vote", { judge: "missing" })])]), ["judge_missing"]);
  assert.deepEqual(kinds([phase("green", "inconclusive", [crit("inconclusive", "judge voted fail, others pass", { judge: "fail" })])]), ["disagreement"]);
  assert.deepEqual(kinds([phase("green", "inconclusive", [crit("inconclusive", "verifier failed but checks passed", { cua: "fail", checks: "pass" })])]), ["disagreement"]);
});

test("causes: a step cap names the step cap, an API error names the error", () => {
  const capped = inconclusiveCauses({ verdict: "INCONCLUSIVE", phases: [phase("green", "inconclusive", [], { status: "step_cap", error: "stopped after 25 steps" })] });
  assert.match(capped[0]!.detail, /step cap/);
  const failed = inconclusiveCauses({ verdict: "INCONCLUSIVE", phases: [phase("red", "inconclusive", [], { status: "error", error: "503 Service Unavailable" })] });
  assert.match(failed[0]!.detail, /503/);
});

test("causes: every cause carries a next step", () => {
  const all = inconclusiveCauses({ verdict: "INCONCLUSIVE", phases: [
    phase("red", "pass", [crit("pass", "all votes pass")]),
    phase("green", "inconclusive", [crit("inconclusive", "required judge gave no vote", { judge: "missing" })]),
    phase("break", "pass", [crit("pass", "all votes pass")]),
  ] });
  assert.equal(all.length, 3);
  for (const c of all) assert.ok(c.next.length > 20);
});

test("causes: a failed browser action is named, with the action", () => {
  const out = inconclusiveCauses({ verdict: "INCONCLUSIVE", phases: [
    phase("green", "inconclusive", [crit("pass", "all votes pass")], { action_errors: ["step 2: keypress: unknown key \"Foo\""] }),
  ] });
  assert.deepEqual(out.map((c) => c.kind), ["action_failed"]);
  assert.match(out[0]!.detail, /green: 1 failed, first step 2: keypress/);
});
