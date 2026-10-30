import { run } from "./orchestrator.js";
import type { WorkItem } from "./types.js";

const [command = "run", ...rest] = process.argv.slice(2);
const body = rest.join(" ").trim() || "fix the failing checkout test and prove it works in the browser";

if (command !== "run") {
  console.error(`unknown command: ${command}`);
  process.exit(1);
}

const item: WorkItem = {
  id: `wi-${Date.now()}`,
  title: body.slice(0, 64),
  source: "issue",
  body,
};

const report = await run(item, { contributor: process.env.ATTEST_CONTRIBUTOR === "1" });

console.log(`work item : ${item.title}`);
console.log(`tasks     : ${report.tasks.length}`);
console.log(`models    : ${[...new Set(report.tasks.map((t) => `${t.provider}:${t.model}`))].join(", ")}`);
console.log(`event log : ${report.logPath}`);
console.log(`trace     : ${report.attestation.traceEvents} events`);
console.log(
  `diff      : ${report.attestation.diff.filesChanged} files  +${report.attestation.diff.added} -${report.attestation.diff.removed}`,
);
console.log(`evidence  : ${report.attestation.video}`);
console.log(`verdict   : ${report.attestation.verdict}`);
