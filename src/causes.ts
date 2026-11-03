// Why a proof is INCONCLUSIVE, and what to do next. Pure: derived only from the recorded phases,
// so `attest verify` and the views agree. It explains a verdict; it never changes one.

import type { PhaseRecord } from "./receipt.js";
import type { Verdict } from "./verdict.js";

export type CauseKind = "not_reproduced" | "wrong_fix_passed" | "incomplete" | "action_failed" | "judge_missing" | "disagreement";

export interface Cause {
  kind: CauseKind;
  title: string;
  detail: string;
  next: string;
}

const NEXT: Record<CauseKind, { title: string; next: string }> = {
  not_reproduced: {
    title: "Bug not reproduced",
    next: "Check the base ref, and that the criterion's given state is reachable from the app's root URL.",
  },
  wrong_fix_passed: {
    title: "Wrong fix passed",
    next: "The criterion doesn't tell the wrong fix from the fix. Make its then name the behaviour the wrong fix gets wrong.",
  },
  incomplete: {
    title: "Execution incomplete",
    next: "Re-run once. If it repeats, run attest doctor and check the criterion's given path.",
  },
  action_failed: {
    title: "A browser action failed",
    next: "Attest couldn't perform an action the verifier asked for, so the screenshots may not show the criterion's when. Read the action error on the evidence page; if Attest can't send that key or action, report it. Otherwise re-run once.",
  },
  judge_missing: {
    title: "Required judge gave no vote",
    next: "Treat it as an outage, not a result: re-run once. One model alone never certifies.",
  },
  disagreement: {
    title: "Voters disagree",
    next: "Compare the votes and screenshots for this phase on the evidence page; a person decides. Don't re-run until one passes.",
  },
};

const cause = (kind: CauseKind, detail: string): Cause => ({ kind, title: NEXT[kind].title, detail, next: NEXT[kind].next });

/** The causes behind an INCONCLUSIVE verdict, most actionable first; empty for any other verdict. */
export function inconclusiveCauses(receipt: { verdict: Verdict; phases: PhaseRecord[] }): Cause[] {
  if (receipt.verdict !== "INCONCLUSIVE") return [];
  const out: Cause[] = [];
  const red = receipt.phases.find((p) => p.phase === "red");
  const brk = receipt.phases.find((p) => p.phase === "break");
  if (red?.result === "pass") out.push(cause("not_reproduced", "red: the base build already meets the criterion"));
  if (brk?.result === "pass") out.push(cause("wrong_fix_passed", "break: the wrong fix meets the criterion"));
  for (const p of receipt.phases) {
    if (p.result !== "inconclusive") continue;
    const failed = p.action_errors ?? [];
    if (failed.length > 0) out.push(cause("action_failed", `${p.phase}: ${failed.length} failed, first ${failed[0]}`));
    if (p.error !== null || p.status !== "completed") {
      const what = p.status === "step_cap" ? "the verifier hit its step cap" : (p.error ?? `verifier status ${p.status}`);
      out.push(cause("incomplete", `${p.phase}: ${what}`));
    }
    for (const c of p.criteria) {
      if (c.result !== "inconclusive") continue;
      if (c.votes.judge === "missing") out.push(cause("judge_missing", `${p.phase}/${c.id}`));
      else if (c.reason.startsWith("verifier failed but") || c.reason.startsWith("judge voted")) {
        out.push(cause("disagreement", `${p.phase}/${c.id}: ${c.reason}`));
      } else if (p.error === null && p.status === "completed") out.push(cause("incomplete", `${p.phase}/${c.id}: ${c.reason}`));
    }
  }
  if (out.length === 0) out.push(cause("incomplete", "a phase is missing or gave no result"));
  return out;
}
