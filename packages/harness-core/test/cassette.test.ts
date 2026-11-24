import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Cassette, CassetteExhaustedError } from "../src/cassette.js";
import { nodeCassetteIo } from "../src/index.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const CASSETTES = [
  "examples/checkout-widget/cassette.jsonl",
  "examples/checkout-demo/cassette.jsonl",
  "examples/realworld/board-enter/cassette.jsonl",
  "examples/realworld/board-focus-trap/cassette.jsonl",
  "examples/realworld/jspaint-attributes-focus/cassette.jsonl",
  "examples/realworld/roadmap-pulls/cassette.jsonl",
];

function withDeadFetch<T>(run: (state: { called: boolean }) => Promise<T> | T): Promise<T> {
  const realFetch = globalThis.fetch;
  const state = { called: false };
  (globalThis as Record<string, unknown>).fetch = (): Promise<never> => {
    state.called = true;
    throw new Error("network is disabled during replay");
  };
  return (async () => run(state))().finally(() => {
    globalThis.fetch = realFetch;
  });
}

for (const rel of CASSETTES) {
  test(`core Cassette replays ${rel} in order with no network`, async () => {
    await withDeadFetch(async (net) => {
      const path = join(root, rel);
      const lines = readFileSync(path, "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l) as { model: string; response: unknown });
      assert.ok(lines.length > 0, "cassette must not be empty");
      const cassette = Cassette.replay(path, nodeCassetteIo, { wait: false });
      for (const line of lines) {
        assert.deepEqual(await cassette.nextResponse(line.model), line.response);
      }
      // One extra call past the end throws a clear error.
      const lastModel = (lines.at(-1) as { model: string }).model;
      await assert.rejects(cassette.nextResponse(lastModel), (err: unknown) =>
        err instanceof CassetteExhaustedError && /no more responses/.test(err.message));
      assert.equal(net.called, false);
    });
  });
}

test("recorded lines keep the committed file format and replay back", async () => {
  const path = join(mkdtempSync(join(tmpdir(), "cassette-")), "test.jsonl");
  const recorder = Cassette.record(path, nodeCassetteIo);
  const first = { id: "r1", output_text: "hello" };
  const second = { id: "r2", output: [] };
  recorder.appendResponse("model-a", first, 12);
  recorder.appendResponse("model-a", second, 34);
  const lines = readFileSync(path, "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
  assert.deepEqual(lines, [
    { seq: 1, model: "model-a", ms: 12, response: first },
    { seq: 2, model: "model-a", ms: 34, response: second },
  ]);
  const cassette = Cassette.replay(path, nodeCassetteIo, { wait: false });
  assert.deepEqual(await cassette.nextResponse("model-a"), first);
  assert.deepEqual(await cassette.nextResponse("model-a"), second);
  await assert.rejects(cassette.nextResponse("model-a"), CassetteExhaustedError);
});

test("record and replay work with injected in-memory io, touching no files", async () => {
  const store = new Map<string, string>();
  const memoryIo = {
    readText: (path: string): string => store.get(path) ?? "",
    appendText: (path: string, text: string): void => store.set(path, (store.get(path) ?? "") + text),
  };
  const recorder = Cassette.record("memory.jsonl", memoryIo);
  recorder.appendResponse("model-a", { id: "x" }, 7);
  assert.equal(store.size, 1);
  const replaying = Cassette.replay("memory.jsonl", memoryIo, { wait: false });
  assert.deepEqual(await replaying.nextResponse("model-a"), { id: "x" });
  await assert.rejects(replaying.nextResponse("model-a"), CassetteExhaustedError);
});

test("cassette core never imports the file backing or a runtime module", () => {
  // cassette.ts runs wherever the caller runs (browser included): file access is
  // injected, so its own source must reference neither the adapters/ backing nor
  // any runtime module. (The test itself may use node: to read that source.)
  const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "src", "cassette.ts"), "utf8");
  assert.ok(!source.includes("adapters/"), "cassette.ts must not import from adapters/");
  assert.ok(!source.includes("node:"), "cassette.ts must not reference runtime modules");
});

test("record and replay modes refuse each other's operations", async () => {
  const path = join(mkdtempSync(join(tmpdir(), "cassette-")), "test.jsonl");
  writeFileSync(path, `${JSON.stringify({ seq: 1, model: "m", response: { id: "x" } })}\n`);
  const replaying = Cassette.replay(path, nodeCassetteIo, { wait: false });
  assert.throws(() => replaying.appendResponse("m", {}, 1), /recording/);
  const recording = Cassette.record(join(tmpdir(), `cassette-never-${process.pid}.jsonl`), nodeCassetteIo);
  await assert.rejects(recording.nextResponse("m"), /recording, not replay/);
});
