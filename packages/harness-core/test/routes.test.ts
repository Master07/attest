import assert from "node:assert/strict";
import { test } from "node:test";
import { createRouter } from "../src/router.js";
import type { Router } from "../src/router.js";

// Route snapshot recorded from main (pre-extraction src/models.ts) on 2026-11-24:
// every role under 4 environments. The core router is built here with test-only env
// names, so this file never mentions a product variable; the resolved provider:model
// pairs must equal the recorded table exactly.

// Recorded table (provider:model for each role; worker also with contributor=true):
//   none:     worker/meta:muse-spark-1.3(+contrib meta:muse-spark-1.3-contributor)
//             reasoning/meta:muse-wonder-1.0 image/meta:muse-image-1.0 ui/meta:sam-3.1
//             verifier/meta:muse-spark-1.3 judge/meta:muse-wonder-1.0
//   baseten:   as none, except judge/baseten:meta-models/muse-spark-open
//   replay:    as baseten (judge/baseten:meta-models/muse-spark-open)
//   override:  as none, except judge/meta:muse-wonder-1.0 via the env override
const ROUTES = {
  worker: { provider: "meta", model: "muse-spark-1.3" },
  reasoning: { provider: "meta", model: "muse-wonder-1.0" },
  image: { provider: "meta", model: "muse-image-1.0" },
  ui: { provider: "meta", model: "sam-3.1" },
  verifier: { provider: "meta", model: "muse-spark-1.3" },
  judge: { provider: "meta", model: "muse-wonder-1.0" },
};
const SPARK_OPEN = { provider: "baseten", model: "meta-models/muse-spark-open" };
const CONTRIBUTOR = { provider: "meta", model: "muse-spark-1.3-contributor" };

function testRouter(): Router {
  return createRouter({
    envPrefix: "TEST_ROUTE_",
    routes: ROUTES,
    providers: {
      meta: { apiKeyEnv: "TEST_MODEL_API_KEY", baseUrlEnv: "TEST_META_API_BASE_URL", defaultBaseUrl: "https://api.meta.ai/v1" },
      baseten: { apiKeyEnv: "TEST_BASETEN_API_KEY", baseUrlEnv: "TEST_BASETEN_BASE_URL", defaultBaseUrl: "https://inference.baseten.co/v1" },
    },
    replayEnvVar: "TEST_REPLAY",
    openWeights: { role: "judge", provider: "baseten", route: SPARK_OPEN },
    contributorVariant: { role: "worker", route: CONTRIBUTOR },
  });
}

const strip = (r: { provider: string; model: string }): { provider: string; model: string } => ({
  provider: r.provider,
  model: r.model,
});

test("snapshot env=none: defaults for every role, contributor variant for the worker", () => {
  const router = testRouter();
  const env = {};
  for (const [role, expected] of Object.entries(ROUTES)) {
    const resolved = router.resolve(role, { env });
    assert.deepEqual(strip(resolved), expected);
    assert.equal(resolved.source, "default");
  }
  assert.deepEqual(strip(router.resolve("worker", { contributor: true, env })), CONTRIBUTOR);
});

test("snapshot env=baseten key: only the judge moves to open weights", () => {
  const router = testRouter();
  const env = { TEST_BASETEN_API_KEY: "k" };
  for (const [role, expected] of Object.entries(ROUTES)) {
    const resolved = router.resolve(role, { env });
    assert.deepEqual(strip(resolved), role === "judge" ? SPARK_OPEN : expected);
  }
  const judge = router.resolve("judge", { env });
  assert.equal(judge.source, "default");
  assert.deepEqual(strip(router.resolve("worker", { contributor: true, env })), CONTRIBUTOR);
});

test("snapshot env=replay: only the judge moves to open weights, sourced from the cassette", () => {
  const router = testRouter();
  const env = { TEST_REPLAY: "cassette.jsonl" };
  for (const [role, expected] of Object.entries(ROUTES)) {
    const resolved = router.resolve(role, { env });
    assert.deepEqual(strip(resolved), role === "judge" ? SPARK_OPEN : expected);
  }
  assert.equal(router.resolve("judge", { env }).source, "cassette");
  assert.equal(router.resolve("verifier", { env }).source, "default");
  // Replaying needs no keys.
  assert.deepEqual(router.resolveProvider("meta", env), { baseUrl: "replay://", apiKey: "replay" });
  assert.deepEqual(strip(router.resolve("worker", { contributor: true, env })), CONTRIBUTOR);
});

test("snapshot env=override: an explicit JUDGE override wins", () => {
  const router = testRouter();
  const env = { TEST_ROUTE_JUDGE: "meta:muse-wonder-1.0" };
  for (const [role, expected] of Object.entries(ROUTES)) {
    const resolved = router.resolve(role, { env });
    assert.deepEqual(strip(resolved), expected);
  }
  assert.equal(router.resolve("judge", { env }).source, "env");
  assert.deepEqual(strip(router.resolve("worker", { contributor: true, env })), CONTRIBUTOR);
});

test("an override for another role leaves the judge rule alone", () => {
  const router = testRouter();
  const env = { TEST_ROUTE_VERIFIER: "baseten:meta-models/muse-spark-open", TEST_BASETEN_API_KEY: "k" };
  assert.deepEqual(strip(router.resolve("verifier", { env })), SPARK_OPEN);
  assert.equal(router.resolve("verifier", { env }).source, "env");
  assert.deepEqual(strip(router.resolve("judge", { env })), SPARK_OPEN);
});

test("malformed overrides and unknown providers throw", () => {
  const router = testRouter();
  assert.throws(() => router.resolve("judge", { env: { TEST_ROUTE_JUDGE: "no-colon" } }), /must be "provider:model"/);
  assert.throws(() => router.resolve("judge", { env: { TEST_ROUTE_JUDGE: "other:model" } }), /unknown provider/);
  assert.throws(() => router.resolve("nope", { env: {} }), /unknown role/);
});
