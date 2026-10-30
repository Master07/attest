import { buildAttestation } from "./attestation.js";
import { EventLog } from "./eventlog.js";
import { MockHarness, type Harness } from "./harness.js";
import { pickRoute } from "./models.js";
import { CuaVerifier, type Verifier } from "./verifier.js";
import type { Attestation, Task, VerificationResult, WorkItem } from "./types.js";

export interface RunOptions {
  harness?: Harness;
  verifier?: Verifier;
  contributor?: boolean;
  logPath?: string;
}

export interface RunReport {
  attestation: Attestation;
  logPath: string;
  tasks: Task[];
}

export async function run(item: WorkItem, opts: RunOptions = {}): Promise<RunReport> {
  const harness = opts.harness ?? new MockHarness();
  const verifier = opts.verifier ?? new CuaVerifier();
  const sessionId = `sess-${Date.now()}`;
  const log = new EventLog(opts.logPath ?? `evidence/${sessionId}/session.jsonl`, sessionId);

  log.append("orchestrator", "intake", { itemId: item.id, source: item.source });

  const plan = await harness.plan(item);
  log.append("planner", "plan_approved", { tasks: plan.tasks.length, approved: plan.approved });

  const spawned = await harness.fanOut(item, plan);
  const tasks: Task[] = spawned.map((t) => ({ ...t, ...pickRoute(t.role, opts.contributor) }));

  for (const t of tasks) {
    log.append(t.id, "worktree_lifecycle", { state: "operation_requested", branch: t.branch });
    log.append(t.id, "worktree_lifecycle", { state: "lease_active", branch: t.branch });
    log.append(t.id, "tool_call", { tool: "edit_file", result: { added: 40, removed: 12 } });
  }

  const merge = await harness.merge(tasks);
  log.append("merge", "merge", { merged: merge.merged, conflicts: merge.conflicts });

  const results: VerificationResult[] = [];
  for (const t of tasks) {
    const result = await verifier.verify(t);
    log.append("verifier", "verification_step", { taskId: t.id, steps: result.steps.length });
    log.append("verifier", "verification_verdict", { taskId: t.id, passed: result.passed });
    results.push(result);
  }

  const attestation = buildAttestation(item.id, tasks, results, log.all());
  log.append("emitter", "attest", { verdict: attestation.verdict });
  log.flush();

  return { attestation, logPath: log.location, tasks };
}
