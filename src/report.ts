import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { loadCriteria } from "./criteria.js";
import type { CriterionRecord, PhaseRecord, Receipt } from "./receipt.js";
import { inconclusiveCauses } from "./causes.js";
import { judgeAbstained, judgeErrored, keyFingerprint } from "./receipt.js";
import type { Vote } from "./verdict.js";

// Evidence page: a self-contained index.html rendered from receipt.json (no scripts, no network).
// It is a view, not evidence — it is written after signing and is not covered by the receipt.

const esc = (s: unknown): string => String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const short = (sha: string | null | undefined, n = 7): string => (sha ? sha.replace(/^sha256:/, "").slice(0, n) : "—");
/** A shortened value with the full value in a tooltip, for hashes and keys. */
const abbr = (full: string | null | undefined, n: number): string =>
  full ? `<span class="mono" title="${esc(full)}">${esc(short(full, n))}…</span>` : `<span class="mono">—</span>`;

const PHASES: Record<string, { title: string; role: string; expected: "fail" | "pass" }> = {
  red: { title: "Red", role: "Original code — the bug should reproduce", expected: "fail" },
  green: { title: "Green", role: "The fix — the criteria should pass", expected: "pass" },
  break: { title: "Break", role: "A wrong fix — Attest should reject it", expected: "fail" },
};

const VERDICT_TEXT: Record<string, { cls: string; word: string; line: string }> = {
  PROVEN: { cls: "ok", word: "Proven", line: "The bug reproduced, the fix works in the running app, and a wrong fix was rejected." },
  PROVEN_UNCHECKED: { cls: "warn", word: "Proven, unchecked", line: "The bug reproduced and the fix works. No wrong fix was supplied, so the verifier's sensitivity is unchecked." },
  REJECTED: { cls: "bad", word: "Rejected", line: "The fix does not meet the criteria in the running app." },
  INCONCLUSIVE: { cls: "warn", word: "Inconclusive", line: "Attest could not establish a proof, so it certifies nothing." },
};

