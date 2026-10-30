import type { Attestation, DiffSummary, LogEntry, Task, VerificationResult } from "./types.js";

function diffFromLog(log: readonly LogEntry[]): DiffSummary {
  let added = 0;
  let removed = 0;
  let filesChanged = 0;
  for (const entry of log) {
    if (entry.event.kind !== "tool_call" || entry.event.tool !== "edit_file") continue;
    filesChanged += 1;
    added += entry.event.result?.added ?? 0;
    removed += entry.event.result?.removed ?? 0;
  }
  return { filesChanged, added, removed };
}

export function buildAttestation(
  workItemId: string,
  _tasks: Task[],
  results: VerificationResult[],
  log: readonly LogEntry[],
): Attestation {
  const verified = results.length > 0 && results.every((r) => r.passed);
  return {
    workItemId,
    diff: diffFromLog(log),
    traceEvents: log.length,
    video: `evidence/${workItemId}/before-after.mp4`,
    verdict: verified ? "verified" : "rejected",
  };
}
