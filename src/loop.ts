import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadCriteria } from "./criteria.js";
import { runProducerAttempt } from "./producer.js";
import type { AttemptResult } from "./producer.js";
import { runProof } from "./proof.js";
import type { Verdict } from "./verdict.js";

// The outer loop (ARCHITECTURE §15.1): Muse Code proposes a fix, Attest proves or rejects it,
// and a rejection's evidence goes back to Muse Code. The verifier stays blind throughout.

export interface LoopOptions {
  repoRoot: string;
  appPath: string;
  base: string;
  report: string;               // the bug report, in the user's words
  maxAttempts?: number;         // default 3
  breakRef?: string;            // Break build to use when no rejected attempt exists yet
  model?: string;               // producer model, default muse-spark-1.3
  onProgress?: (message: string) => void;
}

export interface LoopAttempt {
  attempt: number;
  producer: AttemptResult;
  breakRef: string | null;
  verdict: Verdict | null;
  receipt: string | null;
}

export interface LoopResult {
  dir: string;
  outcome: "proven" | "rejected" | "needs_human" | "producer_error";
  attempts: LoopAttempt[];
}

function producerPrompt(appPath: string, report: string, feedback: string | null): string {
  const lines = [
    `You are fixing a bug in the web app in ${appPath} (a small Node app; start it with \`npm start\` in that directory).`,
    "",
    `Bug report from a customer: "${report}"`,
    "",
    `Fix the bug by changing files in ${appPath} only, and add or update a unit test (node:test, run with \`npm test\` in ${appPath}). Keep the change small. When done, reply with a one-paragraph summary of the root cause and the fix.`,
    "You are running headless: you cannot open a browser, and nobody can approve commands. Do not start servers or other long-running processes; read the code and run the unit tests instead.",
  ];
  if (feedback !== null) lines.push("", feedback);
  return lines.join("\n");
}

export async function runLoop(opts: LoopOptions): Promise<LoopResult> {
  const repoRoot = resolve(opts.repoRoot);
  const stamp = Date.now();
  const dir = join(repoRoot, "evidence", `loop-${stamp}`);
  mkdirSync(dir, { recursive: true });
  const progress = opts.onProgress ?? (() => undefined);
  const criteria = loadCriteria(join(repoRoot, opts.appPath, "criteria.yml"));

  const attempts: LoopAttempt[] = [];
  let feedback: string | null = null;
  let images: string[] = [];
  let lastRejected: string | null = null;
  let outcome: LoopResult["outcome"] = "rejected";

  for (let n = 1; n <= (opts.maxAttempts ?? 3); n++) {
    const branch = `attest/loop-${stamp}-attempt-${n}`;
    progress(`attempt ${n}: Muse Code is writing a fix`);
    const producer = await runProducerAttempt({
      repoRoot, appPath: opts.appPath, base: opts.base, branch,
      prompt: producerPrompt(opts.appPath, opts.report, feedback),
      images, model: opts.model ?? "muse-spark-1.3", maxSteps: 40,
      logFile: join(dir, `attempt-${n}.muse.jsonl`),
    });
    const record: LoopAttempt = { attempt: n, producer, breakRef: null, verdict: null, receipt: null };
    attempts.push(record);

    if (producer.error !== null) {
      progress(`attempt ${n}: producer error — ${producer.error}`);
      outcome = "producer_error";
      break;
    }
    progress(`attempt ${n}: changed ${producer.changed.join(", ")}`);

    // A previously rejected attempt is the most honest Break build: a real wrong fix.
    record.breakRef = lastRejected ?? opts.breakRef ?? null;
    const proof = await runProof({
      repoRoot, appPath: opts.appPath, base: opts.base, pr: branch,
      ...(record.breakRef !== null ? { break: record.breakRef } : {}),
      outDir: join(dir, `attempt-${n}`),
      onProgress: (m) => progress(`attempt ${n}: ${m}`),
    });
    record.verdict = proof.receipt.verdict;
    record.receipt = proof.receiptPath;
    progress(`attempt ${n}: ${proof.receipt.verdict}`);

    if (proof.receipt.verdict === "PROVEN" || proof.receipt.verdict === "PROVEN_UNCHECKED") {
      outcome = "proven";
      break;
    }
    if (proof.receipt.verdict === "INCONCLUSIVE") {
      outcome = "needs_human";
      break;
    }

    // REJECTED: tell the producer what a user would see — never the verifier's prompt or checks.
    const green = proof.receipt.phases.find((p) => p.phase === "green");
    const failed = (green?.criteria ?? []).filter((c) => c.result !== "pass");
    feedback = [
      "Your previous fix was rejected: an independent check drove the running app like a user and the requirement still is not met.",
      ...failed.map((c) => {
        const crit = criteria.criteria.find((x) => x.id === c.id);
        return `- Requirement: given ${crit?.given}, when ${crit?.when}, then ${crit?.then}.\n  What the user saw: ${c.observation || "the expected outcome did not appear."}`;
      }),
      "A screenshot of what the user saw is attached. Unit tests passing is not enough; the fix must work in the running app.",
    ].join("\n");
    images = failed.flatMap((c) => c.evidence.map((e) => join(proof.dir, e)));
    lastRejected = branch;
  }

  writeFileSync(join(dir, "loop.json"), `${JSON.stringify({ base: opts.base, report: opts.report, outcome, attempts }, null, 2)}\n`);
  return { dir, outcome, attempts };
}
