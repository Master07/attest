import { test } from "node:test";
import assert from "node:assert/strict";
import { combineCriterion, combinePhase, fixVerdict } from "../src/verdict.js";
import type { CriterionVotes } from "../src/verdict.js";

const votes = (v: Partial<CriterionVotes>): CriterionVotes => ({ cua: "pass", checks: "n/a", sam: "n/a", judge: "n/a", ...v });

test("criterion: every applicable vote must pass", () => {
  assert.equal(combineCriterion(votes({})).result, "pass");
  assert.equal(combineCriterion(votes({ checks: "pass", sam: "pass", judge: "pass" })).result, "pass");
  assert.equal(combineCriterion(votes({ cua: "fail" })).result, "fail");
  assert.equal(combineCriterion(votes({ cua: "fail", checks: "fail" })).result, "fail");
});

test("criterion: a hard check catches a false pass", () => {
  const out = combineCriterion(votes({ cua: "pass", checks: "fail" }));
  assert.equal(out.result, "fail");
  assert.match(out.reason, /checks failed/);
  assert.equal(combineCriterion(votes({ cua: "pass", checks: "pass", sam: "fail" })).result, "fail");
});

test("criterion: disagreement is never a pass", () => {
  assert.equal(combineCriterion(votes({ cua: "fail", checks: "pass" })).result, "inconclusive");
  assert.equal(combineCriterion(votes({ cua: "pass", judge: "fail" })).result, "inconclusive");
  assert.equal(combineCriterion(votes({ cua: "fail", judge: "pass" })).result, "inconclusive");
  assert.equal(combineCriterion(votes({ cua: "missing", checks: "pass" })).result, "inconclusive");
});

test("phase: fail beats inconclusive beats pass; errors are inconclusive", () => {
  assert.equal(combinePhase(["pass", "pass"]).result, "pass");
  assert.equal(combinePhase(["pass", "inconclusive"]).result, "inconclusive");
  assert.equal(combinePhase(["inconclusive", "fail"]).result, "fail");
  assert.equal(combinePhase([]).result, "inconclusive");
  assert.equal(combinePhase(["pass"], "app did not start").result, "inconclusive");
});

test("fix verdict: full truth table", () => {
  assert.equal(fixVerdict({ red: "fail", green: "pass", break: "fail" }).verdict, "PROVEN");
  assert.equal(fixVerdict({ red: "fail", green: "pass" }).verdict, "PROVEN_UNCHECKED");
  for (const red of ["fail", "pass", "inconclusive"] as const) {
    for (const brk of ["fail", "pass", "inconclusive", undefined] as const) {
      const phases = brk === undefined ? { red, green: "fail" as const } : { red, green: "fail" as const, break: brk };
      assert.equal(fixVerdict(phases).verdict, "REJECTED", `green fail must reject (red ${red}, break ${String(brk)})`);
    }
  }
  assert.equal(fixVerdict({ red: "pass", green: "pass", break: "fail" }).verdict, "INCONCLUSIVE");
  assert.equal(fixVerdict({ red: "fail", green: "pass", break: "pass" }).verdict, "INCONCLUSIVE");
  assert.equal(fixVerdict({ red: "fail", green: "inconclusive", break: "fail" }).verdict, "INCONCLUSIVE");
  assert.equal(fixVerdict({ red: "inconclusive", green: "pass", break: "fail" }).verdict, "INCONCLUSIVE");
  assert.equal(fixVerdict({ green: "pass", break: "fail" }).verdict, "INCONCLUSIVE");
  assert.equal(fixVerdict({ red: "fail", break: "fail" }).verdict, "INCONCLUSIVE");
});

test("fix verdict: not reproduced is worded as not reproduced, not as fake", () => {
  const out = fixVerdict({ red: "pass", green: "pass", break: "fail" });
  assert.ok(out.reasons.some((r) => r.includes("not reproduced in this environment")));
});
