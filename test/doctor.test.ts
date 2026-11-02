import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { loadConfig, type AttestConfig } from "../src/config.js";
import { loadCriteria } from "../src/criteria.js";
import {
  checkConfig,
  checkRef,
  checkRefs,
  credentialChecks,
  formatCheck,
  redactSecrets,
  renderDoctor,
  summaryLines,
} from "../src/doctor.js";
import { MODEL_IDS } from "../src/models.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const modelKey = "sk-doctor-MODEL-sentinel-9f3a2c";
const basetenKey = "sk-doctor-BASETEN-sentinel-77ab";

function sampleConfig(maxSteps = 25, judge = true): AttestConfig {
  return {
    app: { start: "node server.js", url: "http://localhost:$PORT", ready: "/", timeout_s: 90 },
    browser: { viewport: { width: 1280, height: 720 } },
    verifier: { max_steps: maxSteps, judge },
  };
}

test("formatCheck marks a pass and puts a failure's fix on the same line", () => {
  assert.equal(
    formatCheck({ ok: true, name: "refs", detail: "base demo/base abc1234" }),
    "✔ refs: base demo/base abc1234",
  );
  assert.equal(
    formatCheck({
      ok: false,
      name: "refs",
      detail: "base nope: fatal: Needed a single revision",
      fix: "pass a ref that resolves to a commit (git rev-parse --verify)",
    }),
    "✘ refs: base nope: fatal: Needed a single revision — pass a ref that resolves to a commit (git rev-parse --verify)",
  );
});

test("summary without Break names PROVEN_UNCHECKED, the routes, and the step cap", () => {
  const text = summaryLines({
    base: "demo/base",
    pr: "demo/fix",
    env: {},
    config: sampleConfig(),
  }).join("\n");

  assert.match(text, /what will run: Red \(demo\/base\) and Green \(demo\/fix\); no Break, so the best possible verdict is PROVEN_UNCHECKED/);
  assert.match(text, /Break: not supplied/);
  assert.match(text, /models required: verifier, ui if any criterion has expect\.visible, judge/);
  assert.match(text, new RegExp(`verifier meta/${MODEL_IDS.spark}`));
  assert.match(text, new RegExp(`judge meta/${MODEL_IDS.wonder}`));
  assert.match(text, /steps: max_steps 25, judge on/);
  assert.match(text, /no model was called/);
});

test("summary with Break names that ref and does not call the result PROVEN_UNCHECKED", () => {
  const text = summaryLines({
    base: "demo/base",
    pr: "demo/fix",
    breakRef: "demo/bad-fix",
    env: { BASETEN_API_KEY: basetenKey },
    config: sampleConfig(12, false),
    needsUi: true,
  }).join("\n");

  assert.match(text, /Break \(demo\/bad-fix\)/);
  assert.match(text, /Break: supplied/);
  assert.match(text, /models required: verifier, ui$/m);
  assert.equal(text.includes("PROVEN_UNCHECKED"), false);
  assert.match(text, new RegExp(`judge baseten/${MODEL_IDS.sparkOpen.replace("/", "\\/")}`));
  assert.match(text, /steps: max_steps 12, judge off/);
  assert.equal(text.includes(basetenKey), false);
  assert.doesNotMatch(text, /length/i);
});

test("summary says when the step cap is unknown", () => {
  const text = summaryLines({ base: "b", pr: "p", env: {} }).join("\n");
  assert.match(text, /steps: unavailable because attest.yml did not load/);
  assert.match(text, /no model was called/);
});

test("credential reporting says set and never includes the value or its length", () => {
  const checks = credentialChecks({ MODEL_API_KEY: modelKey, BASETEN_API_KEY: basetenKey });
  const text = JSON.stringify(checks);

  assert.equal(checks[0]?.detail, "MODEL_API_KEY set");
  assert.equal(checks[1]?.detail, "BASETEN_API_KEY set; judge route Spark Open on Baseten");
  assert.equal(text.includes(modelKey), false);
  assert.equal(text.includes(basetenKey), false);
  assert.equal(text.includes(String(modelKey.length)), false);
  assert.equal(text.includes(String(basetenKey.length)), false);
  assert.doesNotMatch(text, /length/i);
});

test("a missing Baseten key uses the judge fallback and is not a failure", () => {
  const checks = credentialChecks({ MODEL_API_KEY: modelKey });
  const text = JSON.stringify(checks);

  assert.equal(checks[0]?.ok, true);
  assert.equal(checks[1]?.ok, true);
  assert.equal(checks[1]?.detail, `BASETEN_API_KEY absent; judge route meta/${MODEL_IDS.wonder}`);
  assert.equal(text.includes(modelKey), false);
});

