import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import type { Receipt } from "./receipt.js";
import { inconclusiveCauses } from "./causes.js";
import { judgeAbstained, judgeErrored, keyFingerprint, sha256File } from "./receipt.js";

// W1: render a signed receipt as a GitHub pull-request comment, and the small gh/git helpers
// the two CLI commands need. The renderer is pure: no I/O, no clock, no randomness.

export interface PrCommentOptions {
  receiptRelPath: string;      // relative to the repo root, forward slashes
  receiptSha256: string;       // "sha256:<hex>" of the receipt file
}

export interface PrInfo {
  number: number;
  url: string;
  baseRefName: string;
  headRefName: string;
  headRefOid: string;
}

const EMOJI: Record<Receipt["verdict"], string> = {
  PROVEN: "✅",
  PROVEN_UNCHECKED: "☑️",
  REJECTED: "❌",
  INCONCLUSIVE: "⚠️",
};

const EXPECTED: Record<string, string> = {
  red: "fail (bug reproduces)",
  green: "pass",
  break: "fail (wrong fix rejected)",
};

const MAX_COMMENT = 60_000;

/** Newlines and control characters collapse to spaces; HTML is escaped so model text stays text. */
function oneLine(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/\n+/g, " ")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function html(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** A table cell: pipes escaped, one line. */
function cell(text: string): string {
  return oneLine(text).replace(/\|/g, "\\|");
}

/** An inline code span: backticks removed, one line. */
function code(text: string): string {
  return `\`${oneLine(text).replace(/`/g, "")}\``;
}

/** A table cell that contains an inline code span: both escapes at once. */
function cellCode(text: string): string {
  return cell(code(text));
}

