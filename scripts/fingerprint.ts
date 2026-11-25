// Replay fingerprint, copied verbatim from docs/harness/BASELINE.md. For each event it keeps
// only the fields a refactor must not change; run-specific fields (timestamps, ports, screenshot
// hashes) are ignored, which is why this is stable where log.head is not.
//
// v1 numbers events by `seq` and includes the video events. v2 (what the replay check gates on
// from P1.1) drops the `video`/`video_unavailable` events and numbers the rest by position, so it
// is identical whether or not Playwright's ffmpeg recorder is installed. v1 is kept as history.

import { createHash } from "node:crypto";

export interface ReplayEvent {
  seq: number;
  phase: string | null;
  kind: string;
  data: any;
}

const VIDEO_KINDS = new Set(["video", "video_unavailable"]);

/** Fields kept per event kind, exactly as in BASELINE.md's reference implementation. */
export function pick(e: ReplayEvent): unknown {
  const d = e.data ?? {};
  switch (e.kind) {
    case "cua_step": return { step: d.step, actions: d.actions, errors: d.errors };
    case "cua_result": return { status: d.status, verdicts: (d.verdicts ?? []).map((v: any) => [v.id, v.result]) };
    case "checks": return (d.results ?? []).map((r: any) => [r.id, r.result, (r.outcomes ?? []).map((o: any) => [o.kind, o.result])]);
    case "judge": return { model: d.model, votes: (d.votes ?? []).map((v: any) => [v.id, v.result]) };
    case "phase_result": return d.result;
    case "verdict": return d.verdict;
    case "phase_start": return d.ref;
    default: return null;
  }
}

/** v1 fingerprint line: `<verdict> · <n> events · fp:<16 hex>` (events numbered by `seq`). */
export function fingerprintV1(events: ReplayEvent[]): string {
  const lines = events.map((e) => JSON.stringify([e.seq, e.phase, e.kind, pick(e)]));
  const fp = createHash("sha256").update(lines.join("\n")).digest("hex").slice(0, 16);
  const verdict = events.find((e) => e.kind === "verdict")?.data?.verdict;
  return `${verdict} · ${events.length} events · fp:${fp}`;
}

/** v2 fingerprint line: `<verdict> · <n> events · fp2:<16 hex>` (video events dropped, numbered by position). */
export function fingerprintV2(events: ReplayEvent[]): string {
  const kept = events.filter((e) => !VIDEO_KINDS.has(e.kind));
  const lines = kept.map((e, i) => JSON.stringify([i + 1, e.phase, e.kind, pick(e)]));
  const fp = createHash("sha256").update(lines.join("\n")).digest("hex").slice(0, 16);
  const verdict = kept.find((e) => e.kind === "verdict")?.data?.verdict;
  return `${verdict} · ${kept.length} events · fp2:${fp}`;
}
