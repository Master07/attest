import assert from "node:assert/strict";
import { test } from "node:test";
import { renderPrComment } from "../src/prcomment.js";
import type { PrCommentOptions } from "../src/prcomment.js";
import type { PhaseRecord, Receipt } from "../src/receipt.js";
import type { CriterionVotes } from "../src/verdict.js";

const opts: PrCommentOptions = {
  receiptRelPath: "evidence/run-1/receipt.json",
  receiptSha256: `sha256:${"a".repeat(64)}`,
};

const failed: CriterionVotes = { cua: "fail", checks: "fail", sam: "n/a", judge: "fail" };
const passed: CriterionVotes = { cua: "pass", checks: "pass", sam: "n/a", judge: "pass" };

function phase(
  name: "red" | "green" | "break",
  result: "fail" | "pass",
  votes: CriterionVotes,
  observation: string,
  ref = `demo2/${name}`,
  sha: string | null = `${name}abcdef1234`,
): PhaseRecord {
  return {
    phase: name,
    ref,
    sha,
    status: "completed",
    error: null,
    steps: 2,
    model: "muse-spark-1.3",
    prompt_sha256: "p",
    criteria: [
      {
        id: "pay-completes",
        votes,
        result,
        reason: "",
        observation,
        evidence: [],
      },
    ],
    result,
    reason: "",
  };
}

function receipt(verdict: Receipt["verdict"], overrides: Partial<Receipt> = {}): Receipt {
  const base: Receipt = {
    version: "attest.receipt/0.1",
    mode: "fix",
    created_at: "2026-11-01T00:00:00.000Z",
    subject: {
      repo: "github.com/Master07/attest",
      app: "examples/checkout-widget",
      refs: {},
      criteria_path: "criteria.yml",
      criteria_sha256: "sha256:abc",
    },
    phases: [
      phase("red", "fail", failed, "Clicked Pay; the page stayed on the cart."),
      phase("green", "pass", passed, "Clicked Pay; the confirmation showed Order #1042."),
      phase("break", "fail", failed, "Clicked Pay; the page stayed on the cart."),
    ],
    verdict,
    reasons:
      verdict === "REJECTED"
        ? ["green: the fix does not meet the criteria"]
        : ["red failed, green passed, break failed"],
    models: [
      { role: "verifier", provider: "meta", model: "muse-spark-1.3" },
      { role: "judge", provider: "meta", model: "muse-wonder-1.0" },
    ],
    artifacts: {},
    log: { path: "events.jsonl", head: `sha256:${"b".repeat(64)}`, entries: 42 },
    signature: { alg: "ed25519", public_key: "PUBLICKEY0123456789abcdef", value: "SIG" },
  };
  return { ...base, ...overrides };
}

test("PROVEN: heading, meaning, three phase rows in order, and the receipt marker", () => {
  const out = renderPrComment(receipt("PROVEN"), opts);

  assert.match(out, /^## Attest: PROVEN ✅/m);
  assert.match(out, /The bug reproduced on the base, the fix works in the running app, and a wrong fix was rejected\./);
  assert.match(out, /\| red \| `demo2\/red` @ `redabcd` \| fail \(bug reproduces\) \| fail \|/);
  assert.match(out, /\| green \| `demo2\/green` @ `greenab` \| pass \| pass \|/);
  assert.match(out, /\| break \| `demo2\/break` @ `breakab` \| fail \(wrong fix rejected\) \| fail \|/);

  const red = out.indexOf("| red |");
  const green = out.indexOf("| green |");
  const brk = out.indexOf("| break |");
  assert.ok(red >= 0 && green > red && brk > green, "phases must be red, green, break");

  assert.match(out, /\| Phase \| Criterion \| Verifier \| Checks \| SAM \| Judge \| Result \|/);
  assert.match(out, /\| red \| `pay-completes` \| fail \| fail \| n\/a \| fail \| fail \|/);
  assert.ok(out.includes(`<!-- attest:receipt ${opts.receiptSha256} -->`));
});

test("REJECTED: heading and the first reason as the meaning", () => {
  const out = renderPrComment(receipt("REJECTED"), opts);
  assert.match(out, /^## Attest: REJECTED ❌/m);
  assert.ok(out.includes("green: the fix does not meet the criteria"));
});

test("PROVEN_UNCHECKED: distinct heading and meaning", () => {
  const out = renderPrComment(receipt("PROVEN_UNCHECKED"), opts);
  assert.match(out, /^## Attest: PROVEN_UNCHECKED ☑️/m);
  assert.ok(out.includes("no wrong fix was supplied"));
});

test("replay receipts carry a prominent banner; live receipts do not", () => {
  const replayed = renderPrComment(
    receipt("PROVEN", {
      replay: {
        cassette: "cassette.jsonl",
        sha256: "sha256:a191b30864fddcf12eb843e7a14a3fb4cae3c39d2531de861abee981e13aa148",
      },
    }),
    opts,
  );
  assert.ok(
    replayed.includes(
      "> **Replay:** model responses came from a recorded cassette (`cassette.jsonl`, a191b30864fd), not live API calls.",
    ),
  );
  assert.ok(!renderPrComment(receipt("PROVEN"), opts).includes("**Replay:**"));
});

test("pipes and newlines in refs and observations are escaped; table columns stay intact", () => {
  const tricky = receipt("PROVEN");
  const first = tricky.phases[0];
  assert.ok(first !== undefined);
  first.ref = "feature|one\nbranch";
  const criterion = first.criteria[0];
  assert.ok(criterion !== undefined);
  criterion.observation = "line one\nline two | pipe";

  const out = renderPrComment(tricky, opts);
  assert.match(out, /`feature\\\|one branch`/);
  assert.ok(out.includes("line one line two \\| pipe"));

  const row = out.split("\n").find((line) => line.startsWith("| red |"));
  assert.ok(row !== undefined);
  assert.equal(row.split(/(?<!\\)\|/).length, 6, "four columns → six split parts");
});

test("rendering is deterministic", () => {
  const value = receipt("PROVEN");
  assert.equal(renderPrComment(value, opts), renderPrComment(value, opts));
});

test("the comment contains no local absolute path", () => {
  const out = renderPrComment(receipt("PROVEN"), opts);
  assert.doesNotMatch(out, /C:\\/);
  assert.ok(out.includes("evidence/run-1/receipt.json"));
});

test("observations are truncated to 300 characters with an ellipsis", () => {
  const long = receipt("PROVEN");
  const criterion = long.phases[0]?.criteria[0];
  assert.ok(criterion !== undefined);
  criterion.observation = "y".repeat(310);
  const out = renderPrComment(long, opts);
  assert.ok(out.includes(`${"y".repeat(300)}…`));
});

test("an oversized comment drops the observations block", () => {
  const huge = receipt("PROVEN");
  huge.phases = Array.from({ length: 200 }, (_, index) => {
    const kind: "red" | "green" | "break" = index % 3 === 0 ? "red" : index % 3 === 1 ? "green" : "break";
    const result = kind === "green" ? "pass" : "fail";
    const p = phase(kind, result, kind === "green" ? passed : failed, "z".repeat(300));
    return { ...p, ref: `demo2/${index}` };
  });

  const out = renderPrComment(huge, opts);
  assert.ok(out.length <= 60_000);
  assert.ok(out.includes("(observations omitted for length)"));
});