test("a blank model key counts as missing and is not printed", () => {
  const checks = credentialChecks({ MODEL_API_KEY: "   ", BASETEN_API_KEY: "" });
  assert.equal(checks[0]?.ok, false);
  assert.equal(checks[0]?.detail, "MODEL_API_KEY missing");
  assert.match(checks[1]?.detail ?? "", /BASETEN_API_KEY absent; judge route meta\//);
});

test("an invalid route override is a failure and its value is not echoed", () => {
  const secret = "sk-doctor-ROUTE-sentinel-aabb";
  const checks = credentialChecks({ MODEL_API_KEY: modelKey, ATTEST_ROUTE_JUDGE: secret });
  const text = JSON.stringify(checks);

  assert.equal(checks.some((check) => !check.ok && check.detail === "judge route override is invalid"), true);
  assert.equal(text.includes(secret), false);
  assert.equal(text.includes(modelKey), false);
});

test("renderDoctor redacts a credential that leaked into a detail", () => {
  const rendered = renderDoctor(
    {
      ok: false,
      checks: [{ ok: false, name: "server", detail: `log contained ${modelKey}`, fix: "fix the app" }],
      summary: ["no model was called"],
    },
    { MODEL_API_KEY: modelKey },
  );
  assert.equal(rendered.includes(modelKey), false);
  assert.match(rendered, /\[redacted\]/);
  assert.match(rendered, /no model was called/);
});

test("redactSecrets leaves text alone when no credential is set", () => {
  assert.equal(redactSecrets("MODEL_API_KEY set", {}), "MODEL_API_KEY set");
});

test("a bad ref fails with a fix and does not pretend to resolve", async () => {
  const check = await checkRef(repoRoot, "base", "attest-doctor-no-such-ref");
  assert.equal(check.ok, false);
  assert.match(check.detail, /attest-doctor-no-such-ref/);
  assert.match(check.fix ?? "", /git rev-parse --verify/);
});

test("a real ref prints a short sha", async () => {
  const check = await checkRef(repoRoot, "base", "demo/base");
  assert.equal(check.ok, true);
  assert.match(check.detail, /^base demo\/base [0-9a-f]{4,}$/);
});

test("a missing Break ref is a note, not a failure", async () => {
  const checks = await checkRefs(repoRoot, { base: "demo/base", pr: "demo/fix" });
  const note = checks.find((check) => check.detail.includes("break not supplied"));
  assert.ok(note);
  assert.equal(note.ok, true);
  assert.match(note.detail, /PROVEN_UNCHECKED/);
  assert.equal(checks.filter((check) => check.name === "refs" && check.ok).length, 3);
});

test("the checkout demo config and criteria load", () => {
  const { checks, config } = checkConfig({ repoRoot, appPath: "examples/checkout-demo" });
  assert.equal(checks.every((check) => check.ok), true);
  assert.equal(config?.verifier.max_steps, 25);
  assert.equal(config?.verifier.judge, true);
});

test("a bad attest.yml reports loadConfig's message exactly", async () => {
  const dir = await mkdtemp(join(tmpdir(), "attest-doctor-"));
  try {
    await writeFile(join(dir, "attest.yml"), "app: [\n", "utf8");
    await writeFile(join(dir, "criteria.yml"), "id: x\ncriteria:\n  - { id: c, given: g, when: w, then: t }\n", "utf8");

    let expected = "";
    try {
      loadConfig(dir);
    } catch (err) {
      expected = err instanceof Error ? err.message : String(err);
    }
    assert.notEqual(expected, "");

    const { checks, config } = checkConfig({ repoRoot, appPath: ".", configDir: dir });
    assert.equal(config, undefined);
    assert.equal(checks[0]?.ok, false);
    assert.equal(checks[0]?.detail, expected);
    assert.equal(checks[1]?.ok, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("a bad criteria file reports loadCriteria's message exactly", async () => {
  const dir = await mkdtemp(join(tmpdir(), "attest-doctor-"));
  const criteriaPath = join(dir, "criteria.yml");
  try {
    await writeFile(
      join(dir, "attest.yml"),
      "app:\n  start: node server.js\n  url: http://localhost:$PORT\n  ready: /\n",
      "utf8",
    );
    await writeFile(criteriaPath, "id: only\n", "utf8");

    let expected = "";
    try {
      loadCriteria(criteriaPath);
    } catch (err) {
      expected = err instanceof Error ? err.message : String(err);
    }

    const { checks, config } = checkConfig({ repoRoot, appPath: ".", configDir: dir, criteriaPath });
    assert.ok(config);
    assert.equal(checks[0]?.ok, true);
    assert.equal(checks[1]?.ok, false);
    assert.equal(checks[1]?.detail, expected);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
