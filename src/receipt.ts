import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { loadCriteria } from "./criteria.js";
import { canonicalJson, verifyChain } from "./eventlog.js";
import { combineCriterion, combinePhase, fixVerdict } from "./verdict.js";
import type { CriterionResult, CriterionVotes, PhaseName, Verdict } from "./verdict.js";

// Receipt (ARCHITECTURE §8): a signed summary that pins the criteria, every artifact,
// and the event log's head and length. `verifyReceipt` checks it without calling any model.

export const RECEIPT_VERSION = "attest.receipt/0.1";

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

export const sha256File = (path: string): string =>
  `sha256:${createHash("sha256").update(readFileSync(path)).digest("hex")}`;

/** True when the judge was asked but could not vote (its error is recorded in the notes), as opposed to
 *  a vote that was not applicable. The verdict treats both as an abstention; the views must not. */
export const judgeErrored = (c: CriterionRecord): boolean =>
  c.votes.judge === "n/a" && (c.notes ?? []).some((n) => n.startsWith("Judge could not vote"));

/** Short identifier for a signing key. The SPKI key's first characters are a fixed Ed25519 DER header,
 *  so a prefix would be the same for every key; a hash of the whole key is not. */
export const keyFingerprint = (publicKey: string): string =>
  `sha256:${createHash("sha256").update(publicKey).digest("hex").slice(0, 16)}`;

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
  const publicKey = createPublicKey(privateKey).export({ type: "spki", format: "der" }).toString("base64");
  const value = sign(null, Buffer.from(canonicalJson(body), "utf8"), privateKey).toString("base64");
  return { ...body, signature: { alg: "ed25519", public_key: publicKey, value } };
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
    const phase = combinePhase(criteria, p.error ?? undefined);
    if (phase.result !== p.result) mismatches.push(`${p.phase}: recorded ${p.result}, criteria give ${phase.result}`);
    results[p.phase] = phase.result;
  }
  return { verdict: fixVerdict(results).verdict, mismatches };
}

export function verifyReceipt(receiptPath: string): VerifyResult {
  const steps: VerifyStep[] = [];
  const add = (check: string, ok: boolean, detail: string): void => {
    steps.push({ check, ok, detail });
  };
  const done = (verdict: Verdict | null): VerifyResult => ({ ok: steps.every((s) => s.ok), verdict, steps });

  let receipt: Receipt;
  try {
    // Strip a BOM (Windows editors add one); any real edit still fails the signature check.
    receipt = JSON.parse(readFileSync(receiptPath, "utf8").replace(/^﻿/, "")) as Receipt;
  } catch (err) {
    add("read receipt", false, err instanceof Error ? err.message : String(err));
    return done(null);
  }
  const dir = dirname(resolve(receiptPath));

  // 1. Signature over the canonical body.
  try {
    const { signature, ...body } = receipt;
    const key = createPublicKey({ key: Buffer.from(signature.public_key, "base64"), format: "der", type: "spki" });
    const ok = signature.alg === "ed25519" && verify(null, Buffer.from(canonicalJson(body), "utf8"), key, Buffer.from(signature.value, "base64"));
    add("signature", ok, ok ? "valid Ed25519 signature" : "signature does not match the receipt body");
  } catch (err) {
    add("signature", false, err instanceof Error ? err.message : String(err));
  }

  // 2. Event log: unbroken chain, and exactly the head and length the receipt pins (catches truncation).
  const chain = verifyChain(join(dir, receipt.log.path));
  if (!chain.ok) {
    add("event log", false, `chain broken at line ${chain.error?.line}: ${chain.error?.reason}`);
  } else if (chain.head !== receipt.log.head || chain.entries !== receipt.log.entries) {
    add("event log", false, `log has ${chain.entries} entries ending ${chain.head.slice(0, 19)}…, receipt pins ${receipt.log.entries} ending ${receipt.log.head.slice(0, 19)}…`);
  } else {
    add("event log", true, `${chain.entries} entries, chain intact, head matches`);
  }

  // 3. Every artifact matches its recorded hash.
  const bad: string[] = [];
  for (const [rel, expected] of Object.entries(receipt.artifacts)) {
    const path = join(dir, rel);
    if (!existsSync(path)) bad.push(`${rel} missing`);
    else if (sha256File(path) !== expected) bad.push(`${rel} changed`);
  }
  const count = Object.keys(receipt.artifacts).length;
  add("artifacts", bad.length === 0, bad.length === 0 ? `${count} artifacts match their hashes` : bad.join("; "));

  // 4. Criteria file hashes to the pinned value (same LF-normalised hash as at run time).
  try {
    const criteria = loadCriteria(join(dir, receipt.subject.criteria_path));
    const ok = criteria.sha256 === receipt.subject.criteria_sha256;
    add("criteria", ok, ok ? "criteria hash matches" : "criteria file does not match the pinned hash");
  } catch (err) {
    add("criteria", false, err instanceof Error ? err.message : String(err));
  }

  // 5. The verdict follows from the recorded votes.
  const { verdict, mismatches } = recomputeVerdict(receipt.phases);
  const ok = mismatches.length === 0 && verdict === receipt.verdict;
  add("verdict", ok, ok ? `${verdict} follows from the recorded votes` : [...mismatches, `recorded ${receipt.verdict}, votes give ${verdict}`].join("; "));

  return done(receipt.verdict);
}
