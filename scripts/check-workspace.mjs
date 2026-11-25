import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

try {
  require.resolve("@corbet/harness-core", { paths: [repoRoot] });
} catch {
  process.stderr.write("attest: run `npm install` (the dependency @corbet/harness-core isn't installed)\n");
  process.exit(1);
}
