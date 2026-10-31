import assert from "node:assert/strict";
import { test } from "node:test";
import { MODEL_IDS, pickRoute } from "../src/models.js";

const sparkOpen = { provider: "baseten", model: MODEL_IDS.sparkOpen };

test("judge falls back to Muse Wonder with no Baseten key and no replay", () => {
  assert.deepEqual(pickRoute("judge", false, {}), { provider: "meta", model: MODEL_IDS.wonder });
});

test("judge moves to Muse Spark Open when a Baseten key is set", () => {
  assert.deepEqual(pickRoute("judge", false, { BASETEN_API_KEY: "k" }), sparkOpen);
});

test("judge uses Muse Spark Open while replaying, so committed cassettes replay without a key", () => {
  assert.deepEqual(pickRoute("judge", false, { ATTEST_REPLAY: "cassette.jsonl" }), sparkOpen);
});

test("an explicit ATTEST_ROUTE_JUDGE still wins", () => {
  assert.deepEqual(
    pickRoute("judge", false, { BASETEN_API_KEY: "k", ATTEST_ROUTE_JUDGE: "meta:muse-wonder-1.0" }),
    { provider: "meta", model: "muse-wonder-1.0" },
  );
});

test("other roles are unaffected by a Baseten key", () => {
  assert.deepEqual(pickRoute("verifier", false, { BASETEN_API_KEY: "k" }), { provider: "meta", model: MODEL_IDS.spark });
});

test("the Spark Open ID is the one own Baseten accounts serve", () => {
  assert.equal(MODEL_IDS.sparkOpen, "meta-models/muse-spark-open");
});
