import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { ConfigError, loadConfig, resolveUrl } from "../src/config.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const exampleApp = join(repoRoot, "examples", "checkout-demo");

async function withTempApp(yaml: string, run: (dir: string) => void | Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "attest-config-"));
  try {
    await writeFile(join(dir, "attest.yml"), yaml, "utf8");
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("loads the example app config", () => {
  const config = loadConfig(exampleApp);

  assert.deepEqual(config.app, {
    install: "npm install --no-audit --no-fund",
    start: "node server.js",
    url: "http://localhost:$PORT",
    ready: "/cart",
    timeout_s: 30,
  });
  assert.deepEqual(config.browser.viewport, { width: 1280, height: 720 });
  assert.deepEqual(config.verifier, { max_steps: 25, judge: true });
});

test("applies defaults when browser and verifier are missing", async () => {
  const yaml = [
    "app:",
    "  start: node server.js",
    "  url: http://localhost:$PORT",
    "  ready: /",
  ].join("\n");

  await withTempApp(yaml, (dir) => {
    const config = loadConfig(dir);
    assert.equal(config.app.timeout_s, 90);
    assert.equal(config.app.install, undefined);
    assert.deepEqual(config.browser.viewport, { width: 1280, height: 720 });
    assert.deepEqual(config.verifier, { max_steps: 25, judge: true });
  });
});

test("missing app.start names the field", async () => {
  const yaml = ["app:", "  url: http://localhost:$PORT", "  ready: /"].join("\n");

  await withTempApp(yaml, (dir) => {
    assert.throws(
      () => loadConfig(dir),
      (err: unknown) =>
        err instanceof ConfigError && err.message.includes("attest.yml") && err.message.includes("app.start"),
    );
  });
});

test("missing app section is an error", async () => {
  await withTempApp("browser:\n  viewport: { width: 800, height: 600 }\n", (dir) => {
    assert.throws(() => loadConfig(dir), ConfigError);
  });
});

test("wrong field types name the field", async () => {
  const yaml = [
    "app:",
    "  start: node server.js",
    "  url: http://localhost:$PORT",
    "  ready: /",
    "  timeout_s: soon",
  ].join("\n");

  await withTempApp(yaml, (dir) => {
    assert.throws(
      () => loadConfig(dir),
      (err: unknown) =>
        err instanceof ConfigError && err.message.includes("attest.yml") && err.message.includes("app.timeout_s"),
    );
  });
});

test("resolveUrl replaces every $PORT", () => {
  assert.equal(resolveUrl("http://localhost:$PORT", 4100), "http://localhost:4100");
  assert.equal(resolveUrl("http://localhost:$PORT/health", 4101), "http://localhost:4101/health");
});
