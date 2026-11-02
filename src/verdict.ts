// Pure verdict logic (ARCHITECTURE §1, §7). Models perceive and act; this module decides.
// `attest verify` re-runs these functions over a receipt's recorded votes, so they must stay
// deterministic: no I/O, no clocks, no randomness.

export type Vote = "pass" | "fail" | "n/a";
export type CuaVote = "pass" | "fail" | "missing";
/** "missing": the judge was required (verifier.judge on) but gave no usable vote. Receipts before
 *  attest.receipt/0.2 never record it; they stored a failed judge as "n/a". */
export type JudgeVote = Vote | "missing";
export type CriterionResult = "pass" | "fail" | "inconclusive";
export type PhaseName = "red" | "green" | "break";
export type Verdict = "PROVEN" | "PROVEN_UNCHECKED" | "REJECTED" | "INCONCLUSIVE";

export interface CriterionVotes {
  cua: CuaVote;   // the verifier's verdict; "missing" if it gave none
  checks: Vote;   // deterministic checks; "n/a" when the criterion has no url/network expectation
  sam: Vote;      // UI confirmation; "n/a" when not run
  judge: JudgeVote; // independent judge; "n/a" when not requested, "missing" when required but silent
}

export interface CriterionOutcome {
  result: CriterionResult;
  reason: string;
}

/**
 * Combines one criterion's votes. Every applicable vote must pass; disagreement is never a pass.
 * - No verifier verdict → inconclusive.
 * - Verifier passes but a code check / SAM fails → fail (a hard check caught a false pass).
 * - Verifier fails but code checks pass → inconclusive (the two disagree about what happened).
 * - Judge, when present, must agree with the combined result, or the criterion is inconclusive.
 * - A required judge that gave no vote → inconclusive: one model alone never decides.
 */
export function combineCriterion(votes: CriterionVotes): CriterionOutcome {
  if (votes.cua === "missing") return { result: "inconclusive", reason: "verifier gave no verdict" };
  if (votes.judge === "missing") return { result: "inconclusive", reason: "required judge gave no vote" };

  const hard = [
    { name: "checks", vote: votes.checks },
    { name: "sam", vote: votes.sam },
  ].filter((v) => v.vote !== "n/a");

  let combined: CriterionOutcome;
  if (votes.cua === "pass") {
    const failed = hard.find((v) => v.vote === "fail");
    combined = failed
      ? { result: "fail", reason: `verifier passed but ${failed.name} failed` }
      : { result: "pass", reason: "all votes pass" };
  } else {
    const passed = hard.find((v) => v.vote === "pass");
    combined = passed
      ? { result: "inconclusive", reason: `verifier failed but ${passed.name} passed` }
      : { result: "fail", reason: "verifier failed" };
  }

  if (votes.judge !== "n/a" && combined.result !== "inconclusive" && votes.judge !== combined.result) {
    return { result: "inconclusive", reason: `judge voted ${votes.judge}, others ${combined.result}` };
  }
  return combined;
}

export interface PhaseOutcome {
  result: CriterionResult;
  reason: string;
}

/** A phase fails if any criterion fails; otherwise it is inconclusive if any is; otherwise it passes. */
export function combinePhase(criteria: CriterionResult[], error?: string): PhaseOutcome {
  if (error !== undefined) return { result: "inconclusive", reason: `phase error: ${error}` };
  if (criteria.length === 0) return { result: "inconclusive", reason: "no criteria evaluated" };
  if (criteria.includes("fail")) return { result: "fail", reason: "at least one criterion failed" };
  if (criteria.includes("inconclusive")) return { result: "inconclusive", reason: "at least one criterion inconclusive" };
  return { result: "pass", reason: "all criteria pass" };
}

export interface ProofOutcome {
  verdict: Verdict;
  reasons: string[];
}

/**
 * Fix-mode proof: Red (base) must fail, Green (PR) must pass, Break (wrong fix) must fail.
 * A missing Break phase yields PROVEN_UNCHECKED, never plain PROVEN.
 */
export function fixVerdict(phases: Partial<Record<PhaseName, CriterionResult>>): ProofOutcome {
  const { red, green } = phases;
  const brk = phases.break;
  const reasons: string[] = [];

  if (green === undefined) return { verdict: "INCONCLUSIVE", reasons: ["green phase missing"] };
  if (green === "fail") return { verdict: "REJECTED", reasons: ["green: the fix does not meet the criteria"] };
  if (green === "inconclusive") reasons.push("green: inconclusive");

  if (red === undefined) reasons.push("red phase missing");
  else if (red === "pass") reasons.push("red: bug not reproduced in this environment");
  else if (red === "inconclusive") reasons.push("red: inconclusive");

  if (brk === "pass") reasons.push("break: the wrong fix passed — the verifier cannot tell them apart");
  else if (brk === "inconclusive") reasons.push("break: inconclusive");

  if (reasons.length > 0) return { verdict: "INCONCLUSIVE", reasons };
  if (brk === undefined) {
    return { verdict: "PROVEN_UNCHECKED", reasons: ["red failed and green passed; no break build, so sensitivity is unchecked"] };
  }
  return { verdict: "PROVEN", reasons: ["red failed, green passed, break failed"] };
}
