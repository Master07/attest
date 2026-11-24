// Unit tests for the replay fingerprint (scripts/fingerprint.ts), using small synthetic event
// lists and no browser. v1 and v2 must match BASELINE.md's reference implementations exactly;
// v2 must be stable across video-event placement (it drops video events and numbers by position)
// and must change when a non-video field the fingerprint watches changes.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { fingerprintV1, fingerprintV2, type ReplayEvent } from "../scripts/fingerprint.js";

type Event = { seq: number; phase: string | null; kind: string; data: any };

function baseEvents(): Event[] {
  return [
    { seq: 1, phase: "red", kind: "phase_start", data: { ref: "base-sha" } },
    { seq: 2, phase: "red", kind: "cua_step", data: { step: 1, actions: [{ type: "click", coordinate: [120, 80] }], errors: [] } },
    { seq: 3, phase: "red", kind: "cua_result", data: { status: "completed", verdicts: [{ id: "c-1", result: "fail" }] } },
    { seq: 4, phase: "red", kind: "checks", data: { results: [{ id: "url", result: "fail", outcomes: [{ kind: "url", result: "fail" }] }] } },
    { seq: 5, phase: "red", kind: "judge", data: { model: "judge-model", votes: [{ id: "c-1", result: "fail" }] } },
    { seq: 6, phase: "red", kind: "phase_result", data: { result: "fail" } },
    { seq: 7, phase: "green", kind: "phase_start", data: { ref: "pr-sha" } },
    { seq: 8, phase: "green", kind: "cua_step", data: { step: 1, actions: [{ type: "click", coordinate: [120, 80] }], errors: [] } },
    { seq: 9, phase: "green", kind: "cua_result", data: { status: "completed", verdicts: [{ id: "c-1", result: "pass" }] } },
    { seq: 10, phase: "green", kind: "checks", data: { results: [{ id: "url", result: "pass", outcomes: [{ kind: "url", result: "pass" }] }] } },
    { seq: 11, phase: "green", kind: "judge", data: { model: "judge-model", votes: [{ id: "c-1", result: "pass" }] } },
    { seq: 12, phase: "green", kind: "phase_result", data: { result: "pass" } },
    { seq: 13, phase: null, kind: "verdict", data: { verdict: "PROVEN" } },
  ];
}

// Reference implementations, copied verbatim from docs/harness/BASELINE.md.
function refPick(e: Event): unknown {
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

function refV1(events: Event[]): string {
  const lines = events.map((e) => JSON.stringify([e.seq, e.phase, e.kind, refPick(e)]));
  const fp = createHash("sha256").update(lines.join("\n")).digest("hex").slice(0, 16);
  const verdict = events.find((e) => e.kind === "verdict")?.data?.verdict;
  return `${verdict} · ${events.length} events · fp:${fp}`;
}

function refV2(events: Event[]): string {
  const VIDEO = new Set(["video", "video_unavailable"]);
  const kept = events.filter((e) => !VIDEO.has(e.kind));
  const lines = kept.map((e, i) => JSON.stringify([i + 1, e.phase, e.kind, refPick(e)]));
  const fp = createHash("sha256").update(lines.join("\n")).digest("hex").slice(0, 16);
  const verdict = kept.find((e) => e.kind === "verdict")?.data?.verdict;
  return `${verdict} · ${kept.length} events · fp2:${fp}`;
}

function clone(events: Event[]): Event[] {
  return JSON.parse(JSON.stringify(events)) as Event[];
}

function withVideoAtEnd(events: Event[]): Event[] {
  const out = clone(events);
  const red = out.findIndex((e) => e.kind === "phase_result" && e.phase === "red");
  out.splice(red + 1, 0, { seq: 100, phase: "red", kind: "video", data: { path: "red.webm" } });
  const green = out.findIndex((e) => e.kind === "phase_result" && e.phase === "green");
  out.splice(green + 1, 0, { seq: 101, phase: "green", kind: "video", data: { path: "green.webm" } });
  return out;
}

function withVideoUnavailableAtStart(events: Event[]): Event[] {
  const out = clone(events);
  const redStart = out.findIndex((e) => e.kind === "phase_start" && e.phase === "red");
  out.splice(redStart + 1, 0, { seq: 100, phase: "red", kind: "video_unavailable", data: {} });
  const greenStart = out.findIndex((e) => e.kind === "phase_start" && e.phase === "green");
  out.splice(greenStart + 1, 0, { seq: 101, phase: "green", kind: "video_unavailable", data: {} });
  return out;
}

test("v1 and v2 match BASELINE.md's reference implementations", () => {
  const cases: Event[][] = [
    baseEvents(),
    withVideoAtEnd(baseEvents()),
    withVideoUnavailableAtStart(baseEvents()),
  ];
  for (const events of cases) {
    assert.equal(fingerprintV1(events as ReplayEvent[]), refV1(events), `v1 mismatch for ${events.length} events`);
    assert.equal(fingerprintV2(events as ReplayEvent[]), refV2(events), `v2 mismatch for ${events.length} events`);
  }
});

test("v2 is the same with video at the end of each phase, video_unavailable at the start, and no video events", () => {
  const base = fingerprintV2(baseEvents() as ReplayEvent[]);
  assert.equal(fingerprintV2(withVideoAtEnd(baseEvents()) as ReplayEvent[]), base, "video at end changed v2");
  assert.equal(fingerprintV2(withVideoUnavailableAtStart(baseEvents()) as ReplayEvent[]), base, "video_unavailable at start changed v2");
});

test("v2 changes when a click coordinate changes", () => {
  const changed = clone(baseEvents());
  changed[1]!.data.actions[0].coordinate = [200, 80];
  assert.notEqual(fingerprintV2(changed as ReplayEvent[]), fingerprintV2(baseEvents() as ReplayEvent[]));
});

test("v2 changes when a check result changes", () => {
  const changed = clone(baseEvents());
  changed[3]!.data.results[0].result = "pass";
  assert.notEqual(fingerprintV2(changed as ReplayEvent[]), fingerprintV2(baseEvents() as ReplayEvent[]));
});

test("v2 changes when a judge vote changes", () => {
  const changed = clone(baseEvents());
  changed[4]!.data.votes[0].result = "pass";
  assert.notEqual(fingerprintV2(changed as ReplayEvent[]), fingerprintV2(baseEvents() as ReplayEvent[]));
});

test("v2 changes when the verdict changes", () => {
  const changed = clone(baseEvents());
  changed[12]!.data.verdict = "REJECTED";
  assert.notEqual(fingerprintV2(changed as ReplayEvent[]), fingerprintV2(baseEvents() as ReplayEvent[]));
});

test("v2 changes when the non-video event order changes", () => {
  const changed = clone(baseEvents());
  const step = changed[1]!;
  changed[1] = changed[2]!;
  changed[2] = step;
  assert.notEqual(fingerprintV2(changed as ReplayEvent[]), fingerprintV2(baseEvents() as ReplayEvent[]));
});
