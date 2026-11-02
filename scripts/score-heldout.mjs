// Scores the held-out runs against the unsealed labels. No model calls, no network.
// usage: node scripts/score-heldout.mjs <heldout-labels.zip> <labels.json> <run-dir> [<run-dir> ...]
// Checks the zip against examples/heldout/SEALED.sha256 first; refuses to score if it doesn't match.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const [zip, labelsPath, ...runDirs] = process.argv.slice(2);
if (zip === undefined || labelsPath === undefined || runDirs.length === 0) {
  console.error("usage: node scripts/score-heldout.mjs <zip> <labels.json> <run-dir> [<run-dir> ...]");
  process.exit(2);
}

const sealed = readFileSync("examples/heldout/SEALED.sha256", "utf8").match(/^([0-9a-f]{64}) /m)?.[1];
const actual = createHash("sha256").update(readFileSync(zip)).digest("hex");
if (sealed === undefined || sealed !== actual) {
  console.error(`seal mismatch: SEALED.sha256 ${sealed ?? "(none)"}, zip ${actual}`);
  process.exit(1);
}

// The included run set, from MANIFEST.md "Evaluation run-set registration".
const IDS = ["C01", "C03", "C04", "C05", "C06", "C07", "C09", "C10", "C11", "C12"];

/** Accepts the label shapes a selector might write; anything else stops the script. */
function normalize(raw) {
  const out = new Map();
  const put = (id, v) => {
    const label = typeof v === "boolean" ? (v ? "correct" : "incorrect")
      : typeof v === "string" ? v.toLowerCase()
      : v?.label ?? (typeof v?.correct === "boolean" ? (v.correct ? "correct" : "incorrect") : undefined);
    if (label !== "correct" && label !== "incorrect") throw new Error(`unrecognised label for ${id}: ${JSON.stringify(v)}`);
    out.set(id, label);
  };
  const list = Array.isArray(raw) ? raw : Array.isArray(raw?.candidates) ? raw.candidates : undefined;
  if (list) for (const e of list) put(e.id ?? e.candidate, e);
  else for (const [id, v] of Object.entries(raw?.labels ?? raw)) if (/^C\d\d$/.test(id)) put(id, v);
  return out;
}

const labels = normalize(JSON.parse(readFileSync(labelsPath, "utf8")));
for (const id of IDS) if (!labels.has(id)) throw new Error(`no label for ${id}`);

const ACCEPT = { A: "PROVEN_UNCHECKED", B: "PROVEN" };
const rows = [];
const summary = [];
for (const dir of runDirs) {
  for (const wf of ["A", "B"]) {
    const t = { correct: { accepted: 0, rejected: 0, inconclusive: 0, n: 0 }, incorrect: { accepted: 0, rejected: 0, inconclusive: 0, n: 0 }, missing: 0 };
    for (const id of IDS) {
      const path = join(dir, `${id}-${wf}`, "receipt.json");
      const label = labels.get(id);
      if (!existsSync(path)) { t.missing++; rows.push([dir, wf, id, label, "(no receipt)", ""]); continue; }
      const r = JSON.parse(readFileSync(path, "utf8"));
      const outcome = r.verdict === ACCEPT[wf] ? "accepted" : r.verdict === "REJECTED" ? "rejected" : r.verdict === "INCONCLUSIVE" ? "inconclusive" : "other";
      if (outcome === "other") throw new Error(`${path}: unexpected verdict ${r.verdict} for workflow ${wf}`);
      t[label][outcome]++; t[label].n++;
      const right = label === "correct" ? outcome === "accepted" : outcome === "rejected";
      rows.push([dir, wf, id, label, r.verdict, outcome === "inconclusive" ? "no decision" : right ? "right" : "WRONG"]);
    }
    summary.push({ dir, wf, ...t });
  }
}

console.log("| Run | Workflow | Correct accepted | Correct rejected | Correct inconclusive | Incorrect accepted | Incorrect rejected | Incorrect inconclusive | Missing |");
console.log("|---|---|---|---|---|---|---|---|---|");
for (const s of summary) {
  const c = s.correct, i = s.incorrect;
  console.log(`| ${s.dir} | ${s.wf} | ${c.accepted}/${c.n} | ${c.rejected}/${c.n} | ${c.inconclusive}/${c.n} | **${i.accepted}/${i.n}** | ${i.rejected}/${i.n} | ${i.inconclusive}/${i.n} | ${s.missing} |`);
}
console.log("\n| Run | Workflow | Candidate | Label | Verdict | Outcome |\n|---|---|---|---|---|---|");
for (const r of rows) console.log(`| ${r.join(" | ")} |`);
