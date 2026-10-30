import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { CriteriaError, loadCriteria } from "../src/criteria.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const exampleCriteria = join(repoRoot, "examples", "checkout-demo", "criteria.yml");

async function withTempFile(contents: string, run: (path: string) => void | Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "attest-criteria-"));
  const path = join(dir, "criteria.yml");
  try {
    await writeFile(path, contents, "utf8");
    await run(path);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const validCriteria = [
  "id: checkout-pay-button",
  "criteria:",
  "  - id: pay-completes",
  "    given: A cart with one item at /cart",
  "    when: The user clicks \"Pay\"",
  "    then: The order confirmation page shows an order number",
  "    expect:",
  "      url: /order-confirmation",
  "      network: { method: POST, path: /api/pay, status: 200 }",
  "      visible: [\"Pay button\"]",
  "",
].join("\n");

test("loads the example criteria", () => {
  const file = loadCriteria(exampleCriteria);

  assert.equal(file.id, "checkout-pay-button");
  assert.equal(file.criteria.length, 1);

  const criterion = file.criteria[0];
  assert.ok(criterion);
  assert.equal(criterion.id, "pay-completes");
  assert.equal(criterion.expect?.url, "/order-confirmation");
  assert.deepEqual(criterion.expect?.network, { method: "POST", path: "/api/pay", status: 200 });
  assert.deepEqual(criterion.expect?.visible, ["Pay button"]);
  assert.equal(file.path, resolve(exampleCriteria));
  assert.match(file.sha256, /^[0-9a-f]{64}$/);
});

test("LF and CRLF versions hash the same", async () => {
  const crlf = validCriteria.replace(/\n/g, "\r\n");

  let lfHash = "";
  await withTempFile(validCriteria, (path) => {
    lfHash = loadCriteria(path).sha256;
  });
  await withTempFile(crlf, (path) => {
    assert.equal(loadCriteria(path).sha256, lfHash);
  });
  assert.match(lfHash, /^[0-9a-f]{64}$/);
});

test("duplicate ids are rejected", async () => {
  const duplicated = validCriteria + validCriteria.split("\n").slice(2).join("\n");

  await withTempFile(duplicated, (path) => {
    assert.throws(
      () => loadCriteria(path),
      (err: unknown) => err instanceof CriteriaError && err.message.includes("pay-completes"),
    );
  });
});

test("empty criteria is rejected", async () => {
  await withTempFile("id: empty\ncriteria: []\n", (path) => {
    assert.throws(() => loadCriteria(path), CriteriaError);
  });
});

test("an empty visible list is accepted", async () => {
  const yaml = [
    "id: empty-visible",
    "criteria:",
    "  - id: a-criterion",
    "    given: x",
    "    when: y",
    "    then: z",
    "    expect:",
    "      visible: []",
    "",
  ].join("\n");

  await withTempFile(yaml, (path) => {
    const file = loadCriteria(path);
    assert.deepEqual(file.criteria[0]?.expect?.visible, []);
  });
});

test("missing then names the criterion", async () => {
  const broken = [
    "id: checkout-pay-button",
    "criteria:",
    "  - id: pay-completes",
    "    given: A cart with one item at /cart",
    "    when: The user clicks \"Pay\"",
    "",
  ].join("\n");

  await withTempFile(broken, (path) => {
    assert.throws(
      () => loadCriteria(path),
      (err: unknown) =>
        err instanceof CriteriaError && err.message.includes("pay-completes") && err.message.includes("then"),
    );
  });
});