const MODEL_NAMES: Record<string, string> = {
  "muse-spark-1.3": "Muse Spark 1.3",
  "muse-spark-1.3-contributor": "Muse Spark 1.3",
  "muse-wonder-1.0": "Muse Wonder",
  "meta-models/muse-spark-open": "Muse Spark Open",
  "meta-models/muse-spark-open-1026": "Muse Spark Open",
  "sam-3.1": "SAM 3.1",
};
const modelName = (id: string): string => MODEL_NAMES[id] ?? id;
const providerName = (p: string): string => (p === "baseten" ? "Baseten" : p === "meta" ? "Meta Model API" : p);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "1 Nov 2026, 00:22 UTC" from an ISO timestamp, independent of the machine's locale and time zone. */
function readableUtc(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

interface VoterLabels { verifier: string; ui: string; judge: string }

function voterLabels(receipt: Receipt): VoterLabels {
  const by = (role: string): string | undefined => {
    const m = receipt.models.find((x) => x.role === role);
    return m ? modelName(m.model) : undefined;
  };
  return {
    verifier: `Verifier · ${by("verifier") ?? "computer use"}`,
    ui: by("ui") ? `Element check · ${by("ui")}` : "Element check",
    judge: by("judge") ? `Judge · ${by("judge")}` : "Judge",
  };
}

const VOTE_TEXT: Record<string, { cls: string; mark: string; text: string }> = {
  pass: { cls: "v-pass", mark: "✓", text: "pass" },
  fail: { cls: "v-fail", mark: "✗", text: "fail" },
  "n/a": { cls: "v-na", mark: "–", text: "not applicable" },
  missing: { cls: "v-missing", mark: "!", text: "no vote — error" },
};

function causesBlock(receipt: Receipt): string {
  const causes = inconclusiveCauses(receipt);
  if (causes.length === 0) return "";
  const items = causes.map((c) => `<li><b>${esc(c.title)}</b> · <span class="mono">${esc(c.detail)}</span><br><span class="sub">Next: ${esc(c.next)}</span></li>`).join("");
  return `<div class="replay"><b>Why it's inconclusive</b><ul class="reasons">${items}</ul></div>`;
}

function voteCell(label: string, vote: Vote | "missing"): string {
  const v = VOTE_TEXT[vote] ?? { cls: "v-na", mark: "–", text: String(vote) };
  return `<div class="vote ${v.cls}"><span class="vl">${esc(label)}</span><span class="vv"><span class="mark" aria-hidden="true">${v.mark}</span>${esc(v.text)}</span></div>`;
}

function criterionBlock(c: CriterionRecord, labels: VoterLabels, showId: boolean): string {
  const images = c.evidence
    .map((e) => `<figure><a href="${esc(e)}"><img src="${esc(e)}" alt="${esc(e)}" loading="lazy"></a><figcaption>${esc(e.includes("reveal") ? "SAM 3.1 box + where the click landed" : "Screenshot the verifier cited")}</figcaption></figure>`)
    .join("");
  const notes = (c.notes ?? []).map((n) => `<li>${esc(n)}</li>`).join("");
  return `
    <div class="crit-result">
      ${showId ? `<div class="crit-id mono">${esc(c.id)}</div>` : ""}
      <div class="votes" role="list">
        ${voteCell(labels.verifier, c.votes.cua)}
        ${voteCell("Code checks", c.votes.checks)}
        ${voteCell(labels.ui, c.votes.sam)}
        ${voteCell(labels.judge, judgeErrored(c) ? "missing" : c.votes.judge)}
      </div>
      ${c.observation ? `<blockquote class="obs"><span class="k">Verifier saw</span>${esc(c.observation)}</blockquote>` : ""}
      ${notes ? `<div class="notes"><span class="k">Other voters</span><ul>${notes}</ul></div>` : ""}
      ${images ? `<div class="shots">${images}</div>` : ""}
    </div>`;
}

// ---- Timeline: rebuilt from the hash-chained event log next to the receipt ----

interface LogLine { phase: string | null; kind: string; data: Record<string, unknown> }
interface ClickHit { x: number; y: number; target: string | null; interactive: boolean }

export interface TimelineStep {
  step: number;
  actions: string[];       // human-readable, e.g. "click (957, 426) → div#hb-root (covers the page)"
  screenshot: string | null;
  errors: string[];
}

function describeAction(a: Record<string, unknown>, nextClick: () => ClickHit | undefined): string {
  const xy = `(${String(a["x"])}, ${String(a["y"])})`;
  switch (a["type"]) {
    case "click":
    case "double_click": {
      const hit = nextClick();
      const verb = a["type"] === "click" ? "click" : "double-click";
      if (hit === undefined) return `${verb} ${xy}`;
      return `${verb} ${xy} → landed on ${hit.target ?? "nothing"}${hit.interactive ? "" : " (not a control)"}`;
    }
    case "type": return `type "${String(a["text"] ?? "")}"`;
    case "keypress": return `press ${Array.isArray(a["keys"]) ? (a["keys"] as unknown[]).join("+") : ""}`;
    case "scroll": return `scroll ${xy} by (${String(a["scroll_x"])}, ${String(a["scroll_y"])})`;
    case "move": return `move to ${xy}`;
    case "drag": return "drag";
    case "wait": return "wait";
    case "screenshot": return "look at the screen";
    default: return String(a["type"] ?? "action");
  }
}

/** Pure: the verifier's steps for one phase, from parsed event-log lines. */
export function buildTimeline(lines: LogLine[], phase: string): TimelineStep[] {
  const mine = lines.filter((l) => l.phase === phase);
  const shots = new Map<number, string>();
  for (const l of mine) if (l.kind === "screenshot") shots.set(Number(l.data["step"]), String(l.data["file"]));
  const clicks = (mine.find((l) => l.kind === "clicks")?.data["clicks"] as ClickHit[] | undefined) ?? [];
  let clickIndex = 0;
  const nextClick = (): ClickHit | undefined => clicks[clickIndex++];

  const steps: TimelineStep[] = [{ step: 0, actions: ["open the app"], screenshot: shots.get(0) ?? null, errors: [] }];
  for (const l of mine.filter((x) => x.kind === "cua_step")) {
    const n = Number(l.data["step"]);
    const actions = ((l.data["actions"] as Record<string, unknown>[] | undefined) ?? []).map((a) => describeAction(a, nextClick));
    steps.push({ step: n, actions, screenshot: shots.get(n) ?? null, errors: (l.data["errors"] as string[] | undefined) ?? [] });
  }
  return steps;
}

function readLog(receiptDir: string, receipt: Receipt): LogLine[] {
  try {
    return readFileSync(join(receiptDir, receipt.log.path), "utf8")
      .split(/\r?\n/)
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l) as LogLine);
  } catch {
    return [];
  }
}

