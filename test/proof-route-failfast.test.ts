/*
 * T-004 fix round 3: a misconfigured judge route must fail fast.
 *
 * runProof resolves model routes once, before the first phase starts, and
 * reuses that value for receipt.models. A route error therefore throws out of
 * runProof before any workspace starts, browser launches, or phase event is
 * logged. With no openai-compat override everything is unchanged.
 */

import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { CriteriaFile } from "../src/criteria.js";
import type { Receipt } from "../src/receipt.js";
import { RECEIPT_VERSION } from "../src/receipt.js";
// Static import: loads before registerHooks below runs, so the real module
// (which imports playwright) never passes through our load hook — same as
// test/judge-openai-compat.test.ts.
import { planSheets } from "../src/frames.js";

const CRITERIA: CriteriaFile = {
  id: "route-failfast-test",
  sha256: "unused-by-stub",
  path: "unused-by-stub.yml",
  criteria: [{
    id: "c-1",
    given: "a saved item",
    when: "the page reloads",
    then: "the saved item is visible",
  }],
};

type RunProof = (options: {
  repoRoot: string;
  appPath: string;
  base: string;
  pr: string;
  break?: string;
  criteriaPath?: string;
  configDir?: string;
  outDir?: string;
}) => Promise<{ dir: string; receipt: Receipt }>;

type PickRoute = (
  role: "verifier" | "ui" | "judge",
  contributor?: boolean,
  env?: NodeJS.ProcessEnv,
) => { provider: string; model: string };

const runtime = {
  criteriaPath: "",
  startWorkspaceCalls: 0,
  planSheets,
  composeSheets: async (_frames: Buffer[], _plan: number[][]): Promise<Buffer[]> => {
    throw new Error("unexpected composeSheets without an explicit test stub");
  },
  loadCriteria: (): CriteriaFile => ({ ...CRITERIA, path: runtime.criteriaPath }),
  loadConfig: () => ({
    app: { start: "unused", url: "http://127.0.0.1:$PORT", ready: "unused", timeout_s: 1 },
    browser: { viewport: { width: 800, height: 600 } },
    verifier: { max_steps: 1, judge: true },
  }),
  startWorkspace: async (options: { ref: string; phase: string }) => {
    runtime.startWorkspaceCalls += 1;
    return { sha: `${options.ref}-sha`, url: "http://127.0.0.1:3000", port: 3000, stop: async () => undefined };
  },
  launchBrowser: async () => ({
    videoError: null,
    open: async () => undefined,
    currentUrl: () => "http://127.0.0.1:3000/",
    urlHistory: () => ["http://127.0.0.1:3000/"],
    network: () => [],
    clicks: () => [],
    videoPath: async () => null,
    close: async () => undefined,
  }),
  runVerifier: async (options: { criteria: CriteriaFile; onScreenshot?: (step: number, png: Buffer) => void | Promise<void> }) => {
    await options.onScreenshot?.(0, Buffer.from("frame"));
    return {
      status: "completed",
      verdicts: options.criteria.criteria.map(({ id }) => ({ id, result: "pass" as const, evidence_step: 0, observation: "" })),
      steps: [],
      finalText: "",
      model: "muse-spark-1.3",
      promptSha256: "verifier-prompt",
      fallbacks: [],
    };
  },
  runAllChecks: (criteria: { id: string }[]) => criteria.map(({ id }) => ({ id, result: "n/a", outcomes: [] })),
};

const RUNTIME_GLOBAL = "__attestRouteFailfastRuntime";
Object.assign(globalThis, { [RUNTIME_GLOBAL]: runtime });
const mockSources = new Map<string, string>([
  ["attest-test:failfast-frames", `
    const runtime = globalThis[${JSON.stringify(RUNTIME_GLOBAL)}];
    export const planSheets = (...args) => runtime.planSheets(...args);
    export const composeSheets = (...args) => runtime.composeSheets(...args);
  `],
  ["attest-test:failfast-browser", `const runtime = globalThis[${JSON.stringify(RUNTIME_GLOBAL)}]; export const launchBrowser = (...args) => runtime.launchBrowser(...args);`],
  ["attest-test:failfast-sam", `
    export const judgeVisibility = () => { throw new Error("unexpected SAM visibility check"); };
    export const segment = () => { throw new Error("unexpected SAM segmentation"); };
  `],
  ["attest-test:failfast-checks", `const runtime = globalThis[${JSON.stringify(RUNTIME_GLOBAL)}]; export const runAllChecks = (...args) => runtime.runAllChecks(...args);`],
  ["attest-test:failfast-config", `const runtime = globalThis[${JSON.stringify(RUNTIME_GLOBAL)}]; export const loadConfig = (...args) => runtime.loadConfig(...args);`],
  ["attest-test:failfast-criteria", `const runtime = globalThis[${JSON.stringify(RUNTIME_GLOBAL)}]; export const loadCriteria = (...args) => runtime.loadCriteria(...args);`],
  ["attest-test:failfast-cua", `const runtime = globalThis[${JSON.stringify(RUNTIME_GLOBAL)}]; export const runVerifier = (...args) => runtime.runVerifier(...args);`],
  ["attest-test:failfast-workspace", `const runtime = globalThis[${JSON.stringify(RUNTIME_GLOBAL)}]; export const startWorkspace = (...args) => runtime.startWorkspace(...args);`],
  ["attest-test:failfast-report", `export const writeReport = () => undefined;`],
]);
const proofMocks = new Map([
  ["./browser.js", "attest-test:failfast-browser"],
  ["./sam.js", "attest-test:failfast-sam"],
  ["./checks.js", "attest-test:failfast-checks"],
  ["./config.js", "attest-test:failfast-config"],
  ["./criteria.js", "attest-test:failfast-criteria"],
  ["./cua.js", "attest-test:failfast-cua"],
  ["./workspace.js", "attest-test:failfast-workspace"],
  ["./report.js", "attest-test:failfast-report"],
]);
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "./frames.js" && context.parentURL?.includes("/src/judge.")) {
      return { url: "attest-test:failfast-frames", shortCircuit: true };
    }
    const mocked = context.parentURL?.includes("/src/proof.") ? proofMocks.get(specifier) : undefined;
    if (mocked !== undefined) return { url: mocked, shortCircuit: true };
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    const source = mockSources.get(url);
    if (source !== undefined) return { format: "module", source, shortCircuit: true };
    return nextLoad(url, context);
  },
});

