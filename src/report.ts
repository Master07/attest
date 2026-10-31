import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { loadCriteria } from "./criteria.js";
import type { CriterionRecord, PhaseRecord, Receipt } from "./receipt.js";
import type { Vote } from "./verdict.js";

// Evidence page: a self-contained index.html rendered from receipt.json (no scripts, no network).
// It is a view, not evidence — it is written after signing and is not covered by the receipt.

const esc = (s: unknown): string => String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const short = (sha: string | null | undefined, n = 7): string => (sha ? sha.replace(/^sha256:/, "").slice(0, n) : "—");

const PHASES: Record<string, { title: string; role: string; expected: "fail" | "pass" }> = {
  red: { title: "Red", role: "Original code — the bug should reproduce", expected: "fail" },
  green: { title: "Green", role: "The fix — the criteria should pass", expected: "pass" },
  break: { title: "Break", role: "A wrong fix — Attest should reject it", expected: "fail" },
};

const VERDICT_TEXT: Record<string, { cls: string; line: string }> = {
  PROVEN: { cls: "ok", line: "The bug reproduced, the fix works in the running app, and a wrong fix was rejected." },
  PROVEN_UNCHECKED: { cls: "warn", line: "The bug reproduced and the fix works. No wrong fix was supplied, so the verifier's sensitivity is unchecked." },
  REJECTED: { cls: "bad", line: "The fix does not meet the criteria in the running app." },
  INCONCLUSIVE: { cls: "warn", line: "Attest could not establish a proof, so it certifies nothing." },
};

function voteCell(label: string, vote: Vote | "missing"): string {
  const cls = vote === "pass" ? "v-pass" : vote === "fail" ? "v-fail" : "v-na";
  const mark = vote === "pass" ? "✓" : vote === "fail" ? "✗" : "–";
  return `<div class="vote ${cls}"><span class="mark">${mark}</span><span class="vl">${esc(label)}</span><span class="vv">${esc(vote)}</span></div>`;
}

function criterionBlock(c: CriterionRecord): string {
  const images = c.evidence
    .map((e) => `<figure><a href="${esc(e)}"><img src="${esc(e)}" alt="${esc(e)}" loading="lazy"></a><figcaption>${esc(e.includes("reveal") ? "SAM 3.1 box + where the click landed" : "Screenshot the verifier cited")}</figcaption></figure>`)
    .join("");
  const notes = (c.notes ?? []).map((n) => `<li>${esc(n)}</li>`).join("");
  return `
    <div class="votes">
      ${voteCell("Verifier · Spark 1.3", c.votes.cua)}
      ${voteCell("Code checks", c.votes.checks)}
      ${voteCell("SAM 3.1", c.votes.sam)}
      ${voteCell("Judge", c.votes.judge)}
    </div>
    ${c.observation ? `<p class="obs"><span class="k">Verifier saw</span> ${esc(c.observation)}</p>` : ""}
    ${notes ? `<ul class="notes">${notes}</ul>` : ""}
    <div class="shots">${images}</div>`;
}

function phaseCard(p: PhaseRecord): string {
  const meta = PHASES[p.phase] ?? { title: p.phase, role: "", expected: "fail" as const };
  const asExpected = p.result === meta.expected;
  const badge = p.result === "pass" ? "s-pass" : p.result === "fail" ? "s-fail" : "s-warn";
  return `
  <article class="phase">
    <header>
      <div>
        <h3><span class="pname p-${esc(p.phase)}">${esc(meta.title)}</span> <span class="ref">${esc(p.ref)} @ ${esc(short(p.sha))}</span></h3>
        <p class="role">${esc(meta.role)}</p>
      </div>
      <div class="right">
        <span class="status ${badge}"><span class="dot"></span>${esc(p.result)}</span>
        <span class="expect ${asExpected ? "ok" : "bad"}">${asExpected ? "as expected" : `expected ${meta.expected}`}</span>
      </div>
    </header>
    ${p.error ? `<p class="err">Phase error: ${esc(p.error)}</p>` : ""}
    ${p.criteria.map(criterionBlock).join("")}
    <p class="small">${esc(p.steps)} verifier steps · ${esc(p.model ?? "—")} · prompt ${esc(short(p.prompt_sha256, 12))}</p>
  </article>`;
}