function timelineBlock(steps: TimelineStep[]): string {
  if (steps.length <= 1) return "";
  const items = steps
    .map((s) => `<li><span class="stepn">${s.step}</span><div class="stepbody">${s.actions.map((a) => `<div>${esc(a)}</div>`).join("")}${s.errors.map((e) => `<div class="err">${esc(e)}</div>`).join("")}</div>${s.screenshot ? `<a class="stepshot" href="${esc(s.screenshot)}"><img src="${esc(s.screenshot)}" alt="step ${s.step}" loading="lazy"></a>` : ""}</li>`)
    .join("");
  return `<details class="timeline" open><summary>What the verifier did, step by step <span class="count">${steps.length - 1} ${steps.length === 2 ? "step" : "steps"}</span></summary><ol>${items}</ol></details>`;
}

function phaseOutcome(p: PhaseRecord): { meta: { title: string; role: string; expected: "fail" | "pass" }; match: boolean } {
  const meta = PHASES[p.phase] ?? { title: p.phase, role: "", expected: "fail" as const };
  return { meta, match: p.result === meta.expected };
}

const matchText = (p: PhaseRecord, match: boolean): string =>
  match ? "✓ as expected" : p.result === "inconclusive" ? "! inconclusive" : "✗ not as expected";

function phaseTile(p: PhaseRecord): string {
  const { meta, match } = phaseOutcome(p);
  const cls = match ? "ok" : p.result === "inconclusive" ? "warn" : "bad";
  return `<a class="tile" href="#phase-${esc(p.phase)}"><span class="tile-name">${esc(meta.title)}</span><span class="tile-role">${esc(meta.role.split(" — ")[0] ?? "")}</span><span class="tile-io">expects <b>${esc(meta.expected)}</b> · observed <b>${esc(p.result)}</b></span><span class="tile-match ${cls}">${matchText(p, match)}</span></a>`;
}

function phaseSection(p: PhaseRecord, lines: LogLine[], labels: VoterLabels): string {
  const { meta, match } = phaseOutcome(p);
  const cls = match ? "ok" : p.result === "inconclusive" ? "warn" : "bad";
  return `
  <section class="phase" id="phase-${esc(p.phase)}">
    <header class="phase-head">
      <div>
        <h3>${esc(meta.title)} <span class="role">· ${esc(meta.role)}</span></h3>
        <div class="ref mono" title="${esc(p.sha ?? "")}">${esc(p.ref)} @ ${esc(short(p.sha))}</div>
      </div>
      <div class="outcome">
        <span class="io">expected <b>${esc(meta.expected)}</b> · observed <b>${esc(p.result)}</b></span>
        <span class="pill ${cls}">${matchText(p, match)}</span>
      </div>
    </header>
    ${p.error ? `<p class="phase-error"><b>Phase error.</b> ${esc(p.error)}</p>` : ""}
    ${p.criteria.map((c) => criterionBlock(c, labels, p.criteria.length > 1)).join("")}
    ${p.video ? `<figure class="video"><video src="${esc(p.video)}" controls muted preload="metadata"></video><figcaption>Screen recording of this phase · <span class="mono">${esc(p.video)}</span></figcaption></figure>` : ""}
    ${timelineBlock(buildTimeline(lines, p.phase))}
    <p class="meta-line">${esc(p.steps)} verifier ${p.steps === 1 ? "step" : "steps"} · ${esc(p.model ? modelName(p.model) : "—")} · prompt <span class="mono" title="${esc(p.prompt_sha256 ?? "")}">${esc(short(p.prompt_sha256, 12))}</span></p>
  </section>`;
}