async function loadRunProof(): Promise<RunProof> {
  const mod = await import("../src/proof.js") as Record<string, unknown>;
  assert.equal(typeof mod["runProof"], "function");
  return mod["runProof"] as RunProof;
}

async function loadPickRoute(): Promise<PickRoute> {
  const mod = await import("../src/models.js") as Record<string, unknown>;
  assert.equal(typeof mod["pickRoute"], "function");
  return mod["pickRoute"] as PickRoute;
}

const ROUTE_KEYS = [
  "ATTEST_ROUTE_JUDGE",
  "ATTEST_ROUTE_VERIFIER",
  "ATTEST_ROUTE_UI",
  "ATTEST_ROUTE_WORKER",
  "ATTEST_ROUTE_REASONING",
  "ATTEST_ROUTE_IMAGE",
  "ATTEST_OPENAI_COMPAT_BASE_URL",
  "ATTEST_OPENAI_COMPAT_KEY_ENV",
  "OPENAI_COMPAT_API_KEY",
  "BASETEN_API_KEY",
  "BASETEN_BASE_URL",
  "ATTEST_REPLAY",
] as const;

async function withProofEnv(
  env: NodeJS.ProcessEnv,
  run: (runProof: RunProof, root: string, criteriaPath: string) => Promise<void>,
): Promise<void> {
  const realFetch = globalThis.fetch;
  (globalThis as Record<string, unknown>).fetch = async (): Promise<Response> => {
    throw new Error("unexpected fetch: fail-closed");
  };
  const savedEnv = { ...process.env };
  for (const key of ROUTE_KEYS) delete process.env[key];
  Object.assign(process.env, env);
  const root = await mkdtemp(join(tmpdir(), "attest-route-failfast-"));
  try {
    const criteriaPath = join(root, "criteria.yml");
    await writeFile(criteriaPath, "id: route-failfast-test\n");
    runtime.criteriaPath = criteriaPath;
    runtime.startWorkspaceCalls = 0;
    process.env.ATTEST_KEY_PATH = join(root, "signing-key.pem");
    const runProof = await loadRunProof();
    await run(runProof, root, criteriaPath);
  } finally {
    await rm(root, { recursive: true, force: true });
    globalThis.fetch = realFetch;
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env, savedEnv);
  }
}

function proofArgs(root: string, criteriaPath: string, outDir: string) {
  return {
    repoRoot: root,
    appPath: ".",
    base: "base",
    pr: "pr",
    criteriaPath,
    configDir: root,
    outDir: join(root, outDir),
  };
}

test("missing openai-compat base URL rejects before any workspace starts", async () => {
  await withProofEnv({ ATTEST_ROUTE_JUDGE: "openai-compat:x" }, async (runProof, root, criteriaPath) => {
    await assert.rejects(runProof(proofArgs(root, criteriaPath, "evidence-missing")), {
      message: "openai-compat: set ATTEST_OPENAI_COMPAT_BASE_URL",
    });
    assert.equal(runtime.startWorkspaceCalls, 0, "startWorkspace must never be called");
  });
});

test("non-https openai-compat base URL rejects before any workspace starts", async () => {
  await withProofEnv(
    { ATTEST_ROUTE_JUDGE: "openai-compat:x", ATTEST_OPENAI_COMPAT_BASE_URL: "http://example.com" },
    async (runProof, root, criteriaPath) => {
      await assert.rejects(runProof(proofArgs(root, criteriaPath, "evidence-http")), {
        message: "openai-compat: base URL must use https: (http: is allowed only for 127.0.0.1)",
      });
      assert.equal(runtime.startWorkspaceCalls, 0, "startWorkspace must never be called");
    },
  );
});

test("no route override proceeds and receipt.models matches direct route resolution", async () => {
  await withProofEnv({}, async (runProof, root, criteriaPath) => {
    // Measure mainline route resolution first, in the same env runProof will see.
    const pickRoute = await loadPickRoute();
    const expected = [
      { role: "verifier", ...pickRoute("verifier", false, process.env) },
      ...(CRITERIA.criteria.some((c) => ((c as { expect?: { visible?: string[] } }).expect?.visible ?? []).length > 0)
        ? [{ role: "ui", ...pickRoute("ui", false, process.env) }]
        : []),
      ...(runtime.loadConfig().verifier.judge ? [{ role: "judge", ...pickRoute("judge", false, process.env) }] : []),
    ];
    const { receipt } = await runProof(proofArgs(root, criteriaPath, "evidence-ok"));
    assert.ok(runtime.startWorkspaceCalls > 0, "startWorkspace should be called without an override");
    assert.equal(receipt.version, RECEIPT_VERSION);
    assert.deepEqual(receipt.models, expected);
  });
});
