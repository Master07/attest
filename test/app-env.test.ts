import assert from "node:assert/strict";
import { test } from "node:test";
import { appEnv } from "../src/workspace.js";

const ours: NodeJS.ProcessEnv = {
  Path: "C:\\Windows\\system32",
  SystemRoot: "C:\\Windows",
  TEMP: "C:\\Temp",
  MODEL_API_KEY: "meta-secret",
  BASETEN_API_KEY: "baseten-secret",
  GH_TOKEN: "gh-secret",
  ATTEST_ROUTE_JUDGE: "baseten:x",
  ATTEST_REPLAY: "cassette.jsonl",
  AWS_SECRET_ACCESS_KEY: "aws-secret",
};

test("the app gets what a shell needs, under Windows' own spelling", () => {
  const env = appEnv(ours);
  assert.equal(env.Path, "C:\\Windows\\system32");
  assert.equal(env.SystemRoot, "C:\\Windows");
  assert.equal(env.TEMP, "C:\\Temp");
});

test("no API key, token, secret or Attest setting reaches the app", () => {
  const env = appEnv(ours);
  for (const name of ["MODEL_API_KEY", "BASETEN_API_KEY", "GH_TOKEN", "ATTEST_ROUTE_JUDGE", "ATTEST_REPLAY", "AWS_SECRET_ACCESS_KEY"]) {
    assert.equal(env[name], undefined, `${name} leaked`);
  }
  assert.ok(!Object.values(env).some((v) => v?.includes("secret")));
});

test("Attest's own extras (PORT, ATTEST_CONFIG_DIR) are passed and win", () => {
  const env = appEnv({ ...ours, PORT: "1" }, { PORT: "4321", ATTEST_CONFIG_DIR: "/cfg" });
  assert.equal(env.PORT, "4321");
  assert.equal(env.ATTEST_CONFIG_DIR, "/cfg");
});