export function renderReport(receipt: Receipt, receiptDir: string): string {
  let criteriaHtml = "";
  try {
    const criteria = loadCriteria(join(receiptDir, receipt.subject.criteria_path));
    criteriaHtml = criteria.criteria
      .map((c) => `<li><span class="k">Given</span>${esc(c.given)} <span class="k">When</span>${esc(c.when)} <span class="k">Then</span>${esc(c.then)}</li>`)
      .join("");
  } catch {
    criteriaHtml = `<li>Criteria file unavailable.</li>`;
  }
  const v = VERDICT_TEXT[receipt.verdict] ?? { cls: "warn", line: "" };
  const models = receipt.models.map((m) => `<dt>${esc(m.role)}</dt><dd>${esc(m.model)}</dd>`).join("");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Attest receipt · ${esc(receipt.verdict)}</title>
<style>
:root{--paper:#f6f3ee;--card:#fffdf9;--ink:#191612;--ink-2:#443f38;--muted:#6f685e;--faint:#9b9387;--line:#e6dfd3;--line-2:#d9d1c2;
--ok:#1a6b45;--ok-bg:#eaf4ee;--bad:#a8271d;--bad-bg:#fbeeec;--warn:#836210;--warn-bg:#f8f1df;
--mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;--sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.55 var(--sans)}
.wrap{max-width:1100px;margin:0 auto;padding:0 20px}
.mast{padding:26px 0 18px;border-bottom:1px solid var(--line-2);display:flex;flex-wrap:wrap;gap:16px;justify-content:space-between;align-items:flex-start}
.brand{font-weight:700;letter-spacing:.16em;text-transform:uppercase;font-size:14px}.brand small{display:block;letter-spacing:.03em;text-transform:none;font-weight:400;color:var(--muted);font-size:12.5px;margin-top:4px}
.stamp{border:2px solid currentColor;border-radius:3px;padding:6px 14px;font:700 14px var(--mono);letter-spacing:.14em}
.stamp.ok{color:var(--ok)}.stamp.bad{color:var(--bad)}.stamp.warn{color:var(--warn)}
.lede{font-size:17px;color:var(--ink-2);margin:18px 0 6px}
.reasons{margin:0 0 4px;padding-left:18px;color:var(--muted);font-size:13.5px}
.grid{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid var(--line-2);border-radius:10px;overflow:hidden;background:var(--card);margin:18px 0}
@media(max-width:760px){.grid{grid-template-columns:repeat(2,1fr)}}
.grid div{padding:12px 14px;border-right:1px solid var(--line);border-bottom:1px solid var(--line)}
.grid dt{font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--faint)}.grid dd{margin:5px 0 0;font:12.5px var(--mono);word-break:break-all}
h2{font-size:13px;letter-spacing:.13em;text-transform:uppercase;color:var(--muted);margin:30px 0 12px;font-weight:600}
ul.crit{list-style:none;margin:0;padding:14px 16px;background:var(--card);border:1px solid var(--line-2);border-radius:10px}
ul.crit li{font-size:14.5px}.k{font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--faint);margin:0 6px 0 10px}ul.crit .k:first-child{margin-left:0}
.phase{background:var(--card);border:1px solid var(--line-2);border-radius:12px;padding:18px;margin-bottom:16px}
.phase header{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
.phase h3{margin:0;font-size:17px}.ref{font:12.5px var(--mono);color:var(--muted);font-weight:400}
.pname{display:inline-block;padding:1px 9px;border-radius:4px;color:#fff;font-size:13px;letter-spacing:.06em;text-transform:uppercase;margin-right:6px}
.p-red{background:#a8271d}.p-green{background:#1a6b45}.p-break{background:#5b4a87}
.role{margin:4px 0 0;color:var(--muted);font-size:13.5px}.right{display:flex;flex-direction:column;align-items:flex-end;gap:6px}
.status{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;border-radius:4px;padding:4px 9px;border:1px solid}
.status .dot{width:7px;height:7px;border-radius:50%;background:currentColor}
.s-pass{color:var(--ok);border-color:#bfe0cd;background:var(--ok-bg)}.s-fail{color:var(--bad);border-color:#ecc7c2;background:var(--bad-bg)}.s-warn{color:var(--warn);border-color:#e6dcc0;background:var(--warn-bg)}
.expect{font-size:12px}.expect.ok{color:var(--ok)}.expect.bad{color:var(--bad);font-weight:600}
.votes{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:14px 0 10px}@media(max-width:760px){.votes{grid-template-columns:repeat(2,1fr)}}
.vote{border:1px solid var(--line);border-radius:8px;padding:8px 10px;display:grid;grid-template-columns:20px 1fr;row-gap:2px}
.vote .mark{grid-row:span 2;font-weight:700}.vote .vl{font-size:12px;color:var(--muted)}.vote .vv{font:600 12.5px var(--mono)}
.v-pass{background:var(--ok-bg);color:var(--ok)}.v-fail{background:var(--bad-bg);color:var(--bad)}.v-na{color:var(--faint)}
.obs{margin:6px 0;font-size:14px}.obs .k{margin-left:0}.notes{margin:4px 0 10px;padding-left:18px;font-size:13px;color:var(--ink-2)}
.err{color:var(--bad);font-size:13.5px}.small{font-size:12px;color:var(--faint);margin:10px 0 0}
.shots{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media(max-width:760px){.shots{grid-template-columns:1fr}}
figure{margin:0;border:1px solid var(--line-2);border-radius:8px;overflow:hidden;background:#fff}figure img{display:block;width:100%}
figcaption{font-size:11.5px;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);padding:7px 10px;border-top:1px solid var(--line)}
.cmd{background:#241f19;color:#f0e9dd;border-radius:8px;padding:11px 13px;font:12.5px var(--mono);overflow:auto}
.kvs{display:grid;grid-template-columns:max-content 1fr;gap:6px 16px;font-size:13px;background:var(--card);border:1px solid var(--line-2);border-radius:10px;padding:14px 16px}
.kvs dt{color:var(--muted)}.kvs dd{margin:0;font:12.5px var(--mono);word-break:break-all}
footer{border-top:1px solid var(--line-2);margin-top:30px;padding:18px 0 40px;color:var(--faint);font-size:12.5px}
.replay{margin:16px 0 0;padding:10px 14px;border:1px solid #e6dcc0;background:var(--warn-bg);color:#5f4708;border-radius:9px;font-size:13.5px}
</style></head>
<body><div class="wrap">
<div class="mast">
  <div class="brand">Attest<small>Proof-of-fix receipt · ${esc(receipt.subject.app)}</small></div>
  <div class="stamp ${v.cls}">${esc(receipt.verdict.replace("_", " "))}</div>
</div>
${receipt.replay ? `<p class="replay"><b>Replay.</b> Model responses came from the recorded cassette <code>${esc(receipt.replay.cassette)}</code> (sha256 ${esc(short(receipt.replay.sha256, 12))}…), not the live API. The app, browser, clicks, code checks and receipt were real; the models' decisions were re-applied, not re-made.</p>` : ""}
<p class="lede">${esc(v.line)}</p>
<ul class="reasons">${receipt.reasons.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>
<dl class="grid">
  <div><dt>Repository</dt><dd>${esc(receipt.subject.repo ?? "local")}</dd></div>
  <div><dt>Created</dt><dd>${esc(receipt.created_at)}</dd></div>
  <div><dt>Criteria sha256</dt><dd>${esc(short(receipt.subject.criteria_sha256, 16))}…</dd></div>
  <div><dt>Event log</dt><dd>${esc(receipt.log.entries)} entries · ${esc(short(receipt.log.head, 12))}…</dd></div>
</dl>
<h2>Acceptance criteria (human-approved)</h2>
<ul class="crit">${criteriaHtml}</ul>
<h2>The proof</h2>
${receipt.phases.map(phaseCard).join("")}
<h2>Check this receipt yourself</h2>
<div class="cmd">npm run attest -- verify receipt.json</div>
<p class="small">Verification needs no model calls: it checks the Ed25519 signature, the hash-chained event log and its pinned head, every screenshot's hash, the criteria hash, and re-derives the verdict from the recorded votes.</p>
<dl class="kvs" style="margin-top:12px">${models}<dt>artifacts</dt><dd>${esc(Object.keys(receipt.artifacts).length)} files, each hashed</dd><dt>signing key</dt><dd>${esc(receipt.signature.public_key.slice(-24))}</dd></dl>
<footer>This page is generated from <code>receipt.json</code> and is not itself signed. The receipt is the source of truth — if they ever disagree, trust <code>attest verify</code>.</footer>
</div></body></html>
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