/** Model text quotes the app's page, so it must not ping users (`@name`) or link issues (`#12`) in a public comment. */
function inert(text: string): string {
  return text.replace(/@(?=\w)/g, "@​").replace(/#(?=\d)/g, "#​");
}


function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function meaning(receipt: Receipt): string {
  if (receipt.verdict === "PROVEN") {
    return "The bug reproduced on the base, the fix works in the running app, and a wrong fix was rejected.";
  }
  if (receipt.verdict === "PROVEN_UNCHECKED") {
    return "The bug reproduced and the fix works; no wrong fix was supplied, so the verifier's ability to reject one wasn't tested.";
  }
  return inert(html(oneLine(receipt.reasons[0] ?? "No reason was recorded in the receipt.")));
}

function replayBanner(receipt: Receipt): string {
  if (receipt.replay === undefined) return "";
  const hex = receipt.replay.sha256.replace(/^sha256:/, "").slice(0, 12);
  return `> **Replay:** model responses came from a recorded cassette (${code(basename(receipt.replay.cassette))}, ${hex}), not live API calls.\n`;
}

function phaseRows(receipt: Receipt): string {
  return receipt.phases
    .map((phase) => {
      const build = phase.sha === null ? "—" : `${cellCode(phase.ref)} @ ${cellCode(phase.sha.slice(0, 7))}`;
      const result = phase.error === null ? phase.result : `${phase.result} (${phase.error})`;
      return `| ${cell(phase.phase)} | ${build} | ${cell(EXPECTED[phase.phase] ?? "—")} | ${cell(result)} |`;
    })
    .join("\n");
}

function voteRows(receipt: Receipt): string {
  const rows: string[] = [];
  for (const phase of receipt.phases) {
    for (const criterion of phase.criteria) {
      rows.push(
        `| ${cell(phase.phase)} | ${cellCode(criterion.id)} | ${cell(criterion.votes.cua)} | ${cell(criterion.votes.checks)} | ${cell(criterion.votes.sam)} | ${cell(judgeErrored(criterion) ? "no vote (error)" : criterion.votes.judge)} | ${cell(criterion.result)} |`,
      );
    }
  }
  return rows.join("\n");
}

function observations(receipt: Receipt): string {
  const bullets = receipt.phases.map((phase) => {
    const text = phase.criteria[0]?.observation ?? "";
    const clean =
      text.trim() === ""
        ? "(no observation)"
        : inert(html(truncate(oneLine(text), 300))).replace(/\|/g, "\\|");
    return `- **${cell(phase.phase)}:** ${clean}`;
  });
  return [
    "<details>",
    "<summary>Verifier observations</summary>",
    "",
    ...bullets,
    "",
    "</details>",
  ].join("\n");
}

function checkItYourself(receipt: Receipt, opts: PrCommentOptions): string {
  const key = keyFingerprint(receipt.signature.public_key);
  const models = receipt.models
    .map((model) => code(`${model.role}: ${model.provider}/${model.model}`))
    .join(", ");
  return [
    "### Check it yourself",
    "",
    `- Receipt: ${code(opts.receiptRelPath)} (${code(opts.receiptSha256)})`,
    `- Event log: ${code(receipt.log.head)} (${receipt.log.entries} entries)`,
    `- Signing key fingerprint: ${code(key)}`,
    `- Models: ${models || "—"}`,
    `- Verify: ${code(`npm run attest -- verify ${opts.receiptRelPath}`)}`,
  ].join("\n");
}

function build(receipt: Receipt, opts: PrCommentOptions, includeObservations: boolean): string {
  const sections = [
    `## Attest: ${receipt.verdict} ${EMOJI[receipt.verdict]}`,
    "",
    meaning(receipt),
    ...inconclusiveCauses(receipt).flatMap((c, i) => [...(i === 0 ? ["", "**Why it's inconclusive**", ""] : []), `- **${c.title}** (${code(c.detail)}). Next: ${c.next}`]),
    ...(receipt.phases.some((p) => p.criteria.some(judgeErrored)) ? ["", `> **Judge did not vote in ${receipt.phases.filter((p) => p.criteria.some(judgeErrored)).length} of ${receipt.phases.length} phases** (error recorded in the receipt); ${judgeAbstained(receipt) ? "this verdict rests on the remaining votes" : "a required judge that gives no vote makes those criteria inconclusive"}.`] : []),
    "",
  ];
  if (receipt.replay !== undefined) sections.push(replayBanner(receipt));
  sections.push(
    "| Phase | Build | Expected | Result |",
    "|---|---|---|---|",
    phaseRows(receipt),
    "",
    "| Phase | Criterion | Verifier | Checks | SAM | Judge | Result |",
    "|---|---|---|---|---|---|---|",
    voteRows(receipt),
    "",
  );
  sections.push(includeObservations ? observations(receipt) : "<em>(observations omitted for length)</em>");
  sections.push(
    "",
    checkItYourself(receipt, opts),
    "",
    "<sub>Generated by Attest from a signed receipt. The receipt proves the evidence wasn't changed after capture; it does not prove how the app was set up.</sub>",
    `<!-- attest:receipt ${opts.receiptSha256} -->`,
    "",
  );
  return sections.join("\n");
}

/** GitHub-Markdown comment for a receipt. Same receipt + options → byte-identical output. */
export function renderPrComment(receipt: Receipt, opts: PrCommentOptions): string {
  const full = build(receipt, opts, true);
  return full.length > MAX_COMMENT ? build(receipt, opts, false) : full;
}

/** Reads a receipt from disk (BOM tolerated, like `attest verify`). */
export function readReceipt(path: string): Receipt {
  return JSON.parse(readFileSync(resolve(path), "utf8").replace(/^\uFEFF/, "")) as Receipt;
}

/** A repo-relative, forward-slashed path; a receipt outside the repo (or on another drive) uses its file name. */
export function repoRelativePath(receiptPath: string, repoRoot: string): string {
  const absolute = resolve(receiptPath);
  const relRaw = relative(resolve(repoRoot), absolute);
  if (relRaw === "" || relRaw.startsWith("..") || isAbsolute(relRaw)) return basename(absolute);
  return relRaw.split(sep).join("/");
}

/** Renders and writes `pr-comment.md` beside the receipt. Returns the comment path. */
export function writePrComment(receiptPath: string, receipt: Receipt, repoRoot: string): string {
  const absolute = resolve(receiptPath);
  const out = join(dirname(absolute), "pr-comment.md");
  writeFileSync(
    out,
    renderPrComment(receipt, { receiptRelPath: repoRelativePath(absolute, repoRoot), receiptSha256: sha256File(absolute) }),
    "utf8",
  );
  return out;
}

// ---------------------------------------------------------------------------
// gh / git helpers. Never called with --post by tests or by W1's self-checks.

const GIT_FALLBACK = "C:\\Program Files\\Git\\cmd\\git.exe";
const GH_FALLBACK = "C:\\Program Files\\GitHub CLI\\gh.exe";
const ghFallback = process.platform === "win32" ? GH_FALLBACK : undefined;
const gitFallback = process.platform === "win32" ? GIT_FALLBACK : undefined;

interface ToolResult {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: Error;
}

function runTool(command: string, args: string[], cwd: string, fallback?: string): ToolResult {
  let result = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (result.error !== undefined && (result.error as NodeJS.ErrnoException).code === "ENOENT" && fallback !== undefined) {
    result = spawnSync(fallback, args, { cwd, encoding: "utf8" });
  }
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    ...(result.error !== undefined ? { error: result.error } : {}),
  };
}

