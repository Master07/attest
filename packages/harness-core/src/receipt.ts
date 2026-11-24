// Signed receipts: artifact hashing, Ed25519 signing and the generic verifier.
// The verifier checks the signature, then the event-log chain, then the artifact
// hashes. Anything proof-specific (receipt body fields, criteria, verdict policy)
// stays with the caller and plugs in through hooks: extraSteps for additional
// checks and recompute for verdict recomputation.
import { base64ToBytes, bytesToBase64, ed25519Sign, ed25519Verify, ed25519PublicKeyDerBase64, joinPath, sha256Hex, utf8Bytes } from "./adapters/node.js";
import { canonicalBytes, GENESIS, verifyChainText } from "./eventlog.js";

export interface ReceiptSignature {
  alg: "ed25519";
  public_key: string;
  value: string;
}

export interface ReceiptLogRef {
  path: string;
  head: string;
  entries: number;
}

/** The core-shaped part of a signed receipt: everything the generic verifier reads. */
export interface VerifiableReceipt<V> {
  signature: ReceiptSignature;
  log: ReceiptLogRef;
  artifacts: Record<string, string>;
  verdict: V;
}

export interface VerifyStep {
  check: string;
  ok: boolean;
  detail: string;
}

export interface VerifyResult<V> {
  ok: boolean;
  verdict: V | null;
  steps: VerifyStep[];
}

export interface VerifyReceiptDeps<R, V> {
  /** Directory the receipt's relative paths (log, artifacts) resolve against. */
  dir: string;
  /** Loads the event log at an absolute path. Throws when it cannot be read. */
  loadEvents: (absoluteLogPath: string) => string;
  /** Loads one artifact at an absolute path, or null when it is missing. */
  loadArtifact: (absoluteArtifactPath: string) => Uint8Array | null;
  /** Extra checks (for example a criteria hash) appended after artifacts, before the verdict. */
  extraSteps?: (receipt: R) => VerifyStep[];
  /** Recomputes the verdict from the recorded votes; when given, a verdict step is appended. */
  recompute?: (receipt: R) => { verdict: V; mismatches: string[] };
}

/** SHA-256 of artifact bytes, in the `sha256:<hex>` form receipts pin. */
export function hashArtifact(bytes: Uint8Array): string {
  return `sha256:${sha256Hex(bytes)}`;
}

/** Short identifier for a signing key. The SPKI key's first characters are a fixed
 *  Ed25519 DER header, so a prefix would be the same for every key; a hash of the
 *  whole key is not. */
export function keyFingerprint(publicKey: string): string {
  return `sha256:${sha256Hex(utf8Bytes(publicKey)).slice(0, 16)}`;
}

export function createSignature(body: unknown, privateKeyPem: string): ReceiptSignature {
  const public_key = ed25519PublicKeyDerBase64(privateKeyPem);
  const value = bytesToBase64(ed25519Sign(canonicalBytes(body), privateKeyPem));
  return { alg: "ed25519", public_key, value };
}

export function verifySignature(body: unknown, signature: ReceiptSignature): boolean {
  return (
    signature.alg === "ed25519" &&
    ed25519Verify(canonicalBytes(body), base64ToBytes(signature.value), signature.public_key)
  );
}

export function verifyReceipt<R extends VerifiableReceipt<V>, V>(
  receipt: R,
  deps: VerifyReceiptDeps<R, V>,
): VerifyResult<V> {
  const steps: VerifyStep[] = [];
  const add = (check: string, ok: boolean, detail: string): void => {
    steps.push({ check, ok, detail });
  };
  const done = (verdict: V | null): VerifyResult<V> => ({ ok: steps.every((s) => s.ok), verdict, steps });

  // 1. Signature over the canonical body.
  try {
    const { signature, ...body } = receipt;
    const ok = verifySignature(body, signature);
    add("signature", ok, ok ? "valid Ed25519 signature" : "signature does not match the receipt body");
  } catch (err) {
    add("signature", false, err instanceof Error ? err.message : String(err));
  }

  // 2. Event log: unbroken chain, and exactly the head and length the receipt pins (catches truncation).
  const abs = joinPath(deps.dir, receipt.log.path);
  let chain;
  try {
    chain = verifyChainText(deps.loadEvents(abs));
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    chain = { ok: false, entries: 0, head: GENESIS, error: { line: 0, reason: `cannot read ${abs}: ${reason}` } };
  }
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
    const bytes = deps.loadArtifact(joinPath(deps.dir, rel));
    if (bytes === null) bad.push(`${rel} missing`);
    else if (hashArtifact(bytes) !== expected) bad.push(`${rel} changed`);
  }
  const count = Object.keys(receipt.artifacts).length;
  add("artifacts", bad.length === 0, bad.length === 0 ? `${count} artifacts match their hashes` : bad.join("; "));

  // 4. Caller-specific checks (for example the criteria hash).
  for (const step of deps.extraSteps?.(receipt) ?? []) steps.push(step);

  // 5. The verdict follows from the recorded votes.
  if (deps.recompute !== undefined) {
    const { verdict, mismatches } = deps.recompute(receipt);
    const ok = mismatches.length === 0 && verdict === receipt.verdict;
    add("verdict", ok, ok ? `${verdict} follows from the recorded votes` : [...mismatches, `recorded ${receipt.verdict}, votes give ${verdict}`].join("; "));
  }

  return done(receipt.verdict);
}
