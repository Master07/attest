// Thin wrapper over @corbet/harness-core: signing and verification now live in
// the core so every agent produces receipts the same way. This module keeps its
// exports and signatures; proof-specific fields (body, phases, verdict policy)
// stay here and plug into the core verifier through hooks.
import { createPrivateKey, generateKeyPairSync } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createSignature, hashArtifact, keyFingerprint, verifyReceipt as verifyCoreReceipt } from "@corbet/harness-core";
import { loadCriteria } from "./criteria.js";
import { combineCriterion, combinePhase, fixVerdict } from "./verdict.js";
import type { CriterionResult, CriterionVotes, PhaseName, Verdict } from "./verdict.js";

// Receipt (ARCHITECTURE §8): a signed summary that pins the criteria, every artifact,
// and the event log's head and length. `verifyReceipt` checks it without calling any model.

// 0.2: a required judge that gives no vote is recorded as "missing" and makes the criterion
// inconclusive. 0.1 receipts recorded it as "n/a" and still re-verify unchanged.
// 0.3: each phase records `action_errors`; any failed browser action makes the phase inconclusive.
// Earlier receipts have no such field, so they re-verify under their own policy, unchanged.
export const RECEIPT_VERSION = "attest.receipt/0.3";

export interface CriterionRecord {
  id: string;
  votes: CriterionVotes;
  result: CriterionResult;
  reason: string;
  observation: string;
  evidence: string[];          // artifact paths (relative to the receipt)
  notes?: string[];            // human-readable explanations of the SAM / judge / check votes
}

export interface PhaseRecord {
  phase: PhaseName;
  ref: string;
  sha: string | null;
  status: string;              // verifier loop status, or "error"
  error: string | null;
  steps: number;
  model: string | null;
  prompt_sha256: string | null;
  criteria: CriterionRecord[];
  result: CriterionResult;
  reason: string;
  video?: string;              // artifact path of the phase's screen recording, when recorded
  action_errors?: string[];    // 0.3+: browser actions that could not be performed ("step N: …")
}

export interface ReceiptBody {
  version: string;
  mode: "fix";
  created_at: string;
  subject: {
    repo: string | null;
    app: string;
    refs: Partial<Record<PhaseName, { ref: string; sha: string | null }>>;
    criteria_path: string;     // artifact path of the copied criteria file
    criteria_sha256: string;
  };
  phases: PhaseRecord[];
  verdict: Verdict;
  reasons: string[];
  models: { role: string; provider: string; model: string }[];
  artifacts: Record<string, string>;   // relative path → "sha256:<hex>"
  log: { path: string; head: string; entries: number };
  /** Present only when model responses came from a recorded cassette instead of the live API. */
  replay?: { cassette: string; sha256: string };
}

export interface Receipt extends ReceiptBody {
  signature: { alg: "ed25519"; public_key: string; value: string };
}

export { keyFingerprint };

export const sha256File = (path: string): string =>
  hashArtifact(new Uint8Array(readFileSync(path)));

/** True when the judge was asked but could not vote, as opposed to a vote that was not applicable.
 *  0.2 receipts record this as "missing" (the criterion is inconclusive); 0.1 receipts recorded "n/a"
 *  with the error in the notes, and their verdict treated it as an abstention. */
export const judgeErrored = (c: CriterionRecord): boolean =>
  c.votes.judge === "missing" || (c.votes.judge === "n/a" && (c.notes ?? []).some((n) => n.startsWith("Judge could not vote")));

/** True when a judge failure was allowed to abstain (0.1 receipts), so the verdict rests on the other votes. */
export const judgeAbstained = (receipt: { phases: PhaseRecord[] }): boolean =>
  receipt.phases.some((p) => p.criteria.some((c) => c.votes.judge === "n/a" && judgeErrored(c)));

/** Loads the local Ed25519 signing key, creating it on first use. Never commit it. */
export function loadSigningKey(path = process.env.ATTEST_KEY_PATH ?? join(homedir(), ".attest", "signing-key.pem")) {
  if (!existsSync(path)) {
    const { privateKey } = generateKeyPairSync("ed25519");
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600, flag: "wx" });
  }
  return createPrivateKey(readFileSync(path));
}

export function signReceipt(body: ReceiptBody, keyPath?: string): Receipt {
  const privateKey = loadSigningKey(keyPath);
  const privateKeyPem = String(privateKey.export({ type: "pkcs8", format: "pem" }));
  return { ...body, signature: createSignature(body, privateKeyPem) };
}

export interface VerifyStep {
  check: string;
  ok: boolean;
  detail: string;
}

export interface VerifyResult {
  ok: boolean;
  verdict: Verdict | null;
  steps: VerifyStep[];
}

/** Recomputes criterion, phase and proof results from the recorded votes. */
export function recomputeVerdict(phases: PhaseRecord[]): { verdict: Verdict; mismatches: string[] } {
  const mismatches: string[] = [];
  const results: Partial<Record<PhaseName, CriterionResult>> = {};
  for (const p of phases) {
    const criteria = p.criteria.map((c) => {
      const out = combineCriterion(c.votes);
      if (out.result !== c.result) mismatches.push(`${p.phase}/${c.id}: recorded ${c.result}, votes give ${out.result}`);
      return out.result;
    });
    const phase = combinePhase(criteria, p.error ?? undefined, p.action_errors ?? []);
    if (phase.result !== p.result) mismatches.push(`${p.phase}: recorded ${p.result}, criteria give ${phase.result}`);
    results[p.phase] = phase.result;
  }
  return { verdict: fixVerdict(results).verdict, mismatches };
}

export function verifyReceipt(receiptPath: string): VerifyResult {
  let receipt: Receipt;
  try {
    // Strip a BOM (Windows editors add one); any real edit still fails the signature check.
    receipt = JSON.parse(readFileSync(receiptPath, "utf8").replace(/^﻿/, "")) as Receipt;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { ok: false, verdict: null, steps: [{ check: "read receipt", ok: false, detail }] };
  }
  const dir = dirname(resolve(receiptPath));

  const criteriaStep = (r: Receipt): VerifyStep => {
    try {
      const criteria = loadCriteria(join(dir, r.subject.criteria_path));
      const ok = criteria.sha256 === r.subject.criteria_sha256;
      return { check: "criteria", ok, detail: ok ? "criteria hash matches" : "criteria file does not match the pinned hash" };
    } catch (err) {
      return { check: "criteria", ok: false, detail: err instanceof Error ? err.message : String(err) };
    }
  };

  const result = verifyCoreReceipt(receipt, {
    dir,
    loadEvents: (absoluteLogPath) => readFileSync(absoluteLogPath, "utf8"),
    loadArtifact: (absoluteArtifactPath) => (existsSync(absoluteArtifactPath) ? new Uint8Array(readFileSync(absoluteArtifactPath)) : null),
    extraSteps: (r) => [criteriaStep(r)],
    recompute: (r) => recomputeVerdict(r.phases),
  });
  return { ok: result.ok, verdict: result.verdict, steps: result.steps };
}
