// Node file-system backing for Cassette. All `node:` use in harness-core lives in
// files under this directory (T-002 owns adapters/node.ts, so the cassette backing
// gets its own file instead).
import { appendFileSync, readFileSync } from "node:fs";
import type { CassetteIo } from "../cassette.js";

export const nodeCassetteIo: CassetteIo = {
  readText: (path) => readFileSync(path, "utf8"),
  appendText: (path, text) => appendFileSync(path, text),
};