const LOGO = `<svg class="logo" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5 4 5.6v6.1c0 4.8 3.3 8.6 8 9.8 4.7-1.2 8-5 8-9.8V5.6L12 2.5Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="m8.6 12.2 2.4 2.4 4.6-4.9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/** One design for the evidence page and the proofs dashboard: light, dark and print. */
const STYLE = `:root{--bg:#f6f6f3;--surface:#ffffff;--surface-2:#f1f1ed;--ink:#15171c;--ink-2:#3a3e46;--muted:#686d77;--faint:#959aa4;--line:#e3e3dd;--line-2:#d3d3cc;
--accent:#245b57;--ok:#1d6b47;--ok-bg:#e7f2eb;--ok-line:#bcdcc8;--bad:#b02a1f;--bad-bg:#fcebe8;--bad-line:#efc3bd;--warn:#875700;--warn-bg:#faf0dc;--warn-line:#ead6a8;
--code-bg:#1b1e24;--code-ink:#e6e8ec;
--sans:"Segoe UI Variable Text","Segoe UI",-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif;
--mono:"Cascadia Mono","SF Mono",ui-monospace,Menlo,Consolas,monospace}
@media (prefers-color-scheme:dark){:root{--bg:#0e1014;--surface:#161920;--surface-2:#1c2028;--ink:#e8eaee;--ink-2:#c3c7cf;--muted:#929aa6;--faint:#6c7380;--line:#252a33;--line-2:#323844;
--accent:#83c9c1;--ok:#62c793;--ok-bg:#11251b;--ok-line:#22533a;--bad:#f2928a;--bad-bg:#2b1513;--bad-line:#5b2924;--warn:#e9b75e;--warn-bg:#2a2110;--warn-line:#5a4520;--code-bg:#0a0c10}}
*{box-sizing:border-box}
html{scroll-behavior:smooth;scroll-padding-top:64px}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.6 var(--sans);font-variant-numeric:tabular-nums;-webkit-font-smoothing:antialiased}
a{color:var(--accent)}
.mono{font-family:var(--mono);font-size:.88em}
.wrap{max-width:1120px;margin:0 auto;padding:0 24px}
.top{background:var(--surface);border-bottom:1px solid var(--line)}
.top .wrap{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:60px;flex-wrap:wrap;padding-top:10px;padding-bottom:10px}
.brand{display:flex;align-items:center;gap:10px;font-weight:600;letter-spacing:.01em}
.brand .logo{width:22px;height:22px;color:var(--ink)}
.brand .sub{font-weight:400;color:var(--muted)}
.top-meta{display:flex;align-items:center;gap:12px;color:var(--muted);font-size:13px}
.stamp{display:inline-block;border:1px solid currentColor;border-radius:6px;padding:3px 9px;font:600 11.5px var(--mono);letter-spacing:.08em}
.stamp.ok{color:var(--ok);background:var(--ok-bg);border-color:var(--ok-line)}.stamp.bad{color:var(--bad);background:var(--bad-bg);border-color:var(--bad-line)}.stamp.warn{color:var(--warn);background:var(--warn-bg);border-color:var(--warn-line)}
.toc{position:sticky;top:0;z-index:5;background:var(--bg);border-bottom:1px solid var(--line)}
.toc .wrap{display:flex;gap:4px;overflow-x:auto;padding-top:8px;padding-bottom:8px}
.toc a{color:var(--ink-2);text-decoration:none;font-size:13px;padding:5px 10px;border-radius:6px;white-space:nowrap}
.toc a:hover{background:var(--surface-2)}
main.wrap{padding-top:28px;padding-bottom:48px}
h2{font-size:12px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;color:var(--muted);margin:36px 0 12px}
.card{background:var(--surface);border:1px solid var(--line);border-radius:12px}
.replay{margin:0 0 16px;padding:12px 16px;border:1px solid var(--warn-line);background:var(--warn-bg);color:var(--ink);border-radius:10px;font-size:14px}
.summary{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(0,1fr);gap:16px}
.verdict{padding:22px 24px}
.label{font-size:12.5px;color:var(--muted)}
.vrow{display:flex;align-items:center;flex-wrap:wrap;gap:12px;margin:4px 0 8px}
.vword{font-size:30px;font-weight:600;letter-spacing:-.01em;line-height:1.2}
.vword.ok{color:var(--ok)}.vword.bad{color:var(--bad)}.vword.warn{color:var(--warn)}
.chip{font-size:12.5px;padding:3px 10px;border-radius:999px;background:var(--surface-2);color:var(--ink-2);border:1px solid var(--line)}
.lede{margin:0 0 6px;color:var(--ink-2);font-size:16px}
.reasons{margin:0 0 16px;padding-left:18px;color:var(--muted);font-size:13.5px}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.tile{display:flex;flex-direction:column;gap:2px;padding:12px 14px;border:1px solid var(--line);border-radius:10px;background:var(--surface-2);color:var(--ink);text-decoration:none}
.tile:hover{border-color:var(--line-2)}
.tile-name{font-weight:600}.tile-role{font-size:12.5px;color:var(--muted)}.tile-io{font-size:12.5px;color:var(--ink-2);margin-top:6px}
.tile-match{font-size:12.5px;font-weight:600;margin-top:2px}.tile-match.ok{color:var(--ok)}.tile-match.bad{color:var(--bad)}.tile-match.warn{color:var(--warn)}
.integrity{padding:20px 22px}
.integrity h3{margin:0 0 12px;font-size:14px;font-weight:600;display:flex;align-items:center;gap:8px}
.kv{display:grid;grid-template-columns:max-content minmax(0,1fr);gap:7px 14px;margin:0;font-size:13.5px}
.kv dt{color:var(--muted)}.kv dd{margin:0;min-width:0;overflow-wrap:anywhere}
.cmd{margin:14px 0 0;background:var(--code-bg);color:var(--code-ink);border-radius:8px;padding:10px 12px;font:12.5px/1.5 var(--mono);overflow-x:auto;white-space:pre}
.panel{padding:18px 22px}
.sub{color:var(--muted);font-size:12.5px}
.badge{display:inline-block;font-size:11px;font-weight:600;letter-spacing:.03em;padding:1px 7px;border-radius:999px;background:var(--ok-bg);color:var(--ok);border:1px solid var(--ok-line);vertical-align:1px}
.subject{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px}
.crit-list{list-style:none;margin:0;padding:0;display:grid;gap:10px}
.crit-card{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:16px 20px}
.crit-id{color:var(--muted);margin-bottom:6px}
.gwt{display:grid;grid-template-columns:max-content minmax(0,1fr);gap:8px 16px;margin:0}
.gwt dt{font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);padding-top:2px}
.gwt dd{margin:0}
.phase{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:20px 22px;margin-bottom:16px}
.phase-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;padding-bottom:14px;border-bottom:1px solid var(--line);margin-bottom:16px}
.phase-head h3{margin:0;font-size:18px;font-weight:600}
.phase-head .role{font-weight:400;color:var(--muted);font-size:15px}
.ref{color:var(--muted);margin-top:4px}
.outcome{display:flex;flex-direction:column;align-items:flex-end;gap:6px}
.io{font-size:13px;color:var(--ink-2)}
.pill{font-size:12.5px;font-weight:600;padding:3px 10px;border-radius:999px;border:1px solid}
.pill.ok{color:var(--ok);background:var(--ok-bg);border-color:var(--ok-line)}.pill.bad{color:var(--bad);background:var(--bad-bg);border-color:var(--bad-line)}.pill.warn{color:var(--warn);background:var(--warn-bg);border-color:var(--warn-line)}
.phase-error{margin:0 0 14px;padding:10px 14px;border-radius:8px;background:var(--bad-bg);border:1px solid var(--bad-line);font-size:14px}
.crit-result+.crit-result{margin-top:18px;padding-top:18px;border-top:1px dashed var(--line)}
.votes{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:14px}
.vote{border:1px solid var(--line);border-radius:8px;padding:9px 12px;display:flex;flex-direction:column;gap:2px;min-width:0}
.vote .vl{font-size:12px;color:var(--muted);overflow-wrap:anywhere}
.vote .vv{font-weight:600;font-size:14px;display:flex;gap:6px;align-items:baseline}
.v-pass .vv{color:var(--ok)}.v-fail .vv{color:var(--bad)}.v-na .vv{color:var(--faint);font-weight:400}.v-missing{border-color:var(--warn-line);background:var(--warn-bg)}.v-missing .vv{color:var(--warn)}
.obs{margin:0 0 12px;padding:2px 0 2px 14px;border-left:3px solid var(--line-2);font-size:15px;color:var(--ink)}
.k{display:block;font-size:11.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin-bottom:2px}
.notes{margin:0 0 14px;font-size:13.5px;color:var(--ink-2)}.notes ul{margin:2px 0 0;padding-left:18px}.notes li+li{margin-top:4px}
.shots{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;margin-bottom:6px}.shots figure:only-child{max-width:760px}
figure{margin:0;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:var(--surface-2)}
figure img{display:block;width:100%;height:auto}
figcaption{font-size:12px;color:var(--muted);padding:8px 12px;border-top:1px solid var(--line);background:var(--surface)}
.video{margin-top:14px}.video video{display:block;width:100%;background:#000}
.timeline{margin-top:14px;border:1px solid var(--line);border-radius:10px;background:var(--surface)}
.timeline summary{cursor:pointer;padding:10px 14px;font-size:13.5px;font-weight:600;color:var(--ink-2);display:flex;justify-content:space-between;gap:12px}
.timeline .count{font-weight:400;color:var(--muted)}
.timeline ol{list-style:none;margin:0;padding:4px 14px 10px}
.timeline li{display:grid;grid-template-columns:30px minmax(0,1fr) 168px;gap:14px;align-items:start;padding:10px 0;border-top:1px solid var(--line);position:relative}
.timeline .stepn{width:24px;height:24px;border-radius:50%;border:1px solid var(--line-2);display:flex;align-items:center;justify-content:center;font:600 11.5px var(--mono);color:var(--muted);background:var(--surface-2)}
.timeline .stepbody{font:12.5px/1.55 var(--mono);color:var(--ink-2);min-width:0;overflow-wrap:anywhere}
.timeline .err{color:var(--bad)}
.stepshot img{width:168px;display:block;border:1px solid var(--line);border-radius:6px}
.meta-line{margin:12px 0 0;font-size:12.5px;color:var(--faint)}
.verify{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px}
.verify ul{margin:6px 0 0;padding-left:18px;font-size:14px}.verify li+li{margin-top:4px}
.verify h3{margin:0;font-size:14px;font-weight:600}
footer{border-top:1px solid var(--line);margin-top:40px;padding:18px 0 40px;color:var(--faint);font-size:12.5px}
.tablewrap{overflow-x:auto}.ptable{width:100%;min-width:900px;table-layout:fixed;border-collapse:collapse;font-size:13.5px}.ptable .stamp,.ptable .pill,.ptable .nw{white-space:nowrap}.ptable td a{overflow-wrap:anywhere}.ptable th{text-align:left;font-size:12px;font-weight:600;color:var(--muted);padding:10px 14px;border-bottom:1px solid var(--line);white-space:nowrap}.ptable td{padding:10px 14px;border-bottom:1px solid var(--line);vertical-align:top}.ptable tr:last-child td{border-bottom:0}.phs{white-space:nowrap}.ph{display:inline-block;font-size:12px;padding:1px 7px;border-radius:999px;border:1px solid;margin-right:4px}.ph.ok{color:var(--ok);background:var(--ok-bg);border-color:var(--ok-line)}.ph.bad{color:var(--bad);background:var(--bad-bg);border-color:var(--bad-line)}.ph.warn{color:var(--warn);background:var(--warn-bg);border-color:var(--warn-line)}
@media (max-width:820px){.summary,.subject,.verify{grid-template-columns:minmax(0,1fr)}.votes{grid-template-columns:repeat(2,minmax(0,1fr))}.outcome{align-items:flex-start}
.timeline li{grid-template-columns:30px minmax(0,1fr)}.stepshot{grid-column:2}.stepshot img{width:100%}.vword{font-size:26px}.wrap{padding:0 16px}}
@media print{.toc,.video video{display:none}body{background:#fff;font-size:12px}.card,.phase,.crit-card,.timeline{break-inside:avoid;border-color:#ccc}main{padding:0}.top{border:0}.cmd{background:#f3f3f3;color:#111}a{color:inherit;text-decoration:none}}
`;

export function renderReport(receipt: Receipt, receiptDir: string): string {
  let criteriaHtml = "";
  try {
    const criteria = loadCriteria(join(receiptDir, receipt.subject.criteria_path));
    criteriaHtml = criteria.criteria
      .map((c) => `<li class="crit-card">${criteria.criteria.length > 1 ? `<div class="crit-id mono">${esc(c.id)}</div>` : ""}<dl class="gwt"><dt>Given</dt><dd>${esc(c.given)}</dd><dt>When</dt><dd>${esc(c.when)}</dd><dt>Then</dt><dd>${esc(c.then)}</dd></dl></li>`)
      .join("");
  } catch {
    criteriaHtml = `<li class="crit-card">Criteria file unavailable.</li>`;
  }
  const v = VERDICT_TEXT[receipt.verdict] ?? { cls: "warn", word: receipt.verdict, line: "" };
  const lines = readLog(receiptDir, receipt);
  const labels = voterLabels(receipt);
  const matched = receipt.phases.filter((p) => phaseOutcome(p).match).length;
  const judgeMissing = receipt.phases.filter((p) => p.criteria.some(judgeErrored)).length;
  const app = receipt.subject.app === "." ? "repository root" : receipt.subject.app;
  const models = receipt.models
    .map((m) => `<dt>${esc(m.role)}</dt><dd>${esc(modelName(m.model))} <span class="sub">${esc(providerName(m.provider))} · <span class="mono">${esc(m.model)}</span></span>${m.provider === "baseten" ? ` <span class="badge">open weights</span>` : ""}</dd>`)
    .join("");
  const refs = receipt.phases
    .map((p) => `<dt>${esc((PHASES[p.phase] ?? { title: p.phase }).title)}</dt><dd class="mono" title="${esc(p.sha ?? "")}">${esc(p.ref)} @ ${esc(short(p.sha))}</dd>`)
    .join("");
  const nav = [`<a href="#summary">Summary</a>`, `<a href="#subject">Subject</a>`, `<a href="#criteria">Criteria</a>`,
    ...receipt.phases.map((p) => `<a href="#phase-${esc(p.phase)}">${esc((PHASES[p.phase] ?? { title: p.phase }).title)}</a>`),
    `<a href="#verify">Verify</a>`].join("");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>Attest receipt · ${esc(v.word)} · ${esc(app)}</title>
<style>
${STYLE}</style></head>
<body>
<header class="top"><div class="wrap">
  <div class="brand">${LOGO}<span>Attest</span><span class="sub">Proof-of-fix receipt · ${esc(app)}</span></div>
  <div class="top-meta"><span title="${esc(receipt.created_at)}">${esc(readableUtc(receipt.created_at))}</span><span class="stamp ${v.cls}">${esc(receipt.verdict.replace("_", " "))}</span></div>
</div></header>
<nav class="toc" aria-label="Sections"><div class="wrap">${nav}</div></nav>
<main class="wrap">
${receipt.replay ? `<p class="replay"><b>Replay.</b> Model responses came from the recorded cassette <span class="mono">${esc(receipt.replay.cassette)}</span> (sha256 ${esc(short(receipt.replay.sha256, 12))}…), not the live API. The app, browser, clicks, code checks and receipt were real; the models' decisions were re-applied, not re-made.</p>` : ""}
<section id="summary" class="summary">
  <div class="card verdict">
    <div class="label">Verdict</div>
    <div class="vrow"><span class="vword ${v.cls}">${esc(v.word)}</span><span class="chip">${matched} of ${receipt.phases.length} phases as expected</span></div>
    <p class="lede">${esc(v.line)}</p>${judgeMissing ? `<p class="replay"><b>Judge did not vote in ${judgeMissing} of ${receipt.phases.length} phases.</b> Its error is recorded in the receipt; ${judgeAbstained(receipt) ? "this verdict rests on the remaining votes" : "a required judge that gives no vote makes those criteria inconclusive"}.</p>` : ""}
    <ul class="reasons">${receipt.reasons.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>${causesBlock(receipt)}
    <div class="tiles">${receipt.phases.map(phaseTile).join("")}</div>
  </div>
  <aside class="card integrity" aria-label="Integrity">
    <h3>Integrity</h3>
    <dl class="kv">
      <dt>Signature</dt><dd>Ed25519 · <span class="mono" title="${esc(receipt.signature.public_key)}">${esc(keyFingerprint(receipt.signature.public_key))}</span></dd>
      <dt>Event log</dt><dd>${esc(receipt.log.entries)} entries · ${abbr(receipt.log.head, 12)}</dd>
      <dt>Artifacts</dt><dd>${esc(Object.keys(receipt.artifacts).length)} files, each hashed</dd>
      <dt>Criteria</dt><dd>${abbr(receipt.subject.criteria_sha256, 12)}</dd>
      <dt>Run</dt><dd>${receipt.replay ? "replay of a recorded run" : "live"}</dd>
    </dl>
    <div class="cmd">npm run attest -- verify receipt.json</div>
  </aside>
</section>
<h2 id="subject">Subject</h2>
<section class="subject">
  <div class="card panel"><dl class="kv">
    <dt>Run from</dt><dd class="mono">${esc(receipt.subject.repo ?? "local")}</dd>
    <dt>App</dt><dd>${esc(app)}</dd>
    ${refs}
  </dl></div>
  <div class="card panel"><dl class="kv">${models}</dl></div>
</section>
<h2 id="criteria">Acceptance criteria · human-approved</h2>
<ul class="crit-list">${criteriaHtml}</ul>
<h2>The proof</h2>
${receipt.phases.map((p) => phaseSection(p, lines, labels)).join("")}
<h2 id="verify">Check this receipt yourself</h2>
<section class="card panel verify">
  <div><h3>What <span class="mono">attest verify</span> checks — no model calls</h3><ul>
    <li>The Ed25519 signature over the receipt</li>
    <li>The hash-chained event log, its head and its length</li>
    <li>The hash of every screenshot, video and the criteria copy</li>
    <li>That the verdict follows from the recorded votes</li></ul></div>
  <div><h3>What a receipt does not prove</h3><ul>
    <li>That the capture environment was honest — it shows nothing changed after capture; the signature detects a later edit</li>
    <li>Who ran it — the key is created on the machine that ran the proof</li>
    <li>Anything beyond the stated criteria</li></ul></div>
</section>
</main>
<footer><div class="wrap">This page is generated from <span class="mono">receipt.json</span> and is not itself signed. The receipt is the source of truth — if they ever disagree, trust <span class="mono">attest verify</span>.</div></footer>
</body></html>
`;
}

/** Renders index.html next to a receipt and returns its path. */
export function writeReport(receiptPath: string): string {
  const path = resolve(receiptPath);
  const receipt = JSON.parse(readFileSync(path, "utf8").replace(/^﻿/, "")) as Receipt;
  const out = join(dirname(path), "index.html");
  writeFileSync(out, renderReport(receipt, dirname(path)));
  return out;
}

// ---- Proofs dashboard: one page listing every committed receipt (written by `verify-proofs --write-index`) ----

export interface ProofIndexEntry {
  path: string;                // folder of the receipt, relative to the dashboard, forward slashes
  receipt: Receipt;
  valid: boolean;              // result of verifyReceipt when the page was generated
}

const GROUPS: [RegExp, string][] = [[/^realworld\//, "Real-world"], [/^pr-/, "Pull requests"], [/^benchmark\//, "Benchmark"]];
const groupOf = (path: string): string => GROUPS.find(([re]) => re.test(path))?.[1] ?? "Other";

/** Pure: the dashboard HTML for a set of verified receipts, grouped and in the given order. */
export function renderProofsIndex(entries: ProofIndexEntry[]): string {
  const counts = new Map<string, number>();
  for (const e of entries) counts.set(e.receipt.verdict, (counts.get(e.receipt.verdict) ?? 0) + 1);
  const valid = entries.filter((e) => e.valid).length;
  const chips = ["PROVEN", "PROVEN_UNCHECKED", "INCONCLUSIVE", "REJECTED"]
    .filter((v) => counts.has(v))
    .map((v) => `<span class="stamp ${(VERDICT_TEXT[v] ?? { cls: "warn" }).cls}">${esc(v.replace("_", " "))} · ${counts.get(v)}</span>`)
    .join(" ");
  const groups = [...new Set(entries.map((e) => groupOf(e.path)))];
  const tables = groups.map((g) => {
    const rows = entries.filter((e) => groupOf(e.path) === g).map((e) => {
      const r = e.receipt;
      const v = VERDICT_TEXT[r.verdict] ?? { cls: "warn" };
      const phases = r.phases.map((p) => {
        const { meta, match } = phaseOutcome(p);
        const cls = match ? "ok" : p.result === "inconclusive" ? "warn" : "bad";
        return `<span class="ph ${cls}" title="${esc(meta.title)}: expected ${esc(meta.expected)}, observed ${esc(p.result)}">${esc(meta.title)} ${match ? "✓" : p.result === "inconclusive" ? "!" : "✗"}</span>`;
      }).join("");
      const judge = r.models.find((m) => m.role === "judge");
      return `<tr>
  <td><a href="${esc(e.path)}/index.html">${esc(e.path)}</a><div class="sub">${esc(r.subject.app === "." ? "repository root" : r.subject.app)}</div></td>
  <td><span class="stamp ${v.cls}">${esc(r.verdict.replace("_", " "))}</span></td>
  <td class="phs">${phases}</td>
  <td>${r.replay ? "replay" : "live"}</td>
  <td>${judge ? `${esc(modelName(judge.model))}${judge.provider === "baseten" ? ` <span class="badge">open weights</span>` : ""}` : "—"}</td>
  <td class="nw" title="${esc(r.created_at)}">${esc(readableUtc(r.created_at).replace(", ", " · "))}</td>
  <td>${e.valid ? `<span class="pill ok">✓ valid</span>` : `<span class="pill bad">✗ invalid</span>`}</td>
</tr>`;
    }).join("");
    return `<h2>${esc(g)}</h2><div class="card tablewrap"><table class="ptable"><colgroup><col style="width:21%"><col style="width:15%"><col style="width:18%"><col style="width:6%"><col style="width:15%"><col style="width:15%"><col style="width:10%"></colgroup><thead><tr><th>Proof</th><th>Verdict</th><th>Phases</th><th>Run</th><th>Judge</th><th>Created</th><th>Receipt</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }).join("");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>Attest proofs · ${entries.length} signed receipts</title>
<style>
${STYLE}</style></head>
<body>
<header class="top"><div class="wrap">
  <div class="brand">${LOGO}<span>Attest</span><span class="sub">Proofs · every result in this repository is a signed receipt</span></div>
</div></header>
<main class="wrap">
<section class="card panel">
  <div class="label">Receipts</div>
  <div class="vrow"><span class="vword">${valid} of ${entries.length} valid</span><span class="chip">checked by <span class="mono">npm run verify-proofs</span> when this page was generated</span></div>
  <p class="lede">${chips}</p>
  <div class="cmd">npm run verify-proofs</div>
</section>
${tables}
</main>
<footer><div class="wrap">Generated from the receipts in this folder and not itself signed. Re-run <span class="mono">npm run verify-proofs</span> to check every receipt yourself — no key, no model calls.</div></footer>
</body></html>
`;
}
