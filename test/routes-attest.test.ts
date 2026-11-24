import assert from "node:assert/strict";
import { test } from "node:test";
import { pickRoute, resolveProvider } from "../src/models.js";
import type { ModelRole } from "../src/types.js";

// Snapshot of Attest's REAL wiring (src/models.ts) recorded from main on 2026-11-24.
// Unlike packages/harness-core/test/routes.test.ts — which builds its own router with
// copied routes and would pass even if Attest's wiring were wrong — this file calls
// Attest's real exports and asserts against literal provider:model strings typed out
// below, never imported from src/models.js.

const ROLES: ModelRole[] = ["worker", "reasoning", "image", "ui", "verifier", "judge"];

// provider:model for every role under each environment. The worker row is the
// non-contributor route; the contributor variant is asserted separately.
const EXPECTED: Record<string, Record<ModelRole, string>> = {
  // No keys, no replay, no overrides: every role on its Meta default.
  none: {
    worker: "meta:muse-spark-1.3",
    reasoning: "meta:muse-wonder-1.0",
    image: "meta:muse-image-1.0",
    ui: "meta:sam-3.1",
    verifier: "meta:muse-spark-1.3",
    judge: "meta:muse-wonder-1.0",
  },
  // A Baseten key moves only the judge to open weights.
  baseten: {
    worker: "meta:muse-spark-1.3",
    reasoning: "meta:muse-wonder-1.0",
    image: "meta:muse-image-1.0",
    ui: "meta:sam-3.1",
    verifier: "meta:muse-spark-1.3",
    judge: "baseten:meta-models/muse-spark-open",
  },
  // A replay answers from the cassette the judge was recorded with: same as baseten.
  replay: {
    worker: "meta:muse-spark-1.3",
    reasoning: "meta:muse-wonder-1.0",
    image: "meta:muse-image-1.0",
    ui: "meta:sam-3.1",
    verifier: "meta:muse-spark-1.3",
    judge: "baseten:meta-models/muse-spark-open",
  },
  // An explicit ATTEST_ROUTE_JUDGE pins the judge even with no Baseten key.
  override: {
    worker: "meta:muse-spark-1.3",
    reasoning: "meta:muse-wonder-1.0",
    image: "meta:muse-image-1.0",
    ui: "meta:sam-3.1",
    verifier: "meta:muse-spark-1.3",
    judge: "meta:muse-wonder-1.0",
  },
};

const CONTRIBUTOR = "meta:muse-spark-1.3-contributor";

const ENVS: Record<string, NodeJS.ProcessEnv> = {
  none: {},
  baseten: { BASETEN_API_KEY: "k" },
  replay: { ATTEST_REPLAY: "cassette.jsonl" },
  override: { ATTEST_ROUTE_JUDGE: "meta:muse-wonder-1.0" },
};

// Env vars that influence routing. Each case clears them, applies its own, and
// restores process.env afterwards so cases never leak into each other.
const ROUTING_KEYS = ["ATTEST_REPLAY", "ATTEST_ROUTE_JUDGE", "BASETEN_API_KEY"];

function withCleanEnv(env: NodeJS.ProcessEnv, run: () => void): void {
  const saved = { ...process.env };
  try {
    for (const key of [...ROUTING_KEYS, ...Object.keys(process.env).filter((k) => k.startsWith("ATTEST_ROUTE_"))]) {
      delete process.env[key];
    }
    Object.assign(process.env, env);
    run();
  } finally {
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env, saved);
  }
}

const routeOf = (role: ModelRole): string => {
  const route = pickRoute(role);
  return `${route.provider}:${route.model}`;
};

for (const [name, env] of Object.entries(ENVS)) {
  test(`attest routes under env=${name} match the recorded snapshot`, () => {
    withCleanEnv(env, () => {
      const expected = EXPECTED[name];
      assert.ok(expected);
      for (const role of ROLES) assert.equal(routeOf(role), expected[role], role);
      assert.equal(routeOf("worker"), expected.worker);
      const contributor = pickRoute("worker", true);
      assert.equal(`${contributor.provider}:${contributor.model}`, CONTRIBUTOR);
    });
  });
}

test("attest replay needs no key", () => {
  withCleanEnv({ ATTEST_REPLAY: "cassette.jsonl" }, () => {
    assert.deepEqual(resolveProvider("meta"), { baseUrl: "replay://", apiKey: "replay" });
    assert.deepEqual(resolveProvider("baseten"), { baseUrl: "replay://", apiKey: "replay" });
  });
});