function expectOk(result: ToolResult, what: string): string {
  if (result.error !== undefined) throw new Error(`${what}: ${result.error.message}`);
  if (result.status !== 0) {
    const detail = result.stderr.trim() || result.stdout.trim() || `exit ${String(result.status)}`;
    throw new Error(`${what}: ${detail}`);
  }
  return result.stdout;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`gh pr view returned no ${field}`);
  return value;
}

/** `gh pr view <n>` with a clear error when gh is missing or not logged in. */
export function viewPr(number: string, repoRoot: string): PrInfo {
  const result = runTool(
    "gh",
    ["pr", "view", number, "--json", "number,url,baseRefName,headRefName,headRefOid"],
    repoRoot,
    ghFallback,
  );
  const stdout = expectOk(result, `gh pr view ${number} failed (is gh installed and logged in?)`);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new Error(`gh pr view ${number} returned invalid JSON`);
  }
  if (typeof parsed !== "object" || parsed === null) throw new Error(`gh pr view ${number} returned no pull request`);
  const p = parsed as Record<string, unknown>;
  if (typeof p["number"] !== "number") throw new Error(`gh pr view ${number} returned no number`);

  return {
    number: p["number"],
    url: requireString(p["url"], "url"),
    baseRefName: requireString(p["baseRefName"], "baseRefName"),
    headRefName: requireString(p["headRefName"], "headRefName"),
    headRefOid: requireString(p["headRefOid"], "headRefOid"),
  };
}

/** Fetches the PR's base and head into local `attest/pr-<n>/{base,head}` branches. */
export function fetchPrRefs(pr: PrInfo, repoRoot: string): { base: string; head: string } {
  const base = `attest/pr-${pr.number}/base`;
  const head = `attest/pr-${pr.number}/head`;

  expectOk(
    runTool("git", ["fetch", "origin", `${pr.baseRefName}:refs/heads/${base}`, "--force"], repoRoot, gitFallback),
    `git fetch ${pr.baseRefName} failed`,
  );
  expectOk(
    runTool("git", ["fetch", "origin", `pull/${pr.number}/head:refs/heads/${head}`, "--force"], repoRoot, gitFallback),
    `git fetch pull/${pr.number}/head failed`,
  );

  const fetched = expectOk(
    runTool("git", ["rev-parse", `refs/heads/${head}`], repoRoot, gitFallback),
    `git rev-parse ${head} failed`,
  ).trim();
  if (fetched !== pr.headRefOid) {
    throw new Error(
      `PR head moved: fetched ${fetched.slice(0, 7)}, gh reported ${pr.headRefOid.slice(0, 7)}; re-run`,
    );
  }
  return { base, head };
}

/** Posts the comment with `gh pr comment`. Only reachable through `--post`. */
export function publishComment(number: number, bodyFile: string, repoRoot: string): void {
  expectOk(
    runTool("gh", ["pr", "comment", String(number), "--body-file", bodyFile], repoRoot, ghFallback),
    `gh pr comment ${number} failed`,
  );
}
